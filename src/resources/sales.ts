// Sales accessor (ADR-0004/0005/0011/0019): Read (search / searchAll / get) + Write
// (create / update) over the generic resource factory. Only the Data-Type catalog and
// names are Sales-specific; the static Sales / input types derive from the catalog
// (ADR-0019). Sales ties the whole chain together — it references Client, Recruiter, Job,
// Contract, Candidate and Resume, and every one of them is expandable (ADR-0058).
//
// **Why the six references are not in `requiredOnCreate`.** PORTERS marks them `※`, not `●`
// (docs/reference resources/sales.md), and the Write article spells out what the `※` means:
// they are required *conditionally*, as a dependency chain —
//   Sales.P_Job -> Sales.P_Recruiter -> Sales.P_Client <- Sales.P_Contract
// (setting a lower resource requires its upper ones), plus P_Candidate and P_Resume must be
// given together on create. A flat required-list cannot express that, and guessing "all six
// are required" would reject calls the server accepts. Being stricter than the server fails
// to the *unsafe* side here — the caller cannot work around a client-side rejection, but a
// server-side one comes back as a typed error they can act on. So the library sends what it
// is given and lets PORTERS arbitrate; the rule is documented in docs/guide/write-constraints.md.
// VERIFY(live): the exact conditions are doc-only until a contract environment confirms them.
//
// `P_ClientOwner` / `P_RecruiterOwner` / `P_JobOwner` / `P_CandidateOwner` / `P_ResumeOwner`
// are Field Type `Reference` (16) — display-only mirrors of the referenced record's owner,
// with no value of their own — so they are deliberately absent from the catalog, like Job's.

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
import { CANDIDATE_DESCRIPTOR } from "./candidate";
import { CLIENT_DESCRIPTOR } from "./client";
import { CONTRACT_DESCRIPTOR } from "./contract";
import { JOB_DESCRIPTOR } from "./job";
import { RECRUITER_DESCRIPTOR } from "./recruiter";
import { RESUME_DESCRIPTOR } from "./resume";

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

// Required on create per docs/reference (resources/sales.md「新規必須」列): P_Owner のみが `●`。
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
  path: "sales",
  prefix: "Sales",
  fields: FIELDS,
  references: REFERENCES,
} as const satisfies ResourceDescriptor;

/** A decoded Sales (a placement / revenue record): known `P_` fields, each `value | null`. */
export type Sales = ReadRecord<typeof FIELDS>;
export type SalesPage = ResourcePage<typeof FIELDS>;
export type SalesSearchQuery = SearchQuery<typeof FIELDS, typeof REFERENCES>;

/**
 * Fields for `create`: only `P_Owner` is unconditionally required. The six references are
 * required *conditionally* (a dependency chain PORTERS validates server-side) — see the
 * module comment and docs/guide/write-constraints.md.
 */
export type SalesCreateInput = CreateInput<
  typeof FIELDS,
  (typeof REQUIRED_ON_CREATE)[number]
>;
/** Fields for `update`: all optional (`null` omits, `""` clears a text field). */
export type SalesUpdateInput = UpdateInput<typeof FIELDS>;
/** The Sales accessor; `C` is the declared custom-field catalog merged on (ADR-0023). */
export type SalesResource<C extends FieldCatalog = EmptyCatalog> = Resource<
  typeof FIELDS & C,
  (typeof REQUIRED_ON_CREATE)[number],
  typeof REFERENCES
>;

export const createSalesResource = <C extends FieldCatalog = EmptyCatalog>(
  deps: ResourceDeps,
  custom?: C,
): SalesResource<C> => {
  // Custom U_/A_ aliases never collide with P_, so the merge is exactly `typeof FIELDS & C`;
  // the cast just names that intersection (defineFields already validated aliases — ADR-0023 D7).
  const fields = { ...FIELDS, ...custom } as typeof FIELDS & C;
  return createResource(
    { ...SALES_DESCRIPTOR, fields, requiredOnCreate: REQUIRED_ON_CREATE },
    deps,
  );
};
