// The Read `field` parameter, assembled in one place for every resource that takes one (data and
// master): the default "every catalogued field" when `field` is omitted (ADR-0020), bare aliases
// turned into the wire form PORTERS wants (`{prefix}.{alias}`, a User field with its sub-fields —
// ADR-0059), and the references to expand (ADR-0058) and the Image sub-fields to read (ADR-0064)
// folded into the same list. The rules for expansion and Image entries live with those features
// (`expand.ts` / `image.ts`); this file only runs them in order.

import { bareAlias, qualify } from "../util/alias";
import type { DataType } from "../porters/data-type";
import { USER_SUBFIELDS } from "../porters/read-rules";
import { fieldTypesOf, type FieldCatalog } from "./catalog";
import { applyExpand } from "./apply-expand";
import { guardRawExpansion } from "./guard-raw-expansion";
import type { ExpandSelection, ReferenceMap } from "./expand";
import { applyImage } from "./apply-image";
import type { ImageSelection } from "./image";

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
const qualifyReadFields = (
  prefix: string,
  fields: ReadonlyMap<string, DataType | null>,
  aliases: readonly string[],
): string[] =>
  aliases.map((entry) => {
    const alias = bareAlias(entry);
    return readFieldEntry(prefix, alias, fields.get(alias));
  });

/** What the `field` assembly needs to know about a resource. Built once per resource. */
export type FieldParamContext = {
  /** The resource's alias prefix (`Person` for Candidate; empty for Phase). */
  prefix: string;
  /** The catalog as a lookup: alias -> Data Type. */
  fields: ReadonlyMap<string, DataType | null>;
  /** What is sent when `field` is omitted: every catalogued alias. */
  defaults: readonly string[];
  /** Where each reference field points, for `expand`. A master has none. */
  references: ReferenceMap;
};

/** The {@link FieldParamContext} of a resource: its prefix, its catalog and where its references point. */
export const fieldParamContext = (
  prefix: string,
  fields: FieldCatalog,
  references: ReferenceMap = {},
): FieldParamContext => ({
  prefix,
  fields: fieldTypesOf(fields),
  defaults: Object.keys(fields),
  references,
});

/** What a Read asks for, seen structurally: the typed query types are what constrain callers. */
export type FieldRequest = {
  field?: readonly string[];
  expand?: ExpandSelection;
  image?: ImageSelection;
};

// 省略時に全項目を送るのは ADR-0020、裸の alias に接頭辞を付けるのは ADR-0059。
/**
 * The value of the `field` parameter, or `undefined` when none is sent. In order:
 *
 * 1. `field` omitted -> every catalogued alias; `[]` -> nothing is sent (PORTERS' own answer, the
 *    primary key only — so `expand` / `image` are not sent either. ADR-0096 types it that way)
 * 2. an expansion hand-written into `field` is rejected (it belongs in `expand`)
 * 3. each alias gets the prefix (and a User field its sub-fields); an alias given twice is sent once
 * 4. each selected reference replaces its plain entry with the expanded one
 * 5. each selected Image field replaces its plain entry with the sub-fields to read
 */
export const fieldParam = (
  ctx: FieldParamContext,
  request: FieldRequest,
): string | undefined => {
  const aliases = request.field ?? ctx.defaults;
  if (aliases.length === 0) return undefined;
  guardRawExpansion(aliases, ctx.fields);
  // 同じ alias を 2 回送ると、展開や Image で置き換えるのは最初の 1 件だけになり、素の項目も残る（RV-94）。
  // 接頭辞を付けた後で重複を取り除くので、`P_Name` と `Person.P_Name` も 1 つになる。
  const qualified = [
    ...new Set(qualifyReadFields(ctx.prefix, ctx.fields, aliases)),
  ];
  const expanded = applyExpand(qualified, request.expand, ctx);
  return applyImage(expanded, request.image, ctx.prefix).join(",");
};
