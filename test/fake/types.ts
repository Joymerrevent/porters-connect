// Shared types of the in-repo fake PORTERS server (ADR-0043 / docs/design/fake-server-plan.md).
//
// Dev-only by construction: this lives outside `src/`, so it ships in no tarball (`files` = dist)
// and is not coverage-measured (vitest coverage include = `src/**`) — yet it is still tested, so
// the fake itself stays trustworthy. It implements the public `Transport` seam, which means the
// library runs against it completely unchanged: no HTTP, no TLS, no `host` rewiring (the startable
// HTTP server adapter is phase 5 of the plan).
//
// **Phase 0 = skeleton.** This file defines the *shape* of the options and the injection API so
// later phases only fill in behaviour. Anything not yet honoured is rejected at construction /
// injection time with a named `PortersConfigError` instead of being silently ignored — a fake that
// quietly does nothing would turn into a green test that proves nothing (fail-safe).

import type { Transport } from "../../src/http/types";

/** A stored field value in PORTERS wire shape: a scalar, or the selected Option aliases. */
export type FakeValue = string | string[];

/** One stored record: bare alias (`P_Name`) -> wire value. `P_Id` is always present. */
export type FakeRecord = Record<string, FakeValue>;

/** A user in the fake's User master, used to expand `User`-typed fields on read (phase 1). */
export type FakeUser = {
  P_Id: number;
  P_Type?: string;
  P_Name?: string;
  P_Mail?: string;
};

/**
 * A deterministic fault to inject. Faults are queued by {@link FakeControl.failNext} and consumed
 * by the next request they *target*, so a fault queued for a resource call is not eaten by the
 * OAuth round-trip the library makes first:
 *
 * - `network` / `http` -> the next request of any kind (**wired in phase 0**)
 * - `resultCode` / `writeItemCodes` -> the next Resource API request (phase 1)
 * - `authError` -> the next Authentication API request (phase 1)
 */
export type FakeFault =
  /** Fail like a dropped connection: a retryable `PortersNetworkError`, as `fetch` would. */
  | { kind: "network"; message?: string }
  /** Answer with a raw HTTP status + body (e.g. a 429 that carries no PORTERS envelope). */
  | { kind: "http"; status: number; body?: string }
  /** Answer with a Resource API error envelope (`<{Resource}><Code>…`). */
  | { kind: "resultCode"; code: number; message?: string }
  /** Answer a Write with these per-item Result Codes (bulk write partial failure). */
  | { kind: "writeItemCodes"; codes: number[] }
  /** Answer with an Authentication API error envelope (`<Authentication><Error>…`). */
  | { kind: "authError"; error: number; message?: string };

/** Fault kinds the current phase actually applies; the rest are rejected on injection. */
export const WIRED_FAULT_KINDS = ["network", "http"] as const;

/**
 * Per-minute request caps (reference: Read 2000 / Write 500 per minute). Enforced from phase 4.
 *
 * `mode` decides what exceeding them does. The reference only says the connection *may be forcibly
 * closed* and explicitly notes that **no HTTP 429 / Retry-After is documented**, so `disconnect`
 * (a `PortersNetworkError`, like a dropped `fetch`) is the grounded default; `http429` exists
 * because ADR-0043 names a 429 as a constraint trigger worth exercising.
 */
export type FakeRateLimit = {
  readPerMinute?: number;
  writePerMinute?: number;
  mode?: "disconnect" | "http429";
};

/** Options for {@link createFakeTransport}. */
export type FakeTransportOptions = {
  /** Artificial delay before every answer (ms). Default `0`. **Phase 0.** */
  latencyMs?: number;
  /** Injectable clock for token TTLs / server timestamps. Default `Date.now`. Phase 1. */
  now?: () => number;
  /** Partition ids the fake accepts; anything else answers Result Code 404. Phase 1. */
  partitions?: number[];
  /** Records to pre-load, keyed by URL path segment (e.g. `candidate`). Phase 1. */
  seed?: Record<string, FakeRecord[]>;
  /** Users returned when expanding `User`-typed fields. Phase 1. */
  users?: FakeUser[];
  /** Author recorded in `P_RegisteredBy` / `P_UpdatedBy` when the caller omits them. Phase 1. */
  currentUserId?: number;
  /** Per-minute caps; `false` disables them. Phase 4. */
  rateLimit?: FakeRateLimit | false;
};

/** Option keys the current phase actually honours; the rest are rejected at construction. */
export const WIRED_OPTIONS = ["latencyMs"] as const;

/** Deterministic controls for driving the fake from a test. */
export type FakeControl = {
  /** Queue a fault for the next matching request (see {@link FakeFault}). */
  failNext(fault: FakeFault, times?: number): void;
  /** Drop every queued fault. */
  clearFaults(): void;
  /** The faults still queued, oldest first — lets a test assert nothing was silently eaten. */
  pendingFaults(): readonly FakeFault[];
  /** The stored records of one resource path — for assertions. */
  records(path: string): FakeRecord[];
  /** Replace the artificial latency (ms). */
  setLatency(ms: number): void;
  /** Clear records, faults and every other piece of accumulated state. */
  reset(): void;
};

/**
 * A `Transport` backed by the fake server, plus its {@link FakeControl}. Pass it straight to the
 * client: `new PortersClient({ transport: fake })`.
 */
export type FakeTransport = Transport & { readonly control: FakeControl };
