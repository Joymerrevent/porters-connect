// Opportunity accessor (ADR-0004/0005/0011/0019): Read (search / searchAll / get) + Write
// (create / update) over the generic resource factory. Only the Data-Type catalog and
// names are Opportunity-specific; the static Opportunity / input types derive from the
// catalog (ADR-0019). A sales opportunity against a Client and one of its Recruiters.
//
// Opportunity is the newest resource in the API (Field List updated 2023-08-10) and the
// only data resource with **no `P_Deleted`** — PORTERS simply does not publish one. We do
// not invent it: the absence is the fact, and reference-catalog.test.ts checks both
// directions so neither a missing nor a phantom `P_Deleted` can slip in.

import { createDataResource, type catalogMark } from "./core/data-resource";
import type {
  EmptyImages,
  GetOptions,
  GetRecord,
  ReadSelection,
  SearchRecord,
} from "./core/requested-record";
import type { CreateInput, UpdateInput } from "./core/data-write";
import type {
  EmptyCatalog,
  FieldCatalog,
  ReadFieldAlias,
  ReadRecord,
} from "./core/catalog";
import type { Paging } from "./core/paging";
import type { ResourceDeps } from "./core/deps";
import type { ResourcePage, ResourcePageOf } from "./core/read";
import type { EmptyReferences, Expand, ReferenceMap } from "./core/expand";
import type { ImageOption } from "./core/image";
import type { BulkWriteResult } from "./core/bulk-write";
import type { SearchQuery } from "./core/query";
import type { ResourceDescriptor } from "./core/descriptor";
import { CLIENT_DESCRIPTOR } from "./client";
import { RECRUITER_DESCRIPTOR } from "./recruiter";
import type { ResourceName } from "../porters/resource-list";

const FIELDS = {
  P_Id: "System[Id]",
  P_Owner: "User",
  P_Client: "System[Reference]",
  P_Recruiter: "System[Reference]",
  P_RegistrationDate: "System[DateTime]",
  P_RegisteredBy: "User",
  P_UpdateDate: "System[DateTime]",
  P_UpdatedBy: "User",
  P_Phase: "Option",
  P_PhaseDate: "DateTime",
  P_PhaseMemo: "MultilineText",
  P_Position: "SinglelineText",
} as const satisfies FieldCatalog;

// Required on create per docs/usage/reference (resources/opportunity.md「新規必須」列): P_Owner /
// P_Client / P_Recruiter（P_Id は System[Id]＝lib 供給のため除外）。
const REQUIRED_ON_CREATE = [
  "P_Owner",
  "P_Client",
  "P_Recruiter",
] as const satisfies readonly (keyof typeof FIELDS)[];

// Expandable reference fields (ADR-0058) — both System[Reference] fields Opportunity carries.
const REFERENCES = {
  P_Client: CLIENT_DESCRIPTOR,
  P_Recruiter: RECRUITER_DESCRIPTOR,
} as const satisfies ReferenceMap;

/**
 * Opportunity's names + standard catalog. Exported for in-repo dev tooling — the fake server
 * (ADR-0043) builds Opportunity wire shapes from this very catalog, so the two cannot drift.
 * Not re-exported from `src/index.ts`, so it stays out of the published API.
 */
export const OPPORTUNITY_DESCRIPTOR = {
  name: "Opportunity",
  path: "opportunity" satisfies ResourceName,
  prefix: "Opportunity",
  fields: FIELDS,
  references: REFERENCES,
} as const satisfies ResourceDescriptor;

/** A decoded Opportunity (a sales opportunity): known `P_` fields, each `value | null`. */
export type Opportunity = ReadRecord<typeof FIELDS>;
export type OpportunityPage = ResourcePage<typeof FIELDS>;
/**
 * The Opportunity Read query. `C` is the declared custom-field catalog merged on, so a condition or an
 * order can name a custom field too.
 */
export type OpportunitySearchQuery<C extends FieldCatalog = EmptyCatalog> =
  SearchQuery<typeof FIELDS & C, typeof REFERENCES>;

/**
 * Fields for `create`: owner and both references required; `P_Id` / timestamps are not settable.
 * `C` is the declared custom-field catalog merged on; `CR` names the custom fields that are
 * required on `create`.
 */
export type OpportunityCreateInput<
  C extends FieldCatalog = EmptyCatalog,
  CR extends keyof C = never,
> = CreateInput<typeof FIELDS & C, (typeof REQUIRED_ON_CREATE)[number] | CR>;
/**
 * Fields for `update`: all optional (`null` omits, `""` clears a text field). `C` is the
 * declared custom-field catalog merged on.
 */
export type OpportunityUpdateInput<C extends FieldCatalog = EmptyCatalog> =
  UpdateInput<typeof FIELDS & C>;

// 公開の型の書き出しで繰り返す、利用者が宣言した項目を足した一覧。
type Fields<C extends FieldCatalog> = typeof FIELDS & C;

// メソッドはこのファイルで書き出す（ADR-0100）。データ系で揃っていることは
// data-resource-shapes.test.ts が確かめる。
/**
 * The Opportunity accessor. `C` is the declared custom-field catalog merged on; `CR` names the
 * custom fields that are required on `create`.
 */
export type OpportunityResource<
  C extends FieldCatalog = EmptyCatalog,
  CR extends keyof C = never,
