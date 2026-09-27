// Field alias qualification. PORTERS names a field `{Prefix}.{Alias}` (`Person.P_Name`), but
// **Phase has no prefix** — its aliases are bare (`Id` / `Resource` / …) and the wire form is
// just `Id` (ADR-0061 案1a). Joining the two naively would send `.Id`, so every place that
// builds a qualified name goes through this one function: `field` / `condition` / `order` on
// the Read side and the `<Tag>` on the Write side.
//
// It lives in `util/` because both `resources/` and `xml/` need it and `xml` never imports
// from `resources` (the dependency runs the other way). `bareAlias` is the reverse: it takes the
// prefix off a tag or an entry that carries one.

/** `{prefix}.{alias}`, or the bare alias when the resource has no prefix. */
export const qualify = (prefix: string, alias: string): string =>
  prefix === "" ? alias : `${prefix}.${alias}`;

/**
 * A tag or entry's bare alias: `Person.P_Name` -> `P_Name`. Both sides of a Read use it — the
 * response, whose tags are prefixed, and the request, where a prefix that slipped through a cast
 * is stripped rather than doubled (ADR-0059).
 */
// `includes(".")` -> `includes("")` is an equivalent mutant: for a dotless key,
// slice(indexOf(".") + 1) is slice(0), which equals the key — same as the else.
// Stryker disable StringLiteral
export const bareAlias = (key: string): string =>
  key.includes(".") ? key.slice(key.indexOf(".") + 1) : key;
// Stryker restore StringLiteral
