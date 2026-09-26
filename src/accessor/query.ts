// Typed Read query surface (ADR-0038 / F-2): condition / order / keywords / itemstate, grounded in
// the PORTERS Read parameter reference. The public types are Data-Type-aware — a field's allowed
// operators and value shape derive from its catalog Data Type (ADR-0005 R-5 / ADR-0038 案1a).
// Turning a typed query into the wire params is `append-read-query.ts` / `build-read-params.ts`.

import type { DataType } from "../porters/data-type";
import type { EmptyReferences, Expand, ReferenceMap } from "./expand";
import type { ImageOption } from "./image";
import type { FieldCatalog, ReadFieldAlias } from "./catalog";

// --- condition: per-Data-Type operator objects (reference: Read - Condition) ---

/** Comparable ops for numeric Ids (System[Id]); `or` matches a set of Resource Ids (`P_Id:or=1:2`). */
type IdCondition = {
  gt?: number;
  ge?: number;
  eq?: number;
  le?: number;
  lt?: number;
  or?: number[];
};

/** Comparable ops for Number. */
type NumberCondition = {
  gt?: number;
  ge?: number;
  eq?: number;
  le?: number;
  lt?: number;
};

/** Comparable ops for date/time fields. Values are ISO 8601 (UTC `…Z`); normalised to PORTERS on send. */
type TemporalCondition = {
  gt?: string;
  ge?: string;
  eq?: string;
  le?: string;
  lt?: string;
};

/** Text match. `full` = exact, `part` = substring (PORTERS default). */
type TextCondition = {
  full?: string;
  part?: string;
};

/** Option-select match; values are option aliases (e.g. `Option.P_SE`), OR/AND-joined. */
type OptionCondition = {
  or?: string[];
  and?: string[];
};

/** Link/reference match by id (User / System[Reference]): `eq` one id, or OR/AND a set of ids. */
type ReferenceCondition = {
  eq?: number;
  or?: number[];
  and?: number[];
};

/**
 * The operator object each Data Type accepts in a `condition`, as a **table rather than a
 * conditional chain**: every Data Type is listed exactly once, and `never` — "cannot appear in a
 * condition at all" — is written out rather than inherited from a trailing branch.
 *
 * That difference is the point. A chain silently sends anything unmatched to `never`, so a Data
 * Type added later becomes un-conditionable **without anyone deciding that**. Here it fails to
 * compile until the table says which it is, and `never` stays a decision that was made.
 */
type ConditionOf = {
  "System[Id]": IdCondition;
  Number: NumberCondition;
  DateTime: TemporalCondition;
  "System[DateTime]": TemporalCondition;
  Date: TemporalCondition;
  Age: TemporalCondition;
  SinglelineText: TextCondition;
  MultilineText: TextCondition;
  Mail: TextCondition;
  Telephone: TextCondition;
  URL: TextCondition;
  Option: OptionCondition;
  User: ReferenceCondition;
  "System[Reference]": ReferenceCondition;
  // PORTERS shows no way to condition on a department (it is a User-master read value), so this
  // one is deliberately not conditionable.
  "System[Department]": never;
  // Image: the reference states outright that it cannot appear in a condition (ADR-0064 論点6).
  Image: never;
  // Link: the reference says **nothing either way**, so it lands on the narrow side. VERIFY(live):
  // the Read overview's operator table hints a Link can be conditioned — docs/live-verification.md
  // (LV-21). Allowing it later only widens the type, so waiting costs nothing.
  Link: never;
};

// Data Type なしを null で表す決定は ADR-0056。
/**
 * The condition-operator object a field of Data Type `D` accepts. A field PORTERS gives no Data
 * Type (`null`) resolves to `never`, which is exactly right: the reference says such a
 * field cannot appear in `condition` at all.
 */
type ConditionFor<D extends DataType | null> = D extends DataType
  ? ConditionOf[D]
  : never;

// Data Type ごとの演算子オブジェクトは ADR-0038 案1a。
/**
 * A typed search condition over a catalog: each field maps to the operator object its Data Type
 * allows. Multiple fields are AND-joined (reference). Unknown aliases / wrong
 * operators are type errors. Custom `U_`/`A_` fields are not in the catalog — condition on them via
 * a cast (the encoder passes unknown aliases through as raw scalars, like read/write).
 */
export type Condition<F extends FieldCatalog> = {
  [K in keyof F]?: ConditionFor<F[K]>;
};

// --- order (reference: Read - Order; only Number/Currency/Age/Date/DateTime/System are sortable) ---

