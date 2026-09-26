import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  PortersConfigError,
  PortersNetworkError,
  PortersResourceError,
} from "../errors";
import { asUnknownOutcome, type Requester } from "../http/requester";
import { MAX_REQUEST_LENGTH } from "../porters/request";
import { encodeWriteItem } from "../xml/encode-write-item";
import { createDataResource } from "./data-resource";
import type { FieldCatalog } from "./catalog";
import { buildWriteUrl } from "./build-write-url";

const FIELDS = {
  P_Id: "System[Id]",
  P_Owner: "User",
  P_Name: "SinglelineText",
  P_Memo: "MultilineText",
} as const satisfies FieldCatalog;

const REQUIRED = ["P_Owner"] as const;

type FakeOpts = {
  /** Per-record (global index) Result Code; default 0 (success). */
  codeFor?: (i: number) => number;
  /** 1-based call number to reject (simulates a whole-request failure). */
  failOnCall?: number;
  /** Error to reject with on `failOnCall` (default a PortersNetworkError). */
  error?: Error;
  /** Override how many `<Item>` the response echoes (to force a count mismatch). */
  responseCount?: (sent: number) => number;
};

// A deterministic Requester: records each request, echoes a Write response with one `<Item>`
// (Id + Code) per record sent, or rejects on the configured call. No throttle/transport timing.
type Call = { url: string; body: string; method: string; spec: unknown };
const fakeRequester = (
  opts: FakeOpts = {},
): { requester: Requester; calls: Call[] } => {
  const calls: Call[] = [];
  let call = 0;
  let seen = 0;
  const requester: Requester = {
    request: (req, parse, spec) => {
      call += 1;
      calls.push({
        url: req.url,
        body: req.body ?? "",
        method: req.method,
        spec,
      });
      if (opts.failOnCall === call) {
        return Promise.reject(
          opts.error ??
            new PortersNetworkError("boom", { category: "network" }),
        );
      }
      const sent = (req.body?.match(/<Item>/g) ?? []).length;
      const emit = opts.responseCount ? opts.responseCount(sent) : sent;
      let items = "";
      for (let k = 0; k < emit; k++) {
        const gi = seen + k;
        items += `<Item><Id>${1000 + gi}</Id><Code>${opts.codeFor ? opts.codeFor(gi) : 0}</Code></Item>`;
      }
      seen += sent;
      return Promise.resolve(parse(`<Candidate>${items}</Candidate>`));
    },
  };
  return { requester, calls };
};

const resource = (requester: Requester) =>
  createDataResource(
    {
      name: "Candidate",
      path: "candidate",
      prefix: "Person",
      fields: FIELDS,
      requiredOnCreate: REQUIRED,
    },
    { requester, accessPoint: { hostname: "h.test" }, partition: 7 },
  );

// Tiny records + short prefix so 200 fit under the size cap — exercises the 200-count boundary
// (with Candidate-sized records the size cap binds first).
const SMALL = {
  P_Id: "System[Id]",
  P_A: "Number",
} as const satisfies FieldCatalog;
const smallResource = (requester: Requester) =>
  createDataResource(
    {
      name: "X",
      path: "x",
      prefix: "X",
      fields: SMALL,
      requiredOnCreate: ["P_A"] as const,
    },
    { requester, accessPoint: { hostname: "h.test" }, partition: 7 },
  );

// Exact per-request budget for the `resource` above (must match writeMany's math), and a helper
// that builds a create input whose *sent* record (with the forced P_Id) serializes to `target` chars
// — for the size-boundary tests (P_Memo pads with unescaped 'z', 1 char = 1 output char).
const FIELD_MAP = new Map(Object.entries(FIELDS));
const BUDGET =
  MAX_REQUEST_LENGTH -
  buildWriteUrl({ hostname: "h.test" }, 7, "candidate").length -
  "<Candidate></Candidate>".length;
