// What an access point is (ADR-0047) and the check it passes once, at construction (ADR-0048):
// the scheme / hostname / port every PORTERS URL is built from. The URL itself is assembled in
// `api-url.ts`, which stays pure concatenation because the check already ran here.

import { PortersConfigError } from "../errors/index";

// http を明示 opt-in にし、警告の抑止を別にする決定は ADR-0047。
/**
 * URL scheme of the API access point. `https` is the default; `http` is opt-in,
 * meant for a local fake server or a trusted tunnel, and always warns (see
 * `PortersClientOptions.scheme`).
 */
export type Scheme = "https" | "http";

/**
 * Where the API lives: scheme + hostname + port (ADR-0078).
 *
 * `hostname` is the contract-issued **server name** (supplied via `PORTERS_HOST`, never
 * hard-coded) and carries **no port** — PORTERS issues a name and speaks https, so the port is
 * only ever needed for a local fake or a proxy, and it belongs in `port`. `scheme` defaults to
 * `https`; `http` is opt-in and warns (ADR-0047). Path-prefixed gateways
 * (`https://gw/porters/v1/...`) are deliberately out of scope.
 */
export type AccessPoint = {
  hostname: string;
  /** Only for a local fake / proxy. Omit to use the scheme's own port. */
  port?: number;
  scheme?: Scheme;
};

const HOSTNAME_HINT =
  "Pass the server name only — no port, scheme, path, userinfo or whitespace." +
  ' Examples: "xxxxx.example.com", "127.0.0.1". A port goes in `port`; an IPv6 address is' +
  ' bracketed ("[::1]"). A non-ASCII name must be given in punycode.';

// PORTERS' own range. 0 is not "any port" here — it would build `https://host:0/...`.
const MIN_PORT = 1;
const MAX_PORT = 65535;

const configError = (message: string, hint: string): PortersConfigError =>
  new PortersConfigError(message, { category: "config", hint });

// The scheme the round-trip parses with (ADR-0049). Deliberately *not* `https`: WHATWG URL knows
// the default port of a special scheme and drops it, so `a.test:443` came back as `a.test` and was
// rejected for not round-tripping — a config that works today, refused for a parser's convenience.
// An unknown scheme has no default port, so every port survives. The name only ever appears in
// this file; nothing is sent anywhere with it.
const PROBE_SCHEME = "porters-check";

// The type says `"https" | "http"`, but JS callers and `as` casts get past it — and a silently
// assembled `ftp://host/v1/...` is exactly the ambiguity ADR-0047 refused to keep.
const assertScheme = (scheme: Scheme | undefined): void => {
  if (scheme !== undefined && scheme !== "https" && scheme !== "http") {
    throw configError(
      `scheme ${JSON.stringify(scheme)} is not supported`,
      'Use "https" (default) or "http" (local fake server / trusted tunnel only).',
    );
  }
};

const assertPort = (port: number | undefined): void => {
  if (
    port !== undefined &&
    (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT)
  ) {
    throw configError(
      `port ${JSON.stringify(port)} is not a valid port number`,
      `Pass an integer between ${MIN_PORT} and ${MAX_PORT}, or omit it to use the scheme's own port.`,
    );
  }
};

