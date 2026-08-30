// Reference expansion (ADR-0058): reading the *fields of the referenced record* instead of just
// its id. PORTERS expresses this in `field` — `field=Job.P_Client(Client.P_Id,Client.P_Name)`
// returns the client nested inside the job — and the library exposes it as a typed `expand`
// option rather than a raw string, so the referenced resource's own catalog can decode the
// nested values and derive the record type.
//
// This file owns the vocabulary (what a reference target is, what `expand` accepts, what the read
// record becomes) plus the three mechanical halves: the `field` entries to send, the catalogs to
// decode the answer with, and the guard that turns a hand-written expansion into a clear error.
// Resource wiring lives in resource.ts, XML in xml/.

import { PortersConfigError } from "../errors";
import type { DataType, DecodedValue } from "../xml/decode";
import { bareAlias, type FieldCatalog, type ReadRecord } from "./read-core";

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

/**
 * A caller's `expand`, seen structurally. The typed `Expand<R>` narrows what may be written; the
 * encoder below only needs "alias -> selected aliases", the same way `encodeCondition` works off
 * the loose catalog.
 */
export type ExpandSelection = Readonly<
  Record<string, readonly string[] | undefined>
>;

/** A resource's Read context for expansion: how it names its own fields, and what they point at. */
export type ExpandContext = {
  prefix: string;
  references: ReferenceMap;
};

/**
 * The `field=` entry for one expanded reference: `{prefix}.{alias}({target}.{sub},…)`.
 *
 * VERIFY(live): the aliases inside `()` carry the **referenced** resource's alias prefix, which
 * the reference only ever shows for resources whose prefix equals their name
 * (`Job.P_Client(Client.P_Id,…)`). Candidate is the one resource where they differ (`Person`), so
 * `Process.P_Candidate(Person.P_Id,…)` is inferred from the Field Type article's Write wording,
 * not observed. See docs/live-verification.md (LV-16) — if it is wrong, only this string changes.
 */
const expandEntry = (
  prefix: string,
  alias: string,
  target: ReferenceTarget,
  sub: readonly string[],
): string =>
  `${prefix}.${alias}(${sub.map((s) => `${target.prefix}.${s}`).join(",")})`;

// An expansion is honoured only when the alias is a known reference *and* something was selected:
// `expand: { P_Client: [] }` selects nothing, which on the wire is the ID-only form we already send.
const selectedExpansions = (
  expand: ExpandSelection | undefined,
  references: ReferenceMap,
): [string, ReferenceTarget, readonly string[]][] =>
  Object.entries(expand ?? {}).flatMap(([alias, sub]) => {
    const target = references[alias];
    return target === undefined || sub === undefined || sub.length === 0
      ? []
      : [[alias, target, sub] as [string, ReferenceTarget, readonly string[]]];
  });

/**
 * Fold `expand` into an already-assembled `field` list: an expanded alias **replaces** its plain
 * entry rather than being added next to it.
 *
 * PORTERS expresses the expansion as one `field` entry, and sending the same alias twice — once
 * with `()` and once without — has no documented winner. Rather than guess which one PORTERS
 * honours, we never send both (fail-safe). An alias not already in the list (the caller narrowed
 * `field` themselves) is appended, so asking for an expansion always sends it.
 */
export const applyExpand = (
  entries: readonly string[],
  expand: ExpandSelection | undefined,
  ctx: ExpandContext,
): string[] => {
  const out = [...entries];
  for (const [alias, target, sub] of selectedExpansions(
    expand,
    ctx.references,
  )) {
    const entry = expandEntry(ctx.prefix, alias, target, sub);
    const at = out.indexOf(`${ctx.prefix}.${alias}`);
    if (at === -1) out.push(entry);
    else out[at] = entry;
  }
  return out;
};

/**
 * The catalogs the response decoder needs: expanded alias -> the referenced resource's Data-Type
 * map. Built per call because it depends on what this query asked to expand; a read that expands
 * nothing gets `undefined` and reuses the resource's cached decoder.
 */
export const expansionCatalogs = (
  expand: ExpandSelection | undefined,
  references: ReferenceMap,
): ReadonlyMap<string, ReadonlyMap<string, DataType | null>> | undefined => {
  const selected = selectedExpansions(expand, references);
  return selected.length === 0
    ? undefined
    : new Map(
        selected.map(([alias, target]) => [
          alias,
          new Map(Object.entries(target.fields)),
        ]),
      );
};

/**
 * Reject an expansion hand-written into `field` (`"Job.P_Client(Client.P_Id)"`), pointing at
 * `expand` instead.
 *
 * `field` is typed as bare aliases (ADR-0059), so this string can only arrive through a cast —
 * this is the layer underneath that type, not a substitute for it (defence in depth). It exists
 * because the alternative is worse than an error: the library would send the expansion, PORTERS
 * would answer with the nested record, and `decodeReference` would keep the id and **silently
 * discard everything else** (RV-31). Nothing here removes a capability — `expand` sends the very
 * same request and gives back the decoded record.
 *
 * Only catalogued `System[Reference]` aliases are guarded. A `User` field's `()` is the library's
 * own doing and legitimate; an alias outside the catalog (a tenant `U_`/`A_` field, or `Image`'s
 * `(FileName,ContentType,Content)`) is passed through as before — we have no basis to judge it.
 */
export const guardRawExpansion = (
  entries: readonly string[],
  fields: ReadonlyMap<string, DataType | null>,
): void => {
  for (const entry of entries) {
    const open = entry.indexOf("(");
    if (open === -1) continue;
    const alias = bareAlias(entry.slice(0, open));
    if (fields.get(alias) !== "System[Reference]") continue;
    throw new PortersConfigError(
      `field entry "${entry}" expands a reference; expansions go in "expand", not "field"`,
      {
        category: "config",
        hint: `Use expand: { ${alias}: ["P_Id", ...] }. The library builds the "()" form and decodes the referenced record; a raw field string would be sent but its nested answer discarded.`,
      },
    );
  }
};
