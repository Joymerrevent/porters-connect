// Walking every page of a Read: the offset loop every `searchAll` uses.

import { PortersResourceError } from "../errors";
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
  ) => Promise<{ items: T[]; total: number; start: number }>,
): AsyncGenerator<T> {
  let start = 0;
  for (;;) {
    const page = await fetchPage(PAGE_SIZE, start);
    // VERIFY(live): 応答の Start は、要求した start をそのまま返すと reference から読んでいる（`start` は
    // 取得開始インデックス・0 始まり、`Start` は今回の開始インデックス）。違えば、同じレコードを
    // 繰り返し返すか、抜かすことになるので止める（RV-71） — docs/live-verification.md (LV-34)。
    if (page.start !== start) {
      throw new PortersResourceError(
        `searchAll asked for records from ${start}, but the response starts at ${page.start}`,
        {
          category: "unknown",
          hint: "The response did not follow the requested page, so the walk stopped rather than return some records twice or skip others.",
        },
      );
    }
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
  ) => Promise<{ items: T[]; total: number; start: number }>,
): AsyncGenerator<T> {
  yield* paginate(prepare());
};
