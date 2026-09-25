// The data resources' Write (create / update / createMany / updateMany): the inputs they take and
// the factory that sends them. `data-resource.ts` puts this together with the Read half
// (`data-read.ts`) into one accessor. The Write URL and reading the id back are shared with the
// Attachment accessor in `write.ts`; batching is `bulk-write.ts`.

import { PortersConfigError } from "../../errors";
import type { DataType } from "../../porters/data-type";
import {
  buildWriteXml,
  type WritableDataType,
  type WriteItem,
  type WriteValue,
  type WriteValueOf,
} from "../../xml/encode";
import type { FieldCatalog } from "./catalog";
import type { ResourceDeps } from "./deps";
import { runBulkWrite, type BulkWriteResult } from "./bulk-write";
import { guardImageWrite, guardNoImageInBulk } from "./image";
import type { ResourceDescriptor } from "./descriptor";
import { buildWriteUrl, firstWriteResultId } from "./write";

// Writable aliases: every field whose Data Type a user may write (excludes System[Id] /
// System[DateTime] — ADR-0016/0019).
type WritableKeys<F extends FieldCatalog> = {
  [K in keyof F]: F[K] extends WritableDataType ? K : never;
}[keyof F];

// 書き込み入力の形は ADR-0019 W2。
/**
 * Create input: the `requiredOnCreate` aliases are **required** (non-null); every
 * other writable field is optional (`null` omits). `P_Id` is supplied by the library — not here.
 */
export type CreateInput<F extends FieldCatalog, Req extends keyof F> = {
  [K in Req]: WriteValueOf<F[K]>;
} & {
  [K in Exclude<WritableKeys<F>, Req>]?: WriteValueOf<F[K]> | null;
};

/** Update input: every writable field optional (`null` omits, `""` clears). */
export type UpdateInput<F extends FieldCatalog> = {
  [K in WritableKeys<F>]?: WriteValueOf<F[K]> | null;
};

// `?: never` で塞ぐ経緯は RV-47（spread で束縛が矛盾する形）。使い道は Phase の受けないクエリのキー
// （ADR-0076）と束ねる項目（ADR-0061 / ADR-0080）。
/**
 * An object with `K` taken out — and **kept out**. `Omit` alone only stops a fresh object literal
 * (excess-property checking); a variable that happens to carry the key still assigns. Re-declaring
 * each removed key as `?: never` closes that hole, so the call fails whichever way the object was
 * built — including `create({ ...recordFromRead })`.
 */
export type Without<T, K extends keyof T> = Omit<T, K> & {
  [P in K]?: never;
};

/**
 * What the Write half needs: the resource's {@link ResourceDescriptor}, the aliases required on
 * `create`, and any field the resource writes on every record, independent of the caller. Phase is
 * the only user today — `of(resource)` binds which upper resource's history it writes, and PORTERS
 * wants that as the `Resource` field (ADR-0061 案2a).
 */
export type DataWriteConfig<
  F extends FieldCatalog,
  Req extends readonly (keyof F)[],
> = ResourceDescriptor<F> & {
  /**
   * Aliases required on `create` (PORTERS new-record requirements — ADR-0019 W2). Only the
   * aliases PORTERS marks `●` (unconditionally required) belong here; `※` (conditionally
   * required) fields stay optional and PORTERS arbitrates them (ADR-0083).
   */
  requiredOnCreate: Req;
  writeDefaults?: Readonly<Record<string, WriteValue>>;
};

/** `create` / `update` / `createMany` / `updateMany` for a data resource. */
export const createDataWriter = <
  const F extends FieldCatalog,
  const Req extends readonly (keyof F)[],
