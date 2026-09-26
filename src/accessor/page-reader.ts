// Reading one page of a resource, shared by the data and the master resources.

import type { AccessPoint } from "../http/access-point";
import type { Requester } from "../http/requester";
import { type RawItem } from "../xml/parse-resource-page";
import type { ResourcePageOf } from "./resource-page";
import { runRead } from "./run-read";
import { readUrlOf } from "./page-url";

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
