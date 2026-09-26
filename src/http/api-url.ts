// The one place a PORTERS URL is assembled (ADR-0047). Before this, `https://${host}/v1/...`
// was spelled out at 10 call sites and grew by one with every resource added — so the scheme
// could not be configured at all, and a local (http) fake or a VPN gateway was unreachable
// without swapping the whole Transport. Everything that talks to the API builds its URL here.
// It is pure concatenation: the access point was already checked when it was handed over
// (`validateAccessPoint` — ADR-0048).

import { authorityOf, type AccessPoint } from "./access-point";

/** Build an API URL: `{scheme}://{authority}/v1/{path}` plus `?{params}` when any are given. */
export const apiUrl = (
  accessPoint: AccessPoint,
  path: string,
  params?: URLSearchParams,
): string => {
  const query = params?.toString();
  const scheme = accessPoint.scheme ?? "https";
  const base = `${scheme}://${authorityOf(accessPoint)}/v1/${path}`;
  return query ? `${base}?${query}` : base;
};
