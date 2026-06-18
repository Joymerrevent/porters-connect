// Client accessor (ADR-0004/0005/0011/0019): Read (search / searchAll / get) + Write
// (create / update) over the generic resource factory. Only the Data-Type catalog and
// names are Client-specific; the static Client / input types derive from the catalog
// (ADR-0019).

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
/** The Client accessor; `C` is the declared custom-field catalog merged on (ADR-0023). */
export type ClientResource<C extends FieldCatalog = EmptyCatalog> = Resource<
  typeof FIELDS & C,
  (typeof REQUIRED_ON_CREATE)[number]
>;

export const createClientResource = <C extends FieldCatalog = EmptyCatalog>(
  deps: { requester: Requester; host: string; partition: number },
  custom?: C,
): ClientResource<C> => {
  // Custom U_/A_ aliases never collide with P_, so the merge is exactly `typeof FIELDS & C`;
  // the cast just names that intersection (defineFields already validated aliases — ADR-0023 D7).
  const fields = { ...FIELDS, ...custom } as typeof FIELDS & C;
  return createResource(
    {
      name: "Client",
      path: "client",
      prefix: "Client",
      fields,
      requiredOnCreate: REQUIRED_ON_CREATE,
    },
    deps,
  );
};
