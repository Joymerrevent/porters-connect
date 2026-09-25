// The Read `field` parameter: turning bare aliases into the wire form PORTERS wants
// (`{prefix}.{alias}`, a User field with its sub-fields), and the default "every catalogued field"
// when `field` is omitted (ADR-0020 / ADR-0059).

import { bareAlias, qualify } from "../../util/alias";
import type { DataType } from "../../porters/data-type";
import { USER_SUBFIELDS } from "../../porters/read-rules";
import type { FieldCatalog } from "./catalog";

// --- Read `field` assembly (ADR-0020) -------------------------------------------------------

// One `field=` entry for a bare alias. PORTERS wants `{prefix}.{alias}`; a User-typed field is
// expanded to its 4 readable sub-fields so the wire shape matches `decodeUser` — asking for it
// without `()` would return an id, and the typed record promises a `UserRef`. An alias the catalog
// does not know (a tenant `U_`/`A_` field) is prefixed and left alone.
const readFieldEntry = (
  prefix: string,
  alias: string,
  type: DataType | null | undefined,
): string =>
  type === "User"
    ? `${qualify(prefix, alias)}(${USER_SUBFIELDS.map((s) => `User.${s}`).join(",")})`
    : qualify(prefix, alias);

/**
 * Map caller-supplied bare aliases onto the wire form, the same assembly the default list uses.
 * A prefix that slipped through a cast is stripped first (`Person.P_Name` -> `P_Name`), mirroring
 * `bareAlias` on the response side: the types say bare, the runtime still understands the old
 * prefixed form rather than sending `Person.Person.P_Name`. That asymmetry is deliberate.
 */
export const qualifyReadFields = (
  prefix: string,
  fields: ReadonlyMap<string, DataType | null>,
  aliases: readonly string[],
): string[] =>
  aliases.map((entry) => {
    const alias = bareAlias(entry);
    return readFieldEntry(prefix, alias, fields.get(alias));
  });

// 省略時に全項目を送るのは ADR-0020、裸の alias に接頭辞を付けるのは ADR-0059。
/**
 * The `field` parameter of a resource that takes one: the caller's bare aliases, or every catalogued
 * alias when `field` is omitted, prefixed through the same assembly as {@link qualifyReadFields}.
 * `[]` sends no `field` at all (PORTERS' own answer). Built once per catalog; the returned setter
 * runs per query.
 */
export const createFieldParam = (
  prefix: string,
  fields: FieldCatalog,
): ((p: URLSearchParams, field: readonly string[] | undefined) => void) => {
  const lookup = new Map<string, DataType | null>(Object.entries(fields));
  const defaults = Object.keys(fields);
  return (p, field) => {
    const aliases = field ?? defaults;
    if (aliases.length > 0) {
      p.set("field", qualifyReadFields(prefix, lookup, aliases).join(","));
    }
  };
};
