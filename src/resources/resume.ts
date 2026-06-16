// Resume accessor (ADR-0004/0005/0011): Read (search / searchAll / get) + Write
// (create / update) over the generic resource factory. A Resume belongs to a Candidate;
// P_Candidate is System[Reference] (Write = the Person id).
//
// P_DateOfBirth is the Age Field Type — catalogued as "Age". Its wire value is the
// birthdate (`yyyy/mm/dd`, same as Date); PORTERS derives the displayed age in its UI.
// Display-only Reference fields (P_Mail, P_*Reference — they mirror a Person value and are
// not writable) are intentionally left out of the catalog: scalar mirrors read through as
// raw strings. Multi-select Option read returns the first alias only. Image-typed custom
// fields (U_) are future work. The full static Resume type is future work (SD-3).

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
  ["P_Id", "System[Id]"],
  ["P_Owner", "User"],
  ["P_Candidate", "System[Reference]"],
  ["P_RegistrationDate", "System[DateTime]"],
  ["P_RegisteredBy", "User"],
  ["P_UpdateDate", "System[DateTime]"],
  ["P_UpdatedBy", "User"],
  ["P_Phase", "Option"],
  ["P_PhaseDate", "DateTime"],
  ["P_PhaseMemo", "MultilineText"],
  ["P_Name", "SinglelineText"],
  ["P_RegisterChannel", "Option"],
  ["P_Memo", "MultilineText"],
  ["P_CurrentStatus", "Option"],
  ["P_Education", "MultilineText"],
  ["P_CarrierSummary", "MultilineText"],
  ["P_CurrentSalary", "Number"],
  ["P_ExperiencedJobCategory", "Option"],
  ["P_ExperiencedIndustry", "Option"],
  ["P_ChangeJobsCount", "Number"],
  ["P_Gender", "Option"],
  ["P_DateOfBirth", "Age"],
  ["P_ExpectEmploymentType", "Option"],
  ["P_ExpectArea", "Option"],
  ["P_ExpectJobCategory", "Option"],
  ["P_ExpectIndustry", "Option"],
  ["P_ExpectCondition", "MultilineText"],
  ["P_ExpectSalary", "Number"],
  ["P_DesiredHourlyRate", "Number"],
  ["P_HourlyRate", "Number"],
]);

/** A decoded Resume (a Candidate's CV / profile). Known `P_` fields follow the catalog;
 *  custom `U_`/`A_` appear as decoded raw values. */
export type Resume = ResourceItem;
export type ResumePage = ResourcePage;
export type ResumeSearchQuery = SearchQuery;

/**
 * Fields to write, keyed by bare alias (e.g. `P_Name`). `P_Id` is supplied by
 * `create` / `update` — don't set it. User / Reference fields (`P_Owner` / `P_Candidate`)
 * take an ID (number); Option fields take an alias (or aliases). `null` omits a field.
 * (A precise static Write type is future work — SD-3.)
 */
export type ResumeInput = ResourceInput;
export type ResumeResource = Resource;

export const createResumeResource = (deps: {
  requester: Requester;
  host: string;
  partition: number;
}): ResumeResource =>
  createResource(
    { name: "Resume", path: "resume", prefix: "Resume", fields: FIELDS },
    deps,
  );
