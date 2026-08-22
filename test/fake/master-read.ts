// The master reads (ADR-0021/0022): Partition / User / Field / Option. Each takes its *own*
// query vocabulary — no `condition`, no `get(id)`, and only User accepts `field` — so they do not
// go through `query.ts`; each handler below reads exactly the parameters the reference documents.
//
// Where the data comes from:
//   Partition  the `partitions` option (the ids this fake accepts)
//   User       the User master — the same registry that expands `User`-typed fields
//   Field      the resource descriptors, i.e. the library's own catalogs, turned into Field rows
//   Option     the seeded Option tree, or the aliases writes have used so far
//
// `request_type` semantics are OAuth-method dependent (ADR-0022 fact 4): the fake authenticates
// like `code_direct`, so Partition `request_type=0` (login partition) answers Result Code 403 and
// User `request_type=0` answers the App's own user.

import { FIELD_DESCRIPTOR, RESOURCE_VALUE } from "../../src/resources/field";
import { OPTION_DESCRIPTOR } from "../../src/resources/option";
import { PARTITION_DESCRIPTOR } from "../../src/resources/partition";
import type { ResourceDescriptor } from "../../src/resources/resource";
import { USER_DESCRIPTOR } from "../../src/resources/user";
import type { TransportResponse } from "../../src/http/types";
import type { DataType } from "../../src/xml/decode";
import type { FakeMasters } from "./masters";
import {
  buildItemXml,
  buildReadPageXml,
  buildResourceErrorXml,
  type FieldSelection,
  type ItemShape,
} from "./wire";
import type { FakeOptionNode, FakeRecord } from "./types";

/** What the master handlers read from the fake's state. */
export type MasterContext = {
  masters: FakeMasters;
  /** Partition ids this fake serves. */
  partitions: number[];
  /** The App's own user — what `request_type=0` resolves to under `code_direct`. */
  currentUserId: number;
  optionTree: FakeOptionNode[];
  /** Data resources, for Field Read (`resource=` selects one). */
  resources: ReadonlyMap<string, ResourceDescriptor>;
};

export type MasterReadHandler = (
  url: URL,
  ctx: MasterContext,
) => TransportResponse;

// Data permission error — what `code_direct` gets for the login-partition read (ADR-0022 fact 4).
const CODE_NO_DATA_PERMISSION = 403;

// Data Type -> Field Type Value (docs/reference field-data-types.md). The Option subtypes
// (5 Checkbox / 6 Radio / 7 Dropdown) all decode alike, so the fake reports Dropdown; the System
// family other than System[Id] has no published Value, so it reports System (11).
// VERIFY(live): the Value a real Field Read returns for System[DateTime] / System[Reference] is
// unconfirmed — see docs/live-verification.md (LV-12).
const FIELD_TYPE_VALUE: Record<DataType, number> = {
  SinglelineText: 1,
  MultilineText: 2,
  Number: 3,
  Date: 4,
  Option: 7,
  Age: 8,
  URL: 9,
  Mail: 10,
  "System[Id]": 11,
  "System[DateTime]": 11,
  "System[Reference]": 11,
  DateTime: 12,
  Telephone: 15,
  User: 17,
};

