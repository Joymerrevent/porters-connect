// Sending a Read, shared by every resource — data and master: the page envelope a Read resolves
// to, the URL at the configured access point, and GET + parse + decode for one page. What each
// resource sends (its parameters) and how it decodes stay with the resource (ADR-0021/0022).

import { apiUrl } from "../http/api-url";
import type { AccessPoint } from "../http/access-point";
import type { Requester } from "../http/requester";
import { parseResourcePage, type RawItem } from "../xml/parse-resource-page";
import type { FieldCatalog, ReadRecord } from "./catalog";
import { appendPaging } from "./paging";

// レコード型でパラメータ化するのは expand（ADR-0058）で行が広がるため。
/**
 * A page of decoded records: the standard Read envelope (Total / Count / Start) around whatever
 * the item decoder produced. Parametrised by the *record* rather than the catalog because a read
 * that expands references returns a wider record than the catalog alone describes.
 */
export type ResourcePageOf<T> = {
  items: T[];
  total: number;
  count: number;
  start: number;
};

export type ResourcePage<F extends FieldCatalog> = ResourcePageOf<
  ReadRecord<F>
>;

/**
 * GET a Read URL, parse the standard envelope (Total/Count/Start + Items), decode each item.
 * `resource` is the expected root element — the parser needs it to tell a PORTERS answer from
 * whatever a middlebox put on a 200 (ADR-0051).
 */
export const runRead = <T>(
  requester: Requester,
  resource: string,
  url: string,
  decode: (item: RawItem) => T,
): Promise<ResourcePageOf<T>> =>
  requester.request({ method: "GET", url, headers: {} }, (body) => {
    const page = parseResourcePage(body, resource);
    return {
      items: page.items.map(decode),
      total: page.total,
      count: page.count,
      start: page.start,
    };
  });

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

/** Where a resource's Read goes: the pieces every page of every query shares. */
export type PageReaderTarget = {
  requester: Requester;
  accessPoint: AccessPoint;
  /** Root element of the response (and the error context), e.g. `"Candidate"`. */
  name: string;
  /** URL path segment, e.g. `"candidate"`. */
  path: string;
};

/**
 * Read one page: the query's serialised parameters + paging, sent to the resource's path and decoded
 * with the given decoder. Shared by the data and the master resources, so "how one page is read"
 * is written once; what differs between them — the parameters and whether the decoder depends on
 * the query — stays with each.
 */
export const createPageReader =
  (target: PageReaderTarget) =>
  <T>(
    base: URLSearchParams,
    decode: (item: RawItem) => T,
    count?: number,
    start?: number,
  ): Promise<ResourcePageOf<T>> =>
    runRead(
      target.requester,
      target.name,
      readUrlOf(target.accessPoint, target.path, base, count, start),
      decode,
    );
