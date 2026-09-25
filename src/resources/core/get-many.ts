// getMany (ADR-0095): read many records by id through the `{idAlias}:or=` condition. This file owns
// the two decisions that are not plain `search`: how the ids are split into requests, and how a
// response is checked against what was asked for. The accessor (resource.ts) wires them to
// `search`; nothing here builds a URL or parses XML.

import { PortersResourceError } from "../../errors";
import { MAX_REQUEST_LENGTH } from "../../http/requester";

/** PORTERS returns at most 200 records per Read (`count` is 1–200), so a chunk holds ≤200 ids. */
export const MAX_IDS_PER_READ = 200;

/**
 * Split distinct ids into chunks of at most {@link MAX_IDS_PER_READ} whose Read URL stays within
 * `budget` characters. `urlLength` builds the real URL for a chunk and measures it.
 *
 * The URL grows linearly in the ids — each one adds its own characters plus one encoded `:`
 * separator — so two measurements fix the cost instead of re-measuring every candidate chunk.
 * Measuring (rather than hard-coding `%3A`) keeps this honest if the encoding ever changes.
 *
 * An id that does not fit even alone still gets a chunk of its own: the request-size guard then
 * rejects it before anything is sent, with the same error every oversized Read gets.
 */
export const packIds = (
  ids: readonly number[],
  urlLength: (chunk: readonly number[]) => number,
  budget: number = MAX_REQUEST_LENGTH,
): number[][] => {
  const first = ids[0];
  if (first === undefined) return [];
  const width = (id: number): number => String(id).length;
  const one = urlLength([first]);
  const base = one - width(first);
  const separator = urlLength([first, first]) - one - width(first);

  const chunks: number[][] = [];
  let chunk: number[] = [];
  let length = base;
  for (const id of ids) {
    if (
      chunk.length > 0 &&
      (chunk.length === MAX_IDS_PER_READ ||
        length + separator + width(id) > budget)
    ) {
      chunks.push(chunk);
      chunk = [];
      length = base;
    }
    length += (chunk.length > 0 ? separator : 0) + width(id);
    chunk.push(id);
  }
  chunks.push(chunk);
  return chunks;
};

// 突き合わせに失敗したら返さずに止める（ADR-0095「突き合わせ」）。
// VERIFY(live): 出典は `P_Id` の `or` について記述が割れている（Read - Condition の本文は「Phase の Id と
// Resource Id のみ」、同じ記事と Job / Opportunity Read の例は `P_Id:or`）。PORTERS が条件を無視して先頭から
// 返すと、頼んでいないレコードを頼んだものとして渡してしまうので、ここで止める — docs/live-verification.md (LV-33)。
const unrequested = (resource: string, detail: string): PortersResourceError =>
  new PortersResourceError(
    `${resource}: getMany received ${detail}, so the id condition may not have been applied`,
    {
      category: "unknown",
      hint: "No records were returned. Read the records one at a time with get() instead.",
      context: { resource, operation: "getMany" },
    },
  );

/**
 * Check one Read page against the chunk of ids it was asked for, and key its records by id.
 * Throws — rather than returning anything — when the page holds a record that was not requested
 * (or one without an id), or when `total` claims more matches than ids were sent: both mean the
 * id condition did not narrow the read, and passing those records on would hand the caller
 * records it never asked for.
 */
export const recordsById = <T>(
  page: { items: readonly T[]; total: number },
  chunk: readonly number[],
  idOf: (record: T) => unknown,
  resource: string,
): Map<number, T> => {
  if (page.total > chunk.length) {
    throw unrequested(
      resource,
      `a total of ${page.total} for ${chunk.length} requested ids`,
    );
  }
  // `unknown` so a record without a numeric id (a missing tag, a string) is simply not a member.
  const requested: ReadonlySet<unknown> = new Set(chunk);
  const out = new Map<number, T>();
  for (const record of page.items) {
    const id = idOf(record);
    if (!requested.has(id)) {
      throw unrequested(
        resource,
        `a record that was not requested (id ${String(id)})`,
      );
    }
    out.set(id as number, record);
  }
  return out;
};
