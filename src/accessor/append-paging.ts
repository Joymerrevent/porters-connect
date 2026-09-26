// Setting `count` / `start` on a Read, with `count` checked against PORTERS' range (RV-28).

import { PortersConfigError } from "../errors";
import { MAX_READ_COUNT, MIN_READ_COUNT } from "../porters/read-rules";

/**
 * Set the universal paging params, guarding `count` against the documented 1–200 range before the
 * request goes out (RV-28). Out-of-range values would otherwise reach PORTERS and come back as an
 * opaque response; this is the same "fail early with a clear config error" series as the keyword
 * length / itemstate / request-size guards. Shared by every Read path (data + master + attachment)
 * so the rule lives in one place. Callers are `async`, so this rejects rather than throwing
 * synchronously (ADR-0046).
 */
export const appendPaging = (
  p: URLSearchParams,
  count?: number,
  start?: number,
): void => {
  if (count !== undefined) {
    if (
      !Number.isInteger(count) ||
      count < MIN_READ_COUNT ||
      count > MAX_READ_COUNT
    ) {
      throw new PortersConfigError(
        `count must be an integer between ${MIN_READ_COUNT} and ${MAX_READ_COUNT}, got ${count}`,
        {
          category: "config",
          hint: `PORTERS returns 1–${MAX_READ_COUNT} records per Read. Use searchAll() to walk every page instead of raising count.`,
        },
      );
    }
    p.set("count", String(count));
  }
  if (start !== undefined) p.set("start", String(start));
};
