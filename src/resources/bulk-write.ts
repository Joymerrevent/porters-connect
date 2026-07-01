// Bulk write (ADR-0041 / F-4): createMany / updateMany over PORTERS' multi-`<Item>` Write.
// A single request holds up to 200 records and must stay under the ~15000-char cap, so this
// splits the input into size- and count-bounded batches, sends them sequentially (the write
// throttle paces them), and concatenates the per-item results in input order. A batch is NOT
// atomic — each `<Item>` carries its own `<Code>` — so per-item failures are returned (not
// thrown); only a whole-request failure throws. The generic factory wires this; XML stays in xml/.

import {
  PortersConfigError,
  PortersError,
  PortersResourceError,
} from "../errors";
import { MAX_REQUEST_LENGTH, type Requester } from "../http/requester";
import type { DataType } from "../xml/decode";
import { encodeWriteItem, type WriteItem } from "../xml/encode";
import { parseWriteResult, type WriteResultItem } from "../xml/parser";

/** PORTERS caps a Write request at 200 records; larger inputs are split into batches of 200. */
const MAX_ITEMS_PER_REQUEST = 200;

/** One record's outcome from a bulk write, in the position it was sent (ADR-0041 SD-2). */
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

/**
 * The result of `createMany` / `updateMany` (ADR-0041). `results` holds every record's outcome in
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
 * cap minus URL + envelope overhead) and `MAX_ITEMS_PER_REQUEST` records. A single record larger than
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
    if (
      batch.length >= MAX_ITEMS_PER_REQUEST ||
      length + e.xml.length > budget
    ) {
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

// A batch failed at the request level after earlier batches were already applied. Creates are
// non-idempotent, so a blind full retry would duplicate them — surface the progress instead (SD-4).
const batchFailure = (
  cause: unknown,
  written: number,
  resource: string,
  partition: number,
): PortersError => {
  const base = cause instanceof PortersError ? cause : undefined;
  return new PortersResourceError(
    `bulk write failed after ${written} record(s) had already been written`,
    {
      category: base?.category ?? "unknown",
      code: base?.code ?? null,
      retryable: false,
      httpStatus: base?.httpStatus,
      hint: `${written} record(s) from earlier batches were already written; retry only the records from index ${written} onward (create is non-idempotent — a full retry would duplicate them).`,
      context: { resource, operation: "bulkWrite", partition },
      cause,
    },
  );
};

/**
 * Execute a bulk write: split `items` into batches, POST each, and merge the per-item results.
 * `target.url` is the (short) Write URL; `idempotent` is false for create (non-idempotent), true for
 * update. Per-item `code !== 0` is returned in the result; a whole-request failure throws — with the
 * already-written count once at least one earlier batch succeeded (SD-4).
 */
export const runBulkWrite = async (
  requester: Requester,
  target: {
    name: string;
    prefix: string;
    fields: ReadonlyMap<string, DataType>;
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
  let written = 0;
  for (const batch of batches) {
    const body = `<${target.name}>${batch.map((e) => e.xml).join("")}</${target.name}>`;
    let parsed: WriteResultItem[];
    try {
      parsed = await requester.request(
        { method: "POST", url: target.url, headers: {}, body },
        parseWriteResult,
        { write: true, idempotent },
      );
    } catch (cause) {
      // First batch failed = nothing applied yet → surface the original error unchanged.
      if (written === 0) throw cause;
      throw batchFailure(cause, written, target.name, target.partition);
    }
    if (parsed.length !== batch.length) {
      throw new PortersResourceError(
        `bulk write response returned ${parsed.length} result(s) for ${batch.length} record(s)`,
        { category: "unknown", context: { resource: target.name } },
      );
    }
    batch.forEach((e, i) => {
      const { id, code } = parsed[i];
      results.push({ index: e.index, id, code, ok: code === 0 });
    });
    written += batch.length;
  }

  const failed = results.filter((r) => !r.ok);
  return { results, failed, hasFailures: failed.length > 0 };
};
