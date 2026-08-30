// Activity accessor (ADR-0004/0005/0011/0019): Read (search / searchAll / get) + Write
// (create / update) over the generic resource factory. Only the Data-Type catalog and
// names are Activity-specific; the static Activity / input types derive from the catalog
// (ADR-0019).
//
// Activity attaches to *any* upper resource: `P_Resource` is the resource's numeric id
// (Resource List — Candidate 1, Job 3, Client 5, …) and `P_ResourceId` is the record's id
// in that resource. That makes `P_ResourceId` a **polymorphic** System[Reference]: which
// catalog decodes it is a runtime value, not a static fact, so it is deliberately left out
// of `REFERENCES` and reads as the referenced id — the same as any un-expanded reference
// (ADR-0058). Expanding it would require choosing a descriptor we cannot know at compile
// time; callers read `P_Resource` and fetch through the matching accessor themselves.

import {
  createResource,
  type CreateInput,
  type EmptyCatalog,
  type FieldCatalog,
  type ReadRecord,
  type Resource,
  type ResourceDeps,
  type ResourceDescriptor,
  type ResourcePage,
  type SearchQuery,
  type UpdateInput,
} from "./resource";

const FIELDS = {
  P_Id: "System[Id]",
  P_Owner: "User",
  P_Title: "SinglelineText",
  P_RegistrationDate: "System[DateTime]",
  P_RegisteredBy: "User",
  P_UpdateDate: "System[DateTime]",
  P_UpdatedBy: "User",
  P_Phase: "Option",
  P_PhaseDate: "DateTime",
  P_PhaseMemo: "MultilineText",
  // Which upper resource this activity hangs off (Resource List's numeric id) …
  P_Resource: "Number",
  // … and the record id within it. Polymorphic reference — see the module comment.
  P_ResourceId: "System[Reference]",
  P_FromDate: "DateTime",
  P_ToDate: "DateTime",
  P_Memo: "MultilineText",
  // VERIFY(live): participants is a `User` field that can hold several people. Whether the
  // Read response repeats the nested <User> element (and how) is unconfirmed; the decoder
  // takes the first, like every other User field. See docs/live-verification.md.
  P_EventParticipants: "User",
  P_EventResources: "Option",
  // 削除状態（"0" / "1"）。PORTERS が Data Type を与えていない項目＝`null`（ADR-0056。
  // 詳細は candidate.ts のコメント）。Read の field でのみ指定でき、型もそう振る舞う。
  P_Deleted: null,
} as const satisfies FieldCatalog;

// Required on create per docs/reference (resources/activity.md「新規必須」列): P_Owner /
// P_Title（P_Id は System[Id]＝lib 供給のため除外）。P_Resource / P_ResourceId は必須では
// ないと公表されている＝どこにも紐づかない Activity も登録できる。手前で厳しくしない。
const REQUIRED_ON_CREATE = [
  "P_Owner",
  "P_Title",
] as const satisfies readonly (keyof typeof FIELDS)[];

/**
 * Activity's names + standard catalog. Exported for in-repo dev tooling — the fake server
 * (ADR-0043) builds Activity wire shapes from this very catalog, so the two cannot drift.
 * Not re-exported from `src/index.ts`, so it stays out of the published API.
 */
export const ACTIVITY_DESCRIPTOR = {
  name: "Activity",
  path: "activity",
  prefix: "Activity",
  fields: FIELDS,
} as const satisfies ResourceDescriptor;

/** A decoded Activity (an action logged against another record): known `P_` fields, each `value | null`. */
export type Activity = ReadRecord<typeof FIELDS>;
export type ActivityPage = ResourcePage<typeof FIELDS>;
export type ActivitySearchQuery = SearchQuery<typeof FIELDS>;

/** Fields for `create`: `P_Owner` / `P_Title` required; `P_Id` / timestamps are not settable. */
export type ActivityCreateInput = CreateInput<
  typeof FIELDS,
  (typeof REQUIRED_ON_CREATE)[number]
>;
/** Fields for `update`: all optional (`null` omits, `""` clears a text field). */
export type ActivityUpdateInput = UpdateInput<typeof FIELDS>;
/** The Activity accessor; `C` is the declared custom-field catalog merged on (ADR-0023). */
export type ActivityResource<C extends FieldCatalog = EmptyCatalog> = Resource<
  typeof FIELDS & C,
  (typeof REQUIRED_ON_CREATE)[number]
>;

export const createActivityResource = <C extends FieldCatalog = EmptyCatalog>(
  deps: ResourceDeps,
  custom?: C,
): ActivityResource<C> => {
  // Custom U_/A_ aliases never collide with P_, so the merge is exactly `typeof FIELDS & C`;
  // the cast just names that intersection (defineFields already validated aliases — ADR-0023 D7).
  const fields = { ...FIELDS, ...custom } as typeof FIELDS & C;
  return createResource(
    { ...ACTIVITY_DESCRIPTOR, fields, requiredOnCreate: REQUIRED_ON_CREATE },
    deps,
  );
};
