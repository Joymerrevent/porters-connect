// Sales accessor (ADR-0004/0005/0011/0019): Read (search / searchAll / get) + Write
// (create / update) over the generic resource factory. Only the Data-Type catalog and
// names are Sales-specific; the static Sales / input types derive from the catalog
// (ADR-0019). Sales ties the whole chain together — it references Client, Recruiter, Job,
// Contract, Candidate and Resume, and every one of them is expandable (ADR-0058).
//
// **Why the six references are not in `requiredOnCreate`** — ADR-0083 draws the line: only the
// `●` (unconditionally required) column becomes a type-level requirement, and PORTERS marks
// these six `※` (conditionally required) in docs/usage/reference resources/sales.md. The `※`
// here is a dependency chain —
//   Sales.P_Job -> Sales.P_Recruiter -> Sales.P_Client <- Sales.P_Contract
// (setting a lower resource requires its upper ones), plus P_Candidate and P_Resume must be
// given together on create. A flat required-list cannot express that, so the library sends what
// it is given and lets PORTERS arbitrate. The chain is spelled out for callers in
// docs/usage/topics/limits.md; why we do not encode it is in ADR-0083.
// VERIFY(live): the conditions are doc-only, and so is *how* PORTERS refuses a violation —
// whether it comes back as a distinguishable Result Code or is silently accepted in part.
// docs/live-verification.md (LV-28).
//
// `P_ClientOwner` / `P_RecruiterOwner` / `P_JobOwner` / `P_CandidateOwner` / `P_ResumeOwner`
// are Field Type `Reference` (16) — display-only mirrors of the referenced record's owner,
// with no value of their own — so they are deliberately absent from the catalog, like Job's.

import {
  createDataResource,
  type catalogMark,
  type CreateInput,
  type EmptyImages,
  type GetOptions,
  type GetRecord,
  type ReadSelection,
  type SearchRecord,
  type UpdateInput,
} from "./core/data-resource";
import type {
  EmptyCatalog,
  FieldCatalog,
  Paging,
  ReadFieldAlias,
  ReadRecord,
  ResourceDeps,
  ResourcePage,
  ResourcePageOf,
} from "./core/read";
import type { EmptyReferences, Expand, ReferenceMap } from "./core/expand";
import type { ImageOption } from "./core/image";
import type { BulkWriteResult } from "./core/bulk-write";
import type { SearchQuery } from "./core/query";
import type { ResourceDescriptor } from "./core/descriptor";
import { CANDIDATE_DESCRIPTOR } from "./candidate";
import { CLIENT_DESCRIPTOR } from "./client";
import { CONTRACT_DESCRIPTOR } from "./contract";
import { JOB_DESCRIPTOR } from "./job";
import { RECRUITER_DESCRIPTOR } from "./recruiter";
import { RESUME_DESCRIPTOR } from "./resume";
import type { ResourceName } from "../porters/resource-list";

const FIELDS = {
  P_Id: "System[Id]",
  P_Owner: "User",
  P_Client: "System[Reference]",
  P_Recruiter: "System[Reference]",
  P_Job: "System[Reference]",
  P_Contract: "System[Reference]",
  P_Candidate: "System[Reference]",
  P_Resume: "System[Reference]",
  P_RegistrationDate: "System[DateTime]",
  P_RegisteredBy: "User",
  P_UpdateDate: "System[DateTime]",
  P_UpdatedBy: "User",
  P_Phase: "Option",
  P_PhaseDate: "DateTime",
  P_PhaseMemo: "MultilineText",
  // Currency -> Number (Field Type and Data Type are different axes — see contract.ts).
  P_SalesAmount: "Number",
  P_RecordDate: "Date",
  P_EnterDate: "Date",
  P_BillingClient: "SinglelineText",
  P_BillingDivision: "SinglelineText",
  P_BillingTitle: "SinglelineText",
  P_BillingName: "SinglelineText",
  P_BillingZipcode: "SinglelineText",
  P_BillingCountry: "SinglelineText",
  P_BillingPrefecture: "SinglelineText",
  P_BillingCity: "SinglelineText",
  P_BillingStreet: "MultilineText",
  // 削除状態（"0" / "1"）。PORTERS が Data Type を与えていない項目＝`null`（ADR-0056。
  // 詳細は candidate.ts のコメント）。Read の field でのみ指定でき、型もそう振る舞う。
  P_Deleted: null,
} as const satisfies FieldCatalog;

// Required on create per docs/usage/reference (resources/sales.md「新規必須」列): P_Owner のみが `●`。
// 参照 6 項目は `※`＝条件付きなので入れない（理由は冒頭コメント）。
const REQUIRED_ON_CREATE = [
  "P_Owner",
] as const satisfies readonly (keyof typeof FIELDS)[];

// Expandable reference fields (ADR-0058) — all six, now that every target has a catalog.
// Candidate's alias prefix is `Person`, which the descriptor carries.
const REFERENCES = {
  P_Client: CLIENT_DESCRIPTOR,
  P_Recruiter: RECRUITER_DESCRIPTOR,
  P_Job: JOB_DESCRIPTOR,
  P_Contract: CONTRACT_DESCRIPTOR,
  P_Candidate: CANDIDATE_DESCRIPTOR,
  P_Resume: RESUME_DESCRIPTOR,
} as const satisfies ReferenceMap;

/**
 * Sales's names + standard catalog. Exported for in-repo dev tooling — the fake server
 * (ADR-0043) builds Sales wire shapes from this very catalog, so the two cannot drift.
 * Not re-exported from `src/index.ts`, so it stays out of the published API.
 */
export const SALES_DESCRIPTOR = {
  name: "Sales",
  path: "sales" satisfies ResourceName,
  prefix: "Sales",
  fields: FIELDS,
  references: REFERENCES,
} as const satisfies ResourceDescriptor;

