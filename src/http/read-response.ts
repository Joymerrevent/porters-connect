// How a PORTERS response is read: both error channels, in one place (ADR-0044, extended to the
// authentication endpoints by ADR-0050). The reference calls an error "HTTP != 200 **or** `<Code>`
// != 0", so neither half can be skipped — and which half wins has to be decided identically
// wherever a response is read. `requester` uses it for the Resource API; the OAuth / Token calls,
// which sit outside the request pipeline, use it too.

import { httpStatusError, withHttpStatus, PortersError } from "../errors/index";
import type { TransportResponse } from "./types";

/**
 * Turn a raw response into a parsed value, or throw the error it actually represents.
 *
 * An envelope with a PORTERS code wins: it is the most specific answer there is, so that error is
 * kept and the status stamped alongside. Without one, a non-2xx is classified from the status,
 * because `parse` would otherwise read a proxy's HTML error page as a well-formed empty page and
 * hand the caller "no results" (fail-safe).
 *
 * VERIFY(live): which statuses real PORTERS returns is unconfirmed — see
 * docs/live-verification.md (LV-9).
 */
export const readResponse = <T>(
  res: TransportResponse,
  parse: (body: string) => T,
): T => {
  const ok = res.status >= 200 && res.status < 300;
  try {
    const parsed = parse(res.body);
    if (ok) return parsed;
  } catch (e) {
    // Not ours: on a success status that failure *is* the failure, so it passes through untouched.
    if (!(e instanceof PortersError)) {
      if (ok) throw e;
      throw httpStatusError(res.status, e);
    }
    // A PORTERS code means the API itself answered — keep it. So does any failure on a 2xx, where
    // the status has nothing to add. Otherwise the status explains more than "unparseable" does.
    if (ok || e.code !== null) throw withHttpStatus(e, res.status);
    throw httpStatusError(res.status, e);
  }
  throw httpStatusError(res.status);
};
