// Contract accessor (ADR-0004/0005/0011/0019): Read (search / searchAll / get) + Write
// (create / update) over the generic resource factory. Only the Data-Type catalog and
// names are Contract-specific; the static Contract / input types derive from the catalog
// (ADR-0019).
//
// Two things set Contract apart from every other data resource:
//   - **No `P_Owner`.** PORTERS does not publish one, so `create` requires only `P_Client`.
//     (Everywhere else the owner is required on create.) We do not invent an owner field.
//   - **`Currency` fields.** `P_AdvancePayment` / `P_ContingentFee` / `P_ContractorFee` are
//     Field Type `Currency`, whose **Data Type is `Number`** (docs/usage/reference field-data-types).
//     Field Type and Data Type are different axes; the catalog records the latter, so no new
//     Data Type is needed and the values decode as plain numbers.

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
import type { ResourcePage, ResourcePageOf } from "../accessor/read";
import type { EmptyReferences, Expand, ReferenceMap } from "../accessor/expand";
import type { ImageOption } from "../accessor/image";
import type { BulkWriteResult } from "../accessor/write-many";
import type { SearchQuery } from "../accessor/query";
import type { ResourceDescriptor } from "../accessor/descriptor";
import { CLIENT_DESCRIPTOR } from "./client";
import type { ResourceName } from "../porters/resource-list";

const FIELDS = {
  P_Id: "System[Id]",
  P_Client: "System[Reference]",
  P_RegistrationDate: "System[DateTime]",
  P_RegisteredBy: "User",
  P_UpdateDate: "System[DateTime]",
  P_UpdatedBy: "User",
  P_Name: "SinglelineText",
  P_Memo: "MultilineText",
  // Currency -> Number (see the module comment).
  P_AdvancePayment: "Number",
  P_ContingentFeeRate: "Number",
  P_ContingentFee: "Number",
  P_RefundTerms: "SinglelineText",
  P_PaymentTerms: "SinglelineText",
  P_StartDate: "Date",
  P_EndDate: "Date",
  P_ClientContactDivision: "SinglelineText",
  P_ClientContactTitle: "SinglelineText",
  P_ClientContactName: "SinglelineText",
  P_ClientZipcode: "SinglelineText",
  P_ClientAddress: "SinglelineText",
  P_ClientDivision: "SinglelineText",
  P_SupervisorDivision: "SinglelineText",
  P_SupervisorTitle: "SinglelineText",
  P_SupervisorName: "SinglelineText",
  P_ContractorType: "Option",
  P_ContractorTypeSummary: "MultilineText",
  P_ContractorHeadCount: "Number",
  P_ContractorFee: "Number",
  P_ContractorStartDate: "Date",
  P_ContractorEndDate: "Date",
  P_WorkingHour: "SinglelineText",
  P_BreakTime: "SinglelineText",
  P_Holiday: "MultilineText",
  P_PaymentTermsClosingDate: "SinglelineText",
  P_ContractorPaymentDate: "SinglelineText",
  P_ContractorBillingDate: "SinglelineText",
  P_ContractorTravelExpense: "SinglelineText",
  P_ContractorPaymentByHour: "SinglelineText",
  // 削除状態（"0" / "1"）。PORTERS が Data Type を与えていない項目＝`null`（ADR-0056。
  // 詳細は candidate.ts のコメント）。Read の field でのみ指定でき、型もそう振る舞う。
  P_Deleted: null,
} as const satisfies FieldCatalog;

// Required on create per docs/usage/reference (resources/contract.md「新規必須」列): P_Client のみ
// （P_Id は System[Id]＝lib 供給のため除外）。P_Owner はこのリソースには存在しない。
const REQUIRED_ON_CREATE = [
  "P_Client",
] as const satisfies readonly (keyof typeof FIELDS)[];

// Expandable reference fields (ADR-0058) — Contract's only System[Reference].
const REFERENCES = {
  P_Client: CLIENT_DESCRIPTOR,
} as const satisfies ReferenceMap;

/**
 * Contract's names + standard catalog. Exported for in-repo dev tooling — the fake server
 * (ADR-0043) builds Contract wire shapes from this very catalog, so the two cannot drift.
 * Not re-exported from `src/index.ts`, so it stays out of the published API.
 */
export const CONTRACT_DESCRIPTOR = {
  name: "Contract",
  path: "contract" satisfies ResourceName,
  prefix: "Contract",
  fields: FIELDS,
  references: REFERENCES,
} as const satisfies ResourceDescriptor;

/** A decoded Contract (an agreement with a client): known `P_` fields, each `value | null`. */
export type Contract = ReadRecord<typeof FIELDS>;
export type ContractPage = ResourcePage<typeof FIELDS>;
/**
 * The Contract Read query. `C` is the declared custom-field catalog merged on, so a condition or an
 * order can name a custom field too.
 */
export type ContractSearchQuery<C extends FieldCatalog = EmptyCatalog> =
  SearchQuery<typeof FIELDS & C, typeof REFERENCES>;

