// Resume accessor (ADR-0004/0005/0011/0019): Read (search / searchAll / get) + Write
// (create / update) over the generic resource factory. A Resume belongs to a Candidate;
// P_Candidate is System[Reference] (Write = the Person id).
//
// P_DateOfBirth is the Age Data Type — catalogued as "Age". Its wire value is the
// birthdate (`yyyy/mm/dd`, same as Date); PORTERS derives the displayed age in its UI.
// Display-only Reference fields (P_Mail, P_*Reference — they mirror a Person value and are
// not writable) are intentionally left out of the catalog: scalar mirrors read through as
// raw strings. Multi-select Option read returns every selected alias as `string[]` (ADR-0017).
// Image-typed custom fields (U_) are future work. The static Resume / input types derive from the catalog (ADR-0019).

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
import type { ResourceDeps } from "../accessor/deps";
import type { ResourcePage, ResourcePageOf } from "../accessor/resource-page";
import type { EmptyReferences, Expand, ReferenceMap } from "../accessor/expand";
import type { ImageOption } from "../accessor/image";
import type { BulkWriteResult } from "../accessor/write-many";
import type { SearchQuery } from "../accessor/query";
import type { ResourceDescriptor } from "../accessor/descriptor";
import { CANDIDATE_DESCRIPTOR } from "./candidate";
import type { ResourceName } from "../porters/resource-list";

const FIELDS = {
  P_Id: "System[Id]",
  P_Owner: "User",
  P_Candidate: "System[Reference]",
  P_RegistrationDate: "System[DateTime]",
  P_RegisteredBy: "User",
  P_UpdateDate: "System[DateTime]",
  P_UpdatedBy: "User",
  P_Phase: "Option",
  P_PhaseDate: "DateTime",
  P_PhaseMemo: "MultilineText",
  P_Name: "SinglelineText",
  P_RegisterChannel: "Option",
  P_Memo: "MultilineText",
  P_CurrentStatus: "Option",
  P_Education: "MultilineText",
  P_CarrierSummary: "MultilineText",
  P_CurrentSalary: "Number",
  P_ExperiencedJobCategory: "Option",
  P_ExperiencedIndustry: "Option",
  P_ChangeJobsCount: "Number",
  P_Gender: "Option",
  P_DateOfBirth: "Age",
  P_ExpectEmploymentType: "Option",
  P_ExpectArea: "Option",
  P_ExpectJobCategory: "Option",
  P_ExpectIndustry: "Option",
  P_ExpectCondition: "MultilineText",
  P_ExpectSalary: "Number",
  P_DesiredHourlyRate: "Number",
  P_HourlyRate: "Number",
  // 削除状態（"0" / "1"）。PORTERS が Data Type を与えていない項目＝`null`（ADR-0056。
  // 詳細は candidate.ts のコメント）。Read の field でのみ指定でき、型もそう振る舞う。
  P_Deleted: null,
} as const satisfies FieldCatalog;

// Required on create per docs/usage/reference (resources/resume.md「新規必須」列): P_Owner / P_Candidate
// （P_Id は System[Id]＝lib 供給のため除外）。LV-5 は reference で確定。
const REQUIRED_ON_CREATE = [
  "P_Owner",
  "P_Candidate",
] as const satisfies readonly (keyof typeof FIELDS)[];

// Expandable reference fields (ADR-0058). Candidate's alias prefix is `Person`, not the resource
// name — the descriptor carries it so callers never write it.
const REFERENCES = {
  P_Candidate: CANDIDATE_DESCRIPTOR,
} as const satisfies ReferenceMap;

/**
 * Resume's names + standard catalog. Exported for in-repo dev tooling — the fake server
 * (ADR-0043) builds Resume wire shapes from this very catalog, so the two cannot drift.
 * Not re-exported from `src/index.ts`, so it stays out of the published API.
 */
export const RESUME_DESCRIPTOR = {
  name: "Resume",
  path: "resume" satisfies ResourceName,
  prefix: "Resume",
  fields: FIELDS,
  references: REFERENCES,
} as const satisfies ResourceDescriptor;

/** A decoded Resume (a Candidate's CV / profile): known `P_` fields, each requested field
 *  `value | null`. */
export type Resume = ReadRecord<typeof FIELDS>;
export type ResumePage = ResourcePage<typeof FIELDS>;
/**
 * The Resume Read query. `C` is the declared custom-field catalog merged on, so a condition or an
 * order can name a custom field too.
 */
export type ResumeSearchQuery<C extends FieldCatalog = EmptyCatalog> =
  SearchQuery<typeof FIELDS & C, typeof REFERENCES>;

/**
 * Fields for `create`: `P_Owner` required; `P_Id` / system timestamps are not settable. `C` is
 * the declared custom-field catalog merged on; `CR` names the custom fields that are required on
 * `create`.
 */
