// Department master accessor (read-only — ADR-0021/0022). Department Read lists the departments
// of a partition; PORTERS added it in Connect API 8.2.1 (2025/03) alongside the ユーザー部署型
// (Link) field type, and it is what a `DepartmentRef` points at. It takes `partition` and `field`
// only — no `request_type`, no `condition`/`get(id)` — and its scope is **`user_r`**: the source
// lists no `department_r`, so the User grant covers it. No Write API ("Department は read のみ").

import type { ResourceDeps } from "../accessor/deps";
import type { ResourceDescriptor } from "../accessor/descriptor";
import { createFieldParam } from "../accessor/field-param-setter";
import type {
  FieldCatalog,
  ReadFieldAlias,
  ReadRecord,
} from "../accessor/catalog";
import type { Paging } from "../accessor/paging";
import type { ResourcePage } from "../accessor/resource-page";
import { createMasterResource } from "../accessor/master-resource";

// docs/usage/reference resources/department.md（出典: Department - Field List）の全 6 項目。
// 先頭 2 つはユーザー部署型（Link）／`User.P_Department` の参照経由でも読める項目で、残る 4 つは
// reference が「Resource API での Read 時に、参照取得することはできません」と書く＝**この
// Department Read でだけ読める**（User の拡張 13 項目と同じ位置づけ）。カスタム項目は無い。
const FIELDS = {
  P_Id: "System[Id]",
  P_Name: "SinglelineText",
  // 0 / 1。PORTERS の画面で非表示にした部署。Read で除くかどうかは利用側。
  P_Hidden: "Number",
  P_SortNo: "Number",
  P_RegistrationDate: "System[DateTime]",
  P_UpdateDate: "System[DateTime]",
} as const satisfies FieldCatalog;

/**
 * Department's names + catalog. Exported for in-repo dev tooling — the fake server (ADR-0043)
 * builds Department Read responses from this very catalog, so the two cannot drift. The alias
 * prefix is the resource name itself (`Department.P_Id` — docs/usage/reference). Not re-exported
 * from `src/index.ts`, so it stays out of the published API.
 */
export const DEPARTMENT_DESCRIPTOR = {
  name: "Department",
  path: "department",
  prefix: "Department",
  fields: FIELDS,
} as const satisfies ResourceDescriptor;

/** A decoded Department (a PORTERS user department). `P_Hidden`: 0 = shown, 1 = hidden. */
export type Department = ReadRecord<typeof FIELDS>;
export type DepartmentPage = ResourcePage<typeof FIELDS>;

/** Department Read query. The API takes no filter: every department of the partition is listed. */
export type DepartmentSearchQuery = {
  // 裸 alias に接頭辞を足すのは ADR-0059、省略時に全項目を取るのは ADR-0020。
  /**
   * Output fields as **bare aliases** (`P_Name`); the library adds the `Department.` prefix.
   * **Omit** to fetch every catalogued field. Pass `[]` for PORTERS' own
   * default — `P_Id` alone, which is what a fieldless read returns.
   */
  field?: ReadFieldAlias<typeof FIELDS>[];
};

export type DepartmentResource = {
  search(query?: DepartmentSearchQuery & Paging): Promise<DepartmentPage>;
  /** Auto-paginating search: yields every department of the partition. */
  searchAll(query?: DepartmentSearchQuery): AsyncIterable<Department>;
};

// Sent when the caller omits `field` (ADR-0020). A fieldless Department Read answers with `P_Id`
// alone, so leaving `field` off would hand back a record whose type promises 6 fields and whose
// other 5 are silently `null` — the shape of RV-1.
//
// VERIFY(live): the source says `field` accepts the Field List's entries but only ever shows
// `P_Id,P_Name`; whether the 4 "参照取得できない" fields come back from a direct Department Read
// with all 6 listed at once is unconfirmed — docs/live-verification.md (LV-30). If one is
// rejected, drop it from this default rather than from the catalog: `field` can still name it.
const setField = createFieldParam(DEPARTMENT_DESCRIPTOR.prefix, FIELDS);

// The parameters Department Read takes; paging and sending are the shared `createMasterResource`.
const buildParams = (
  partition: number,
  q: DepartmentSearchQuery,
): URLSearchParams => {
  const p = new URLSearchParams();
  p.set("partition", String(partition));
  setField(p, q.field);
  return p;
};

export const createDepartmentResource = (
  deps: ResourceDeps,
): DepartmentResource =>
  createMasterResource(
    {
      ...DEPARTMENT_DESCRIPTOR,
      params: (q: DepartmentSearchQuery) => buildParams(deps.partition, q),
    },
    deps,
  );
