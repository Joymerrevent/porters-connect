// The data resources' Write (create / update / createMany / updateMany): the factory that sends
// them. The inputs they take are `write-record.ts`. `data-resource.ts` puts this together with the
// Read half (`read-data.ts`) into one accessor. The Write URL and reading the id back are shared
// with the Attachment accessor in `write.ts`; batching is `write-many.ts`.

import { PortersConfigError } from "../errors";
import { buildWriteXml, type WriteItem, type WriteValue } from "../xml/encode";
import { fieldTypesOf, type FieldCatalog } from "./catalog";
import type { ResourceDeps } from "./deps";
import { writeMany, type BulkWriteResult } from "./write-many";
import type { CreateInput, UpdateInput } from "./write-record";
import { guardImageWrite, guardNoImageInBulk } from "./image";
import { idAliasOf, type ResourceDescriptor } from "./descriptor";
import { buildWriteUrl, firstWriteResultId } from "./write";

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

// PORTERS reads this id on a Write item as "create a new record".
const NEW_RECORD = -1;

/** `create` / `update` / `createMany` / `updateMany` for a data resource. */
export const createDataWriter = <
  const F extends FieldCatalog,
  const Req extends readonly (keyof F)[],
>(
  config: DataWriteConfig<F, Req>,
  deps: ResourceDeps,
) => {
  const fieldMap = fieldTypesOf(config.fields);
  // Phase uses `Id` (ADR-0061).
  const idAlias = idAliasOf(config);

  const writeUrl = (): string =>
    buildWriteUrl(deps.accessPoint, deps.partition, config.path);

  const firstWriteId = (body: string): number =>
    firstWriteResultId(body, config.path, config.name);

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

  // One record to write: the caller's input, the accessor's bound fields, and the id — `NEW_RECORD`
  // for create (non-idempotent: a retry would duplicate), the target id for update (idempotent:
  // re-applying the same write is safe). The id goes on after the spread, so a caller-supplied
  // id never overrides it.
  const toItem = (input: object, id: number): WriteItem =>
    withDefaults({ ...input, [idAlias]: id });

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

  // Bulk write (ADR-0041): the records go to the batching executor as they are — same items as
  // a single write. An image cannot ride in a batch (ADR-0064 論点3), so that is refused first.
  const writeAll = (
    records: WriteItem[],
    method: "createMany" | "updateMany",
    idempotent: boolean,
  ): Promise<BulkWriteResult> => {
    guardNoImageInBulk(records, fieldMap, method);
    return writeMany(
      deps.requester,
      {
        name: config.name,
        prefix: config.prefix,
        fields: fieldMap,
        partition: deps.partition,
        url: writeUrl(),
      },
      records,
      idempotent,
    );
  };

  // `async` for the exception contract: `toItem` (and so the bound-alias check) runs while the
  // arguments are evaluated, before `write` / `writeMany` is entered, so without it a refused
  // bound alias (RV-47) would throw synchronously instead of rejecting (ADR-0046). Found as RV-64.
  const create = async (input: CreateInput<F, Req[number]>): Promise<number> =>
    write(toItem(input, NEW_RECORD), false);

  const update = async (id: number, input: UpdateInput<F>): Promise<number> =>
    write(toItem(input, id), true);

  const createMany = async (
    inputs: CreateInput<F, Req[number]>[],
  ): Promise<BulkWriteResult> =>
    writeAll(
      inputs.map((input) => toItem(input, NEW_RECORD)),
      "createMany",
      false,
    );

  const updateMany = async (
    items: { id: number; fields: UpdateInput<F> }[],
  ): Promise<BulkWriteResult> =>
    writeAll(
      items.map(({ id, fields }) => toItem(fields, id)),
      "updateMany",
      true,
    );

  return { create, update, createMany, updateMany };
};
