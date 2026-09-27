// The paging a `search` takes: `count` / `start`. Setting them on a Read (with `count` checked) is
// `append-paging.ts`, and the offset walk every `searchAll` uses is `paginate.ts`.

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
