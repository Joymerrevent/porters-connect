// Folding `expand` into the `field` list (ADR-0058).

import { qualify } from "../util/alias";
import type { ReferenceTarget, ExpandSelection, ExpandContext } from "./expand";
import { selectedExpansions } from "./selected-expansions";

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
  `${qualify(prefix, alias)}(${sub.map((s) => qualify(target.prefix, s)).join(",")})`;

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
    const at = out.indexOf(qualify(ctx.prefix, alias));
    if (at === -1) out.push(entry);
    else out[at] = entry;
  }
  return out;
};
