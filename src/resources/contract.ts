// Contract accessor (ADR-0004/0005/0011/0019): Read (search / searchAll / get) + Write
// (create / update) over the generic resource factory. Only the Data-Type catalog and
// names are Contract-specific; the static Contract / input types derive from the catalog
// (ADR-0019).
//
// Two things set Contract apart from every other data resource:
//   - **No `P_Owner`.** PORTERS does not publish one, so `create` requires only `P_Client`.
//     (Everywhere else the owner is required on create.) We do not invent an owner field.
//   - **`Currency` fields.** `P_AdvancePayment` / `P_ContingentFee` / `P_ContractorFee` are
//     Field Type `Currency`, whose **Data Type is `Number`** (docs/reference field-data-types).
//     Field Type and Data Type are different axes; the catalog records the latter, so no new
//     Data Type is needed and the values decode as plain numbers.

import {
  createResource,
  type CreateInput,
  type EmptyCatalog,
  type FieldCatalog,
  type ReadRecord,
  type ReferenceMap,
  type Resource,
  type ResourceDeps,
  type ResourceDescriptor,
  type ResourcePage,
  type SearchQuery,
  type UpdateInput,
} from "./resource";
import { CLIENT_DESCRIPTOR } from "./client";

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

// Required on create per docs/reference (resources/contract.md「新規必須」列): P_Client のみ
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
  path: "contract",
  prefix: "Contract",
  fields: FIELDS,
  references: REFERENCES,
} as const satisfies ResourceDescriptor;

/** A decoded Contract (an agreement with a client): known `P_` fields, each `value | null`. */
export type Contract = ReadRecord<typeof FIELDS>;
export type ContractPage = ResourcePage<typeof FIELDS>;
export type ContractSearchQuery = SearchQuery<typeof FIELDS, typeof REFERENCES>;

/** Fields for `create`: only `P_Client` required (Contract has no owner field). */
export type ContractCreateInput = CreateInput<
  typeof FIELDS,
  (typeof REQUIRED_ON_CREATE)[number]
>;
/** Fields for `update`: all optional (`null` omits, `""` clears a text field). */
export type ContractUpdateInput = UpdateInput<typeof FIELDS>;
/** The Contract accessor; `C` is the declared custom-field catalog merged on (ADR-0023). */
export type ContractResource<C extends FieldCatalog = EmptyCatalog> = Resource<
  typeof FIELDS & C,
  (typeof REQUIRED_ON_CREATE)[number],
  typeof REFERENCES
>;

export const createContractResource = <C extends FieldCatalog = EmptyCatalog>(
  deps: ResourceDeps,
  custom?: C,
): ContractResource<C> => {
  // Custom U_/A_ aliases never collide with P_, so the merge is exactly `typeof FIELDS & C`;
  // the cast just names that intersection (defineFields already validated aliases — ADR-0023 D7).
  const fields = { ...FIELDS, ...custom } as typeof FIELDS & C;
  return createResource(
    { ...CONTRACT_DESCRIPTOR, fields, requiredOnCreate: REQUIRED_ON_CREATE },
    deps,
  );
};
