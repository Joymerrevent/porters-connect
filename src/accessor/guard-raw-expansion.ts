// Refusing an expansion hand-written into `field` (ADR-0058 / RV-31).

import { PortersConfigError } from "../errors";
import type { DataType } from "../porters/data-type";
import { bareAlias } from "../util/alias";

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
