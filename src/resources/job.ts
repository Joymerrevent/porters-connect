// Job accessor (ADR-0004/0005/0011/0019): Read (search / searchAll / get) + Write
// (create / update) over the generic resource factory. Only the Data-Type catalog and
// names are Job-specific. P_Client / P_Recruiter are System[Reference] (Write = ID).
//
// Display-only Reference fields (P_Mail, P_*Reference — they mirror a Recruiter value and
// are not writable) are intentionally left out of the catalog: they read through as raw
// strings. Multi-select Option read returns the first alias only (full multi-Option is
// future work). The static Job / input types derive from the catalog (ADR-0019).

import type { Requester } from "../http/requester";
import {
  createResource,
  type CreateInput,
  type FieldCatalog,
  type ReadRecord,
  type Resource,
  type ResourcePage,
  type SearchQuery,
  type UpdateInput,
} from "./resource";

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
} as const satisfies FieldCatalog;

// VERIFY(live): create 必須項目はテナント/契約依存。過剰な必須化を避け P_Owner のみ必須にする
// （P_Client 等が必須の可能性あり）。see docs/live-verification.md (LV-5)。
const REQUIRED_ON_CREATE = [
  "P_Owner",
] as const satisfies readonly (keyof typeof FIELDS)[];

/** A decoded Job: known `P_` fields, each requested field `value | null`. */
export type Job = ReadRecord<typeof FIELDS>;
export type JobPage = ResourcePage<typeof FIELDS>;
export type JobSearchQuery = SearchQuery;

/** Fields for `create`: `P_Owner` required; `P_Id` / system timestamps are not settable. */
export type JobCreateInput = CreateInput<
  typeof FIELDS,
  (typeof REQUIRED_ON_CREATE)[number]
>;
/** Fields for `update`: all optional (`null` omits, `""` clears a text field). */
export type JobUpdateInput = UpdateInput<typeof FIELDS>;
export type JobResource = Resource<
  typeof FIELDS,
  (typeof REQUIRED_ON_CREATE)[number]
>;

export const createJobResource = (deps: {
  requester: Requester;
  host: string;
  partition: number;
}): JobResource =>
  createResource(
    {
      name: "Job",
      path: "job",
      prefix: "Job",
      fields: FIELDS,
      requiredOnCreate: REQUIRED_ON_CREATE,
    },
    deps,
  );