> = {
  /** @internal Type-level mark of the field catalog; never present at runtime. */
  [catalogMark]?(field: ReadFieldAlias<Fields<C>>): void;
  /**
   * Search Opportunity records: resolves to one page of the records matching `query`. `field` picks
   * the fields to read (omit it to read every known field), `expand` reads referenced records
   * too, `image` picks an Image field's sub-fields, and `count` / `start` choose the page.
   */
  search<
    const E extends Expand<typeof REFERENCES> = EmptyReferences,
    const I extends ImageOption<Fields<C>> = EmptyImages,
    const FL extends readonly ReadFieldAlias<Fields<C>>[] | undefined =
      undefined,
  >(
    query?: OpportunitySearchQuery<C> & Paging & ReadSelection<FL, E, I>,
  ): Promise<
    ResourcePageOf<SearchRecord<Fields<C>, typeof REFERENCES, E, I, FL>>
  >;
  /**
   * Search every Opportunity record matching `query`, page after page (200 records per request).
   * Takes the same `field` / `expand` / `image` as `search`.
   */
  searchAll<
    const E extends Expand<typeof REFERENCES> = EmptyReferences,
    const I extends ImageOption<Fields<C>> = EmptyImages,
    const FL extends readonly ReadFieldAlias<Fields<C>>[] | undefined =
      undefined,
  >(
    query?: OpportunitySearchQuery<C> & ReadSelection<FL, E, I>,
  ): AsyncIterable<SearchRecord<Fields<C>, typeof REFERENCES, E, I, FL>>;
  /**
   * Read one Opportunity record by id; `undefined` when there is none. `field` picks the fields to
   * read, the same way it does for `search` (omit it to read every known field); the record's id
   * is always read, even when `field` leaves it out. `expand` reads referenced records too;
   * `image` picks an Image field's sub-fields — `get` is where asking for a `Content` belongs,
   * since it fetches one record rather than a page.
   */
  get<
    const E extends Expand<typeof REFERENCES> = EmptyReferences,
    const I extends ImageOption<Fields<C>> = EmptyImages,
    const FL extends readonly ReadFieldAlias<Fields<C>>[] | undefined =
      undefined,
  >(
    id: number,
    options?: GetOptions<Fields<C>, FL, E, I>,
  ): Promise<GetRecord<Fields<C>, typeof REFERENCES, E, I, FL> | undefined>;
  // 設計は ADR-0095（ID の突き合わせ・組分け・戻り値の形）。
  /**
   * Read many Opportunity records by id. Resolves to an array in the order of `ids`, holding
   * `undefined` where no record has that id — the same answer `get` gives for one id. A repeated
   * id gets the same record at each of its positions; an empty `ids` sends no request.
   *
   * The ids are sent together (up to 200 per request, and as many as fit under the request size
   * limit), so this makes far fewer requests than calling `get` for each id. Takes the same
   * options as `get`; narrowing `field` shortens each request, so more ids fit in one.
   *
   * Every record that comes back is checked against the ids that were asked for. If PORTERS
   * returns one that was not requested, the call rejects instead of returning it.
   */
  getMany<
    const E extends Expand<typeof REFERENCES> = EmptyReferences,
    const I extends ImageOption<Fields<C>> = EmptyImages,
    const FL extends readonly ReadFieldAlias<Fields<C>>[] | undefined =
      undefined,
  >(
    ids: readonly number[],
    options?: GetOptions<Fields<C>, FL, E, I>,
  ): Promise<(GetRecord<Fields<C>, typeof REFERENCES, E, I, FL> | undefined)[]>;
  /** Create one Opportunity record; resolves to the newly assigned id. */
  create(input: OpportunityCreateInput<C, CR>): Promise<number>;
  /** Update one Opportunity record by id; resolves to that id. */
  update(id: number, input: OpportunityUpdateInput<C>): Promise<number>;
  // 一括書き込みの設計は ADR-0041 / F-4。
  /**
   * Create many Opportunity records in one call. Auto-batched to ≤200 records and under the request
   * size cap. **Not atomic** — inspect the `BulkWriteResult`: per-record failures are returned
   * (`failed` / `hasFailures`), not thrown. Only a whole-request failure throws (with the
   * already-written count). Batching is non-idempotent: a full retry after a mid-run failure may
   * duplicate creates. Empty input sends no request.
   */
  createMany(inputs: OpportunityCreateInput<C, CR>[]): Promise<BulkWriteResult>;
  /**
   * Update many Opportunity records by id in one call. Auto-batched like `createMany`; per-record
   * failures are returned in the `BulkWriteResult`, not thrown.
   */
  updateMany(
    items: { id: number; fields: OpportunityUpdateInput<C> }[],
  ): Promise<BulkWriteResult>;
};

export const createOpportunityResource = <
  C extends FieldCatalog = EmptyCatalog,
>(
  deps: ResourceDeps,
  custom?: C,
): OpportunityResource<C> => {
  // Custom U_/A_ aliases never collide with P_, so the merge is exactly `typeof FIELDS & C`;
  // the cast just names that intersection (defineFields already validated aliases — ADR-0023 D7).
  const fields = { ...FIELDS, ...custom } as typeof FIELDS & C;
  // `C` が型引数のままだと、共通の実装の型（DataResource）とこのファイルで書き出した型が同じだと
  // コンパイラが示しきれないので、ここで名前を付け替える（ADR-0100）。同じであることは
  // data-resource-shapes.test.ts が具体的な `C` で確かめる。
  return createDataResource(
    { ...OPPORTUNITY_DESCRIPTOR, fields, requiredOnCreate: REQUIRED_ON_CREATE },
    deps,
  ) as OpportunityResource<C>;
};
