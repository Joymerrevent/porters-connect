// Client accessor (ADR-0004/0005/0011/0019): Read (search / searchAll / get) + Write
// (create / update) over the generic resource factory. Only the Data-Type catalog and
// names are Client-specific; the static Client / input types derive from the catalog
// (ADR-0019).

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
  P_RegistrationDate: "System[DateTime]",
  P_RegisteredBy: "User",
  P_UpdateDate: "System[DateTime]",
  P_UpdatedBy: "User",
  P_Phase: "Option",
  P_PhaseDate: "DateTime",
  P_PhaseMemo: "MultilineText",
  P_Name: "SinglelineText",
  P_Memo: "MultilineText",
  P_Country: "SinglelineText",
  P_Prefecture: "SinglelineText",
  P_City: "SinglelineText",
  P_Street: "MultilineText",
  P_Zipcode: "SinglelineText",
  P_Telephone: "Telephone",
  P_Fax: "Telephone",
} as const satisfies FieldCatalog;

// Required on create per docs/reference (resources/client.md「新規必須」列): P_Owner。
// （P_Id は System[Id]＝lib 供給のため除外。LV-5 は reference で確定。）
const REQUIRED_ON_CREATE = [
  "P_Owner",
] as const satisfies readonly (keyof typeof FIELDS)[];

/** A decoded Client (company): known `P_` fields, each requested field `value | null`. */
export type Client = ReadRecord<typeof FIELDS>;
export type ClientPage = ResourcePage<typeof FIELDS>;
export type ClientSearchQuery = SearchQuery;

/** Fields for `create`: `P_Owner` required; `P_Id` / system timestamps are not settable. */
export type ClientCreateInput = CreateInput<
  typeof FIELDS,
  (typeof REQUIRED_ON_CREATE)[number]
>;
/** Fields for `update`: all optional (`null` omits, `""` clears a text field). */
export type ClientUpdateInput = UpdateInput<typeof FIELDS>;
export type ClientResource = Resource<
  typeof FIELDS,
  (typeof REQUIRED_ON_CREATE)[number]
>;

export const createClientResource = (deps: {
  requester: Requester;
  host: string;
  partition: number;
}): ClientResource =>
  createResource(
    {
      name: "Client",
      path: "client",
      prefix: "Client",
      fields: FIELDS,
      requiredOnCreate: REQUIRED_ON_CREATE,
    },
    deps,
  );
