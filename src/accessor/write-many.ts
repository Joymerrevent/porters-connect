// Bulk write (ADR-0041 / F-4): createMany / updateMany over PORTERS' multi-`<Item>` Write.
// A single request holds up to 200 records and must stay under the ~15000-char cap, so this
// splits the input into size- and count-bounded batches, sends them sequentially (the write
// throttle paces them), and concatenates the per-item results in input order. A batch is NOT
// atomic — each `<Item>` carries its own `<Code>` — so per-item failures are returned (not
// thrown); only a whole-request failure throws. data-writer.ts wires this; XML stays in xml/.

import {
  PortersConfigError,
  PortersError,
  PortersResourceError,
} from "../errors";
import { isUnknownOutcome, type Requester } from "../http/requester";
import { MAX_REQUEST_LENGTH } from "../porters/request";
import { MAX_WRITE_ITEMS } from "../porters/write-rules";
import type { DataType } from "../porters/data-type";
import { encodeWriteItem } from "../xml/encode-write-item";
import type { WriteItem } from "../xml/write-value";
import {
  parseWriteResult,
  type WriteResultItem,
} from "../xml/parse-write-result";

// 結果の形（入力順・ok 判定）は ADR-0041 SD-2。
/** One record's outcome from a bulk write, in the position it was sent. */
export type BulkWriteResultItem = {
  /** 0-based index in the input array. */
  index: number;
  /** Assigned (create) / echoed (update) record id. Meaningful only when `ok`. */
  id: number;
  /** PORTERS per-item Result Code (`0` = success). */
  code: number;
  /** `code === 0`. */
  ok: boolean;
};

// 件別失敗で throw しない決定は ADR-0041。
/**
 * The result of `createMany` / `updateMany`. `results` holds every record's outcome in
 * input order; `failed` is the `ok === false` subset. A per-item `code !== 0` does **not** throw —
 * a bulk write mixes successes and failures — so always inspect `hasFailures` / `failed`.
 */
export type BulkWriteResult = {
  results: BulkWriteResultItem[];
  failed: BulkWriteResultItem[];
  hasFailures: boolean;
};

// A record paired with its original index and pre-serialized `<Item>…</Item>` (measured for packing).
type Encoded = { index: number; xml: string };

/**
 * Greedily pack encoded records into batches that each stay within `budget` characters (the request
 * cap minus URL + envelope overhead) and `MAX_WRITE_ITEMS` records. A single record larger than
 * `budget` cannot be sent in any batch → fail fast with a clear config error (send-time, fail-safe).
 */