const assertHostname = (hostname: string): void => {
  const rejected = (): PortersConfigError =>
    configError(
      `hostname ${JSON.stringify(hostname)} is not a bare server name`,
      HOSTNAME_HINT,
    );
  // `%` は往復の比較を通るが、https の URL では復号されて別の名前になる（`a%41.test` → `aa.test`）か、
  // 組み立てられずに通信エラー（再試行できる扱い）として届く。サーバー名に `%` は現れない（RV-92）。
  if (hostname.includes("%")) throw rejected();
  let url: URL;
  try {
    url = new URL(`${PROBE_SCHEME}://${hostname}`);
    // 送るときの scheme でも組み立てられること。未知の scheme は名前を検査しないので、punycode として
    // 成り立たない `xn--` などは、ここで確かめないと最初のリクエストまで分からない（RV-92）。
    // 空の名前もここで止まる。未知の scheme は空の authority を許し、`porters-check://` の hostname が
    // `""` になって空の入力と「一致」してしまう。`!` で押し通した未設定の `PORTERS_HOST` は、この検査が
    // 止めるべき誤りそのもの（RV-17）。
    new URL(`https://${hostname}`);
  } catch {
    throw rejected();
  }
  // An unknown scheme leaves the name's case alone (a special scheme lowercases it), so compare
  // case-insensitively — an upper-case name is valid.
  //
  // `url.port` / `url.pathname` を並べるのは、「名前と、その後ろに何も無いこと」を契約として読めるように
  // するため（ADR-0078 / ADR-0048）。`a.test:4010` は `hostname` が `a.test` として parse できてしまい、
  // 見逃すとポートが黙って落ちる。ただ、ポートやパスが混ざれば `url.hostname` は入力と一致しなく
  // なるので、先頭の比較がすでに弾いている。後ろ 2 つは等価なミュータントになる（実測 2026-09-16）ため、
  // ミューテーションから外す。IPv6 は `[::1]` と括弧で囲むので、ポートとは見なされない。
  // Stryker disable ConditionalExpression: equivalent — a port or a path implies a hostname mismatch
  if (
    url.hostname.toLowerCase() !== hostname.toLowerCase() ||
    url.port !== "" ||
    url.pathname !== ""
  ) {
    throw rejected();
  }
  // Stryker restore ConditionalExpression
};

/**
 * Reject an access point the library cannot honour — **before** a single request is built
 * (ADR-0048). `hostname` means the server name and nothing else (ADR-0078): a value carrying a
 * port, a scheme, a path, userinfo or whitespace is a configuration mistake, not a destination.
 *
 * Left unchecked it would not fail: `https://${hostname}/v1/...` concatenates into something that
 * is *itself* a valid URL, so `https://xxxxx.example.com` as a `hostname` resolves the host `https`
 * and an empty one resolves `v1`. Credentials (`app_id` in the OAuth query, `secret` in the Token
 * body) would go to whatever that name resolves to, and a name that does not resolve reads as a
 * `PortersNetworkError` with `retryable: true` — a config mistake retried forever under the wrong
 * diagnosis. Both are the wrong way to fall over.
 *
 * The test is a round-trip rather than a list of forbidden patterns, so shapes nobody thought of
 * are rejected too (fail-safe): parse `{PROBE_SCHEME}://{hostname}` and require that it parses,
 * that `url.hostname` comes back as the input (case-insensitively), that no port came with it,
 * and that nothing follows the authority.
 *
 * Known limit, by design: a name is percent-encoded rather than punycode-decoded here, so a
 * non-ASCII name does not round-trip and must be written in punycode (PORTERS issues ASCII server
 * names). The hint says so.
 */
export const validateAccessPoint = (accessPoint: AccessPoint): void => {
  assertScheme(accessPoint.scheme);
  assertPort(accessPoint.port);
  assertHostname(accessPoint.hostname);
};

/**
 * The authority this access point addresses: `hostname` plus `:port` when one is configured.
 * Assembled in one place because the URL and the insecure-http warning (ADR-0047) read it, and the
 * throttle bucket key (ADR-0073) is derived from it — they must agree on what "the same
 * destination" means. Two access points that differ only by port are different destinations.
 */
export const authorityOf = (accessPoint: AccessPoint): string =>
  accessPoint.port === undefined
    ? accessPoint.hostname
    : `${accessPoint.hostname}:${accessPoint.port}`;

/**
 * The key that decides which access points share a throttle bucket (ADR-0073): the authority as
 * the request goes out — lower-cased, without the scheme's default port and without a trailing
 * `.`. `a.test`, `A.test:443` and `a.test.` reach the same server, so they must count against the
 * same limit (RV-92). Expects an access point that passed {@link validateAccessPoint}.
 */
export const throttleKeyOf = (accessPoint: AccessPoint): string => {
  const url = new URL(
    `${accessPoint.scheme ?? "https"}://${authorityOf(accessPoint)}`,
  );
  const hostname = url.hostname.replace(/\.$/, "");
  return url.port === "" ? hostname : `${hostname}:${url.port}`;
};
