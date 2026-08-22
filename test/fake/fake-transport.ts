// The fake server itself: routing, the PORTERS-side guards (auth header, API version, partition,
// request length) and deterministic fault injection, exposed as a `Transport` (ADR-0043).
//
// Layering mirrors the real thing: this file owns *protocol* concerns, `store.ts` + `records.ts` +
// `masters.ts` the state, `wire.ts` the XML, `query.ts` the Read parameters, `oauth.ts` the token
// lifecycle.
//
// Fail-safe throughout: a route that is not implemented yet and an option that is not honoured yet
// both raise a named `PortersConfigError`. A half-built fake must never look like a passing test.
//
//   phase 1 (here)  OAuth + Candidate Read/Write round-trip + Result-Code / size injection
//   phase 2+        the remaining resources, the master reads, the per-minute rate caps

import {
  PortersConfigError,
  PortersNetworkError,
} from "../../src/errors/index";
import { MAX_REQUEST_LENGTH } from "../../src/http/requester";
import type { TransportRequest, TransportResponse } from "../../src/http/types";
import { createFakeMasters } from "./masters";
import { createFakeAuth } from "./oauth";
import { parseReadQuery, runReadQuery } from "./query";
import { createRateLimiter } from "./rate-limit";
import {
  createRecord,
  seedRecord,
  updateRecord,
  type RecordContext,
} from "./records";
import {
  FAKE_DATA_DESCRIPTORS,
  FAKE_RESOURCES,
  type FakeResource,
} from "./resources";
import { createFakeStore } from "./store";
import {
  type FakeControl,
  type FakeFault,
  type FakeRecord,
  type FakeTransport,
  type FakeTransportOptions,
} from "./types";
import {
  buildAuthenticationXml,
  buildReadPageXml,
  buildResourceErrorXml,
  buildWriteResultXml,
  parseWriteBody,
} from "./wire";

/** The API prefix every PORTERS endpoint sits under. */
const API_PREFIX = "/v1/";
const OAUTH_PATH = "/v1/oauth";
const TOKEN_PATH = "/v1/token";

// Resource Result Codes this fake can raise (docs/reference/resource-api/result-codes.md).
const CODE_NOT_FOUND = 7;
const CODE_INVALID_PARAMETER = 100;
const CODE_TOO_MANY_PARAMETERS = 102;
const CODE_INVALID_VERSION = 146;
const CODE_TOKEN_EXPIRED = 401;
const CODE_TOKEN_INVALID = 402;
const CODE_PARTITION_NOT_FOUND = 404;

/** One request carries at most 200 records (reference: Read / Write とも最大 200 件). */
const MAX_ITEMS_PER_REQUEST = 200;

const AUTH_TOKEN_HEADER = "X-porters-hrbc-oauth-token";
const API_VERSION_HEADER = "X-P-ConnectAPI-Version";
const SUPPORTED_API_VERSIONS = new Set(["1", "2"]);

type RouteKind = "auth" | "resource" | "unknown";

/** A resolved request target: the auth endpoints, one known resource, or nothing. */
type Route =
  | { kind: "auth"; path: string }
  | { kind: "resource"; resource: FakeResource }
  | { kind: "unknown" };

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const routeList = (): string =>
  [
    OAUTH_PATH,
    TOKEN_PATH,
    ...[...FAKE_RESOURCES.keys()].map((p) => API_PREFIX + p),
  ].join(", ");

const resolveRoute = (path: string): Route => {
  if (path === OAUTH_PATH || path === TOKEN_PATH) return { kind: "auth", path };
  const resource = path.startsWith(API_PREFIX)
    ? FAKE_RESOURCES.get(path.slice(API_PREFIX.length))
    : undefined;
  return resource ? { kind: "resource", resource } : { kind: "unknown" };
};

// A header lookup that ignores case — the library sends canonical casing, but a Transport must not
// depend on that.
const header = (req: TransportRequest, name: string): string | undefined => {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(req.headers)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return undefined;
};

