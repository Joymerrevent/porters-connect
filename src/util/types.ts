// Type-level helpers that do not belong to any one module. Types only — nothing here runs.

// `?: never` で塞ぐ経緯は RV-47（spread で束縛が矛盾する形）。使い道は Phase の受けないクエリのキー
// （ADR-0076）と束ねる項目（ADR-0061 / ADR-0080）。
/**
 * An object with `K` taken out — and **kept out**. `Omit` alone only stops a fresh object literal
 * (excess-property checking); a variable that happens to carry the key still assigns. Re-declaring
 * each removed key as `?: never` closes that hole, so the call fails whichever way the object was
 * built — including `create({ ...recordFromRead })`.
 */
export type Without<T, K extends keyof T> = Omit<T, K> & {
  [P in K]?: never;
};
