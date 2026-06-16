// Client accessor (ADR-0004/0005/0011): Read (search / searchAll / get) + Write
// (create / update) over the generic resource factory. Only the Data-Type catalog and
// names are Client-specific. The full static Client type is future work (SD-3).

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
  ["P_RegistrationDate", "System[DateTime]"],
  ["P_RegisteredBy", "User"],
  ["P_UpdateDate", "System[DateTime]"],
  ["P_UpdatedBy", "User"],
  ["P_Phase", "Option"],
  ["P_PhaseDate", "DateTime"],
  ["P_PhaseMemo", "MultilineText"],
  ["P_Name", "SinglelineText"],
  ["P_Memo", "MultilineText"],
  ["P_Country", "SinglelineText"],
  ["P_Prefecture", "SinglelineText"],
  ["P_City", "SinglelineText"],
  ["P_Street", "MultilineText"],
  ["P_Zipcode", "SinglelineText"],
  ["P_Telephone", "Telephone"],
  ["P_Fax", "Telephone"],
]);

/** A decoded Client (company). Known `P_` fields follow the catalog; custom `U_`/`A_`
 *  appear as decoded raw values. */
export type Client = ResourceItem;
export type ClientPage = ResourcePage;
export type ClientSearchQuery = SearchQuery;

/**
 * Fields to write, keyed by bare alias (e.g. `P_Name`). `P_Id` is supplied by
 * `create` / `update` — don't set it. The `P_Owner` (User) field takes an ID
 * (number); Option fields take an alias (or aliases). `null` omits a field.
 * (A precise static Write type is future work — SD-3.)
 */
export type ClientInput = ResourceInput;
export type ClientResource = Resource;

export const createClientResource = (deps: {
  requester: Requester;
  host: string;
  partition: number;
}): ClientResource =>
  createResource(
    { name: "Client", path: "client", prefix: "Client", fields: FIELDS },
    deps,
  );
