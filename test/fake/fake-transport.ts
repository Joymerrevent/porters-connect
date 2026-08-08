// The fake server's skeleton: URL routing, the fault-injection frame, and the state core wired
// together behind the `Transport` seam (ADR-0043 phase 0 — docs/design/fake-server-plan.md).
//
// Layering mirrors the real thing and is what the later phases fill in:
//   phase 0  this file (routing / injection frame) + `store.ts` (state) + `resources.ts` (routes)
//   phase 1  OAuth + Candidate round-trip + Result-Code injection (adds the XML + query layers)
//   phase 2+ the remaining resources, the master reads, the constraint triggers
//
// Fail-safe throughout: a route that is not implemented yet, an option that is not honoured yet
// and a fault kind that is not applied yet all raise a named `PortersConfigError`. A half-built
// fake must never look like a passing test.

import {
  PortersConfigError,
  PortersNetworkError,
} from "../../src/errors/index";
import type { TransportRequest, TransportResponse } from "../../src/http/types";
import type { ResourceDescriptor } from "../../src/resources/resource";
import { FAKE_RESOURCES } from "./resources";
import { createFakeStore } from "./store";
import {
  WIRED_FAULT_KINDS,
  WIRED_OPTIONS,
  type FakeControl,
  type FakeFault,
  type FakeTransport,
  type FakeTransportOptions,
} from "./types";

/** The API prefix every PORTERS endpoint sits under. */
const API_PREFIX = "/v1/";
const OAUTH_PATH = "/v1/oauth";
const TOKEN_PATH = "/v1/token";

/** A resolved request target: the auth endpoints, one known resource, or nothing. */
type Route =
  | { kind: "auth"; path: string }
  | { kind: "resource"; descriptor: ResourceDescriptor }
  | { kind: "unknown" };

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const routeList = (): string =>
  [
    OAUTH_PATH,
    TOKEN_PATH,
    ...[...FAKE_RESOURCES.keys()].map((p) => API_PREFIX + p),
  ].join(", ");

const resolve = (path: string): Route => {
  if (path === OAUTH_PATH || path === TOKEN_PATH) return { kind: "auth", path };
  const descriptor = path.startsWith(API_PREFIX)
    ? FAKE_RESOURCES.get(path.slice(API_PREFIX.length))
    : undefined;
  return descriptor ? { kind: "resource", descriptor } : { kind: "unknown" };
};

// An option whose behaviour has not landed yet must not be accepted silently: a test that passes
// `rateLimit` and sees no rate limiting would "pass" for the wrong reason.
const rejectUnwiredOptions = (options: FakeTransportOptions): void => {
  const wired = new Set<string>(WIRED_OPTIONS);
  const unwired = Object.keys(options).filter((key) => !wired.has(key));
  if (unwired.length > 0) {
    throw new PortersConfigError(
      `fake server: option(s) ${unwired.join(", ")} are declared but not wired yet (phase 0 skeleton)`,
      {
        category: "config",
        hint: `Wired so far: ${[...wired].join(", ")}. The rest land in the phases listed in docs/design/fake-server-plan.md.`,
      },
    );
  }
};

const notImplemented = (what: string, phase: string): PortersConfigError =>
  new PortersConfigError(`fake server: ${what} is not implemented yet`, {
    category: "config",
    hint: `It lands in ${phase} of docs/design/fake-server-plan.md.`,
  });

/**
 * Build a stateful fake PORTERS server behind the `Transport` seam (ADR-0043). Unlike
 * {@link createMockTransport} — a stateless stub for single-call unit tests (N1) — this one is
 * meant to remember what you wrote and to enforce the API's own constraints, so a whole
 * `create -> search -> update` flow can run offline (N2 / L1 integration).
 *
 * **Phase 0**: routing, the injection frame and the state core are in place; every endpoint still
 * answers with an explicit "not implemented yet" error. OAuth and the Candidate round-trip land in
 * phase 1.
 *
 * @example
 * const fake = createFakeTransport();
 * const porters = new PortersClient({ host: "fake.test", transport: fake });
 * fake.control.failNext({ kind: "network" }); // the next request fails like a dropped connection
 */
export const createFakeTransport = (
  options: FakeTransportOptions = {},
): FakeTransport => {
  rejectUnwiredOptions(options);
  const store = createFakeStore();
  const faults: FakeFault[] = [];
  let latencyMs = options.latencyMs ?? 0;

  const takeFault = (): FakeFault | undefined => faults.shift();

  const send = async (req: TransportRequest): Promise<TransportResponse> => {
    if (latencyMs > 0) await sleep(latencyMs);
    const url = new URL(req.url);
    const target = resolve(url.pathname);
    if (target.kind === "unknown") {
      throw new PortersConfigError(
        `fake server: no route for ${req.method} ${url.pathname}`,
        {
          category: "config",
          hint: `Routed so far: ${routeList()}. Other resources land in phases 2-3 of docs/design/fake-server-plan.md.`,
        },
      );
    }

    // Transport-level faults need no PORTERS envelope, so they are answered here. The
    // envelope-level kinds (resultCode / writeItemCodes / authError) stay queued for the handlers
    // that know the resource name and item count — phase 1.
    const fault = takeFault();
    if (fault?.kind === "network") {
      throw new PortersNetworkError(
        fault.message ?? "fake server: connection reset",
        { category: "network", retryable: true },
      );
    }
    if (fault?.kind === "http") {
      return { status: fault.status, body: fault.body ?? "" };
    }

    if (target.kind === "auth") {
      throw notImplemented(`the auth endpoint ${target.path}`, "phase 1");
    }
    throw notImplemented(
      `${req.method} ${API_PREFIX}${target.descriptor.path}`,
      "phase 1 (Candidate) / phase 2 (the other resources)",
    );
  };

  const control: FakeControl = {
    failNext: (fault, times = 1) => {
      const wired = new Set<string>(WIRED_FAULT_KINDS);
      if (!wired.has(fault.kind)) {
        throw notImplemented(`fault kind "${fault.kind}"`, "phase 1");
      }
      for (let i = 0; i < times; i += 1) faults.push(fault);
    },
    clearFaults: () => {
      faults.length = 0;
    },
    pendingFaults: () => [...faults],
    records: (path) => store.list(path),
    setLatency: (ms) => {
      latencyMs = ms;
    },
    reset: () => {
      faults.length = 0;
      store.reset();
    },
  };

  return { send, control };
};
