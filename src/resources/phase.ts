// Phase accessor (ADR-0061). Phase records the history of a record's phase transitions, and it is
// unlike the other 12 data resources in four ways — all of them decided in ADR-0061:
//
//   1. **No alias prefix and no `P_`.** Its aliases are bare (`Id` / `Resource` / `Date` / …), so
//      the descriptor carries `prefix: ""` and the generic factory qualifies through `qualify`
//      (案1a). The primary key is `Id`, not `P_Id` — hence `idAlias`.
//   2. **Read requires `resource=`.** Which upper resource's history to read is a *parameter*, not
//      a `condition`. `of(name)` binds it once and every call inherits it (案2a), so a caller
//      cannot forget it: `t.phase.search(...)` does not exist.
//   3. **`System[Department]`** appears in three fields (案3a).
//   4. **Write has a latest-phase rule** (the date must be newer than the current latest, etc.).
//      That depends on server-side state, so the library does not pre-judge it — PORTERS decides
//      and the failure comes back as a typed error (案4a, like Sales' `※`).
//
// Phase has no custom fields (fixed fields only) and no `Deleted` field, so it is absent from
// `CustomFieldResource` and carries no `P_Deleted` analogue.
//
// VERIFY(live): a `User`-typed field is requested with its sub-fields — `Owner(User.P_Id,…)` —
// because that is what the generic factory sends for all 13 resources. PORTERS' own Phase sample
// requests them **bare** (`field=Id,RegisteredBy,…,Owner,OwnerDepartment`) and does not show the
// parenthesised form for this resource. The response shape is the same either way, so if the
// parenthesised form is rejected, the fix is the request string only — docs/live-verification.md (LV-17).

import { createDataResource, type catalogMark } from "./core/data-resource";
import type {
  EmptyImages,
  GetOptions,
  GetRecord,
  ReadSelection,
  SearchRecord,
} from "./core/data-read";
import type { CreateInput, UpdateInput } from "./core/data-write";
import type { Without } from "../util/types";
import type { EmptyReferences, Expand } from "./core/expand";
import type { ImageOption } from "./core/image";
import type { BulkWriteResult } from "./core/bulk-write";
import type { FieldCatalog, ReadFieldAlias, ReadRecord } from "./core/catalog";
import type { Paging } from "./core/paging";
import type { ResourceDeps } from "./core/deps";
import type { ResourcePage, ResourcePageOf } from "./core/read";
import type { SearchQuery } from "./core/query";
import type { ResourceDescriptor } from "./core/descriptor";
import { RESOURCE_VALUES, type ResourceName } from "../porters/resource-list";

const FIELDS = {
  Id: "System[Id]",
  Resource: "Number",
  ResourceId: "Number",
  Phase: "Option",
  Date: "DateTime",
  Memo: "MultilineText",
  // 0 = past phase, 1 = the latest one.
  Recent: "Number",
  RegistrationDate: "System[DateTime]",
  RegisteredBy: "User",
  UpdateDate: "System[DateTime]",
  UpdatedBy: "User",
  Owner: "User",
  OwnerDepartment: "System[Department]",
  // Only present on a Phase attached to Process / Sales (docs/usage/reference resources/phase.md).
  // Reading them elsewhere simply yields nothing, like any unset field.
  JobOwner: "User",
  JobOwnerDepartment: "System[Department]",
  ResumeOwner: "User",
  ResumeOwnerDepartment: "System[Department]",
} as const satisfies FieldCatalog;

// Required on create per docs/usage/reference (resources/phase.md「新規必須」列): Id / Resource /
// ResourceId。`Id` はライブラリが供給し、`Resource` は `of(name)` が埋めるので、
// 呼び出し側に残るのは `ResourceId` だけ。
const REQUIRED_ON_CREATE = [
  "ResourceId",
] as const satisfies readonly (keyof typeof FIELDS)[];

/**
 * Phase's names + catalog. Exported for in-repo dev tooling — the fake server (ADR-0043) builds
 * Phase wire shapes from this very catalog, so the two cannot drift. Not re-exported from
 * `src/index.ts`, so it stays out of the published API.
 */
export const PHASE_DESCRIPTOR = {
  name: "Phase",
  path: "phase",
  // Bare aliases — see the module comment (ADR-0061 案1a).
  prefix: "",
  idAlias: "Id",
  fields: FIELDS,
} as const satisfies ResourceDescriptor;

