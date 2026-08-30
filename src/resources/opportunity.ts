// Opportunity accessor (ADR-0004/0005/0011/0019): Read (search / searchAll / get) + Write
// (create / update) over the generic resource factory. Only the Data-Type catalog and
// names are Opportunity-specific; the static Opportunity / input types derive from the
// catalog (ADR-0019). A sales opportunity against a Client and one of its Recruiters.
//
// Opportunity is the newest resource in the API (Field List updated 2023-08-10) and the
// only data resource with **no `P_Deleted`** — PORTERS simply does not publish one. We do
// not invent it: the absence is the fact, and reference-catalog.test.ts checks both
// directions so neither a missing nor a phantom `P_Deleted` can slip in.

import {
  createResource,
  type CreateInput,
  type EmptyCatalog,
  type FieldCatalog,
  type ReadRecord,
  type ReferenceMap,
  type Resource,
  type ResourceDeps,
  type ResourceDescriptor,
  type ResourcePage,
  type SearchQuery,
  type UpdateInput,
} from "./resource";
import { CLIENT_DESCRIPTOR } from "./client";
import { RECRUITER_DESCRIPTOR } from "./recruiter";

const FIELDS = {
  P_Id: "System[Id]",
  P_Owner: "User",
  P_Client: "System[Reference]",
  P_Recruiter: "System[Reference]",
  P_RegistrationDate: "System[DateTime]",
  P_RegisteredBy: "User",
  P_UpdateDate: "System[DateTime]",
  P_UpdatedBy: "User",
  P_Phase: "Option",
  P_PhaseDate: "DateTime",
  P_PhaseMemo: "MultilineText",
  P_Position: "SinglelineText",
} as const satisfies FieldCatalog;

// Required on create per docs/reference (resources/opportunity.md「新規必須」列): P_Owner /
// P_Client / P_Recruiter（P_Id は System[Id]＝lib 供給のため除外）。
const REQUIRED_ON_CREATE = [
  "P_Owner",
  "P_Client",
  "P_Recruiter",
] as const satisfies readonly (keyof typeof FIELDS)[];

// Expandable reference fields (ADR-0058) — both System[Reference] fields Opportunity carries.
const REFERENCES = {
  P_Client: CLIENT_DESCRIPTOR,
  P_Recruiter: RECRUITER_DESCRIPTOR,
} as const satisfies ReferenceMap;

/**
 * Opportunity's names + standard catalog. Exported for in-repo dev tooling — the fake server
 * (ADR-0043) builds Opportunity wire shapes from this very catalog, so the two cannot drift.
 * Not re-exported from `src/index.ts`, so it stays out of the published API.
 */
export const OPPORTUNITY_DESCRIPTOR = {
  name: "Opportunity",
  path: "opportunity",
  prefix: "Opportunity",
  fields: FIELDS,
  references: REFERENCES,
} as const satisfies ResourceDescriptor;

/** A decoded Opportunity (a sales opportunity): known `P_` fields, each `value | null`. */
export type Opportunity = ReadRecord<typeof FIELDS>;
export type OpportunityPage = ResourcePage<typeof FIELDS>;
export type OpportunitySearchQuery = SearchQuery<
  typeof FIELDS,
  typeof REFERENCES
>;

/** Fields for `create`: owner and both references required; `P_Id` / timestamps are not settable. */
export type OpportunityCreateInput = CreateInput<
  typeof FIELDS,
  (typeof REQUIRED_ON_CREATE)[number]
>;
/** Fields for `update`: all optional (`null` omits, `""` clears a text field). */
export type OpportunityUpdateInput = UpdateInput<typeof FIELDS>;
/** The Opportunity accessor; `C` is the declared custom-field catalog merged on (ADR-0023). */
export type OpportunityResource<C extends FieldCatalog = EmptyCatalog> =
  Resource<
    typeof FIELDS & C,
    (typeof REQUIRED_ON_CREATE)[number],
    typeof REFERENCES
  >;

export const createOpportunityResource = <
  C extends FieldCatalog = EmptyCatalog,
>(
  deps: ResourceDeps,
  custom?: C,
): OpportunityResource<C> => {
  // Custom U_/A_ aliases never collide with P_, so the merge is exactly `typeof FIELDS & C`;
  // the cast just names that intersection (defineFields already validated aliases — ADR-0023 D7).
  const fields = { ...FIELDS, ...custom } as typeof FIELDS & C;
  return createResource(
    { ...OPPORTUNITY_DESCRIPTOR, fields, requiredOnCreate: REQUIRED_ON_CREATE },
    deps,
  );
};
