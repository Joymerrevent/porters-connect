// Candidate accessor (ADR-0004/0005/0011/0019): Read (search / searchAll / get) + Write
// (create / update) over the generic resource factory. Only the Data-Type catalog and names
// are Candidate-specific; the static Candidate / input types derive from the catalog
// (single source of truth — ADR-0019).

import { createDataResource, type catalogMark } from "./core/data-resource";
import type {
  EmptyImages,
  GetOptions,
  GetRecord,
  ReadSelection,
  SearchRecord,
} from "./core/data-read";
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
import type { EmptyReferences, Expand } from "./core/expand";
import type { ImageOption } from "./core/image";
import type { BulkWriteResult } from "./core/bulk-write";
import type { SearchQuery } from "./core/query";
import type { ResourceDescriptor } from "./core/descriptor";
import type { ResourceName } from "../porters/resource-list";

const FIELDS = {
  P_Id: "System[Id]",
  P_Owner: "User",
  P_RegistrationDate: "System[DateTime]",
  P_RegisteredBy: "User",
  P_UpdateDate: "System[DateTime]",
  P_UpdatedBy: "User",
  P_Phase: "Option",
  P_PhaseDate: "DateTime",
  P_PhaseMemo: "MultilineText",
  P_Name: "SinglelineText",
  P_Reading: "SinglelineText",
  P_Memo: "MultilineText",
  P_Mail: "Mail",
  P_MobileMail: "Mail",
  P_Telephone: "Telephone",
  P_Mobile: "Telephone",
  P_Fax: "Telephone",
  P_Country: "SinglelineText",
  P_Prefecture: "SinglelineText",
  P_City: "SinglelineText",
  P_Street: "MultilineText",
  P_Zipcode: "SinglelineText",
  // 削除状態（"0" 生存 / "1" 削除済み）。PORTERS はこの項目に Data Type を与えていない
  // （reference の Field Type / Data Type とも「ー」）ので `null`＝型が無いことを記録する（ADR-0056）。
  // 「未設定」でも「不明」でもない。null は condition / order / Write の型から自動的に外れる＝
  // reference の「Read の field でのみ指定可」がそのまま型で守られる。
  P_Deleted: null,
} as const satisfies FieldCatalog;

// Required on create per docs/usage/reference (resources/candidate.md「新規必須」列): P_Owner。
// （System[Id] の P_Id も新規必須だが lib が -1 を供給するため型からは除外。LV-5 は reference で確定。）
const REQUIRED_ON_CREATE = [
  "P_Owner",
] as const satisfies readonly (keyof typeof FIELDS)[];

/**
 * Candidate's names + standard catalog. Exported for in-repo dev tooling — the fake server
 * (ADR-0043) builds Candidate wire shapes from this very catalog, so the two cannot drift.
 * Not re-exported from `src/index.ts`, so it stays out of the published API.
 */
export const CANDIDATE_DESCRIPTOR = {
  name: "Candidate",
  path: "candidate" satisfies ResourceName,
  prefix: "Person",
  fields: FIELDS,
} as const satisfies ResourceDescriptor;

/** A decoded Candidate: known `P_` fields, each requested field `value | null`. */
export type Candidate = ReadRecord<typeof FIELDS>;
export type CandidatePage = ResourcePage<typeof FIELDS>;
/**
 * The Candidate Read query. `C` is the declared custom-field catalog merged on, so a condition or an
 * order can name a custom field too.
 */
export type CandidateSearchQuery<C extends FieldCatalog = EmptyCatalog> =
  SearchQuery<typeof FIELDS & C>;

/**
 * Fields for `create`: `P_Owner` is required; `P_Id` / system timestamps are not settable. `C`
 * is the declared custom-field catalog merged on; `CR` names the custom fields that are required
 * on `create`.
 */
export type CandidateCreateInput<
  C extends FieldCatalog = EmptyCatalog,
  CR extends keyof C = never,
> = CreateInput<typeof FIELDS & C, (typeof REQUIRED_ON_CREATE)[number] | CR>;
/**
 * Fields for `update`: all optional (`null` omits, `""` clears a text field). `C` is the
 * declared custom-field catalog merged on.
 */
export type CandidateUpdateInput<C extends FieldCatalog = EmptyCatalog> =
  UpdateInput<typeof FIELDS & C>;

// 公開の型の書き出しで繰り返す、利用者が宣言した項目を足した一覧。
type Fields<C extends FieldCatalog> = typeof FIELDS & C;

// メソッドはこのファイルで書き出す（ADR-0100）。データ系で揃っていることは
// data-resource-shapes.test.ts が確かめる。
/**
 * The Candidate accessor. `C` is the declared custom-field catalog merged on; `CR` names the
 * custom fields that are required on `create`.
 */
export type CandidateResource<
  C extends FieldCatalog = EmptyCatalog,
  CR extends keyof C = never,