/** A decoded Sales (a placement / revenue record): known `P_` fields, each `value | null`. */
export type Sales = ReadRecord<typeof FIELDS>;
export type SalesPage = ResourcePage<typeof FIELDS>;
/**
 * The Sales Read query. `C` is the declared custom-field catalog merged on, so a condition or an
 * order can name a custom field too.
 */
export type SalesSearchQuery<C extends FieldCatalog = EmptyCatalog> =
  SearchQuery<typeof FIELDS & C, typeof REFERENCES>;

// 条件付き必須を型で表さない決定は ADR-0083。
/**
 * Fields for `create`: only `P_Owner` is unconditionally required. The six references are
 * required *conditionally* (a dependency chain PORTERS validates server-side), so they stay
 * optional here — see docs/usage/topics/limits.md. `C` is the declared custom-field catalog
 * merged on; `CR` names the custom fields that are required on `create`.
 */
export type SalesCreateInput<
  C extends FieldCatalog = EmptyCatalog,
  CR extends keyof C = never,
> = CreateInput<typeof FIELDS & C, (typeof REQUIRED_ON_CREATE)[number] | CR>;
/**
 * Fields for `update`: all optional (`null` omits, `""` clears a text field). `C` is the
 * declared custom-field catalog merged on.
 */
export type SalesUpdateInput<C extends FieldCatalog = EmptyCatalog> =
  UpdateInput<typeof FIELDS & C>;

// 公開の型の書き出しで繰り返す、利用者が宣言した項目を足した一覧。
type Fields<C extends FieldCatalog> = typeof FIELDS & C;

// メソッドはこのファイルで書き出す（ADR-0100）。データ系で揃っていることは
// data-resource-shapes.test.ts が確かめる。
/**
 * The Sales accessor. `C` is the declared custom-field catalog merged on; `CR` names the
 * custom fields that are required on `create`.
 */
export type SalesResource<
  C extends FieldCatalog = EmptyCatalog,
  CR extends keyof C = never,
> = {
  /** @internal Type-level mark of the field catalog; never present at runtime. */
  [catalogMark]?(field: ReadFieldAlias<Fields<C>>): void;
  /**
   * Search Sales records: resolves to one page of the records matching `query`. `field` picks
   * the fields to read (omit it to read every known field), `expand` reads referenced records
   * too, `image` picks an Image field's sub-fields, and `count` / `start` choose the page.
   */
  search<
    const E extends Expand<typeof REFERENCES> = EmptyReferences,
    const I extends ImageOption<Fields<C>> = EmptyImages,
    const FL extends readonly ReadFieldAlias<Fields<C>>[] | undefined =
      undefined,
  >(
    query?: SalesSearchQuery<C> & Paging & ReadSelection<FL, E, I>,
  ): Promise<
    ResourcePageOf<SearchRecord<Fields<C>, typeof REFERENCES, E, I, FL>>
  >;
  /**
   * Search every Sales record matching `query`, page after page (200 records per request).
   * Takes the same `field` / `expand` / `image` as `search`.
   */
  searchAll<
    const E extends Expand<typeof REFERENCES> = EmptyReferences,
    const I extends ImageOption<Fields<C>> = EmptyImages,
    const FL extends readonly ReadFieldAlias<Fields<C>>[] | undefined =
      undefined,
  >(
    query?: SalesSearchQuery<C> & ReadSelection<FL, E, I>,
  ): AsyncIterable<SearchRecord<Fields<C>, typeof REFERENCES, E, I, FL>>;
  /**
   * Read one Sales record by id; `undefined` when there is none. `field` picks the fields to
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
   * Read many Sales records by id. Resolves to an array in the order of `ids`, holding
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
  /** Create one Sales record; resolves to the newly assigned id. */
  create(input: SalesCreateInput<C, CR>): Promise<number>;
  /** Update one Sales record by id; resolves to that id. */
  update(id: number, input: SalesUpdateInput<C>): Promise<number>;
  // 一括書き込みの設計は ADR-0041 / F-4。
  /**
   * Create many Sales records in one call. Auto-batched to ≤200 records and under the request
   * size cap. **Not atomic** — inspect the `BulkWriteResult`: per-record failures are returned
   * (`failed` / `hasFailures`), not thrown. Only a whole-request failure throws (with the
   * already-written count). Batching is non-idempotent: a full retry after a mid-run failure may
   * duplicate creates. Empty input sends no request.
   */
  createMany(inputs: SalesCreateInput<C, CR>[]): Promise<BulkWriteResult>;
  /**
   * Update many Sales records by id in one call. Auto-batched like `createMany`; per-record
   * failures are returned in the `BulkWriteResult`, not thrown.
   */
  updateMany(
    items: { id: number; fields: SalesUpdateInput<C> }[],
  ): Promise<BulkWriteResult>;
};

export const createSalesResource = <C extends FieldCatalog = EmptyCatalog>(
  deps: ResourceDeps,
  custom?: C,
): SalesResource<C> => {
  // Custom U_/A_ aliases never collide with P_, so the merge is exactly `typeof FIELDS & C`;
  // the cast just names that intersection (defineFields already validated aliases — ADR-0023 D7).
  const fields = { ...FIELDS, ...custom } as typeof FIELDS & C;
  // `C` が型引数のままだと、共通の実装の型（DataResource）とこのファイルで書き出した型が同じだと
  // コンパイラが示しきれないので、ここで名前を付け替える（ADR-0100）。同じであることは
  // data-resource-shapes.test.ts が具体的な `C` で確かめる。
  return createDataResource(
    { ...SALES_DESCRIPTOR, fields, requiredOnCreate: REQUIRED_ON_CREATE },
    deps,
  ) as SalesResource<C>;
};