const intParam = (url: URL, key: string, fallback: number): number => {
  const raw = url.searchParams.get(key);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const selectionOf = (
  fields: Readonly<Record<string, DataType | null>>,
): FieldSelection[] => Object.keys(fields).map((alias) => ({ alias, sub: [] }));

const page = (
  descriptor: ResourceDescriptor,
  ctx: MasterContext,
  records: FakeRecord[],
  url: URL,
  optionShape?: ItemShape["optionShape"],
): TransportResponse => {
  const start = intParam(url, "start", 0);
  const count = intParam(url, "count", 200);
  const window = records.slice(start, start + count);
  return {
    status: 200,
    body: buildReadPageXml({
      resource: descriptor.name,
      shape: {
        prefix: descriptor.prefix,
        fields: descriptor.fields,
        masters: ctx.masters,
        optionShape,
      },
      records: window,
      selection: selectionOf(descriptor.fields),
      total: records.length,
      start,
    }),
  };
};

/** `GET /v1/partition?request_type=` — takes no `partition` (it is how you discover them). */
export const readPartition: MasterReadHandler = (url, ctx) => {
  if (intParam(url, "request_type", 1) === 0) {
    // The login partition is reachable only under the browser `code` grant; the fake authenticates
    // like `code_direct`, so it answers the same 403 a real App would get (ADR-0022 fact 4).
    return {
      status: 200,
      body: buildResourceErrorXml(
        PARTITION_DESCRIPTOR.name,
        CODE_NO_DATA_PERMISSION,
        "the login partition needs the browser `code` grant",
      ),
    };
  }
  const records = ctx.partitions.map((id) => ({
    P_Id: String(id),
    P_Name: `Fake Partition ${id}`,
    P_CompanyId: `fake-company-${id}`,
  }));
  return page(PARTITION_DESCRIPTOR, ctx, records, url);
};

/** `GET /v1/user?partition=&request_type=&user_type=&field=` — the operator master. */
export const readUser: MasterReadHandler = (url, ctx) => {
  const requestType = intParam(url, "request_type", 1);
  const userType = intParam(url, "user_type", -1);
  const entries = ctx.masters.userList();
  const current = ctx.masters.user(String(ctx.currentUserId));
  // request_type=0 under code_direct = the App's own user (self-identification).
  const pool = requestType === 0 ? [current] : entries;
  const records = pool
    // user_type: -1 any, 0 system admins (P_Type=1), 1 standard users (P_Type=0).
    .filter(
      (u) =>
        userType === -1 ||
        (userType === 0 && u.P_Type === "1") ||
        (userType === 1 && u.P_Type === "0"),
    )
    .map((u) => ({ ...u }));
  return page(USER_DESCRIPTOR, ctx, records, url);
};

/** `GET /v1/field?partition=&resource=&active=` — a resource's catalog, as Field rows. */
export const readField: MasterReadHandler = (url, ctx) => {
  const value = intParam(url, "resource", -1);
  const path = Object.entries(RESOURCE_VALUE).find(
    ([, code]) => code === value,
  )?.[0];
  const descriptor = path === undefined ? undefined : ctx.resources.get(path);
  if (descriptor === undefined) {
    // An unknown/unsupported resource selector is a parameter error, not an empty catalog.
    return {
      status: 200,
      body: buildResourceErrorXml(
        FIELD_DESCRIPTOR.name,
        100,
        `unsupported resource selector: ${value}`,
      ),
    };
  }
  const records = Object.entries(descriptor.fields)
    // A Field row carries a Field Type value. A field PORTERS assigns no Data Type (`ー` -> `null`,
    // ADR-0056) has no Field Type either — the reference's `P_Deleted` row is `ー` in both columns —
    // so it gets no row here. Inventing a Value for it would be exactly the fabrication ADR-0056 refuses.
    .filter((entry): entry is [string, DataType] => entry[1] !== null)
    .map(([alias, type], index) => ({
      P_Id: String(index + 1),
      P_Name: alias,
      // The alias as it travels on the wire, i.e. what you would put in `field=`.
      // VERIFY(live): prefixed vs bare in a real Field Read is unconfirmed — see LV-12.
      P_Alias: `${descriptor.prefix}.${alias}`,
      P_Type: String(FIELD_TYPE_VALUE[type]),
      P_Required: "0",
      P_ResourceType: String(value),
      // Option-typed fields point at their option group; the fake names the field's own alias.
      ...(type === "Option" ? { P_ReferTo: [`Option.${alias}`] } : {}),
    }));
  // `P_ReferTo` nests without an `<OptionRoot>` wrapper here (ADR-0022 fact 6).
  return page(FIELD_DESCRIPTOR, ctx, records, url, "bare");
};

// One Option node -> its record, plus its children as a nested `<Items>` collection.
const optionItemXml = (
  node: FakeOptionNode,
  parentId: string,
  order: number,
  shape: ItemShape,
  ctx: MasterContext,
): string => {
  const entry = ctx.masters.option(node.alias);
  const record: FakeRecord = {
    P_Id: entry.id,
    P_Name: node.name ?? entry.name,
    P_Alias: node.alias,
    P_ParentId: parentId,
    P_Type: String(node.type ?? 0),
    P_Order: String(order),
  };
  const children = (node.children ?? [])
    .map((child, index) =>
      optionItemXml(child, entry.id, index + 1, shape, ctx),
    )
    .join("");
  const nested = children === "" ? "" : `<Items>${children}</Items>`;
  return buildItemXml(
    shape,
    record,
    Object.keys(OPTION_DESCRIPTOR.fields).map((alias) => ({ alias, sub: [] })),
    nested,
  );
};

// Depth-first search for the subtree an `alias=` names.
const findNode = (
  nodes: FakeOptionNode[],
  alias: string,
): FakeOptionNode | undefined => {
  for (const node of nodes) {
    if (node.alias === alias) return node;
    const hit = findNode(node.children ?? [], alias);
    if (hit) return hit;
  }
  return undefined;
};

// `level` limits the depth: -1 all, 0 the named node alone, 1+ that many generations below it.
const prune = (node: FakeOptionNode, level: number): FakeOptionNode =>
  level < 0
    ? node
    : {
        ...node,
        children:
          level === 0
            ? []
            : (node.children ?? []).map((child) => prune(child, level - 1)),
      };

/** `GET /v1/option?partition=&alias=&level=&enabled=&count=` — the recursive choice master. */
export const readOption: MasterReadHandler = (url, ctx) => {
  const alias = url.searchParams.get("alias");
  const level = intParam(url, "level", -1);
  const count = intParam(url, "count", 200);
  // Nothing seeded? Serve the aliases writes have used, as flat roots — a read after a write
  // then still shows the choice that was stored (auto-registering, like the other masters).
  const tree =
    ctx.optionTree.length > 0
      ? ctx.optionTree
      : ctx.masters.optionAliases().map((a) => ({ alias: a }));
  const subtree = alias === null ? undefined : findNode(tree, alias);
  const roots = alias === null ? tree : subtree ? [subtree] : [];
  const shape: ItemShape = {
    prefix: OPTION_DESCRIPTOR.prefix,
    fields: OPTION_DESCRIPTOR.fields,
    masters: ctx.masters,
  };
  const items = roots
    .slice(0, count)
    .map((node, index) =>
      optionItemXml(prune(node, level), "0", index + 1, shape, ctx),
    )
    .join("");
  // Option's envelope carries `<Code>` and the recursive `<Items>` — no Total/Count/Start
  // (ADR-0022 fact 5).
  return {
    status: 200,
    body: buildReadPageXml({
      resource: OPTION_DESCRIPTOR.name,
      shape,
      items,
      paging: false,
    }),
  };
};
