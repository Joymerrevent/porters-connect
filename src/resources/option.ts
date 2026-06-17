// Option master accessor (read-only — ADR-0021/0022). Option Read returns a tenant's choice
// master as a recursive tree: each <Item> nests child <Item>s under <Items>. We flatten the
// tree depth-first into one array — every node present, parent linkage kept via `P_ParentId`
// and ordering via `P_Order` (ADR-0021 軸3, case 3a). It requires `partition` and takes
// `alias`/`level`/`enabled`/`count` — no `start` (no offset paging → no searchAll), no
// `field`/`condition`/`get(id)`.

import type { Requester } from "../http/requester";
import { parseResourcePage, type RawItem } from "../xml/parser";
import { asArray, asRecord } from "../xml/raw";
import { decoderFor, type FieldCatalog, type ReadRecord } from "./read-core";

const FIELDS = {
  P_Id: "System[Id]",
  P_Name: "SinglelineText",
  P_Alias: "SinglelineText",
  P_ParentId: "Number",
  P_Type: "Number",
  P_Order: "Number",
} as const satisfies FieldCatalog;

/** A decoded Option (one choice). `P_ParentId` links to the parent; `P_Type` 0 = normal, 1–11 = a phase kind. */
export type Option = ReadRecord<typeof FIELDS>;

/** Option Read query. `alias` selects a subtree root; `level` its depth (-1 all). */
export type OptionSearchQuery = {
  /** Root alias of the subtree to read (e.g. `Option.P_Gender`). Omit for all. */
  alias?: string;
  /** Depth: -1 all (default), 0 = siblings of `alias`, 1+ = descendants. */
  level?: number;
  /** -1 = all (default), 0 = unused only, 1 = in-use only. */
  enabled?: -1 | 0 | 1;
  count?: number;
};

export type OptionResource = {
  /** Read options, flattened depth-first (all nodes; tree is reconstructable via `P_ParentId`). */
  search(query?: OptionSearchQuery): Promise<Option[]>;
};

const buildUrl = (
  host: string,
  partition: number,
  q: OptionSearchQuery,
): string => {
  const p = new URLSearchParams();
  p.set("partition", String(partition));
  if (q.alias !== undefined) p.set("alias", q.alias);
  if (q.level !== undefined) p.set("level", String(q.level));
  if (q.enabled !== undefined) p.set("enabled", String(q.enabled));
  if (q.count !== undefined) p.set("count", String(q.count));
  return `https://${host}/v1/option?${p.toString()}`;
};

// Decode one node's own fields, dropping the nested `Items` collection (handled by the walk).
const withoutItems = (raw: RawItem): RawItem =>
  Object.fromEntries(Object.entries(raw).filter(([k]) => k !== "Items"));

export const createOptionResource = (deps: {
  requester: Requester;
  host: string;
  partition: number;
}): OptionResource => {
  const decode = decoderFor(FIELDS);
  // Depth-first flatten: push each node, then recurse into its <Items><Item>… children.
  const flatten = (items: RawItem[], out: Option[]): void => {
    for (const raw of items) {
      out.push(decode(withoutItems(raw)));
      const children = asArray(asRecord(raw.Items)?.Item).map(
        (it) => asRecord(it) ?? {},
      );
      flatten(children, out);
    }
  };
  const search = (query: OptionSearchQuery = {}): Promise<Option[]> =>
    deps.requester.request(
      {
        method: "GET",
        url: buildUrl(deps.host, deps.partition, query),
        headers: {},
      },
      (body) => {
        const out: Option[] = [];
        flatten(parseResourcePage(body).items, out);
        return out;
      },
    );
  return { search };
};
