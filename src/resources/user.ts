// User master accessor (read-only — ADR-0021/0022). User Read requires `partition` and
// `request_type` (1 = all users; 0 = the current user — under code_direct this is the App's
// own user, i.e. self-identification). No `condition`/`get(id)`: the API has no id filter.
//
// The catalog carries **every field the reference lists** (ADR-0060 D2). PORTERS answers a
// fieldless User Read with 4 core fields, but `field` may name any of them since Connect API
// 3.12.31, so the library sends the catalog default like every other resource (ADR-0020) —
// otherwise the typed record would promise 17 fields and quietly deliver 4 (RV-1).

import type { ResourceDeps, ResourceDescriptor } from "./resource";
import {
  decoderFor,
  paginateOnce,
  qualifyReadFields,
  readUrlOf,
  runRead,
  type FieldCatalog,
  type ReadFieldAlias,
  type ReadRecord,
  type ResourcePage,
} from "./read-core";
import type { DataType } from "../xml/decode";

// docs/reference resources/user.md（出典: User - Field List / Timezone List）の全 17 項目。
// 先頭 4 つは PORTERS が field 省略時に返すもので、**参照先として読める唯一の 4 つ**でもある
// （`Job.P_Owner(User.…)` の展開 — read-core の `USER_SUBFIELDS`）。以降の 13 項目は
// reference が「Resource API での Read 時に、参照取得することはできません」と明記する項目で、
// **この User Read でだけ読める**。両者はカタログ上は同列で、違いは要求のしかたに現れる。
const FIELDS = {
  P_Id: "System[Id]",
  P_Type: "Number",
  P_Name: "SinglelineText",
  P_Mail: "Mail",
  // 部署は User と同じ入れ子で返る（`<Department><Department.P_Id>…` — ADR-0061 案3a）。
  P_Department: "System[Department]",
  P_Telephone: "Telephone",
  P_Mobile: "Telephone",
  P_MobileMail: "Mail",
  P_UserName: "SinglelineText",
  // タイムゾーン名（`Asia/Tokyo` 等）。PORTERS は Timezone List の名前をそのまま返す。
  P_TimeZone: "SinglelineText",
  P_Language: "SinglelineText",
  P_StartDate: "Date",
  P_EndDate: "Date",
  P_RegistrationDate: "System[DateTime]",
  // 登録者・更新者は `User` 型＝汎用の組み立てが `(User.P_Id,…)` を付けて要求する。
  // VERIFY(live): User Read で User 型の項目を `()` 付きで要求できるかは未確認（LV-17 と同型）。
  P_RegisteredBy: "User",
  P_UpdateDate: "System[DateTime]",
  P_UpdatedBy: "User",
} as const satisfies FieldCatalog;

/**
 * User's names + catalog. Exported for in-repo dev tooling — the fake server (ADR-0043)
 * builds User Read responses from this very catalog, so the two cannot drift. The alias
 * prefix is the resource name itself (`User.P_Id` — docs/reference). Not re-exported from
 * `src/index.ts`, so it stays out of the published API.
 */
export const USER_DESCRIPTOR = {
  name: "User",
  path: "user",
  prefix: "User",
  fields: FIELDS,
} as const satisfies ResourceDescriptor;

/** A decoded User (PORTERS operator). `P_Type`: 0 = standard user, 1 = system admin. */
export type User = ReadRecord<typeof FIELDS>;
export type UserPage = ResourcePage<typeof FIELDS>;

/** User Read query. `requestType` 1 = all users (default); `userType` -1 = any (default). */
export type UserSearchQuery = {
  /** 1 = all users (default). 0 = the current user (code_direct → the App's own user). */
  requestType?: 0 | 1;
  /** -1 = any (default), 0 = system admins, 1 = standard users. */
  userType?: -1 | 0 | 1;
  /**
   * Output fields as **bare aliases** (`P_Name`); the library adds the `User.` prefix (ADR-0059).
   * **Omit** to fetch every catalogued field (ADR-0020); narrow it when the extra HR fields
   * (department / telephone / dates) are not interesting. Pass `[]` for PORTERS' own default —
   * the 4 core fields it returns for a fieldless read.
   */
  field?: ReadFieldAlias<typeof FIELDS>[];
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

// The catalog as a runtime lookup, for prefixing the caller's bare `field` aliases (ADR-0059).
const FIELD_MAP = new Map<string, DataType | null>(Object.entries(FIELDS));

// Sent when the caller omits `field` (ADR-0020, applied to this master by ADR-0060 D2). PORTERS
// answers a fieldless User Read with 4 of the 17 fields, so leaving `field` off would hand back a
// record whose type promises 17 and whose other 13 are silently `null` — the shape of RV-1.
// `field: []` still opts into the API-native answer (those 4), like `[]` does elsewhere.
const DEFAULT_FIELDS = Object.keys(FIELDS) as ReadFieldAlias<typeof FIELDS>[];

// Paging is left out on purpose — see `field.ts` / RV-32.
const buildParams = (
  partition: number,
  q: Omit<UserSearchQuery, "count" | "start">,
): URLSearchParams => {
  const p = new URLSearchParams();
  p.set("partition", String(partition));
  p.set("request_type", String(q.requestType ?? 1));
  p.set("user_type", String(q.userType ?? -1));
  const field = q.field ?? DEFAULT_FIELDS;
  if (field.length > 0) {
    p.set(
      "field",
      qualifyReadFields(USER_DESCRIPTOR.prefix, FIELD_MAP, field).join(","),
    );
  }
  return p;
};

export const createUserResource = (deps: ResourceDeps): UserResource => {
  const decode = decoderFor(FIELDS);
  // `async` for the exception contract (ADR-0046).
  const readUrl = (q: UserSearchQuery): string =>
    readUrlOf(
      deps.accessPoint,
      "user",
      buildParams(deps.partition, q),
      q.count,
      q.start,
    );
  const search = async (query: UserSearchQuery = {}): Promise<UserPage> =>
    runRead(deps.requester, USER_DESCRIPTOR.name, readUrl(query), decode);
  // The query is read once, at the first page (RV-32).
  const searchAll = (
    query: Omit<UserSearchQuery, "count" | "start"> = {},
  ): AsyncIterable<User> =>
    paginateOnce(() => {
      const base = buildParams(deps.partition, query);
      return (count, start) =>
        runRead(
          deps.requester,
          USER_DESCRIPTOR.name,
          readUrlOf(deps.accessPoint, "user", base, count, start),
          decode,
        );
    });
  // VERIFY(live): code_direct + request_type=0 returning the App's own user is doc-only.
  // See docs/live-verification.md (LV-7).
  const current = async (): Promise<User | undefined> =>
    (await search({ requestType: 0, count: 1 })).items[0];
  return { search, searchAll, current };
};