>(
  config: DataWriteConfig<F, Req>,
  deps: ResourceDeps,
) => {
  // The catalog is `as const` for the types; encode needs a runtime lookup.
  const fieldMap = new Map<string, DataType | null>(
    Object.entries(config.fields),
  );
  // `P_Id` unless the resource says otherwise (Phase uses `Id` — ADR-0061).
  const idAlias = config.idAlias ?? "P_Id";

  const writeUrl = (): string =>
    buildWriteUrl(deps.accessPoint, deps.partition, config.path);

  const firstWriteId = (body: string): number =>
    firstWriteResultId(body, config.path, config.name);

  // create forces P_Id=-1 (non-idempotent: a retry would duplicate); update forces
  // the target id (idempotent: re-applying the same write is safe). Forcing P_Id
  // after the spread means a caller-supplied P_Id never overrides it.
  // Fields the accessor itself contributes to every record (Phase's `Resource` — ADR-0061).
  //
  // The binding is **authoritative**: a caller who supplies one of these aliases can only be
  // contradicting it, so we refuse the write rather than pick a winner (RV-47). Silently dropping
  // the caller's value would be the other failure — a setting that looks applied and is not
  // (RV-10). The spread puts the defaults **last** as well, so even a value that reached here
  // through some other path cannot override the binding.
  const boundAliases = Object.keys(config.writeDefaults ?? {});
  const withDefaults = (item: WriteItem): WriteItem => {
    // `?: never` は `undefined` を許すので、**値が入っているときだけ**弾く（型と実行時を揃える）。
    const supplied = boundAliases.filter((alias) => item[alias] !== undefined);
    if (supplied.length > 0) {
      throw new PortersConfigError(
        `${config.name}: ${supplied.join(", ")} is set by the accessor and cannot be written`,
        {
          category: "config",
          hint: `The accessor already binds ${supplied.join(", ")} (e.g. t.phase.of("client")). Drop it from the input, or bind a different resource.`,
        },
      );
    }
    return { ...item, ...config.writeDefaults };
  };

  const write = async (
    item: WriteItem,
    idempotent: boolean,
  ): Promise<number> => {
    // An image is checked against PORTERS' own limits here and then sent with the ~15000-char
    // request guard lifted — a 2MB Base64 body can never fit under it (ADR-0064 論点3). The guard
    // is only lifted for a write that actually carries one, and only after those checks passed.
    const hasImage = guardImageWrite(item, fieldMap);
    return deps.requester.request(
      {
        method: "POST",
        url: writeUrl(),
        headers: {},
        body: buildWriteXml({
          resource: config.name,
          prefix: config.prefix,
          fields: fieldMap,
          items: [item],
        }),
      },
      firstWriteId,
      // Spread rather than `unboundedBody: hasImage`: a write with no image keeps the exact spec
      // it always had, so the opt-out shows up only where it was actually taken.
      { write: true, idempotent, ...(hasImage ? { unboundedBody: true } : {}) },
    );
  };

  // `async` for the exception contract: `withDefaults` runs while the arguments are evaluated,
  // i.e. before `write` is entered, so without it a refused bound alias (RV-47) would throw
  // synchronously instead of rejecting (ADR-0046). Found as RV-64.
  const create = async (input: CreateInput<F, Req[number]>): Promise<number> =>
    write(withDefaults({ ...input, [idAlias]: -1 }), false);

  const update = async (id: number, input: UpdateInput<F>): Promise<number> =>
    write(withDefaults({ ...input, [idAlias]: id }), true);

  // Bulk write (ADR-0041): map each input to a WriteItem with its P_Id (create = -1, update = id) —
  // mirroring single write — and hand the array to the batching executor. createMany is
  // non-idempotent (P_Id=-1), updateMany idempotent (targets ids).
  const target = {
    name: config.name,
    prefix: config.prefix,
    fields: fieldMap,
    partition: deps.partition,
  };
  // `async` for the exception contract: the arguments (URL build, per-item mapping) are evaluated
  // before `runBulkWrite` is entered, so without it a failure there would throw synchronously
  // instead of rejecting (ADR-0046).
  const createMany = async (
    inputs: CreateInput<F, Req[number]>[],
  ): Promise<BulkWriteResult> => {
    const records = inputs.map((input) =>
      withDefaults({ ...input, [idAlias]: -1 }),
    );
    guardNoImageInBulk(records, fieldMap, "createMany");
    return runBulkWrite(
      deps.requester,
      { ...target, url: writeUrl() },
      records,
      false,
    );
  };

  const updateMany = async (
    items: { id: number; fields: UpdateInput<F> }[],
  ): Promise<BulkWriteResult> => {
    const records = items.map(({ id, fields }) =>
      withDefaults({ ...fields, [idAlias]: id }),
    );
    guardNoImageInBulk(records, fieldMap, "updateMany");
    return runBulkWrite(
      deps.requester,
      { ...target, url: writeUrl() },
      records,
      true,
    );
  };

  return { create, update, createMany, updateMany };
};