export type ResumeCreateInput<
  C extends FieldCatalog = EmptyCatalog,
  CR extends keyof C = never,
> = CreateInput<typeof FIELDS & C, (typeof REQUIRED_ON_CREATE)[number] | CR>;
/**
 * Fields for `update`: all optional (`null` omits, `""` clears a text field). `C` is the
 * declared custom-field catalog merged on.
 */
export type ResumeUpdateInput<C extends FieldCatalog = EmptyCatalog> =
  UpdateInput<typeof FIELDS & C>;

// 公開の型の書き出しで繰り返す、利用者が宣言した項目を足した一覧。
type Fields<C extends FieldCatalog> = typeof FIELDS & C;

// メソッドはこのファイルで書き出す（ADR-0100）。データ系で揃っていることは
// data-resource-shapes.test.ts が確かめる。
/**
 * The Resume accessor. `C` is the declared custom-field catalog merged on; `CR` names the
 * custom fields that are required on `create`.
 */
export type ResumeResource<
  C extends FieldCatalog = EmptyCatalog,
  CR extends keyof C = never,
> = {
  /** @internal Type-level mark of the field catalog; never present at runtime. */
  [catalogMark]?(field: ReadFieldAlias<Fields<C>>): void;
  /**
   * Search Resume records: resolves to one page of the records matching `query`. `field` picks
   * the fields to read (omit it to read every known field), `expand` reads referenced records
   * too, `image` picks an Image field's sub-fields, and `count` / `start` choose the page.
   */
  search<
    const E extends Expand<typeof REFERENCES> = EmptyReferences,
    const I extends ImageOption<Fields<C>> = EmptyImages,
    const FL extends readonly ReadFieldAlias<Fields<C>>[] | undefined =
      undefined,
  >(
    query?: ResumeSearchQuery<C> & Paging & ReadSelection<FL, E, I>,
  ): Promise<
    ResourcePageOf<SearchRecord<Fields<C>, typeof REFERENCES, E, I, FL>>
  >;
  /**
   * Search every Resume record matching `query`, page after page (200 records per request).
   * Takes the same `field` / `expand` / `image` as `search`.
   */
  searchAll<
    const E extends Expand<typeof REFERENCES> = EmptyReferences,
    const I extends ImageOption<Fields<C>> = EmptyImages,
    const FL extends readonly ReadFieldAlias<Fields<C>>[] | undefined =
      undefined,
  >(
    query?: ResumeSearchQuery<C> & ReadSelection<FL, E, I>,
  ): AsyncIterable<SearchRecord<Fields<C>, typeof REFERENCES, E, I, FL>>;
  /**
   * Read one Resume record by id; `undefined` when there is none. `field` picks the fields to
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
   * Read many Resume records by id. Resolves to an array in the order of `ids`, holding
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
  /** Create one Resume record; resolves to the newly assigned id. */
  create(input: ResumeCreateInput<C, CR>): Promise<number>;
  /** Update one Resume record by id; resolves to that id. */
  update(id: number, input: ResumeUpdateInput<C>): Promise<number>;
  // 一括書き込みの設計は ADR-0041 / F-4。
  /**
   * Create many Resume records in one call. Auto-batched to ≤200 records and under the request
   * size cap. **Not atomic** — inspect the `BulkWriteResult`: per-record failures are returned
   * (`failed` / `hasFailures`), not thrown. Only a whole-request failure throws (with the
   * already-written count). Batching is non-idempotent: a full retry after a mid-run failure may
   * duplicate creates. Empty input sends no request.
   */
  createMany(inputs: ResumeCreateInput<C, CR>[]): Promise<BulkWriteResult>;
  /**
   * Update many Resume records by id in one call. Auto-batched like `createMany`; per-record
   * failures are returned in the `BulkWriteResult`, not thrown.
   */
  updateMany(
    items: { id: number; fields: ResumeUpdateInput<C> }[],
  ): Promise<BulkWriteResult>;
};

export const createResumeResource = <C extends FieldCatalog = EmptyCatalog>(
  deps: ResourceDeps,
  custom?: C,
): ResumeResource<C> => {
  // Custom U_/A_ aliases never collide with P_, so the merge is exactly `typeof FIELDS & C`;
  // the cast just names that intersection (defineFields already validated aliases — ADR-0023 D7).
  const fields = { ...FIELDS, ...custom } as typeof FIELDS & C;
  // `C` が型引数のままだと、共通の実装の型（DataResource）とこのファイルで書き出した型が同じだと
  // コンパイラが示しきれないので、ここで名前を付け替える（ADR-0100）。同じであることは
  // data-resource-shapes.test.ts が具体的な `C` で確かめる。
  return createDataResource(
    { ...RESUME_DESCRIPTOR, fields, requiredOnCreate: REQUIRED_ON_CREATE },
    deps,
  ) as ResumeResource<C>;
};