> = {
  /** @internal Type-level mark of the field catalog; never present at runtime. */
  [catalogMark]?(field: ReadFieldAlias<Fields<C>>): void;
  /**
   * Search Candidate records: resolves to one page of the records matching `query`. `field` picks
   * the fields to read (omit it to read every known field), `expand` reads referenced records
   * too, `image` picks an Image field's sub-fields, and `count` / `start` choose the page.
   */
  search<
    const E extends Expand<EmptyReferences> = EmptyReferences,
    const I extends ImageOption<Fields<C>> = EmptyImages,
    const FL extends readonly ReadFieldAlias<Fields<C>>[] | undefined =
      undefined,
  >(
    query?: CandidateSearchQuery<C> & Paging & ReadSelection<FL, E, I>,
  ): Promise<
    ResourcePageOf<SearchRecord<Fields<C>, EmptyReferences, E, I, FL>>
  >;
  /**
   * Search every Candidate record matching `query`, page after page (200 records per request).
   * Takes the same `field` / `expand` / `image` as `search`.
   */
  searchAll<
    const E extends Expand<EmptyReferences> = EmptyReferences,
    const I extends ImageOption<Fields<C>> = EmptyImages,
    const FL extends readonly ReadFieldAlias<Fields<C>>[] | undefined =
      undefined,
  >(
    query?: CandidateSearchQuery<C> & ReadSelection<FL, E, I>,
  ): AsyncIterable<SearchRecord<Fields<C>, EmptyReferences, E, I, FL>>;
  /**
   * Read one Candidate record by id; `undefined` when there is none. `field` picks the fields to
   * read, the same way it does for `search` (omit it to read every known field); the record's id
   * is always read, even when `field` leaves it out. `expand` reads referenced records too;
   * `image` picks an Image field's sub-fields — `get` is where asking for a `Content` belongs,
   * since it fetches one record rather than a page.
   */
  get<
    const E extends Expand<EmptyReferences> = EmptyReferences,
    const I extends ImageOption<Fields<C>> = EmptyImages,
    const FL extends readonly ReadFieldAlias<Fields<C>>[] | undefined =
      undefined,
  >(
    id: number,
    options?: GetOptions<Fields<C>, FL, E, I>,
  ): Promise<GetRecord<Fields<C>, EmptyReferences, E, I, FL> | undefined>;
  // 設計は ADR-0095（ID の突き合わせ・組分け・戻り値の形）。
  /**
   * Read many Candidate records by id. Resolves to an array in the order of `ids`, holding
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
    const E extends Expand<EmptyReferences> = EmptyReferences,
    const I extends ImageOption<Fields<C>> = EmptyImages,
    const FL extends readonly ReadFieldAlias<Fields<C>>[] | undefined =
      undefined,
  >(
    ids: readonly number[],
    options?: GetOptions<Fields<C>, FL, E, I>,
  ): Promise<(GetRecord<Fields<C>, EmptyReferences, E, I, FL> | undefined)[]>;
  /** Create one Candidate record; resolves to the newly assigned id. */
  create(input: CandidateCreateInput<C, CR>): Promise<number>;
  /** Update one Candidate record by id; resolves to that id. */
  update(id: number, input: CandidateUpdateInput<C>): Promise<number>;
  // 一括書き込みの設計は ADR-0041 / F-4。
  /**
   * Create many Candidate records in one call. Auto-batched to ≤200 records and under the request
   * size cap. **Not atomic** — inspect the `BulkWriteResult`: per-record failures are returned
   * (`failed` / `hasFailures`), not thrown. Only a whole-request failure throws (with the
   * already-written count). Batching is non-idempotent: a full retry after a mid-run failure may
   * duplicate creates. Empty input sends no request.
   */
  createMany(inputs: CandidateCreateInput<C, CR>[]): Promise<BulkWriteResult>;
  /**
   * Update many Candidate records by id in one call. Auto-batched like `createMany`; per-record
   * failures are returned in the `BulkWriteResult`, not thrown.
   */
  updateMany(
    items: { id: number; fields: CandidateUpdateInput<C> }[],
  ): Promise<BulkWriteResult>;
};

export const createCandidateResource = <C extends FieldCatalog = EmptyCatalog>(
  deps: ResourceDeps,
  custom?: C,
): CandidateResource<C> => {
  // Custom U_/A_ aliases never collide with P_, so the merge is exactly `typeof FIELDS & C`;
  // the cast just names that intersection (defineFields already validated aliases — ADR-0023 D7).
  const fields = { ...FIELDS, ...custom } as typeof FIELDS & C;
  // `C` が型引数のままだと、共通の実装の型（DataResource）とこのファイルで書き出した型が同じだと
  // コンパイラが示しきれないので、ここで名前を付け替える（ADR-0100）。同じであることは
  // data-resource-shapes.test.ts が具体的な `C` で確かめる。
  return createDataResource(
    { ...CANDIDATE_DESCRIPTOR, fields, requiredOnCreate: REQUIRED_ON_CREATE },
    deps,
  ) as CandidateResource<C>;
};
