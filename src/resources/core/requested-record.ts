// The record type a data resource's Read resolves to, keyed by what was asked for: `field` narrows
// it (ADR-0096), `expand` widens a reference into the referenced record (ADR-0058) and `image`
// picks an Image field's sub-fields (ADR-0064). Also the options `get` / `getMany` take. Types only
// — the Read that sends them is `data-read.ts`.

import type { FieldCatalog, ReadFieldAlias } from "./catalog";
import type { Expand, ExpandedReadRecord, ReferenceMap } from "./expand";
import type { ImageOption, ImageReadRecord } from "./image";

/**
 * "No image sub-fields selected": the identity default for the image generic, mirroring
 * `EmptyReferences`. With no keys, `ImageReadRecord` collapses back to the record it wrapped.
 */
export type EmptyImages = Record<never, never>;

// PORTERS の主キーの alias。データ系は `P_Id`、Phase だけ `Id`（ADR-0061）。レコードの型に在る方だけが残る。
type IdKey = "P_Id" | "Id";

// `field` のリストに書いた alias（リテラルのリストから取り出す）。
type ListedKeys<FL> = FL extends readonly (infer A)[] ? A : never;

// `field` のリストで要求したキー。`expand` / `image` で選んだ alias も送られるので含める。
// `field: []` は主キーしか送らないので、何も要求していない（`expand` / `image` も送られない）。
type SelectedKeys<FL, E, I> = FL extends readonly []
  ? never
  : ListedKeys<FL> | keyof E | keyof I;

// 戻り値の型を要求した項目に絞るのは ADR-0096。キーは省略可能のまま（要求した項目が必ず返るとは約束しない）。
/**
 * The record a Read returns, keyed by what was asked for. `FL` is the `field` list as written:
 * omitted (`undefined`) keeps every known field; a literal list keeps those fields plus the ones
 * named in `expand` / `image` (they are requested too); `[]` keeps nothing but `Always`. A list the
 * compiler cannot see as literal (a `string[]` variable) keeps every field. Keys stay optional.
 * `Always` is what the method requests regardless of `field` — `get` / `getMany` read the id and,
 * because the id keeps `field` non-empty, whatever `expand` / `image` name.
 */
export type RequestedRecord<
  Rec,
  FL,
  E,
  I,
  Always extends PropertyKey = never,
> = [FL] extends [undefined]
  ? Rec
  : Pick<Rec, Extract<keyof Rec, SelectedKeys<FL, E, I> | Always>>;

/**
 * What a Read selects besides its conditions: the `field` list, the references to `expand` and
 * the Image sub-fields to read (`image`). Each is captured as a type parameter so the record type
 * can follow it.
 */
export type ReadSelection<FL, E, I> = {
  field?: FL;
  expand?: E;
  image?: I;
};

/** The options of `get` / `getMany`: the same selection a search takes. */
export type GetOptions<F extends FieldCatalog, FL, E, I> = {
  field?: FL & readonly ReadFieldAlias<F>[];
  expand?: E;
  image?: I;
};

/** The record `search` / `searchAll` resolve to for a given `expand` / `image` / `field`. */
export type SearchRecord<
  F extends FieldCatalog,
  R extends ReferenceMap,
  E extends Expand<R>,
  I extends ImageOption<F>,
  FL,
> = RequestedRecord<ImageReadRecord<ExpandedReadRecord<F, R, E>, I>, FL, E, I>;

/**
 * The record `get` / `getMany` resolve to: like {@link SearchRecord}, plus the id and whatever
 * `expand` / `image` name, which are read even when `field` leaves them out.
 */
export type GetRecord<
  F extends FieldCatalog,
  R extends ReferenceMap,
  E extends Expand<R>,
  I extends ImageOption<F>,
  FL,
> = RequestedRecord<
  ImageReadRecord<ExpandedReadRecord<F, R, E>, I>,
  FL,
  E,
  I,
  IdKey | keyof E | keyof I
>;
