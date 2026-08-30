// Recruiter accessor (ADR-0004/0005/0011/0019): Read (search / searchAll / get) + Write
// (create / update) over the generic resource factory. Only the Data-Type catalog and
// names are Recruiter-specific; the static Recruiter / input types derive from the catalog
// (ADR-0019). A Recruiter is a person at a Client company, so P_Client is System[Reference]
// (Write = ID) and is expandable (ADR-0058).

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

const FIELDS = {
  P_Id: "System[Id]",
  P_Owner: "User",
  P_Client: "System[Reference]",
  P_RegistrationDate: "System[DateTime]",
  P_RegisteredBy: "User",
  P_UpdateDate: "System[DateTime]",
  P_UpdatedBy: "User",
  P_Phase: "Option",
  P_PhaseDate: "DateTime",
  P_PhaseMemo: "MultilineText",
  P_Name: "SinglelineText",
  P_Reading: "SinglelineText",
  P_Division: "SinglelineText",
  P_Title: "SinglelineText",
  P_Memo: "MultilineText",
  P_Country: "SinglelineText",
  P_Prefecture: "SinglelineText",
  P_City: "SinglelineText",
  P_Street: "MultilineText",
  P_Zipcode: "SinglelineText",
  P_Telephone: "Telephone",
  P_Fax: "Telephone",
  P_Mail: "Mail",
  P_Mobile: "Telephone",
  // PORTERS 自身が `Telephone` と公表している（Candidate の `P_MobileMail` は `Mail` なので
  // リソース間で食い違うが、正典どおりに写す＝Field List 記事で確認済み）。忠実さを優先する。
  P_MobileMail: "Telephone",
  // 削除状態（"0" / "1"）。PORTERS が Data Type を与えていない項目＝`null`（ADR-0056。
  // 詳細は candidate.ts のコメント）。Read の field でのみ指定でき、型もそう振る舞う。
  P_Deleted: null,
} as const satisfies FieldCatalog;

// Required on create per docs/reference (resources/recruiter.md「新規必須」列): P_Owner /
// P_Client（P_Id は System[Id]＝lib 供給のため除外）。
const REQUIRED_ON_CREATE = [
  "P_Owner",
  "P_Client",
] as const satisfies readonly (keyof typeof FIELDS)[];

// Expandable reference fields (ADR-0058). The Field List article says Read may reach the
// Client resource's fields through P_Client, which is exactly what `expand` requests.
const REFERENCES = {
  P_Client: CLIENT_DESCRIPTOR,
} as const satisfies ReferenceMap;

/**
 * Recruiter's names + standard catalog. Exported for in-repo dev tooling — the fake server
 * (ADR-0043) builds Recruiter wire shapes from this very catalog, so the two cannot drift.
 * Not re-exported from `src/index.ts`, so it stays out of the published API.
 */
export const RECRUITER_DESCRIPTOR = {
  name: "Recruiter",
  path: "recruiter",
  prefix: "Recruiter",
  fields: FIELDS,
  references: REFERENCES,
} as const satisfies ResourceDescriptor;

/** A decoded Recruiter (a person at a client company): known `P_` fields, each `value | null`. */
export type Recruiter = ReadRecord<typeof FIELDS>;
export type RecruiterPage = ResourcePage<typeof FIELDS>;
export type RecruiterSearchQuery = SearchQuery<
  typeof FIELDS,
  typeof REFERENCES
>;

/** Fields for `create`: `P_Owner` / `P_Client` required; `P_Id` / system timestamps are not settable. */
export type RecruiterCreateInput = CreateInput<
  typeof FIELDS,
  (typeof REQUIRED_ON_CREATE)[number]
>;
/** Fields for `update`: all optional (`null` omits, `""` clears a text field). */
export type RecruiterUpdateInput = UpdateInput<typeof FIELDS>;
/** The Recruiter accessor; `C` is the declared custom-field catalog merged on (ADR-0023). */
export type RecruiterResource<C extends FieldCatalog = EmptyCatalog> = Resource<
  typeof FIELDS & C,
  (typeof REQUIRED_ON_CREATE)[number],
  typeof REFERENCES
>;

export const createRecruiterResource = <C extends FieldCatalog = EmptyCatalog>(
  deps: ResourceDeps,
  custom?: C,
): RecruiterResource<C> => {
  // Custom U_/A_ aliases never collide with P_, so the merge is exactly `typeof FIELDS & C`;
  // the cast just names that intersection (defineFields already validated aliases — ADR-0023 D7).
  const fields = { ...FIELDS, ...custom } as typeof FIELDS & C;
  return createResource(
    { ...RECRUITER_DESCRIPTOR, fields, requiredOnCreate: REQUIRED_ON_CREATE },
    deps,
  );
};