/** A decoded Phase entry: known aliases, each requested field `value | null`. */
export type Phase = ReadRecord<typeof FIELDS>;
export type PhasePage = ResourcePage<typeof FIELDS>;
// Phase - Read does not list `keywords` / `itemstate` among its Input Variables — and that is not
// an editorial omission: of the 17 Read articles, the 11 common data resources list both (in the
// URL template *and* the table) and Phase / Attachment / the 5 masters list neither (ADR-0076).
// Sending an unlisted parameter can fail the whole Read (Result Code 100 / 102), so the query type
// leaves them out.
//
// VERIFY(live): whether PORTERS ignores them or rejects the call is still unknown (LV-25 in
// docs/live-verification.md). The runtime is unchanged — a key forced in through a cast is still
// sent — so a live contract can settle it without patching the library. If PORTERS accepts them,
// putting them back is additive.
type PhaseUnsupportedQuery = "keywords" | "itemstate";

// keywords / itemstate を外す判断は ADR-0076。
/**
 * Phase's Read query: the common vocabulary **minus `keywords` / `itemstate`**, which
 * `Phase - Read` does not list.
 */
export type PhaseSearchQuery = Omit<
  SearchQuery<typeof FIELDS>,
  PhaseUnsupportedQuery
> & { [K in PhaseUnsupportedQuery]?: never };

/** Fields for `create`: `ResourceId` required (`Id` and `Resource` are supplied for you). */
export type PhaseCreateInput = CreateInput<
  typeof FIELDS,
  (typeof REQUIRED_ON_CREATE)[number]
>;
/** Fields for `update`: all optional (`null` omits, `""` clears a text field). */
export type PhaseUpdateInput = UpdateInput<typeof FIELDS>;

// 書き込みの入力から外す、of() で束ねた項目（ADR-0061。型で塞ぐ経緯は RV-47）。
type PhaseBound = "Resource";

// メソッドはこのファイルで書き出す（ADR-0100）。ほかのデータ系と違うのは、検索が keywords / itemstate を
// 受けないこと（ADR-0076）と、書き込みの入力が Resource を受けないこと（RV-47）の 2 つだけ。
// 違いの無いメソッドが揃っていることは data-resource-shapes.test.ts が確かめる。
/**
 * The Phase accessor for one bound resource — the same shape as every other resource, except that
 * `search` / `searchAll` do not take `keywords` / `itemstate` and the write inputs do
 * not take `Resource`: `of()` binds it, and supplying it again could only contradict the binding.
 */
