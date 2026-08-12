// Shared types of the in-repo fake PORTERS server (ADR-0043 / docs/design/fake-server-plan.md).
//
// Dev-only by construction: this lives outside `src/`, so it ships in no tarball (`files` = dist)
// and is not coverage-measured (vitest coverage include = `src/**`) — yet it is still tested, so
// the fake itself stays trustworthy. It implements the public `Transport` seam, which means the
// library runs against it completely unchanged: no HTTP, no TLS, no `host` rewiring (the startable
// HTTP server adapter is phase 5 of the plan).

import type { Transport } from "../../src/http/types";

/** A stored field value in PORTERS wire shape: a scalar, or the selected Option aliases. */
export type FakeValue = string | string[];

/** One stored record: bare alias (`P_Name`) -> wire value. `P_Id` is always present. */
export type FakeRecord = Record<string, FakeValue>;

/** A user in the fake's User master: expands `User`-typed fields, and is what `/v1/user` reads. */
export type FakeUser = {
  P_Id: number;
  /** `0` = standard user, `1` = system admin (docs/reference). Default `0`. */
  P_Type?: string;
  P_Name?: string;
  P_Mail?: string;
};

/**
 * One node of the Option master tree that `/v1/option` reads. PORTERS returns choices as a
 * recursive `<Items>` tree; seed one here when a test cares about the hierarchy (the aliases a
 * write used are otherwise served as flat roots).
 */
export type FakeOptionNode = {
  /** Leaf alias as it appears in a value, e.g. `Option.P_Tokyo`. */
  alias: string;
  name?: string;
  /** `0` = ordinary choice, `1`–`11` = a phase kind (docs/reference). Default `0`. */
  type?: number;
  children?: FakeOptionNode[];
};

/**
 * A deterministic fault to inject. Faults are queued by {@link FakeControl.failNext} and consumed
 * by the next request they *target*, so a fault queued for a resource call is not eaten by the
 * OAuth round-trip the library makes first:
 *
 * - `network` / `http` -> the next request of any kind
 * - `resultCode` -> the next Resource API request
 * - `writeItemCodes` -> the next Resource API **write**
 * - `authError` -> the next Authentication API request (`/v1/oauth`, `/v1/token`)
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

/**
 * Request caps on the Resource API (reference: Read 2000 / Write 500 per minute, and a contractual
 * ~150,000 accesses per month). Enforced by default at the reference values — the library throttles
 * itself to 90% of the per-minute caps, so a well-behaved caller never reaches them.
 *
 * `mode` decides what exceeding them does. The reference only says the connection *may be forcibly
 * closed* and explicitly notes that **no HTTP 429 / Retry-After is documented**, so `disconnect`
 * (a `PortersNetworkError`, like a dropped `fetch`) is the grounded default; `http429` is offered
 * because ADR-0043 names a 429 as a constraint trigger worth exercising. Which one the live API
 * does is unverified — see docs/live-verification.md (LV-9).
 */
export type FakeRateLimit = {
  /** Default 2000. */
  readPerMinute?: number;
  /** Default 500. */
  writePerMinute?: number;
  /** Read + Write over a rolling 30 days. Default 150000. */
  perMonth?: number;
  /** Default `disconnect`. */
  mode?: "disconnect" | "http429";
};

/** Options for {@link createFakeTransport}. */
export type FakeTransportOptions = {
  /** Artificial delay before every answer (ms). Default `0`. */
  latencyMs?: number;
  /** Injectable clock for token TTLs / server timestamps. Default `Date.now`. */
  now?: () => number;
  /** Partition ids the fake accepts; anything else answers Result Code 404. Default `[1]`. */
  partitions?: number[];
  /** Records to pre-load, keyed by URL path segment (e.g. `candidate`). Ids are assigned here. */
  seed?: Record<string, FakeRecord[]>;
  /** Users returned when expanding `User`-typed fields, and read by `/v1/user`. */
  users?: FakeUser[];
  /** The Option master tree read by `/v1/option`. Omit to serve the used aliases as flat roots. */
  optionTree?: FakeOptionNode[];
  /** Author recorded in `P_RegisteredBy` / `P_UpdatedBy` when the caller omits them. Default `1`. */
  currentUserId?: number;
  /** Request caps; `false` disables them. Defaults to the reference limits. */
  rateLimit?: FakeRateLimit | false;
};

/** Deterministic controls for driving the fake from a test. */
export type FakeControl = {
  /** Queue a fault for the next matching request (see {@link FakeFault}). */
  failNext(fault: FakeFault, times?: number): void;
  /** Drop every queued fault. */
  clearFaults(): void;
  /** The faults still queued, oldest first — lets a test assert nothing was silently eaten. */
  pendingFaults(): readonly FakeFault[];
  /** Expire every issued Access Token, so the next call gets Result Code 401 (refresh path). */
  expireAccessTokens(): void;
  /** Mint an OAuth `code` as the browser grant would, for `auth.exchangeAuthorizationCode`. */
  issueAuthorizationCode(): string;
  /** The stored records of one resource path — for assertions. */
  records(path: string): FakeRecord[];
  /** Replace the artificial latency (ms). */
  setLatency(ms: number): void;
  /** Clear records, masters, tokens and faults, then re-apply `seed`. */
  reset(): void;
};

/**
 * A `Transport` backed by the fake server, plus its {@link FakeControl}. Pass it straight to the
 * client: `new PortersClient({ transport: fake })`.
 */
export type FakeTransport = Transport & { readonly control: FakeControl };
