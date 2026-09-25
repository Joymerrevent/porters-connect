// What a resource *is*, independent of the tenant: its names, alias prefix, id alias and standard
// `P_` catalog. Shared by every family — the data resources' factory, the master resources and the
// in-repo fake server all read the same descriptor (ADR-0097: split out of the data-resource factory,
// which the masters used to import it from).

import type { FieldCatalog } from "./catalog";
import type { ReferenceMap } from "./expand";

/**
 * The tenant-independent half of a resource definition: names + the standard `P_` catalog.
 * Each resource module exports its own (e.g. `CANDIDATE_DESCRIPTOR`) so in-repo dev tooling —
 * the fake server (ADR-0043) — derives wire shapes from the *same* catalog instead of a copy
 * that could drift. Not part of the published API: `src/index.ts` is curated.
 */
export type ResourceDescriptor<
  F extends FieldCatalog = FieldCatalog,
  R extends ReferenceMap = ReferenceMap,
> = {
  /** Root element + Write resource name, e.g. `"Candidate"`. */
  name: string;
  /** URL path segment, e.g. `"candidate"`. */
  path: string;
  /** Field alias prefix, e.g. `"Person"`. Empty for a resource whose aliases are bare (Phase). */
  prefix: string;
  /**
   * Primary-key alias. `P_Id` for every resource whose aliases carry the `P_` convention;
   * **Phase names it `Id`** (ADR-0061). Read (`get`) and Write (`create` / `update`) both address
   * the record through it, so it is a fact about the resource, not a constant of the factory.
   * The fake server has always modelled this as `idAlias` — the library catches up here.
   */
  idAlias?: string;
  /** Data-Type catalog (`as const`): bare alias -> Data Type. */
  fields: F;
  /**
   * Expandable `System[Reference]` fields (ADR-0058): bare alias -> the referenced resource's
   * descriptor. The catalog only records that a field *is* a reference, never what it points at,
   * so the link lives here — that is also where Candidate's `Person` alias prefix is absorbed.
   * Omitted, or an alias left out, means the field reads as the referenced id and nothing else.
   */
  references?: R;
};
