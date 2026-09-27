// GET + parse + decode for one Read URL.

import type { Requester } from "../http/requester";
import { parseResourcePage, type RawItem } from "../xml/parse-resource-page";
import type { ResourcePageOf } from "./resource-page";

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
