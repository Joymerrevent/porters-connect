// The one place a PORTERS URL is assembled (ADR-0047). Before this, `https://${host}/v1/...`
// was spelled out at 10 call sites and grew by one with every resource added — so the scheme
// could not be configured at all, and a local (http) fake or a VPN gateway was unreachable
// without swapping the whole Transport. Everything that talks to the API builds its URL here.

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
