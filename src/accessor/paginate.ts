// Walking every page of a Read: the offset loop every `searchAll` uses.

import { MAX_READ_COUNT } from "../porters/read-rules";

// `searchAll` pages by the largest `count` PORTERS allows (porters/read-rules.ts).
const PAGE_SIZE = MAX_READ_COUNT;

/**
 * Offset pagination shared by every `searchAll`. Advances by the items actually returned and
 * stops at `total` — or on an empty page (defensive against a stuck offset / infinite loop).
 * A generator can't be an arrow; a function expression still satisfies func-style:expression.
 */
export const paginate = async function* <T>(
  fetchPage: (
    count: number,
    start: number,
  ) => Promise<{ items: T[]; total: number }>,
): AsyncGenerator<T> {
  let start = 0;
  for (;;) {
    const page = await fetchPage(PAGE_SIZE, start);
    for (const item of page.items) yield item;
    start += page.items.length;
    if (page.items.length === 0 || start >= page.total) return;
  }
};

/**
 * {@link paginate}, with the per-page fetcher built **once**: `prepare` runs inside the generator,
 * the first time a page is asked for. The iteration then holds the *serialised* query — not the
 * caller's object — so writing to that object between pages cannot change what the next page asks
 * for (RV-32). Preparing inside the generator (rather than when `searchAll(...)` is called) also
 * keeps a query guard's failure arriving as a rejected iteration instead of a synchronous throw,
 * which is the contract every Read path follows (ADR-0046).
 */
export const paginateOnce = async function* <T>(
  prepare: () => (
    count: number,
    start: number,
  ) => Promise<{ items: T[]; total: number }>,
): AsyncGenerator<T> {
  yield* paginate(prepare());
};
