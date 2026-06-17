// Process accessor (ADR-0004/0005/0011/0019): Read (search / searchAll / get) + Write
// (create / update) over the generic resource factory. Process is the relational
// resource linking a Candidate to a Job; P_Client / P_Recruiter / P_Job / P_Candidate /
// P_Resume are System[Reference] (Write = the related record's id; P_Candidate is the
// Person id).
//
// Display-only Reference fields (P_JobOwner, P_Job*Reference, P_ResumeOwner,
// P_Resume*Reference — they mirror a Job/Recruiter/Person value and are not writable) are
// intentionally left out of the catalog: scalar mirrors read through as raw strings,
// nested ones (e.g. P_JobOwner -> a User) read as null. Multi-select Option read returns
// the first alias only. The static Process / input types derive from the catalog (ADR-0019).

import type { Requester } from "../http/requester";
import {
  createResource,
  type CreateInput,
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
} as const;

// VERIFY(live): Process は関連リソースを繋ぐため、P_Owner 以外に P_Candidate / P_Job 等が
// create 必須の可能性が高いが実機未確認。過剰な必須化を避け確証のある P_Owner のみ必須にする。
// see docs/live-verification.md (LV-5)。
const REQUIRED_ON_CREATE = ["P_Owner"] as const;

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
export type ProcessResource = Resource<
  typeof FIELDS,
  (typeof REQUIRED_ON_CREATE)[number]
>;

export const createProcessResource = (deps: {
  requester: Requester;
  host: string;
  partition: number;
}): ProcessResource =>
  createResource(
    {
      name: "Process",
      path: "process",
      prefix: "Process",
      fields: FIELDS,
      requiredOnCreate: REQUIRED_ON_CREATE,
    },
    deps,
  );
