import { describe, expect, it } from "vitest";

import {
  PortersConfigError,
  PortersNetworkError,
  PortersResourceError,
} from "../errors";
import type { Requester } from "../http/requester";
import { createResource, type FieldCatalog } from "./resource";

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
const fakeRequester = (
  opts: FakeOpts = {},
): { requester: Requester; calls: { url: string; body: string }[] } => {
  const calls: { url: string; body: string }[] = [];
  let call = 0;
  let seen = 0;
  const requester: Requester = {
    request: (req, parse) => {
      call += 1;
      calls.push({ url: req.url, body: req.body ?? "" });
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
  createResource(
    {
      name: "Candidate",
      path: "candidate",
      prefix: "Person",
      fields: FIELDS,
      requiredOnCreate: REQUIRED,
    },
    { requester, host: "h.test", partition: 7 },
  );

// Tiny records + short prefix so 200 fit under the size cap — exercises the 200-count boundary
// (with Candidate-sized records the size cap binds first).
const SMALL = {
  P_Id: "System[Id]",
  P_A: "Number",
} as const satisfies FieldCatalog;
const smallResource = (requester: Requester) =>
  createResource(
    {
      name: "X",
      path: "x",
      prefix: "X",
      fields: SMALL,
      requiredOnCreate: ["P_A"] as const,
    },
    { requester, host: "h.test", partition: 7 },
  );

describe("createMany / updateMany (bulk write, ADR-0041 / F-4)", () => {
  it("sends one batch, hits partition, returns per-item results in input order", async () => {
    const { requester, calls } = fakeRequester();
    const r = await resource(requester).createMany([
      { P_Owner: 1, P_Name: "山田" },
      { P_Owner: 2, P_Name: "鈴木" },
    ]);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain("/v1/candidate?partition=7");
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

  it("rejects a single record over the size budget (send-time)", async () => {
    const { requester, calls } = fakeRequester();
    await expect(
      resource(requester).createMany([
        { P_Owner: 1, P_Memo: "z".repeat(20000) },
      ]),
    ).rejects.toBeInstanceOf(PortersConfigError);
    expect(calls).toHaveLength(0); // nothing sent
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

  it("throws with the already-written count when a later batch fails", async () => {
    const { requester } = fakeRequester({ failOnCall: 2 });
    const inputs = Array.from({ length: 201 }, () => ({ P_A: 1 }));
    const err = await smallResource(requester)
      .createMany(inputs)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PortersResourceError);
    const e = err as PortersNetworkError;
    expect(e.retryable).toBe(false);
    expect(e.message).toContain("200 record(s)");
    expect(e.hint).toContain("index 200");
    expect(e.cause).toBeInstanceOf(PortersNetworkError); // original error preserved
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
  });

  it("throws when the response item count does not match the batch", async () => {
    const { requester } = fakeRequester({ responseCount: (n) => n - 1 });
    await expect(
      resource(requester).createMany([
        { P_Owner: 1, P_Name: "a" },
        { P_Owner: 1, P_Name: "b" },
      ]),
    ).rejects.toMatchObject({ name: "PortersResourceError" });
  });
});
