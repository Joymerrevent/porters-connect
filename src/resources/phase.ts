// Phase accessor (ADR-0061). Phase records the history of a record's phase transitions, and it is
// unlike the other 12 data resources in four ways — all of them decided in ADR-0061:
//
//   1. **No alias prefix and no `P_`.** Its aliases are bare (`Id` / `Resource` / `Date` / …), so
//      the descriptor carries `prefix: ""` and the generic factory qualifies through `qualify`
//      (案1a). The primary key is `Id`, not `P_Id` — hence `idAlias`.
//   2. **Read requires `resource=`.** Which upper resource's history to read is a *parameter*, not
//      a `condition`. `of(name)` binds it once and every call inherits it (案2a), so a caller
//      cannot forget it: `t.phase.search(...)` does not exist.
//   3. **`System[Department]`** appears in three fields (案3a).
//   4. **Write has a latest-phase rule** (the date must be newer than the current latest, etc.).
//      That depends on server-side state, so the library does not pre-judge it — PORTERS decides
//      and the failure comes back as a typed error (案4a, like Sales' `※`).
//
// Phase has no custom fields (fixed fields only) and no `Deleted` field, so it is absent from
// `CustomFieldResource` and carries no `P_Deleted` analogue.
//
// VERIFY(live): a `User`-typed field is requested with its sub-fields — `Owner(User.P_Id,…)` —
// because that is what the generic factory sends for all 13 resources. PORTERS' own Phase sample
// requests them **bare** (`field=Id,RegisteredBy,…,Owner,OwnerDepartment`) and does not show the
// parenthesised form for this resource. The response shape is the same either way, so if the
// parenthesised form is rejected, the fix is the request string only. See docs/live-verification.md.

import {
  createResource,
  type CreateInput,
  type FieldCatalog,
  type ReadRecord,
  type Resource,
  type ResourceDeps,
  type ResourceDescriptor,
  type ResourcePage,
  type SearchQuery,
  type UpdateInput,
} from "./resource";
import { RESOURCE_VALUES, type ResourceName } from "./resource-list";

const FIELDS = {
  Id: "System[Id]",
  Resource: "Number",
  ResourceId: "Number",
  Phase: "Option",
  Date: "DateTime",
  Memo: "MultilineText",
  // 0 = past phase, 1 = the latest one.
  Recent: "Number",
  RegistrationDate: "System[DateTime]",
  RegisteredBy: "User",
  UpdateDate: "System[DateTime]",
  UpdatedBy: "User",
  Owner: "User",
  OwnerDepartment: "System[Department]",
  // Only present on a Phase attached to Process / Sales (docs/reference resources/phase.md).
  // Reading them elsewhere simply yields nothing, like any unset field.
  JobOwner: "User",
  JobOwnerDepartment: "System[Department]",
  ResumeOwner: "User",
  ResumeOwnerDepartment: "System[Department]",
} as const satisfies FieldCatalog;

// Required on create per docs/reference (resources/phase.md「新規必須」列): Id / Resource /
// ResourceId。`Id` はライブラリが供給し、`Resource` は `of(name)` が埋めるので、
// 呼び出し側に残るのは `ResourceId` だけ。
const REQUIRED_ON_CREATE = [
  "ResourceId",
] as const satisfies readonly (keyof typeof FIELDS)[];

/**
 * Phase's names + catalog. Exported for in-repo dev tooling — the fake server (ADR-0043) builds
 * Phase wire shapes from this very catalog, so the two cannot drift. Not re-exported from
 * `src/index.ts`, so it stays out of the published API.
 */
export const PHASE_DESCRIPTOR = {
  name: "Phase",
  path: "phase",
  // Bare aliases — see the module comment (ADR-0061 案1a).
  prefix: "",
  idAlias: "Id",
  fields: FIELDS,
} as const satisfies ResourceDescriptor;

/** A decoded Phase entry: known aliases, each requested field `value | null`. */
export type Phase = ReadRecord<typeof FIELDS>;
export type PhasePage = ResourcePage<typeof FIELDS>;
export type PhaseSearchQuery = SearchQuery<typeof FIELDS>;

/** Fields for `create`: `ResourceId` required (`Id` and `Resource` are supplied for you). */
export type PhaseCreateInput = CreateInput<
  typeof FIELDS,
  (typeof REQUIRED_ON_CREATE)[number]
>;
/** Fields for `update`: all optional (`null` omits, `""` clears a text field). */
export type PhaseUpdateInput = UpdateInput<typeof FIELDS>;

/** The Phase accessor for one bound resource — same shape as every other resource. */
export type PhaseResource = Resource<
  typeof FIELDS,
  (typeof REQUIRED_ON_CREATE)[number]
>;

/**
 * Phase is reached through the resource whose history you want (ADR-0061 案2a):
 *
 * ```ts
 * const phases = t.phase.of("client");
 * await phases.search({ condition: { ResourceId: { eq: 20001 } } });
 * ```
 *
 * The name is the accessor's own spelling ({@link ResourceName}) — `of(5)` and `of("clinet")`
 * are compile errors (案5b).
 */
export type PhaseAccessor = {
  of(resource: ResourceName): PhaseResource;
};

export const createPhaseAccessor = (deps: ResourceDeps): PhaseAccessor => ({
  of: (resource) => {
    // One binding, two places PORTERS wants it: `resource=` on Read and the `Resource` field on
    // Write. Both are filled from here, so neither can be forgotten or contradicted.
    const value = RESOURCE_VALUES[resource];
    return createResource(
      {
        ...PHASE_DESCRIPTOR,
        requiredOnCreate: REQUIRED_ON_CREATE,
        readParams: { resource: String(value) },
        writeDefaults: { Resource: value },
      },
      deps,
    );
  },
});
