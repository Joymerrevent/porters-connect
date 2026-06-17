// Resume accessor (ADR-0004/0005/0011/0019): Read (search / searchAll / get) + Write
// (create / update) over the generic resource factory. A Resume belongs to a Candidate;
// P_Candidate is System[Reference] (Write = the Person id).
//
// P_DateOfBirth is the Age Data Type — catalogued as "Age". Its wire value is the
// birthdate (`yyyy/mm/dd`, same as Date); PORTERS derives the displayed age in its UI.
// Display-only Reference fields (P_Mail, P_*Reference — they mirror a Person value and are
// not writable) are intentionally left out of the catalog: scalar mirrors read through as
// raw strings. Multi-select Option read returns the first alias only. Image-typed custom
// fields (U_) are future work. The static Resume / input types derive from the catalog (ADR-0019).

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
} as const satisfies FieldCatalog;

// Required on create per docs/reference (resources/resume.md「新規必須」列): P_Owner / P_Candidate
// （P_Id は System[Id]＝lib 供給のため除外）。LV-5 は reference で確定。
const REQUIRED_ON_CREATE = [
  "P_Owner",
  "P_Candidate",
] as const satisfies readonly (keyof typeof FIELDS)[];

/** A decoded Resume (a Candidate's CV / profile): known `P_` fields, each requested field
 *  `value | null`. */
export type Resume = ReadRecord<typeof FIELDS>;
export type ResumePage = ResourcePage<typeof FIELDS>;
export type ResumeSearchQuery = SearchQuery;

/** Fields for `create`: `P_Owner` required; `P_Id` / system timestamps are not settable. */
export type ResumeCreateInput = CreateInput<
  typeof FIELDS,
  (typeof REQUIRED_ON_CREATE)[number]
>;
/** Fields for `update`: all optional (`null` omits, `""` clears a text field). */
export type ResumeUpdateInput = UpdateInput<typeof FIELDS>;
export type ResumeResource = Resource<
  typeof FIELDS,
  (typeof REQUIRED_ON_CREATE)[number]
>;

export const createResumeResource = (deps: {
  requester: Requester;
  host: string;
  partition: number;
}): ResumeResource =>
  createResource(
    {
      name: "Resume",
      path: "resume",
      prefix: "Resume",
      fields: FIELDS,
      requiredOnCreate: REQUIRED_ON_CREATE,
    },
    deps,
  );