const sentLen = (memo: string): number =>
  encodeWriteItem("Person", FIELD_MAP, { P_Owner: 1, P_Memo: memo, P_Id: -1 })
    .length;
const inputOfLen = (target: number): { P_Owner: number; P_Memo: string } => ({
  P_Owner: 1,
  P_Memo: "z".repeat(target - sentLen("")),
});

describe("createMany / updateMany (bulk write, ADR-0041 / F-4)", () => {
  it("sends one batch, hits partition, returns per-item results in input order", async () => {
    const { requester, calls } = fakeRequester();
    const r = await resource(requester).createMany([
      { P_Owner: 1, P_Name: "山田" },
      { P_Owner: 2, P_Name: "鈴木" },
    ]);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain("/v1/candidate?partition=7");
    expect(calls[0]?.method).toBe("POST");
    // create is a non-idempotent write (spec threaded to the requester).
    expect(calls[0]?.spec).toEqual({ write: true, idempotent: false });
    // body is a well-formed `<Candidate>…</Candidate>` envelope with items joined directly.
    expect(calls[0]?.body.startsWith("<Candidate>")).toBe(true);
    expect(calls[0]?.body.endsWith("</Candidate>")).toBe(true);
    expect(calls[0]?.body).toContain("</Item><Item>"); // no separator between records
    // create forces P_Id = -1 on every record.
    expect(
      calls[0]?.body.match(/<Person.P_Id>-1<\/Person.P_Id>/g),
    ).toHaveLength(2);
    expect(r.results).toEqual([
      { index: 0, id: 1000, code: 0, ok: true },
      { index: 1, id: 1001, code: 0, ok: true },
    ]);
    expect(r.hasFailures).toBe(false);
    expect(r.failed).toEqual([]);
  });

  it("updateMany targets each id (idempotent) and echoes them", async () => {
    const { requester, calls } = fakeRequester();
    const r = await resource(requester).updateMany([
      { id: 55, fields: { P_Name: "更新" } },
      { id: 66, fields: { P_Name: "更新2" } },
    ]);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.spec).toEqual({ write: true, idempotent: true }); // update is idempotent
    expect(calls[0]?.body).toContain("<Person.P_Id>55</Person.P_Id>");
    expect(calls[0]?.body).toContain("<Person.P_Id>66</Person.P_Id>");
    expect(r.results.map((x) => x.index)).toEqual([0, 1]);
  });

  it("surfaces per-item failures without throwing (partial success)", async () => {
    // Second record fails (code 122); the rest succeed.
    const { requester } = fakeRequester({
      codeFor: (i) => (i === 1 ? 122 : 0),
    });
    const r = await resource(requester).createMany([
      { P_Owner: 1, P_Name: "a" },
      { P_Owner: 1, P_Name: "b" },
      { P_Owner: 1, P_Name: "c" },
    ]);

    expect(r.hasFailures).toBe(true);
    expect(r.failed).toEqual([{ index: 1, id: 1001, code: 122, ok: false }]);
    expect(r.results.filter((x) => x.ok)).toHaveLength(2);
  });

  it("splits by the 200-record cap into multiple requests", async () => {
    const { requester, calls } = fakeRequester();
    const inputs = Array.from({ length: 201 }, () => ({ P_A: 1 }));
    const r = await smallResource(requester).createMany(inputs);

    expect(calls).toHaveLength(2); // 200 + 1
    expect(r.results).toHaveLength(201);
    expect(r.results[200]).toEqual({ index: 200, id: 1200, code: 0, ok: true });
  });

  it("splits by the size cap when records are large", async () => {
    const { requester, calls } = fakeRequester();
    const big = "z".repeat(8000); // two records exceed ~15000 chars together
    const r = await resource(requester).createMany([
      { P_Owner: 1, P_Memo: big },
      { P_Owner: 1, P_Memo: big },
    ]);

    expect(calls).toHaveLength(2); // one record per request
    expect(r.results).toHaveLength(2);
  });

  it("rejects a single record over the size budget (send-time, with a clear message)", async () => {
    const { requester, calls } = fakeRequester();
    const err = (await resource(requester)
      .createMany([{ P_Owner: 1, P_Memo: "z".repeat(20000) }])
      .catch((e: unknown) => e)) as PortersConfigError;
    expect(err).toBeInstanceOf(PortersConfigError);
    expect(err.category).toBe("config");
    expect(err.message).toContain("single record");
    expect(err.hint).toContain("15000");
    expect(calls).toHaveLength(0); // nothing sent
  });

  it("accepts a record exactly at the size budget, rejects one over it (boundary)", async () => {
    const ok = fakeRequester();
    const r = await resource(ok.requester).createMany([inputOfLen(BUDGET)]);
    expect(ok.calls).toHaveLength(1); // == budget fits (kills `>=`)
    expect(r.results).toHaveLength(1);

    const over = fakeRequester();
    await expect(
      resource(over.requester).createMany([inputOfLen(BUDGET + 1)]),
    ).rejects.toBeInstanceOf(PortersConfigError); // one over throws (pins the budget math)
    expect(over.calls).toHaveLength(0);
  });

  it("packs two records summing to exactly the budget into one request (boundary)", async () => {
    const { requester, calls } = fakeRequester();
    const a = Math.floor(BUDGET / 2);
    const r = await resource(requester).createMany([
      inputOfLen(a),
      inputOfLen(BUDGET - a),
    ]);
    expect(calls).toHaveLength(1); // sum == budget stays together (kills `>=`)
    expect(r.results).toHaveLength(2);
  });

  it("sends no request for empty input", async () => {
    const { requester, calls } = fakeRequester();
    const r = await resource(requester).createMany([]);
    expect(calls).toHaveLength(0);
    expect(r).toEqual({ results: [], failed: [], hasFailures: false });
  });

  it("re-throws the original error when the first batch fails (nothing written)", async () => {
    const { requester } = fakeRequester({ failOnCall: 1 });
    await expect(
      resource(requester).createMany([{ P_Owner: 1, P_Name: "a" }]),
    ).rejects.toBeInstanceOf(PortersNetworkError);
  });

  it("names the failed batch and what earlier batches wrote when a later batch fails", async () => {
    const { requester } = fakeRequester({
      failOnCall: 2,
      error: new PortersNetworkError("boom", {
        category: "network",
        code: 503,
      }),
    });
    const inputs = Array.from({ length: 201 }, () => ({ P_A: 1 }));
    const err = await smallResource(requester)
      .createMany(inputs)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PortersResourceError);
    const e = err as PortersNetworkError;
    expect(e.retryable).toBe(false);
    expect(e.message).toBe("bulk write failed at records 200–200 of 201: boom");
    expect(e.hint).toBe(
      "The records 200–200 were not written. The 200 record(s) sent in earlier batches were written. Resend only the records that were not written.",
    );
    expect(e.category).toBe("network"); // base category preserved
    expect(e.code).toBe(503); // base code preserved
    expect(e.context).toMatchObject({
      resource: "X",
      operation: "bulkWrite",
      partition: 7,
    });
    expect(e.cause).toBeInstanceOf(PortersNetworkError); // original error preserved
  });

  // RV-69。先のバッチの 1 件ごとの失敗は、途中で止まると results ごと失われていた。hint に並べる。
  it("lists the earlier records PORTERS refused, and the records not yet sent", async () => {
    const { requester } = fakeRequester({
      failOnCall: 2,
      codeFor: (i) => (i === 0 || i === 5 ? 107 : 0),
    });
    const inputs = Array.from({ length: 450 }, () => ({ P_A: 1 }));
    const e = (await smallResource(requester)
      .createMany(inputs)
      .catch((x: unknown) => x)) as PortersResourceError;
    expect(e.hint).toBe(
      "The records 200–399 were not written. Records from index 400 onward were not sent. Of the 200 record(s) sent in earlier batches, index 0, 5 failed and were not written; the rest were written. Resend only the records that were not written.",
    );
  });

  it("lists exactly 20 refused indexes without a count", async () => {
    const { requester } = fakeRequester({
      failOnCall: 2,
      codeFor: (i) => (i < 20 ? 107 : 0),
    });
    const inputs = Array.from({ length: 201 }, () => ({ P_A: 1 }));
    const e = (await smallResource(requester)
      .createMany(inputs)
      .catch((x: unknown) => x)) as PortersResourceError;
    const listed = Array.from({ length: 20 }, (_, i) => i).join(", ");
    expect(e.hint).toContain(`index ${listed} failed`);
  });

  it("lists at most 20 refused indexes and counts the rest", async () => {
    const { requester } = fakeRequester({
      failOnCall: 2,
      codeFor: (i) => (i < 25 ? 107 : 0),
    });
    const inputs = Array.from({ length: 201 }, () => ({ P_A: 1 }));
    const e = (await smallResource(requester)
      .createMany(inputs)
      .catch((x: unknown) => x)) as PortersResourceError;
    const listed = Array.from({ length: 20 }, (_, i) => i).join(", ");
    expect(e.hint).toContain(`index ${listed} and 5 more failed`);
  });

  // 送った後で結果が分からない create のバッチは、登録された可能性がある（ADR-0103 / RV-69）。
  it("says a sent batch whose outcome is unknown may have been written", async () => {
    const { requester } = fakeRequester({
      failOnCall: 2,
      error: asUnknownOutcome(
        new PortersNetworkError("timeout", {
          category: "network",
          retryable: true,
        }),
      ),
    });
    const inputs = Array.from({ length: 201 }, () => ({ P_A: 1 }));
    const e = (await smallResource(requester)
      .createMany(inputs)
      .catch((x: unknown) => x)) as PortersResourceError;
    expect(e.hint).toContain(
      "The records 200–200 may have been written before the failure: check whether they exist before resending them.",
    );
  });

  it("reports the range even when the first batch's outcome is unknown", async () => {
    const { requester } = fakeRequester({
      failOnCall: 1,
      error: asUnknownOutcome(
        new PortersNetworkError("timeout", {
          category: "network",
          retryable: true,
        }),
      ),
    });
    const inputs = Array.from({ length: 201 }, () => ({ P_A: 1 }));
    const e = (await smallResource(requester)
      .createMany(inputs)
      .catch((x: unknown) => x)) as PortersResourceError;
    expect(e).toBeInstanceOf(PortersResourceError);
    expect(e.hint).toBe(
      "The records 0–199 may have been written before the failure: check whether they exist before resending them. Records from index 200 onward were not sent. Resend only the records that were not written.",
    );
  });

  it("tells an update that failed midway it can be resent", async () => {
    const { requester } = fakeRequester({ failOnCall: 2 });
    const items = Array.from({ length: 201 }, (_, i) => ({
      id: i + 1,
      fields: { P_A: 1 },
    }));
    const e = (await smallResource(requester)
      .updateMany(items)
      .catch((x: unknown) => x)) as PortersResourceError;
    expect(e.hint).toContain(
      "The records 200–200 failed; updates can be resent as they are.",
    );
  });

  it("wraps a non-PortersError batch failure with unknown category / null code", async () => {
    const { requester } = fakeRequester({
      failOnCall: 2,
      error: new Error("raw transport blowup"),
    });
    const inputs = Array.from({ length: 201 }, () => ({ P_A: 1 }));
    const err = (await smallResource(requester)
      .createMany(inputs)
      .catch((e: unknown) => e)) as PortersResourceError;
    expect(err).toBeInstanceOf(PortersResourceError);
    expect(err.category).toBe("unknown");
    expect(err.code).toBeNull();
    expect(err.cause).toBeInstanceOf(Error);
    expect(err.message).toBe(
      "bulk write failed at records 200–200 of 201: raw transport blowup",
    );
  });

  it("writes a thrown non-Error value into the message as it is", async () => {
    const { requester } = fakeRequester({
      failOnCall: 2,
      error: "socket closed" as unknown as Error,
    });
    const inputs = Array.from({ length: 201 }, () => ({ P_A: 1 }));
    const err = (await smallResource(requester)
      .createMany(inputs)
      .catch((e: unknown) => e)) as PortersResourceError;
    expect(err.message).toBe(
      "bulk write failed at records 200–200 of 201: socket closed",
    );
  });

  it("throws when the response item count does not match the batch", async () => {
    const { requester } = fakeRequester({ responseCount: (n) => n - 1 });
    const err = (await resource(requester)
      .createMany([
        { P_Owner: 1, P_Name: "a" },
        { P_Owner: 1, P_Name: "b" },
      ])
      .catch((e: unknown) => e)) as PortersResourceError;
    expect(err).toBeInstanceOf(PortersResourceError);
    expect(err.category).toBe("unknown");
    expect(err.message).toBe(
      "bulk write failed at records 0–1 of 2: the response returned 1 result(s) for 2 record(s)",
    );
    // 応答は届いたが、どれが書けたかが読めない＝登録された可能性がある（RV-69）。
    expect(err.hint).toContain("may have been written");
    expect(err.context).toMatchObject({ resource: "Candidate" });
  });
});

