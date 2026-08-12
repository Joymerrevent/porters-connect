// The public exception contract (ADR-0046): **a Promise-returning public method never throws
// synchronously.** Every failure — misconfiguration included — reaches the caller as a rejection,
// so `porters.candidate.search(q).catch(handler)` works as written.
//
// This is the cross-cutting guard the ADR asks for. It walks the whole Promise-returning surface
// rather than the methods that happen to guard something today, because the regression it protects
// against is *adding* a guard (or any eager work) outside the promise chain later.

import { describe, expect, it } from "vitest";

import { PortersClient } from "../../src/client";
import { PortersError } from "../../src/errors/index";
import { createMockTransport } from "../../src/http/mock-transport";

// Every route is unmocked — the auth endpoints included (`auth: false`) — so whatever a call
// reaches first fails with a non-retryable PortersConfigError from the transport. Fast,
// deterministic, and it makes the auth surface fail too, which the auto-answered default would not.
const setup = () =>
  new PortersClient({
    host: "fake.test",
    appId: "app-id",
    appSecret: "app-secret",
    partition: 1,
    scopes: ["candidate_r"],
    transport: createMockTransport(() => undefined, { auth: false }),
  });

const OVER_10MB = "A".repeat(14_000_001);
const OVER_100_CHARS = "あ".repeat(101);

// Each entry is a call that is *expected to fail*. What is under test is not that it fails, but
// **how the failure is delivered**.
const calls = (porters: PortersClient): [string, () => Promise<unknown>][] => [
  // Data resources — one factory (createResource) serves candidate / job / client / process /
  // resume, so exercising Candidate covers the shape for all five.
  ["candidate.search", () => porters.candidate.search()],
  // …and the two typed-query guards, which run while the URL is built (the RV-15 originals).
  [
    "candidate.search (keywords guard)",
    () => porters.candidate.search({ keywords: [OVER_100_CHARS] }),
  ],
  [
    "candidate.search (itemstate guard)",
    () =>
      porters.candidate.search({
        itemstate: "deleted",
        condition: { P_Name: { part: "x" } },
      }),
  ],
  ["candidate.get", () => porters.candidate.get(1)],
  ["candidate.create", () => porters.candidate.create({ P_Owner: 5 })],
  ["candidate.update", () => porters.candidate.update(1, { P_Name: "x" })],
  [
    "candidate.createMany",
    () => porters.candidate.createMany([{ P_Owner: 5 }]),
  ],
  [
    "candidate.updateMany",
    () => porters.candidate.updateMany([{ id: 1, fields: { P_Name: "x" } }]),
  ],
  // Attachment (bespoke accessor, its own 10MB guard)
  ["attachment.search", () => porters.attachment.search()],
  ["attachment.get", () => porters.attachment.get(1)],
  [
    "attachment.create (10MB guard)",
    () =>
      porters.attachment.create({
        resource: 3,
        resourceId: 1,
        contentType: "text/plain",
        fileName: "big.txt",
        content: OVER_10MB,
      }),
  ],
  [
    "attachment.update (10MB guard)",
    () => porters.attachment.update(1, { content: OVER_10MB }),
  ],
  // Master Read
  ["partition.search", () => porters.partition.search()],
  ["user.search", () => porters.user.search()],
  ["user.current", () => porters.user.current()],
  ["field.search", () => porters.field.search({ resource: "candidate" })],
  ["option.search", () => porters.option.search()],
  // OAuth surface (the string-returning authorizationUrl / revokeUrl are deliberately absent —
  // they return no Promise, so synchronous throwing is correct there).
  [
    "auth.exchangeAuthorizationCode",
    () => porters.auth.exchangeAuthorizationCode("never-issued"),
  ],
  ["auth.getToken", () => porters.auth.getToken()],
];

describe("public exception contract (ADR-0046)", () => {
  it("delivers every failure as a rejection, never a synchronous throw", async () => {
    const porters = setup();

    for (const [name, call] of calls(porters)) {
      let promise: Promise<unknown> | undefined;
      // The assertion that matters: invoking the method returns, it does not throw.
      expect(() => {
        promise = call();
      }, `${name} threw synchronously`).not.toThrow();
      expect(promise, `${name} did not return a Promise`).toBeInstanceOf(
        Promise,
      );
      await expect(promise, `${name} did not reject`).rejects.toBeInstanceOf(
        PortersError,
      );
    }
  });

  it("catches a send-time guard with .catch(), not just try/catch", async () => {
    const porters = setup();
    let caught: unknown;

    // The exact shape RV-15 could not support: no `await`, no try/catch — just `.catch`.
    await porters.candidate
      .search({ keywords: [OVER_100_CHARS] })
      .catch((e: unknown) => {
        caught = e;
      });

    expect(caught).toBeInstanceOf(PortersError);
    expect(caught).toMatchObject({
      name: "PortersConfigError",
      category: "config",
    });
  });

  it("searchAll defers its first request to the first iteration, and rejects there", async () => {
    const porters = setup();

    // `paginate` is an async generator, so no work happens at call time. Already true before
    // ADR-0046 — pinned here so it stays true (the ADR asks for confirmation, not a change).
    let iterable: AsyncIterable<unknown> | undefined;
    expect(() => {
      iterable = porters.candidate.searchAll({ keywords: [OVER_100_CHARS] });
    }).not.toThrow();

    await expect(
      (async () => {
        for await (const _ of iterable!) break;
      })(),
    ).rejects.toBeInstanceOf(PortersError);
  });

  it("keeps synchronous throwing where no Promise is returned", () => {
    const porters = setup();

    // The counterpart of the contract: `authorizationUrl` returns a string, so a configuration
    // error has nowhere to reject to and correctly throws (ADR-0046 対象外).
    expect(() =>
      porters.auth.authorizationUrl({ redirectUrl: "https://x", scopes: [] }),
    ).toThrow(expect.objectContaining({ name: "PortersConfigError" }));
  });
});
