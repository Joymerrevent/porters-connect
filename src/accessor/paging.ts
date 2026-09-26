// Read paging shared by every resource: the `count` / `start` a `search` takes (checked before
// sending) and the offset walk every `searchAll` uses.

import { PortersConfigError } from "../errors";
import { MAX_READ_COUNT, MIN_READ_COUNT } from "../porters/read-rules";

// 「何を探すか」（…SearchQuery）とページ送りを別の型にするのは ADR-0099。
/**
 * How many records a Read returns at most: `count`, 1–200 (checked before sending). Option's
 * `search` takes only this, because Option Read has no `start`.
 */
export type Limit = {
  count?: number;
};

/**
 * Which page a Read returns: up to `count` records starting at `start` (0-based). `search` takes
 * it next to the query; `searchAll` walks the pages itself and does not.
 */
export type Paging = Limit & {
  start?: number;
};

// `searchAll` pages by the largest `count` PORTERS allows (porters/read-rules.ts).
const PAGE_SIZE = MAX_READ_COUNT;

/**
 * Set the universal paging params, guarding `count` against the documented 1–200 range before the
 * request goes out (RV-28). Out-of-range values would otherwise reach PORTERS and come back as an
 * opaque response; this is the same "fail early with a clear config error" series as the keyword
 * length / itemstate / request-size guards. Shared by every Read path (data + master + attachment)
 * so the rule lives in one place. Callers are `async`, so this rejects rather than throwing
 * synchronously (ADR-0046).
 */
export const appendPaging = (
  p: URLSearchParams,
  count?: number,
  start?: number,
): void => {
  if (count !== undefined) {
    if (
      !Number.isInteger(count) ||
      count < MIN_READ_COUNT ||
      count > MAX_READ_COUNT
    ) {
      throw new PortersConfigError(
        `count must be an integer between ${MIN_READ_COUNT} and ${MAX_READ_COUNT}, got ${count}`,
        {
          category: "config",
          hint: `PORTERS returns 1–${MAX_READ_COUNT} records per Read. Use searchAll() to walk every page instead of raising count.`,
        },
      );
    }
    p.set("count", String(count));
  }
  if (start !== undefined) p.set("start", String(start));
};

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
