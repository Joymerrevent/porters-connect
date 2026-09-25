// Small Write helpers shared by the data resources' factory and the bespoke Attachment accessor:
// the Write URL and reading the id out of a single-Item Write response.

import { PortersResourceError, resourceError } from "../../errors";
import { apiUrl, type AccessPoint } from "../../http/access-point";
import { parseWriteResult } from "../../xml/parser";

/** Build a Write URL: `/v1/{path}?partition=…` at the configured access point. */
export const buildWriteUrl = (
  accessPoint: AccessPoint,
  partition: number,
  path: string,
): string =>
  apiUrl(
    accessPoint,
    path,
    new URLSearchParams({ partition: String(partition) }),
  );

/**
 * A single-Item Write response -> the assigned/updated id. A non-zero per-item Code is a
 * resource error (mapped, not swallowed); a missing result Item is unparseable. Shared by
 * the generic factory and the bespoke Attachment accessor. `path` names the error code
 * message, `name` the error context resource.
 */
export const firstWriteResultId = (
  body: string,
  path: string,
  name: string,
): number => {
  const first = parseWriteResult(body)[0];
  if (first === undefined) {
    throw new PortersResourceError("write returned no result item", {
      category: "unknown",
    });
  }
  if (first.code !== 0) {
    throw resourceError(
      first.code,
      `${path} write returned code ${first.code}`,
      {
        resource: name,
      },
    );
  }
  return first.id;
};