// Property-based tests (fast-check). 分割は「200 件」と「~15000 文字」の 2 つの上限に同時に
// 従う必要があり、例示テストは代表的な境界を 1 点ずつ突いているだけ。レコード長がばらつく
// 現実の入力で上限を破らないことは、値を機械に選ばせないと確かめられない。
describe("bulk write の分割: 不変条件（property-based）", () => {
  const WRITE_URL = buildWriteUrl({ hostname: "h.test" }, 7, "candidate");
  const ENVELOPE = "<Candidate></Candidate>".length;

  it("どの入力でも上限を破らず、順序と件数が保たれる", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 0, max: 400 }), {
          minLength: 1,
          maxLength: 250,
        }),
        async (extras) => {
          const { requester, calls } = fakeRequester();
          const items = extras.map((n) => inputOfLen(sentLen("") + n));
          const result = await resource(requester).createMany(items);

          let seen = 0;
          for (const call of calls) {
            const count = (call.body.match(/<Item>/g) ?? []).length;
            // 空のバッチを送らない
            expect(count).toBeGreaterThan(0);
            // 200 件の上限
            expect(count).toBeLessThanOrEqual(200);
            // リクエスト全体（URL + body）が文字数上限以下
            expect(WRITE_URL.length + call.body.length).toBeLessThanOrEqual(
              MAX_REQUEST_LENGTH,
            );
            // 早すぎる分割をしない: 次のバッチの先頭を足すとどちらかの上限を破る
            const next = items[seen + count];
            if (next !== undefined) {
              const packed = call.body.length - ENVELOPE;
              const overCount = count >= 200;
              const overBudget = packed + sentLen(next.P_Memo) > BUDGET;
              expect(overCount || overBudget).toBe(true);
            }
            seen += count;
          }

          // 全件が 1 回ずつ、入力順のまま返る
          expect(seen).toBe(items.length);
          expect(result.results.map((r) => r.index)).toEqual(
            items.map((_, i) => i),
          );
        },
      ),
      { numRuns: 25 },
    );
  });

  it("budget を 1 文字でも超えるレコードは送信前に弾く", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 500 }), async (over) => {
        const { requester, calls } = fakeRequester();
        await expect(
          resource(requester).createMany([inputOfLen(BUDGET + over)]),
        ).rejects.toBeInstanceOf(PortersConfigError);
        // 送る前に弾く（1 本もリクエストが出ない）＝フェイルセーフ
        expect(calls).toHaveLength(0);
      }),
      { numRuns: 15 },
    );
  });
});
