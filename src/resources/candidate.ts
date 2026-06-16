// Candidate accessor (ADR-0004/0005/0011): Read (search / searchAll / get) + Write
// (create / update) over the generic resource factory. Only the Field-Type catalog and
// names are Candidate-specific. The full static Candidate type — distinct Read vs Write
// shapes — is future work (SD-3).

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
  ["P_RegistrationDate", "System[DateTime]"],
  ["P_RegisteredBy", "User"],
  ["P_UpdateDate", "System[DateTime]"],
  ["P_UpdatedBy", "User"],
  ["P_Phase", "Option"],
  ["P_PhaseDate", "DateTime"],
  ["P_Name", "SinglelineText"],
  ["P_Reading", "SinglelineText"],
  ["P_Mail", "Mail"],
  ["P_MobileMail", "Mail"],
  ["P_Telephone", "Telephone"],
  ["P_Mobile", "Telephone"],
  ["P_Country", "SinglelineText"],
  ["P_Prefecture", "SinglelineText"],
  ["P_City", "SinglelineText"],
  ["P_Zipcode", "SinglelineText"],
]);

/** A decoded Candidate. Known `P_` fields follow the catalog; custom `U_`/`A_`
 *  appear as decoded raw values. */
export type Candidate = ResourceItem;
export type CandidatePage = ResourcePage;
export type CandidateSearchQuery = SearchQuery;

/**
 * Fields to write, keyed by bare alias (e.g. `P_Name`). `P_Id` is supplied by
 * `create` / `update` — don't set it. User / Reference fields take an ID (number);
 * Option fields take an alias (or aliases). `null` omits a field.
 * (A precise static Write type is future work — SD-3.)
 */
export type CandidateInput = ResourceInput;
export type CandidateResource = Resource;

export const createCandidateResource = (deps: {
  requester: Requester;
  host: string;
  partition: number;
}): CandidateResource =>
  createResource(
    { name: "Candidate", path: "candidate", prefix: "Person", fields: FIELDS },
    deps,
  );
