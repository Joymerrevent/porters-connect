// Reference expansion (ADR-0058): reading the *fields of the referenced record* instead of just
// its id. PORTERS expresses this in `field` — `field=Job.P_Client(Client.P_Id,Client.P_Name)`
// returns the client nested inside the job — and the library exposes it as a typed `expand`
// option rather than a raw string, so the referenced resource's own catalog can decode the
// nested values and derive the record type.
//
// This file owns the vocabulary: what a reference target is, what `expand` accepts, and what the
// read record becomes. Resource wiring lives in resource.ts, XML in xml/.

import type { DecodedValue } from "../xml/decode";
import type { FieldCatalog, ReadRecord } from "./read-core";

/**
 * The resource a `System[Reference]` field points at, as far as expansion needs it: its alias
 * prefix (what goes inside the `()`) and its Data-Type catalog (what decodes the answer).
 *
 * Structurally a {@link ResourceDescriptor}, spelled out here so the two types do not reference
 * each other in a circle. Descriptors are passed in directly — the referenced prefix is **not**
 * the resource name for Candidate (`Person`), which is exactly the trap this removes from callers.
 */
export type ReferenceTarget = {
  name: string;
  path: string;
  prefix: string;
  fields: FieldCatalog;
};

/**
 * A resource's expandable reference fields: bare alias -> the referenced resource's descriptor.
 * Only catalogued `System[Reference]` fields whose target the library implements appear here;
 * anything absent simply cannot be expanded (it still reads as the referenced id).
 */
export type ReferenceMap = Readonly<Record<string, ReferenceTarget>>;

/**
 * "Nothing to expand": the identity default for the reference generic, mirroring
 * {@link EmptyCatalog}. `Record<never, never>` keeps `keyof` empty, so every derived type
 * collapses back to the un-expanded shape.
 */
export type EmptyReferences = Record<never, never>;

/** The catalog of a reference target — the type its expanded values decode by. */
type CatalogOf<T> = T extends { fields: infer F extends FieldCatalog }
  ? F
  : never;

/**
 * What `expand` accepts: for each expandable reference field, the **bare aliases** to read from
 * the referenced record. The referenced prefix is never written by the caller — the descriptor
 * has it (ADR-0058). Only catalogued aliases of the target are allowed: an alias outside its
 * catalog has no Data Type here, so nothing could type or decode it.
 */
export type Expand<R extends ReferenceMap> = {
  [K in keyof R]?: readonly (keyof CatalogOf<R[K]> & string)[];
};

/**
 * The value an expanded reference field reads back as: the selected aliases, each decoded by the
 * referenced catalog's Data Type.
 *
 * `[S] extends [...]` is deliberately **non-distributive**. A caller who declares their query as
 * the loose `SearchQuery` type passes `S = readonly (...)[] | undefined`, which is not a promise
 * that anything was expanded — that falls through to the un-expanded `number`, so naming the
 * query type never changes what the record claims to hold.
 */
export type ExpandedValue<T extends ReferenceTarget, S> = [S] extends [
  readonly (infer A extends keyof CatalogOf<T> & string)[],
]
  ? { [K in A]?: DecodedValue<CatalogOf<T>[K]> | null }
  : DecodedValue<"System[Reference]">;

/**
 * The read record for a query that expanded some references: the plain {@link ReadRecord}, with
 * each expanded field's value replaced by the referenced record's own shape. Fields left out of
 * `expand` keep the referenced id (`number`), so a caller who expands one relation pays no type
 * cost on the others — that asymmetry is the point of `expand` over widening the base type.
 */
export type ExpandedReadRecord<
  F extends FieldCatalog,
  R extends ReferenceMap,
  E,
> = Omit<ReadRecord<F>, keyof E> & {
  [K in keyof E & keyof R]?: ExpandedValue<R[K], E[K]> | null;
};
