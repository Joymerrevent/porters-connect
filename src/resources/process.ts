// Process accessor (ADR-0004/0005/0011): Read (search / searchAll / get) + Write
// (create / update) over the generic resource factory. Process is the relational
// resource linking a Candidate to a Job; P_Client / P_Recruiter / P_Job / P_Candidate /
// P_Resume are System[Reference] (Write = the related record's id; P_Candidate is the
// Person id).
//
// Display-only Reference fields (P_JobOwner, P_Job*Reference, P_ResumeOwner,
// P_Resume*Reference — they mirror a Job/Recruiter/Person value and are not writable) are
// intentionally left out of the catalog: scalar mirrors read through as raw strings,
// nested ones (e.g. P_JobOwner -> a User) read as null. Multi-select Option read returns
// the first alias only. The full static Process type is future work (SD-3).

import type { Requester } from "../http/requester";
import type { DataType } from "../xml/decode";
import {
  createResource,
  type Resource,
  type ResourceInput,
  type ResourceItem,
  type ResourcePage,
  type SearchQuery,
} from "./resource";

const FIELDS = new Map<string, DataType>([
  ["P_Id", "System[Id]"],
  ["P_Owner", "User"],
  ["P_Client", "System[Reference]"],
  ["P_Recruiter", "System[Reference]"],
  ["P_Job", "System[Reference]"],
  ["P_Candidate", "System[Reference]"],
  ["P_Resume", "System[Reference]"],
  ["P_RegistrationDate", "System[DateTime]"],
  ["P_RegisteredBy", "User"],
  ["P_UpdateDate", "System[DateTime]"],
  ["P_UpdatedBy", "User"],
  ["P_Phase", "Option"],
  ["P_PhaseDate", "DateTime"],
  ["P_PhaseMemo", "MultilineText"],
  ["P_Close", "Option"],
  ["P_CloseReason", "Option"],
  ["P_ExpectedSalesAmount", "Number"],
  ["P_ExpectedClosingDate", "Date"],
]);

/** A decoded Process (a Candidate's progress through a Job). Known `P_` fields follow the
 *  catalog; custom `U_`/`A_` appear as decoded raw values. */
export type Process = ResourceItem;
export type ProcessPage = ResourcePage;
export type ProcessSearchQuery = SearchQuery;

/**
 * Fields to write, keyed by bare alias (e.g. `P_Phase`). `P_Id` is supplied by
 * `create` / `update` — don't set it. User / Reference fields (`P_Owner` / `P_Client` /
 * `P_Recruiter` / `P_Job` / `P_Candidate` / `P_Resume`) take an ID (number); Option fields
 * take an alias (or aliases). `null` omits a field.
 * (A precise static Write type is future work — SD-3.)
 */
export type ProcessInput = ResourceInput;
export type ProcessResource = Resource;

export const createProcessResource = (deps: {
  requester: Requester;
  host: string;
  partition: number;
}): ProcessResource =>
  createResource(
    { name: "Process", path: "process", prefix: "Process", fields: FIELDS },
    deps,
  );
