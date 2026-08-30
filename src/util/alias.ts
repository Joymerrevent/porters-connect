// Field alias qualification. PORTERS names a field `{Prefix}.{Alias}` (`Person.P_Name`), but
// **Phase has no prefix** — its aliases are bare (`Id` / `Resource` / …) and the wire form is
// just `Id` (ADR-0061 案1a). Joining the two naively would send `.Id`, so every place that
// builds a qualified name goes through this one function: `field` / `condition` / `order` on
// the Read side and the `<Tag>` on the Write side.
//
// It lives in `util/` because both `resources/` and `xml/` need it and `xml` never imports
// from `resources` (the dependency runs the other way).

/** `{prefix}.{alias}`, or the bare alias when the resource has no prefix. */
export const qualify = (prefix: string, alias: string): string =>
  prefix === "" ? alias : `${prefix}.${alias}`;
