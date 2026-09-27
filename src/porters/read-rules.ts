// What PORTERS' Read accepts and returns (ADR-0098). The query encoder and the `field` assembly in
// accessor/ enforce these; the values are PORTERS' own.

/** `count` bounds on every Read (docs/usage/reference: `count` is 1–200, default 10). */
export const MIN_READ_COUNT = 1;
export const MAX_READ_COUNT = 200;

/** `keywords` is capped at 100 characters, commas included. */
export const KEYWORDS_MAX_CHARS = 100;

/** The 4 readable sub-fields of a User-type field (docs/usage/reference: only these are returned). */
export const USER_SUBFIELDS = ["P_Id", "P_Type", "P_Name", "P_Mail"] as const;

/** itemstate=deleted/all restricts condition to these standard fields (reference / 削除済みデータ取得). */
export const DELETED_CONDITION_FIELDS: ReadonlySet<string> = new Set([
  "P_Id",
  "P_UpdateDate",
  "P_UpdatedBy",
]);

/**
 * Read responses that carry no `Total` / `Count` / `Start` attributes on the root (reference: every
 * resource's Read has them except Option). Any other resource's response without them is not read.
 */
export const RESOURCES_WITHOUT_PAGE_ATTRIBUTES: ReadonlySet<string> = new Set([
  "Option",
]);

/**
 * The operators (suffixes) a Read `condition` takes — `[Alias]:[suffix]=[value]` (reference: Number /
 * date types `gt` `ge` `eq` `le` `lt`, text `full` `part`, Option / Link / Id `or` `and`).
 */
export const CONDITION_SUFFIXES: ReadonlySet<string> = new Set([
  "eq",
  "gt",
  "ge",
  "le",
  "lt",
  "part",
  "full",
  "or",
  "and",
]);
