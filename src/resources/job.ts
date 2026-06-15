// Job accessor (ADR-0004/0005/0011): Read (search / searchAll / get) + Write
// (create / update) over the generic resource factory. Only the Field-Type catalog and
// names are Job-specific. P_Client / P_Recruiter are System[Reference] (Write = ID).
//
// Display-only Reference fields (P_Mail, P_*Reference — they mirror a Recruiter value and
// are not writable) are intentionally left out of the catalog: they read through as raw
// strings. Multi-select Option read returns the first alias only (full multi-Option is
// future work). The full static Job type is future work (SD-3).

import type { Requester } from "../http/requester";
import type { FieldType } from "../xml/decode";
import {
  createResource,
  type Resource,
  type ResourceInput,
  type ResourceItem,
  type ResourcePage,
  type SearchQuery,
} from "./resource";

const FIELDS = new Map<string, FieldType>([
  ["P_Id", "Id"],
  ["P_Owner", "User"],
  ["P_Client", "Reference"],
  ["P_Recruiter", "Reference"],
  ["P_RegistrationDate", "DateTime"],
  ["P_RegisteredBy", "User"],
  ["P_UpdateDate", "DateTime"],
  ["P_UpdatedBy", "User"],
  ["P_Phase", "Option"],
  ["P_PhaseDate", "DateTime"],
  ["P_PhaseMemo", "Text"],
  ["P_Position", "Text"],
  ["P_Publish", "Option"],
  ["P_JobCategorySummary", "Text"],
  ["P_JobCategory", "Option"],
  ["P_IndustrySummary", "Text"],
  ["P_Industry", "Option"],
  ["P_SalarySummary", "Text"],
  ["P_MinSalary", "Number"],
  ["P_MaxSalary", "Number"],
  ["P_AreaSummary", "Text"],
  ["P_Area", "Option"],
  ["P_PayrollsText", "Text"],
  ["P_Memo", "Text"],
  ["P_EmploymentPeriod", "Text"],
  // "P_WokingHours" is the alias as published by PORTERS (source typo); keep verbatim.
  ["P_WokingHours", "Text"],
  ["P_Holidays", "Text"],
  ["P_Benefits", "Text"],
  ["P_PubliclyTraded", "Option"],
  ["P_SalesAmountText", "Text"],
  ["P_EstablishmentDateText", "Text"],
  ["P_CapitalText", "Text"],
  ["P_EmploymentType", "Option"],
  ["P_ExpectedAgeReason", "Option"],
]);

/** A decoded Job. Known `P_` fields follow the catalog; custom `U_`/`A_` appear raw. */
export type Job = ResourceItem;
export type JobPage = ResourcePage;
export type JobSearchQuery = SearchQuery;

/**
 * Fields to write, keyed by bare alias (e.g. `P_Position`). `P_Id` is supplied by
 * `create` / `update`. User / Reference fields (`P_Owner` / `P_Client` / `P_Recruiter`)
 * take an ID (number); Option fields take an alias (or aliases). `null` omits a field.
 * (A precise static Write type is future work — SD-3.)
 */
export type JobInput = ResourceInput;
export type JobResource = Resource;

export const createJobResource = (deps: {
  requester: Requester;
  host: string;
  partition: number;
}): JobResource =>
  createResource(
    { name: "Job", path: "job", prefix: "Job", fields: FIELDS },
    deps,
  );
