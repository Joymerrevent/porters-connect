// Candidate accessor (ADR-0004/0005/0011/0019): Read (search / searchAll / get) + Write
// (create / update) over the generic resource factory. Only the Data-Type catalog and names
// are Candidate-specific; the static Candidate / input types derive from the catalog
// (single source of truth — ADR-0019).

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
  P_Name: "SinglelineText",
  P_Reading: "SinglelineText",
  P_Mail: "Mail",
  P_MobileMail: "Mail",
  P_Telephone: "Telephone",
  P_Mobile: "Telephone",
  P_Country: "SinglelineText",
  P_Prefecture: "SinglelineText",
  P_City: "SinglelineText",
  P_Zipcode: "SinglelineText",
} as const satisfies FieldCatalog;

// P_Owner is generally required on create (docs/reference: 所有者・新規作成時は通常必須）。
// VERIFY(live): 他に create 必須の項目があるかはテナント/契約依存。過剰な必須化を避け P_Owner のみ
// 必須にする。see docs/live-verification.md (LV-5)。
const REQUIRED_ON_CREATE = [
  "P_Owner",
] as const satisfies readonly (keyof typeof FIELDS)[];

/** A decoded Candidate: known `P_` fields, each requested field `value | null`. */
export type Candidate = ReadRecord<typeof FIELDS>;
export type CandidatePage = ResourcePage<typeof FIELDS>;
export type CandidateSearchQuery = SearchQuery;

/** Fields for `create`: `P_Owner` is required; `P_Id` / system timestamps are not settable. */
export type CandidateCreateInput = CreateInput<
  typeof FIELDS,
  (typeof REQUIRED_ON_CREATE)[number]
>;
/** Fields for `update`: all optional (`null` omits, `""` clears a text field). */
export type CandidateUpdateInput = UpdateInput<typeof FIELDS>;
export type CandidateResource = Resource<
  typeof FIELDS,
  (typeof REQUIRED_ON_CREATE)[number]
>;

export const createCandidateResource = (deps: {
  requester: Requester;
  host: string;
  partition: number;
}): CandidateResource =>
  createResource(
    {
      name: "Candidate",
      path: "candidate",
      prefix: "Person",
      fields: FIELDS,
      requiredOnCreate: REQUIRED_ON_CREATE,
    },
    deps,
  );
