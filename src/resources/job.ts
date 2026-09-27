// Job accessor (ADR-0004/0005/0011/0019): built on the data resources' factory
// (`createDataResource`), which gives every data resource the same methods. Only the Data-Type
// catalog and names are Job-specific. P_Client / P_Recruiter are System[Reference] (Write = ID).
//
// Display-only Reference fields (P_Mail, P_*Reference — they mirror a Recruiter value and
// are not writable) are intentionally left out of the catalog: they read through as raw
// strings. Multi-select Option read returns every selected alias as `string[]` (ADR-0017).
// The static Job / input types derive from the catalog (ADR-0019).

import {
  createDataResource,
  type catalogMark,
} from "../accessor/data-resource";
import type {
  EmptyImages,
  GetOptions,
  GetRecord,
  ReadSelection,
  SearchRecord,
} from "../accessor/read-record";
import type { CreateInput, UpdateInput } from "../accessor/write-record";
import type {
  EmptyCatalog,
  FieldCatalog,
  ReadFieldAlias,
  ReadRecord,
} from "../accessor/catalog";
import type { Paging } from "../accessor/paging";
import type { PartitionBoundConnectionDeps } from "../accessor/deps";
import type { ResourcePage, ResourcePageOf } from "../accessor/resource-page";
import type { EmptyReferences, Expand, ReferenceMap } from "../accessor/expand";
import type { ImageOption } from "../accessor/image";
import type { BulkWriteResult } from "../accessor/write-many";
import type { SearchQuery } from "../accessor/query";
import type { ResourceDescriptor } from "../accessor/descriptor";
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
  P_Publish: "Option",
  P_JobCategorySummary: "MultilineText",
  P_JobCategory: "Option",
  P_IndustrySummary: "MultilineText",
  P_Industry: "Option",
  P_SalarySummary: "MultilineText",
  P_MinSalary: "Number",
  P_MaxSalary: "Number",
  P_AreaSummary: "MultilineText",
  P_Area: "Option",
  P_PayrollsText: "SinglelineText",
  P_Memo: "MultilineText",
  P_EmploymentPeriod: "MultilineText",
  // "P_WokingHours" is the alias as published by PORTERS (source typo); keep verbatim.
  P_WokingHours: "MultilineText",
  P_Holidays: "MultilineText",
  P_Benefits: "MultilineText",
  P_PubliclyTraded: "Option",
  P_SalesAmountText: "SinglelineText",
  P_EstablishmentDateText: "SinglelineText",
  P_CapitalText: "SinglelineText",
  P_EmploymentType: "Option",
  P_ExpectedAgeReason: "Option",
  // 削除状態（"0" / "1"）。PORTERS が Data Type を与えていない項目＝`null`（ADR-0056。
  // 詳細は candidate.ts のコメント）。Read の field でのみ指定でき、型もそう振る舞う。
  P_Deleted: null,
} as const satisfies FieldCatalog;

// Required on create per docs/usage/reference (resources/job.md「新規必須」列): P_Owner / P_Client /
// P_Recruiter（P_Id は System[Id]＝lib 供給のため除外）。LV-5 は reference で確定。
const REQUIRED_ON_CREATE = [
  "P_Owner",
  "P_Client",
  "P_Recruiter",
] as const satisfies readonly (keyof typeof FIELDS)[];

// Expandable reference fields (ADR-0058) — both System[Reference] fields Job carries.
const REFERENCES = {
  P_Client: CLIENT_DESCRIPTOR,
  P_Recruiter: RECRUITER_DESCRIPTOR,
} as const satisfies ReferenceMap;

/**
 * Job's names + standard catalog. Exported for in-repo dev tooling — the fake server
 * (ADR-0043) builds Job wire shapes from this very catalog, so the two cannot drift.
 * Not re-exported from `src/index.ts`, so it stays out of the published API.
 */
export const JOB_DESCRIPTOR = {
  name: "Job",
  path: "job" satisfies ResourceName,
  prefix: "Job",
  fields: FIELDS,
  references: REFERENCES,
} as const satisfies ResourceDescriptor;

/** A decoded Job: known `P_` fields, each requested field `value | null`. */
export type Job = ReadRecord<typeof FIELDS>;
export type JobPage = ResourcePage<typeof FIELDS>;
/**
 * The Job Read query. `C` is the declared custom-field catalog merged on, so a condition or an
 * order can name a custom field too.
 */
export type JobSearchQuery<C extends FieldCatalog = EmptyCatalog> = SearchQuery<
  typeof FIELDS & C,
  typeof REFERENCES
>;

