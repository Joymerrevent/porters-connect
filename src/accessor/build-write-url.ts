// The Write URL: `/v1/{path}?partition=…` at the configured access point (ADR-0047).

import { apiUrl } from "../http/api-url";
import type { AccessPoint } from "../http/access-point";

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