type OrderableDataType =
  "System[Id]" | "System[DateTime]" | "Number" | "DateTime" | "Date" | "Age";

type OrderableKeys<F extends FieldCatalog> = {
  [K in keyof F]: F[K] extends OrderableDataType ? K : never;
}[keyof F];

/**
 * Sort spec: an ordered list of `{ field: "asc" | "desc" }`, encoded in array (then key) order. Only
 * orderable Data Types (Number/Date/DateTime/Age/System) are accepted (reference).
 */
export type Order<F extends FieldCatalog> = Array<
  Partial<Record<OrderableKeys<F>, "asc" | "desc">>
>;

// --- itemstate (reference: 削除済みデータ取得) ---

// 省略と existing 明示を区別する決定は ADR-0057。
/**
 * Which delete state to read. `existing` reads live data, `deleted`/`all` read deleted records —
 * the only way to read deleted data, since there is no delete API. When `deleted`/`all`, condition
 * is restricted to `P_Id` / `P_UpdateDate` / `P_UpdatedBy` and PORTERS auto-adds a "updated within
 * 90 days" filter (`P_UpdateDate` = the delete time, `P_UpdatedBy` = the last editor).
 *
 * **Omitting the field is not the same as passing `existing`.** Omitting defers to the
 * API's own default (today: `existing`); passing `existing` states that you want live records only,
 * and is sent as such. Both read live data now, but only the explicit form keeps doing so if PORTERS
 * ever changes that default. Use `itemstate: "existing"` when live-only actually matters to you.
 */
export type ItemState = "existing" | "deleted" | "all";

// --- the public query shape (data resources parametrise over their catalog) ---

export type SearchQuery<
  F extends FieldCatalog = FieldCatalog,
  R extends ReferenceMap = EmptyReferences,
> = {
  // 裸 alias に接頭辞を足すのは ADR-0059、省略時に全項目を取るのは ADR-0020。
  /**
   * Output fields as **bare aliases** (e.g. `P_Name`) — the same vocabulary as `condition` and
   * `order`; the library adds the resource's prefix. **Omit** to fetch every catalogued
   * field by default: PORTERS returns only the primary key for a fieldless request, so
   * the library sends a catalog-derived default field set instead. Pass `[]` to opt into that
   * API-native "primary key only" response (e.g. counting). With `[]`, `expand` and `image` are not
   * sent either — there is no field list to add them to — so list the fields you want when you use
   * them. An alias listed twice is sent once.
   */
  field?: readonly ReadFieldAlias<F>[];
  // expand の設計は ADR-0058。
  /**
   * Read the *fields* of a referenced record, not just its id: map an expandable
   * `System[Reference]` field to the bare aliases you want from the resource it points at. The
   * referenced prefix is supplied by the library, and the expanded fields come back decoded by
   * that resource's own Data Types.
   *
   * ```ts
   * const page = await t.job.search({ expand: { P_Client: ["P_Id", "P_Name"] } });
   * page.items[0]?.P_Client; // { P_Id: number | null; P_Name: string | null } | null
   * ```
   *
   * A field left out of `expand` still reads as the referenced id — expanding one relation costs
   * nothing on the others. An expanded alias replaces its plain `field` entry, so nothing is
   * requested twice.
   */
  expand?: Expand<R>;
  // image の設計は ADR-0064。
  /**
   * Read an Image field's `ContentType` / `Content`, not just its `FileName`: map an
   * Image-typed field to the sub-tags you want. Only what you select comes back, and the record
   * type narrows to exactly that.
   *
   * ```ts
   * const page = await t.resume.search({ image: { U_photo: ["FileName", "Content"] } });
   * page.items[0]?.U_photo; // { FileName: string | null; Content: string | null }
   * ```
   *
   * A field left out reads back `FileName` alone — PORTERS' own default — so listing records never
   * drags every image body along with it. Like `expand`, a selected alias replaces its plain
   * `field` entry, so nothing is requested twice.
   */
  image?: ImageOption<F>;
  /** Typed AND-conditions; each field's operators derive from its Data Type. */
  condition?: Condition<F>;
  /** Sort order; orderable Data Types only (Number/Date/DateTime/Age/System). */
  order?: Order<F>;
  /**
   * Keyword AND-search over text fields (MultilineText/SinglelineText/Mail/URL; Telephone digits
   * only). OR is not supported. Max 100 characters including commas — guarded before send, as is
   * a keyword that is empty or contains a comma.
   */
  keywords?: string[];
  /** Delete-state filter (default `existing`). `deleted`/`all` restrict `condition` — see {@link ItemState}. */
  itemstate?: ItemState;
};
