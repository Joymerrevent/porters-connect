// One page's Read URL: the shared parameters plus that page's `count` / `start`.

import { apiUrl } from "../http/api-url";
import type { AccessPoint } from "../http/access-point";
import { appendPaging } from "./append-paging";

/**
 * Assemble a Read URL from a **paging-free** parameter set: the shared half of the query is built
 * once and only `count` / `start` differ per page (RV-32). The set is cloned rather than mutated,
 * so one base can serve every page of the same `searchAll`.
 */
export const readUrlOf = (
  accessPoint: AccessPoint,
  path: string,
  base: URLSearchParams,
  count?: number,
  start?: number,
): string => {
  const p = new URLSearchParams(base);
  appendPaging(p, count, start);
  return apiUrl(accessPoint, path, p);
};