const packBatches = (encoded: Encoded[], budget: number): Encoded[][] => {
  const batches: Encoded[][] = [];
  let batch: Encoded[] = [];
  let length = 0;
  for (const e of encoded) {
    if (e.xml.length > budget) {
      throw new PortersConfigError(
        `a single record serializes to ${e.xml.length} characters, over the ~${budget}-character budget for one request`,
        {
          category: "config",
          hint: "Reduce that record's field values — a bulk request (URL + body) is capped at ~15000 characters.",
        },
      );
    }
    // Start a new batch when the next record would breach either bound. Never reached with an empty
    // batch: on the first record `length` and `batch.length` are 0 and an over-budget record already
    // threw above, so `batch` is always non-empty here (no empty batch is ever pushed).
    if (batch.length >= MAX_WRITE_ITEMS || length + e.xml.length > budget) {
      batches.push(batch);
      batch = [];
      length = 0;
    }
    batch.push(e);
    length += e.xml.length;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
};

// 途中の失敗の hint に並べる index の数の上限（それより多ければ、残りは件数で書く）。
const MAX_LISTED = 20;

const listIndexes = (indexes: readonly number[]): string =>
  indexes.length > MAX_LISTED
    ? `${indexes.slice(0, MAX_LISTED).join(", ")} and ${indexes.length - MAX_LISTED} more`
    : indexes.join(", ");

/** Where a bulk write stopped, for the error that reports it. */
type Progress = {
  /** First and last input index of the batch that failed. */
  first: number;
  last: number;
  /** How many records the whole call was given. */
  total: number;
  /** How many records earlier batches sent, and which of them PORTERS refused. */
  sent: number;
  earlierFailed: readonly number[];
  /** The failed batch may have been applied (a sent create whose outcome is unknown). */
  unknownOutcome: boolean;
  idempotent: boolean;
};

// 一括書き込みが途中で止まった。create は非冪等なので、全体を送り直すと重複する（SD-4）。どこまで
// 書けたか・どこが分からないかを書いて返す。バッチごとの結果（results）は返せないので、それまでに
// 失敗した index は hint に並べる（RV-69）。
const batchFailure = (
  cause: unknown,
  at: Progress,
  resource: string,
  partition: number,
): PortersError => {
  const base = cause instanceof PortersError ? cause : undefined;
  const range = `records ${at.first}–${at.last}`;
  const failedBatch = at.unknownOutcome
    ? `The ${range} may have been written before the failure: check whether they exist before resending them.`
    : at.idempotent
      ? `The ${range} failed; updates can be resent as they are.`
      : `The ${range} were not written.`;
  const notSent =
    at.last + 1 < at.total
      ? `Records from index ${at.last + 1} onward were not sent.`
      : undefined;
  const earlier =
    at.earlierFailed.length > 0
      ? `Of the ${at.sent} record(s) sent in earlier batches, index ${listIndexes(at.earlierFailed)} failed and were not written; the rest were written.`
      : at.sent > 0
        ? `The ${at.sent} record(s) sent in earlier batches were written.`
        : undefined;
  return new PortersResourceError(
    `bulk write failed at ${range} of ${at.total}: ${cause instanceof Error ? cause.message : String(cause)}`,
    {
      category: base?.category ?? "unknown",
      code: base?.code ?? null,
      retryable: false,
      httpStatus: base?.httpStatus,
      hint: [
        failedBatch,
        notSent,
        earlier,
        "Resend only the records that were not written.",
      ]
        .filter((part) => part !== undefined)
        .join(" "),
      context: { resource, operation: "bulkWrite", partition },
      cause,
    },
  );
};

/**
 * Execute a bulk write: split `items` into batches, POST each, and merge the per-item results.
 * `target.url` is the (short) Write URL; `idempotent` is false for create (non-idempotent), true for
 * update. Per-item `code !== 0` is returned in the result; a whole-request failure throws — naming
 * the batch that failed, what was sent before it and which of those failed, once anything may have
 * been written (SD-4 / RV-69).
 */
export const writeMany = async (
  requester: Requester,
  target: {
    name: string;
    prefix: string;
    fields: ReadonlyMap<string, DataType | null>;
    url: string;
    partition: number;
  },
  items: WriteItem[],
  idempotent: boolean,
): Promise<BulkWriteResult> => {
  const envelope = `<${target.name}></${target.name}>`.length;
  const budget = MAX_REQUEST_LENGTH - target.url.length - envelope;
  const encoded: Encoded[] = items.map((item, index) => ({
    index,
    xml: encodeWriteItem(target.prefix, target.fields, item),
  }));
  const batches = packBatches(encoded, budget);

  const results: BulkWriteResultItem[] = [];
  let sent = 0;
  for (const batch of batches) {
    const body = `<${target.name}>${batch.map((e) => e.xml).join("")}</${target.name}>`;
    const progress = (unknownOutcome: boolean): Progress => ({
      first: batch[0].index,
      last: batch[batch.length - 1].index,
      total: items.length,
      sent,
      earlierFailed: results.filter((r) => !r.ok).map((r) => r.index),
      unknownOutcome,
      idempotent,
    });
    let parsed: WriteResultItem[];
    try {
      parsed = await requester.request(
        { method: "POST", url: target.url, headers: {}, body },
        parseWriteResult,
        { write: true, idempotent },
      );
    } catch (cause) {
      const unknownOutcome = isUnknownOutcome(cause);
      // 最初のバッチが「書き込まれていないと分かる」失敗なら、何も書かれていない → 元のエラーのまま。
      if (sent === 0 && !unknownOutcome) throw cause;
      throw batchFailure(
        cause,
        progress(unknownOutcome),
        target.name,
        target.partition,
      );
    }
    if (parsed.length !== batch.length) {
      // 応答は届いたが、どのレコードが書けたかが読めない＝このバッチは結果が分からない。
      const mismatch = new Error(
        `the response returned ${parsed.length} result(s) for ${batch.length} record(s)`,
      );
      throw batchFailure(
        mismatch,
        progress(true),
        target.name,
        target.partition,
      );
    }
    batch.forEach((e, i) => {
      const { id, code } = parsed[i];
      results.push({ index: e.index, id, code, ok: code === 0 });
    });
    sent += batch.length;
  }

  const failed = results.filter((r) => !r.ok);
  return { results, failed, hasFailures: failed.length > 0 };
};
