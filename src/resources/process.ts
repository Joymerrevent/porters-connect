// Process accessor (ADR-0004/0005/0011/0019): Read (search / searchAll / get) + Write
// (create / update) over the generic resource factory. Process is the relational
// resource linking a Candidate to a Job; P_Client / P_Recruiter / P_Job / P_Candidate /
// P_Resume are System[Reference] (Write = the related record's id; P_Candidate is the
// Person id).
//
// Display-only Reference fields (P_JobOwner, P_Job*Reference, P_ResumeOwner,
// P_Resume*Reference — they mirror a Job/Recruiter/Person value and are not writable) are
// intentionally left out of the catalog: scalar mirrors read through as raw strings,
// nested ones (e.g. P_JobOwner -> a User) read as null. Multi-select Option read returns every
// selected alias as `string[]` (ADR-0017). The static Process / input types derive from the catalog (ADR-0019).

import type { Requester } from "../http/requester";
import {
  createResource,
  type CreateInput,
  type EmptyCatalog,
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
  P_Job: "System[Reference]",
  P_Candidate: "System[Reference]",
  P_Resume: "System[Reference]",
  P_RegistrationDate: "System[DateTime]",
  P_RegisteredBy: "User",
  P_UpdateDate: "System[DateTime]",
  P_UpdatedBy: "User",
  P_Phase: "Option",
  P_PhaseDate: "DateTime",
  P_PhaseMemo: "MultilineText",
  P_Close: "Option",
  P_CloseReason: "Option",
  P_ExpectedSalesAmount: "Number",
  P_ExpectedClosingDate: "Date",
} as const satisfies FieldCatalog;

// Required on create per docs/reference (resources/process.md「新規必須」列): P_Owner と関連 5 項目
// （P_Client / P_Recruiter / P_Job / P_Candidate / P_Resume）。P_Id は System[Id]＝lib 供給で除外。
// LV-5 は reference で確定。
const REQUIRED_ON_CREATE = [
  "P_Owner",
  "P_Client",
  "P_Recruiter",
  "P_Job",
  "P_Candidate",
  "P_Resume",
] as const satisfies readonly (keyof typeof FIELDS)[];

/** A decoded Process (a Candidate's progress through a Job): known `P_` fields, each
 *  requested field `value | null`. */
export type Process = ReadRecord<typeof FIELDS>;
export type ProcessPage = ResourcePage<typeof FIELDS>;
export type ProcessSearchQuery = SearchQuery;

/** Fields for `create`: `P_Owner` required; `P_Id` / system timestamps are not settable. */
export type ProcessCreateInput = CreateInput<
  typeof FIELDS,
  (typeof REQUIRED_ON_CREATE)[number]
>;
/** Fields for `update`: all optional (`null` omits, `""` clears a text field). */
export type ProcessUpdateInput = UpdateInput<typeof FIELDS>;
/** The Process accessor; `C` is the declared custom-field catalog merged on (ADR-0023). */
export type ProcessResource<C extends FieldCatalog = EmptyCatalog> = Resource<
  typeof FIELDS & C,
  (typeof REQUIRED_ON_CREATE)[number]
>;

export const createProcessResource = <C extends FieldCatalog = EmptyCatalog>(
  deps: { requester: Requester; host: string; partition: number },
  custom?: C,
): ProcessResource<C> => {
  // Custom U_/A_ aliases never collide with P_, so the merge is exactly `typeof FIELDS & C`;
  // the cast just names that intersection (defineFields already validated aliases — ADR-0023 D7).
  const fields = { ...FIELDS, ...custom } as typeof FIELDS & C;
  return createResource(
    {
      name: "Process",
      path: "process",
      prefix: "Process",
      fields,
      requiredOnCreate: REQUIRED_ON_CREATE,
    },
    deps,
  );
};
