// L1 integration for the 200-record limit (ADR-0043 phase 2 / ADR-0041). `createMany` and
// `updateMany` batch on the *client* side; the fake enforces the limit on the *server* side and
// answers 102 to anything larger. Both halves are exercised here, so a batching regression shows
// up as a real PORTERS-shaped rejection rather than as a silently truncated write.

import { describe, expect, it } from "vitest";

import { PortersClient } from "../../src/client";
import type { TransportRequest } from "../../src/http/types";
import { createFakeTransport } from "../fake/index";

// Wrap the fake so the test can see how the library chopped the work up.
const setup = () => {
  const fake = createFakeTransport();
  const writes: TransportRequest[] = [];
  const porters = new PortersClient({
    host: "fake.test",
    appId: "app-id",
    appSecret: "app-secret",
    partition: 1,
    transport: {
      send: (req) => {
        if (req.method === "POST" && req.url.includes("/v1/candidate")) {
          writes.push(req);
        }
        return fake.send(req);
      },
    },
  });
  return { fake, porters, writes };
};

const itemCount = (body: string | undefined): number =>
  (body ?? "").split("<Item>").length - 1;

describe("bulk write through the fake", () => {
  it("writes 250 creates as several accepted batches, in order", async () => {
    const { fake, porters, writes } = setup();
    const inputs = Array.from({ length: 250 }, (_, i) => ({
      P_Owner: 5,
      P_Name: `候補者 ${i}`,
    }));

    const result = await porters.candidate.createMany(inputs);

    expect(writes.length).toBeGreaterThan(1);
    for (const w of writes) {
      // Both bounds hold on every request — the fake answers 102 / HTTP 400 otherwise.
      expect(itemCount(w.body)).toBeLessThanOrEqual(200);
      expect(w.url.length + (w.body?.length ?? 0)).toBeLessThanOrEqual(15_000);
    }
    expect(result.hasFailures).toBe(false);
    expect(result.results).toHaveLength(250);
    // Ids come back in input order, from the fake's own sequence.
    expect(result.results[0]?.id).toBe(10001);
    expect(result.results[249]?.id).toBe(10250);
    expect(fake.control.records("candidate")).toHaveLength(250);
    expect(fake.control.records("candidate")[249]?.P_Name).toBe("候補者 249");
  });

  it("hits the 200-record bound when the records are small enough", async () => {
    const { porters, writes } = setup();
    const created = await porters.candidate.createMany(
      Array.from({ length: 250 }, () => ({ P_Owner: 5 })),
    );
    writes.length = 0;

    // An id-only update serializes to ~45 chars, so 200 of them still fit the size cap: this is
    // the case where the *record count* is the binding limit, not the request length.
    await porters.candidate.updateMany(
      created.results.map((r) => ({ id: r.id, fields: {} })),
    );

    expect(writes.map((w) => itemCount(w.body))).toEqual([200, 50]);
  });

  it("updates 250 records and applies every one", async () => {
    const { fake, porters, writes } = setup();
    const created = await porters.candidate.createMany(
      Array.from({ length: 250 }, () => ({ P_Owner: 5, P_Name: "初期" })),
    );
    writes.length = 0;

    const result = await porters.candidate.updateMany(
      created.results.map((r) => ({ id: r.id, fields: { P_Name: "更新後" } })),
    );

    expect(result.hasFailures).toBe(false);
    expect(result.results).toHaveLength(250);
    expect(fake.control.records("candidate")).toHaveLength(250); // no new records
    expect(
      fake.control.records("candidate").every((r) => r.P_Name === "更新後"),
    ).toBe(true);
  });

  it("reports a per-record failure without aborting the batch", async () => {
    const { fake, porters } = setup();
    // The 3rd record of the first (only) batch fails validation.
    fake.control.failNext({ kind: "writeItemCodes", codes: [0, 0, 133] });

    const result = await porters.candidate.createMany(
      Array.from({ length: 3 }, (_, i) => ({
        P_Owner: 5,
        P_Name: `候補者 ${i}`,
      })),
    );

    expect(result.hasFailures).toBe(true);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatchObject({ index: 2, code: 133, ok: false });
    expect(fake.control.records("candidate")).toHaveLength(2);
  });

  it("empty input sends nothing", async () => {
    const { porters, writes } = setup();

    const result = await porters.candidate.createMany([]);

    expect(writes).toHaveLength(0);
    expect(result.results).toEqual([]);
  });
});
