// User master accessor (read-only — ADR-0021/0022). User Read requires `partition` and
// `request_type` (1 = all users; 0 = the current user — under code_direct this is the App's
// own user, i.e. self-identification). `field` defaults to the 4 readable core fields, which
// is exactly this catalog, so we omit it unless the caller narrows. No `condition`/`get(id)`:
// the API has no id filter. Extended HR fields (department/telephone/dates/…) are deferred —
// their read availability/decode shape is unconfirmed (see docs/live-verification.md).

import type { Requester } from "../http/requester";
import {
  decoderFor,
  paginate,
  runRead,
  type FieldCatalog,
  type ReadRecord,
  type ResourcePage,
} from "./read-core";

const FIELDS = {
  P_Id: "System[Id]",
  P_Type: "Number",
  P_Name: "SinglelineText",
  P_Mail: "Mail",
} as const satisfies FieldCatalog;

/** A decoded User (PORTERS operator). `P_Type`: 0 = standard user, 1 = system admin. */
export type User = ReadRecord<typeof FIELDS>;
export type UserPage = ResourcePage<typeof FIELDS>;

/** User Read query. `requestType` 1 = all users (default); `userType` -1 = any (default). */
export type UserSearchQuery = {
  /** 1 = all users (default). 0 = the current user (code_direct → the App's own user). */
  requestType?: 0 | 1;
  /** -1 = any (default), 0 = system admins, 1 = standard users. */
  userType?: -1 | 0 | 1;
  /** Output fields (prefixed aliases). Omit to get the 4 core fields (this catalog). */
  field?: string[];
  count?: number;
  start?: number;
};

export type UserResource = {
  search(query?: UserSearchQuery): Promise<UserPage>;
  /** Auto-paginating search: yields every matching user. */
  searchAll(
    query?: Omit<UserSearchQuery, "count" | "start">,
  ): AsyncIterable<User>;
  /**
   * The current API user (`request_type=0`). Under the library's default `code_direct` auth
   * this resolves to the App's own user (username = app name) — useful for self-identification.
   * Under the browser `code` grant it is the logged-in user. Resolves `undefined` if none.
   */
  current(): Promise<User | undefined>;
};

const buildUrl = (
  host: string,
  partition: number,
  q: UserSearchQuery,
): string => {
  const p = new URLSearchParams();
  p.set("partition", String(partition));
  p.set("request_type", String(q.requestType ?? 1));
  p.set("user_type", String(q.userType ?? -1));
  if (q.field && q.field.length > 0) p.set("field", q.field.join(","));
  if (q.count !== undefined) p.set("count", String(q.count));
  if (q.start !== undefined) p.set("start", String(q.start));
  return `https://${host}/v1/user?${p.toString()}`;
};

export const createUserResource = (deps: {
  requester: Requester;
  host: string;
  partition: number;
}): UserResource => {
  const decode = decoderFor(FIELDS);
  const search = (query: UserSearchQuery = {}): Promise<UserPage> =>
    runRead(deps.requester, buildUrl(deps.host, deps.partition, query), decode);
  const searchAll = (
    query: Omit<UserSearchQuery, "count" | "start"> = {},
  ): AsyncIterable<User> =>
    paginate((count, start) => search({ ...query, count, start }));
  // VERIFY(live): code_direct + request_type=0 returning the App's own user is doc-only.
  // See docs/live-verification.md (LV-7).
  const current = async (): Promise<User | undefined> =>
    (await search({ requestType: 0, count: 1 })).items[0];
  return { search, searchAll, current };
};