/**
 * Fields for `create`: `P_Owner` required; `P_Id` / system timestamps are not settable. `C` is
 * the declared custom-field catalog merged on; `CR` names the custom fields that are required on
 * `create`.
 */
export type JobCreateInput<
  C extends FieldCatalog = EmptyCatalog,
  CR extends keyof C = never,
> = CreateInput<typeof FIELDS & C, (typeof REQUIRED_ON_CREATE)[number] | CR>;
/**
 * Fields for `update`: all optional (`null` omits, `""` clears a text field). `C` is the
 * declared custom-field catalog merged on.
 */
export type JobUpdateInput<C extends FieldCatalog = EmptyCatalog> = UpdateInput<
  typeof FIELDS & C
>;

// 公開の型の書き出しで繰り返す、利用者が宣言した項目を足した一覧。
type Fields<C extends FieldCatalog> = typeof FIELDS & C;

// メソッドはこのファイルで書き出す（ADR-0100）。データ系で揃っていることは
// data-resource-shapes.test.ts が確かめる。
/**
 * The Job accessor. `C` is the declared custom-field catalog merged on; `CR` names the
 * custom fields that are required on `create`.
 */
export type JobResource<
  C extends FieldCatalog = EmptyCatalog,
  CR extends keyof C = never,
> = {
  /** @internal Type-level mark of the field catalog; never present at runtime. */
  [catalogMark]?(field: ReadFieldAlias<Fields<C>>): void;
  /**
   * Search Job records: resolves to one page of the records matching `query`. `field` picks
   * the fields to read (omit it to read every known field), `expand` reads referenced records
   * too, `image` picks an Image field's sub-fields, and `count` / `start` choose the page.
   */
  search<
    const E extends Expand<typeof REFERENCES> = EmptyReferences,
    const I extends ImageOption<Fields<C>> = EmptyImages,
    const FL extends readonly ReadFieldAlias<Fields<C>>[] | undefined =
      undefined,
  >(
    query?: JobSearchQuery<C> & Paging & ReadSelection<FL, E, I>,
  ): Promise<
    ResourcePageOf<SearchRecord<Fields<C>, typeof REFERENCES, E, I, FL>>
  >;
  /**
   * Search every Job record matching `query`, page after page (200 records per request).
   * Takes the same `field` / `expand` / `image` as `search`.
   */
  searchAll<
    const E extends Expand<typeof REFERENCES> = EmptyReferences,
    const I extends ImageOption<Fields<C>> = EmptyImages,
    const FL extends readonly ReadFieldAlias<Fields<C>>[] | undefined =
      undefined,
  >(
    query?: JobSearchQuery<C> & ReadSelection<FL, E, I>,
  ): AsyncIterable<SearchRecord<Fields<C>, typeof REFERENCES, E, I, FL>>;
  /**
   * Read one Job record by id; `undefined` when there is none. `field` picks the fields to
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
   * Read many Job records by id. Resolves to an array in the order of `ids`, holding
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
  /** Create one Job record; resolves to the newly assigned id. */
  create(input: JobCreateInput<C, CR>): Promise<number>;
  /** Update one Job record by id; resolves to that id. */
  update(id: number, input: JobUpdateInput<C>): Promise<number>;
  // 一括書き込みの設計は ADR-0041 / F-4。
  /**
   * Create many Job records in one call. Auto-batched to ≤200 records and under the request
   * size cap. **Not atomic** — inspect the `BulkWriteResult`: per-record failures are returned
   * (`failed` / `hasFailures`), not thrown. Only a whole-request failure throws (with the
   * already-written count). Batching is non-idempotent: a full retry after a mid-run failure may
   * duplicate creates. Empty input sends no request.
   */
  createMany(inputs: JobCreateInput<C, CR>[]): Promise<BulkWriteResult>;
  /**
   * Update many Job records by id in one call. Auto-batched like `createMany`; per-record
   * failures are returned in the `BulkWriteResult`, not thrown.
   */
  updateMany(
    items: { id: number; fields: JobUpdateInput<C> }[],
  ): Promise<BulkWriteResult>;
};

export const createJobResource = <C extends FieldCatalog = EmptyCatalog>(
  deps: PartitionBoundConnectionDeps,
  custom?: C,
): JobResource<C> => {
  // 2 つの cast の理由は、data-resource.ts の createDataResource の上に書いてある。
  const fields = { ...FIELDS, ...custom } as typeof FIELDS & C;
  return createDataResource(
    { ...JOB_DESCRIPTOR, fields, requiredOnCreate: REQUIRED_ON_CREATE },
    deps,
  ) as JobResource<C>;
};