export type PhaseResource = {
  /** @internal Type-level mark of the field catalog; never present at runtime. */
  [catalogMark]?(field: ReadFieldAlias<typeof FIELDS>): void;
  /**
   * Search the Phase history of the bound resource: resolves to one page of the entries matching
   * `query`. `field` picks the fields to read (omit it to read every known field), and
   * `count` / `start` choose the page. `keywords` / `itemstate` are not taken.
   */
  search<
    const E extends Expand<EmptyReferences> = EmptyReferences,
    const I extends ImageOption<typeof FIELDS> = EmptyImages,
    const FL extends readonly ReadFieldAlias<typeof FIELDS>[] | undefined =
      undefined,
  >(
    query?: PhaseSearchQuery & Paging & ReadSelection<FL, E, I>,
  ): Promise<
    ResourcePageOf<SearchRecord<typeof FIELDS, EmptyReferences, E, I, FL>>
  >;
  /**
   * Search every Phase entry of the bound resource matching `query`, page after page (200 entries
   * per request). Takes the same `field` as `search`.
   */
  searchAll<
    const E extends Expand<EmptyReferences> = EmptyReferences,
    const I extends ImageOption<typeof FIELDS> = EmptyImages,
    const FL extends readonly ReadFieldAlias<typeof FIELDS>[] | undefined =
      undefined,
  >(
    query?: PhaseSearchQuery & ReadSelection<FL, E, I>,
  ): AsyncIterable<SearchRecord<typeof FIELDS, EmptyReferences, E, I, FL>>;
  /**
   * Read one Phase entry by id; `undefined` when there is none. `field` picks the fields to read,
   * the same way it does for `search` (omit it to read every known field); the entry's `Id` is
   * always read, even when `field` leaves it out.
   */
  get<
    const E extends Expand<EmptyReferences> = EmptyReferences,
    const I extends ImageOption<typeof FIELDS> = EmptyImages,
    const FL extends readonly ReadFieldAlias<typeof FIELDS>[] | undefined =
      undefined,
  >(
    id: number,
    options?: GetOptions<typeof FIELDS, FL, E, I>,
  ): Promise<GetRecord<typeof FIELDS, EmptyReferences, E, I, FL> | undefined>;
  // 設計は ADR-0095（ID の突き合わせ・組分け・戻り値の形）。
  /**
   * Read many Phase entries by id. Resolves to an array in the order of `ids`, holding
   * `undefined` where no entry has that id — the same answer `get` gives for one id. A repeated
   * id gets the same entry at each of its positions; an empty `ids` sends no request.
   *
   * The ids are sent together (up to 200 per request, and as many as fit under the request size
   * limit), so this makes far fewer requests than calling `get` for each id. Takes the same
   * options as `get`; narrowing `field` shortens each request, so more ids fit in one.
   *
   * Every entry that comes back is checked against the ids that were asked for. If PORTERS
   * returns one that was not requested, the call rejects instead of returning it.
   */
  getMany<
    const E extends Expand<EmptyReferences> = EmptyReferences,
    const I extends ImageOption<typeof FIELDS> = EmptyImages,
    const FL extends readonly ReadFieldAlias<typeof FIELDS>[] | undefined =
      undefined,
  >(
    ids: readonly number[],
    options?: GetOptions<typeof FIELDS, FL, E, I>,
  ): Promise<
    (GetRecord<typeof FIELDS, EmptyReferences, E, I, FL> | undefined)[]
  >;
  /**
   * Create one Phase entry for the bound resource; resolves to the newly assigned id. `Resource`
   * is filled from the binding and cannot be supplied.
   */
  create(input: Without<PhaseCreateInput, PhaseBound>): Promise<number>;
  /** Update one Phase entry by id; resolves to that id. `Resource` cannot be supplied. */
  update(
    id: number,
    input: Without<PhaseUpdateInput, PhaseBound>,
  ): Promise<number>;
  // 一括書き込みの設計は ADR-0041 / F-4。
  /**
   * Create many Phase entries in one call. Auto-batched to ≤200 entries and under the request
   * size cap. **Not atomic** — inspect the `BulkWriteResult`: per-entry failures are returned
   * (`failed` / `hasFailures`), not thrown. Only a whole-request failure throws (with the
   * already-written count). Batching is non-idempotent: a full retry after a mid-run failure may
   * duplicate creates. Empty input sends no request.
   */
  createMany(
    inputs: Without<PhaseCreateInput, PhaseBound>[],
  ): Promise<BulkWriteResult>;
  /**
   * Update many Phase entries by id in one call. Auto-batched like `createMany`; per-entry
   * failures are returned in the `BulkWriteResult`, not thrown.
   */
  updateMany(
    items: { id: number; fields: Without<PhaseUpdateInput, PhaseBound> }[],
  ): Promise<BulkWriteResult>;
};

// of(resource) で束ねる形は ADR-0061 案2a、名前を文字列 union にするのは同 案5b。
/**
 * Phase is reached through the resource whose history you want:
 *
 * ```ts
 * const phases = t.phase.of("client");
 * await phases.search({ condition: { ResourceId: { eq: 20001 } } });
 * ```
 *
 * The name is the accessor's own spelling ({@link ResourceName}) — `of(5)` and `of("clinet")`
 * are compile errors.
 */
export type PhaseAccessor = {
  of(resource: ResourceName): PhaseResource;
};

export const createPhaseAccessor = (deps: ResourceDeps): PhaseAccessor => ({
  of: (resource) => {
    // One binding, two places PORTERS wants it: `resource=` on Read and the `Resource` field on
    // Write. Both are filled from here, so neither can be forgotten or contradicted.
    const value = RESOURCE_VALUES[resource];
    return createDataResource(
      {
        ...PHASE_DESCRIPTOR,
        requiredOnCreate: REQUIRED_ON_CREATE,
        readParams: { resource: String(value) },
        writeDefaults: { Resource: value },
      },
      deps,
    );
  },
});