/**
 * Build a stateful fake PORTERS server behind the `Transport` seam (ADR-0043). Unlike
 * {@link createMockTransport} — a stateless stub for single-call unit tests (N1) — this one
 * remembers what you wrote and enforces the API's own constraints, so a whole
 * `create -> search -> update` flow runs offline (N2 / L1 integration).
 *
 * @example
 * const fake = createFakeTransport();
 * const porters = new PortersClient({ host: "fake.test", appId: "a", appSecret: "s",
 *   partition: 1, transport: fake });
 * const id = await porters.candidate.create({ P_Owner: 5, P_Name: "山田 太郎" });
 * fake.control.failNext({ kind: "resultCode", code: 403 }); // next call fails deterministically
 */
export const createFakeTransport = (
  options: FakeTransportOptions = {},
): FakeTransport => {
  const now = options.now ?? (() => Date.now());
  const partitions = new Set((options.partitions ?? [1]).map(String));
  const context: RecordContext = {
    now,
    currentUserId: options.currentUserId ?? 1,
  };
  const store = createFakeStore();
  const masters = createFakeMasters({ users: options.users });
  const auth = createFakeAuth({ now });
  const rate = createRateLimiter(options.rateLimit, now);
  const faults: FakeFault[] = [];
  let latencyMs = options.latencyMs ?? 0;

  const applySeed = (): void => {
    for (const [path, records] of Object.entries(options.seed ?? {})) {
      const descriptor = FAKE_RESOURCES.get(path);
      if (descriptor === undefined) {
        throw new PortersConfigError(
          `fake server: cannot seed unknown resource "${path}"`,
          {
            category: "config",
            hint: `Known resources: ${[...FAKE_RESOURCES.keys()].join(", ")}.`,
          },
        );
      }
      for (const record of records) {
        seedRecord(store, descriptor, record, context);
      }
    }
  };
  applySeed();

  const matchesRoute = (
    fault: FakeFault,
    kind: RouteKind,
    write: boolean,
  ): boolean => {
    switch (fault.kind) {
      case "network":
      case "http":
        return true;
      case "authError":
        return kind === "auth";
      case "writeItemCodes":
        return kind === "resource" && write;
      case "resultCode":
        return kind === "resource";
    }
  };

  // Consume the queued fault only when it targets this request, so a fault queued for a resource
  // call is not swallowed by the OAuth round-trip the library makes first. `only` narrows further,
  // letting the outer routing take just the transport-level faults (network / raw HTTP).
  const takeFault = (
    kind: RouteKind,
    write: boolean,
    only?: (fault: FakeFault) => boolean,
  ): FakeFault | undefined => {
    const next = faults[0];
    if (next === undefined) return undefined;
    if (!matchesRoute(next, kind, write)) return undefined;
    if (only !== undefined && !only(next)) return undefined;
    faults.shift();
    return next;
  };

  const resourceError = (
    resource: FakeResource,
    code: number,
    message: string,
  ): TransportResponse => ({
    // Result-code errors ride HTTP 200 (reference); the library routes on `<Code>`.
    status: 200,
    body: buildResourceErrorXml(resource.descriptor.name, code, message),
  });

  const checkAccess = (
    req: TransportRequest,
    url: URL,
    resource: FakeResource,
  ): TransportResponse | undefined => {
    const version = header(req, API_VERSION_HEADER);
    if (version !== undefined && !SUPPORTED_API_VERSIONS.has(version)) {
      return resourceError(
        resource,
        CODE_INVALID_VERSION,
        `unsupported ${API_VERSION_HEADER}: ${version}`,
      );
    }
    const state = auth.checkAccessToken(header(req, AUTH_TOKEN_HEADER));
    if (state === "expired") {
      return resourceError(
        resource,
        CODE_TOKEN_EXPIRED,
        "Access Token has expired",
      );
    }
    if (state === "invalid") {
      return resourceError(
        resource,
        CODE_TOKEN_INVALID,
        "Invalid Access Token",
      );
    }
    // Partition Read is how an App discovers its partitions, so it is the one route that sends
    // none (ADR-0022 fact 3).
    if (resource.partitionless) return undefined;
    const partition = url.searchParams.get("partition");
    if (partition === null || !partitions.has(partition)) {
      return resourceError(
        resource,
        CODE_PARTITION_NOT_FOUND,
        `unknown partition: ${partition ?? "(none)"}`,
      );
    }
    return undefined;
  };

  const handleRead = (url: URL, resource: FakeResource): TransportResponse => {
    const query = parseReadQuery(url, resource.descriptor.prefix);
    const { items, total } = runReadQuery(
      store.list(resource.descriptor.path),
      query,
      resource.descriptor.fields,
    );
    return {
      status: 200,
      body: buildReadPageXml({
        resource: resource.descriptor.name,
        shape: {
          prefix: resource.descriptor.prefix,
          fields: resource.descriptor.fields,
          masters,
        },
        records: items,
        selection: query.selection,
        total,
        start: query.start,
      }),
    };
  };

  // A write names Users by id and Options by alias; register them so the masters can serve them
  // afterwards (`/v1/user`, `/v1/option`) and so a read expands them losslessly. Real PORTERS
  // requires them to exist beforehand — the fake accepts them and remembers instead (fail-safe:
  // a value you wrote never disappears).
  const registerReferenced = (
    resource: FakeResource,
    item: FakeRecord,
  ): void => {
    for (const [alias, value] of Object.entries(item)) {
      const type = resource.descriptor.fields[alias];
      if (type === "User" && typeof value === "string") masters.user(value);
      if (type === "Option") {
        for (const selected of Array.isArray(value) ? value : [value]) {
          masters.option(selected);
        }
      }
    }
  };

  // One `<Item>`: `P_Id = -1` creates, any other id updates that record (write-format.md).
  const writeItem = (
    resource: FakeResource,
    item: FakeRecord,
  ): { id: number; code: number } => {
    const rawId = item[resource.idAlias];
    const id = typeof rawId === "string" ? Number(rawId) : Number.NaN;
    if (!Number.isInteger(id)) return { id: 0, code: CODE_INVALID_PARAMETER };
    registerReferenced(resource, item);
    if (id === -1) {
      const created = createRecord(store, resource, item, context);
      return { id: Number(created[resource.idAlias]), code: 0 };
    }
    const updated = updateRecord(store, resource, id, item, context);
    // VERIFY(live): the code for "update targeted a record that does not exist" is unconfirmed;
    // 7 (Resource が存在しない) is the closest documented match — see LV-11.
    return updated === undefined
      ? { id, code: CODE_NOT_FOUND }
      : { id, code: 0 };
  };

  const handleWrite = (
    req: TransportRequest,
    resource: FakeResource,
    forcedCodes: number[] | undefined,
  ): TransportResponse => {
    const parsed = parseWriteBody(req.body ?? "", resource.descriptor.prefix);
    if (parsed === undefined || parsed.resource !== resource.descriptor.name) {
      return resourceError(
        resource,
        CODE_INVALID_PARAMETER,
        "malformed write body",
      );
    }
    if (parsed.items.length > MAX_ITEMS_PER_REQUEST) {
      // VERIFY(live): the reference only says "split into 200-record requests"; which code PORTERS
      // answers with — and whether it is a root-level error at all — is unconfirmed. See LV-11.
      return resourceError(
        resource,
        CODE_TOO_MANY_PARAMETERS,
        `${parsed.items.length} records exceed the ${MAX_ITEMS_PER_REQUEST}-record limit`,
      );
    }
    const results = parsed.items.map((item, index) => {
      const forced = forcedCodes?.[index];
      // An injected non-zero code fails that record without touching the store, exactly as a
      // per-item validation failure would.
      if (forced !== undefined && forced !== 0) return { id: 0, code: forced };
      return writeItem(resource, item);
    });
    return {
      status: 200,
      body: buildWriteResultXml(resource.descriptor.name, results),
    };
  };

  const handleResource = (
    req: TransportRequest,
    url: URL,
    resource: FakeResource,
  ): TransportResponse => {
    const write = req.method === "POST";
    const fault = takeFault("resource", write);
    if (fault?.kind === "resultCode") {
      return resourceError(
        resource,
        fault.code,
        fault.message ?? `injected result code ${fault.code}`,
      );
    }
    // Rate limiting sits in front of everything else, as an edge would: an over-cap request never
    // reaches auth or the store.
    if (!rate.take(write ? "write" : "read")) {
      if (rate.mode === "http429") return { status: 429, body: "" };
      throw new PortersNetworkError(
        "fake server: connection closed (request limit exceeded)",
        { category: "network", retryable: true },
      );
    }
    // PORTERS has no Write API for the masters, so neither does the fake: a POST here is a bug in
    // the caller, not a PORTERS error to imitate — surface it before anything else (fail-safe).
    if (write && resource.master !== undefined) {
      throw new PortersConfigError(
        `fake server: ${resource.descriptor.name} is read-only (PORTERS has no Write API for the masters)`,
        { category: "config" },
      );
    }
    const denied = checkAccess(req, url, resource);
    if (denied) return denied;
    if (resource.master !== undefined) {
      return resource.master(url, {
        masters,
        partitions: [...partitions].map(Number),
        currentUserId: context.currentUserId,
        optionTree: options.optionTree ?? [],
        resources: FAKE_DATA_DESCRIPTORS,
      });
    }
    if (!write) return handleRead(url, resource);
    return handleWrite(
      req,
      resource,
      fault?.kind === "writeItemCodes" ? fault.codes : undefined,
    );
  };

  const handleAuth = (
    req: TransportRequest,
    url: URL,
    path: string,
  ): TransportResponse => {
    const fault = takeFault("auth", false);
    if (fault?.kind === "authError") {
      return {
        status: 200,
        body: buildAuthenticationXml({
          Error: String(fault.error),
          Message:
            fault.message ?? `injected authentication error ${fault.error}`,
        }),
      };
    }
    if (path === TOKEN_PATH) return auth.handleToken(req.body);
    return auth.handleOAuth(url);
  };

  const send = async (req: TransportRequest): Promise<TransportResponse> => {
    if (latencyMs > 0) await sleep(latencyMs);
    const url = new URL(req.url);
    const target = resolveRoute(url.pathname);
    if (target.kind === "unknown") {
      throw new PortersConfigError(
        `fake server: no route for ${req.method} ${url.pathname}`,
        {
          category: "config",
          hint: `Routed so far: ${routeList()}. Other resources land in phases 2-3 of docs/design/fake-server-plan.md.`,
        },
      );
    }

    // Transport-level faults need no PORTERS envelope, so they are answered here; the
    // envelope-level kinds stay queued for the handler that knows the resource name / item count.
    const write = req.method === "POST";
    const transportFault = takeFault(
      target.kind,
      write,
      (f) => f.kind === "network" || f.kind === "http",
    );
    if (transportFault?.kind === "network") {
      throw new PortersNetworkError(
        transportFault.message ?? "fake server: connection reset",
        { category: "network", retryable: true },
      );
    }
    if (transportFault?.kind === "http") {
      return { status: transportFault.status, body: transportFault.body ?? "" };
    }

    // PORTERS rejects an over-long request as a whole (URL + body, ~15000 chars). The body it
    // answers with is undocumented, so the fake sends a bare HTTP 400 — and the library's own
    // send-time guard is what keeps this unreachable in practice. VERIFY(live): see LV-9.
    // A file upload is exempt: Attachment content has its own 10MB limit (ADR-0018), which is why
    // the library sends it with `unboundedBody` — the fake has to honour the same exemption or a
    // legitimate upload would 400 here.
    const unbounded =
      target.kind === "resource" && write && target.resource.unboundedWrite;
    if (
      !unbounded &&
      req.url.length + (req.body?.length ?? 0) > MAX_REQUEST_LENGTH
    ) {
      return { status: 400, body: "request too long" };
    }

    if (target.kind === "auth") return handleAuth(req, url, target.path);
    return handleResource(req, url, target.resource);
  };

  const control: FakeControl = {
    failNext: (fault, times = 1) => {
      for (let i = 0; i < times; i += 1) faults.push(fault);
    },
    clearFaults: () => {
      faults.length = 0;
    },
    pendingFaults: () => [...faults],
    expireAccessTokens: () => auth.expireAccessTokens(),
    issueAuthorizationCode: () => auth.issueAuthorizationCode(),
    records: (path) => store.list(path),
    setLatency: (ms) => {
      latencyMs = ms;
    },
    reset: () => {
      faults.length = 0;
      rate.reset();
      auth.reset();
      masters.reset();
      store.reset();
      applySeed();
    },
  };

  return { send, control };
};
