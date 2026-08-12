// The one place a PORTERS URL is assembled (ADR-0047). Before this, `https://${host}/v1/...`
// was spelled out at 10 call sites and grew by one with every resource added — so the scheme
// could not be configured at all, and a local (http) fake or a VPN gateway was unreachable
// without swapping the whole Transport. Everything that talks to the API builds its URL here.
// Knowing what an access point *is* also lives here, so validation sits next to assembly
// (ADR-0048) — `apiUrl` stays pure concatenation and the check runs once, at construction.

import { PortersConfigError } from "../errors/index";
import type { Scheme } from "../types/index";

/**
 * Where the API lives: scheme + authority. `host` is the contract-issued host name (supplied via
 * `PORTERS_HOST`, never hard-coded) and may carry a port — `localhost:4010`. `scheme` defaults to
 * `https`; `http` is opt-in and warns (ADR-0047). Path-prefixed gateways
 * (`https://gw/porters/v1/...`) are deliberately out of scope.
 */
export type AccessPoint = {
  host: string;
  scheme?: Scheme;
};

const HOST_HINT =
  "Pass the host name only (with a port if needed) — no scheme, path, userinfo or whitespace." +
  ' Examples: "xxxxx.example.com", "127.0.0.1:4010". Omit the default port (443). A non-ASCII host must be given in punycode.';

const configError = (message: string, hint: string): PortersConfigError =>
  new PortersConfigError(message, { category: "config", hint });

/**
 * Reject an access point the library cannot honour — **before** a single request is built
 * (ADR-0048). `host` means the host (and optional port), nothing else; a value carrying a scheme,
 * a path, userinfo or whitespace is a configuration mistake, not a destination.
 *
 * Left unchecked it would not fail: `https://${host}/v1/...` concatenates into something that is
 * *itself* a valid URL, so `https://xxxxx.example.com` as a `host` resolves the host `https` and an
 * empty `host` resolves `v1`. Credentials (`app_id` in the OAuth query, `secret` in the Token body)
 * would go to whatever that name resolves to, and a name that does not resolve reads as a
 * `PortersNetworkError` with `retryable: true` — a config mistake retried forever under the wrong
 * diagnosis. Both are the wrong way to fall over.
 *
 * The test is a round-trip rather than a list of forbidden patterns, so shapes nobody thought of
 * are rejected too (fail-safe): parse `https://{host}` and require that it parses, that `url.host`
 * comes back as the input (lowercased), and that the path is `/`.
 *
 * Known limits, both by design: `url.host` is punycode-normalized, so a non-ASCII host must be
 * written in punycode (PORTERS issues ASCII host names); and the redundant default port — `:443`
 * — is dropped by the parser, so it does not round-trip and is rejected. Both say so in the hint.
 */
export const validateAccessPoint = (accessPoint: AccessPoint): void => {
  const { host, scheme } = accessPoint;
  // The type says `"https" | "http"`, but JS callers and `as` casts get past it — and a silently
  // assembled `ftp://host/v1/...` is exactly the ambiguity ADR-0047 refused to keep.
  if (scheme !== undefined && scheme !== "https" && scheme !== "http") {
    throw configError(
      `scheme ${JSON.stringify(scheme)} is not supported`,
      'Use "https" (default) or "http" (local fake server / trusted tunnel only).',
    );
  }

  const rejected = (): PortersConfigError =>
    configError(
      `host ${JSON.stringify(host)} is not a bare host name`,
      HOST_HINT,
    );
  let url: URL;
  try {
    url = new URL(`https://${host}`);
  } catch {
    throw rejected();
  }
  // The `pathname` half is belt-and-suspenders: a path can only appear after a delimiter that
  // also ends the authority, so an input carrying one already fails the host comparison (checked
  // exhaustively over a delimiter-rich alphabet — no counterexample). It stays because ADR-0048
  // names all three conditions and reading it as "host, and nothing after it" is the point.
  // Stryker disable next-line ConditionalExpression: equivalent — a non-"/" path implies a host mismatch
  if (url.host !== host.toLowerCase() || url.pathname !== "/") throw rejected();
};

/** Build an API URL: `{scheme}://{host}/v1/{path}` plus `?{params}` when any are given. */
export const apiUrl = (
  accessPoint: AccessPoint,
  path: string,
  params?: URLSearchParams,
): string => {
  const query = params?.toString();
  const scheme = accessPoint.scheme ?? "https";
  const base = `${scheme}://${accessPoint.host}/v1/${path}`;
  return query ? `${base}?${query}` : base;
};