/**
 * Fields for `create`: only `P_Client` required (Contract has no owner field). `C` is the
 * declared custom-field catalog merged on; `CR` names the custom fields that are required on
 * `create`.
 */
export type ContractCreateInput<
  C extends FieldCatalog = EmptyCatalog,
  CR extends keyof C = never,
> = CreateInput<typeof FIELDS & C, (typeof REQUIRED_ON_CREATE)[number] | CR>;
/**
 * Fields for `update`: all optional (`null` omits, `""` clears a text field). `C` is the
 * declared custom-field catalog merged on.
 */
export type ContractUpdateInput<C extends FieldCatalog = EmptyCatalog> =
  UpdateInput<typeof FIELDS & C>;

// 公開の型の書き出しで繰り返す、利用者が宣言した項目を足した一覧。
type Fields<C extends FieldCatalog> = typeof FIELDS & C;

// メソッドはこのファイルで書き出す（ADR-0100）。データ系で揃っていることは
// data-resource-shapes.test.ts が確かめる。
/**
 * The Contract accessor. `C` is the declared custom-field catalog merged on; `CR` names the
 * custom fields that are required on `create`.
 */
export type ContractResource<
  C extends FieldCatalog = EmptyCatalog,
  CR extends keyof C = never,
> = {
  /** @internal Type-level mark of the field catalog; never present at runtime. */
  [catalogMark]?(field: ReadFieldAlias<Fields<C>>): void;
  /**
   * Search Contract records: resolves to one page of the records matching `query`. `field` picks
   * the fields to read (omit it to read every known field), `expand` reads referenced records
   * too, `image` picks an Image field's sub-fields, and `count` / `start` choose the page.
   */
  search<
    const E extends Expand<typeof REFERENCES> = EmptyReferences,
    const I extends ImageOption<Fields<C>> = EmptyImages,
    const FL extends readonly ReadFieldAlias<Fields<C>>[] | undefined =
      undefined,
  >(
    query?: ContractSearchQuery<C> & Paging & ReadSelection<FL, E, I>,
  ): Promise<
    ResourcePageOf<SearchRecord<Fields<C>, typeof REFERENCES, E, I, FL>>
  >;
  /**
   * Search every Contract record matching `query`, page after page (200 records per request).
   * Takes the same `field` / `expand` / `image` as `search`.
   */
  searchAll<
    const E extends Expand<typeof REFERENCES> = EmptyReferences,
    const I extends ImageOption<Fields<C>> = EmptyImages,
    const FL extends readonly ReadFieldAlias<Fields<C>>[] | undefined =
      undefined,
  >(
    query?: ContractSearchQuery<C> & ReadSelection<FL, E, I>,
  ): AsyncIterable<SearchRecord<Fields<C>, typeof REFERENCES, E, I, FL>>;
  /**
   * Read one Contract record by id; `undefined` when there is none. `field` picks the fields to
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
   * Read many Contract records by id. Resolves to an array in the order of `ids`, holding
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
  /** Create one Contract record; resolves to the newly assigned id. */
  create(input: ContractCreateInput<C, CR>): Promise<number>;
  /** Update one Contract record by id; resolves to that id. */
  update(id: number, input: ContractUpdateInput<C>): Promise<number>;
  // 一括書き込みの設計は ADR-0041 / F-4。
  /**
   * Create many Contract records in one call. Auto-batched to ≤200 records and under the request
   * size cap. **Not atomic** — inspect the `BulkWriteResult`: per-record failures are returned
   * (`failed` / `hasFailures`), not thrown. Only a whole-request failure throws (with the
   * already-written count). Batching is non-idempotent: a full retry after a mid-run failure may
   * duplicate creates. Empty input sends no request.
   */
  createMany(inputs: ContractCreateInput<C, CR>[]): Promise<BulkWriteResult>;
  /**
   * Update many Contract records by id in one call. Auto-batched like `createMany`; per-record
   * failures are returned in the `BulkWriteResult`, not thrown.
   */
  updateMany(
    items: { id: number; fields: ContractUpdateInput<C> }[],
  ): Promise<BulkWriteResult>;
};

export const createContractResource = <C extends FieldCatalog = EmptyCatalog>(
  deps: ResourceDeps,
  custom?: C,
): ContractResource<C> => {
  // Custom U_/A_ aliases never collide with P_, so the merge is exactly `typeof FIELDS & C`;
  // the cast just names that intersection (defineFields already validated aliases — ADR-0023 D7).
  const fields = { ...FIELDS, ...custom } as typeof FIELDS & C;
  // `C` が型引数のままだと、共通の実装の型（DataResource）とこのファイルで書き出した型が同じだと
  // コンパイラが示しきれないので、ここで名前を付け替える（ADR-0100）。同じであることは
  // data-resource-shapes.test.ts が具体的な `C` で確かめる。
  return createDataResource(
    { ...CONTRACT_DESCRIPTOR, fields, requiredOnCreate: REQUIRED_ON_CREATE },
    deps,
  ) as ContractResource<C>;
};
