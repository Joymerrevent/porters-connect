// Candidate accessor (ADR-0004/0005/0011). Read-only for the PoC: search / get.
// Standard `P_` fields decode via the catalog; the full static Candidate type is
// future work (SD-3). Write (create/update) lands in the next slice.

import type { Requester } from "../http/requester";
import { decodeField, type FieldType, type FieldValue } from "../xml/decode";
import { parseResourcePage } from "../xml/parser";

const FIELDS = new Map<string, FieldType>([
  ["P_Id", "Id"],
  ["P_Owner", "User"],
  ["P_RegistrationDate", "DateTime"],
  ["P_RegisteredBy", "User"],
  ["P_UpdateDate", "DateTime"],
  ["P_UpdatedBy", "User"],
  ["P_Phase", "Option"],
  ["P_PhaseDate", "DateTime"],
  ["P_Name", "Text"],
  ["P_Reading", "Text"],
  ["P_Mail", "Text"],
  ["P_MobileMail", "Text"],
  ["P_Telephone", "Text"],
  ["P_Mobile", "Text"],
  ["P_Country", "Text"],
  ["P_Prefecture", "Text"],
  ["P_City", "Text"],
  ["P_Zipcode", "Text"],
]);

/** A decoded Candidate. Known `P_` fields follow the catalog; custom `U_`/`A_`
 *  appear as decoded raw values. */
export type Candidate = Record<string, FieldValue>;

export type CandidatePage = {
  items: Candidate[];
  total: number;
  count: number;
  start: number;
};

export type CandidateSearchQuery = {
  field?: string[];
  condition?: Record<string, string>;
  count?: number;
  start?: number;
};

export type CandidateResource = {
  search(query?: CandidateSearchQuery): Promise<CandidatePage>;
  get(id: number): Promise<Candidate | undefined>;
};

// `includes(".")` -> `includes("")` is an equivalent mutant: for a dotless key,
// slice(indexOf(".") + 1) is slice(0), which equals the key — same as the else.
// Stryker disable StringLiteral
const bareAlias = (key: string): string =>
  key.includes(".") ? key.slice(key.indexOf(".") + 1) : key;
// Stryker restore StringLiteral

const decodeCandidate = (item: Record<string, unknown>): Candidate => {
  const out: Candidate = {};
  for (const [key, raw] of Object.entries(item)) {
    const alias = bareAlias(key);
    const type = FIELDS.get(alias);
    out[alias] = type
      ? decodeField(type, raw)
      : typeof raw === "string"
        ? raw
        : null;
  }
  return out;
};

const buildCandidateUrl = (
  host: string,
  partition: number,
  q: CandidateSearchQuery,
): string => {
  const p = new URLSearchParams();
  p.set("partition", String(partition));
  if (q.field && q.field.length > 0) p.set("field", q.field.join(","));
  if (q.condition) {
    const conds = Object.entries(q.condition).map(([k, v]) => `${k}=${v}`);
    if (conds.length > 0) p.set("condition", conds.join(","));
  }
  if (q.count !== undefined) p.set("count", String(q.count));
  if (q.start !== undefined) p.set("start", String(q.start));
  return `https://${host}/v1/candidate?${p.toString()}`;
};

export const createCandidateResource = (deps: {
  requester: Requester;
  host: string;
  partition: number;
}): CandidateResource => {
  const search = (query: CandidateSearchQuery = {}): Promise<CandidatePage> =>
    deps.requester.request(
      {
        method: "GET",
        url: buildCandidateUrl(deps.host, deps.partition, query),
        headers: {},
      },
      (body) => {
        const page = parseResourcePage(body);
        return {
          items: page.items.map(decodeCandidate),
          total: page.total,
          count: page.count,
          start: page.start,
        };
      },
    );

  const get = async (id: number): Promise<Candidate | undefined> => {
    const page = await search({
      condition: { "Person.P_Id:eq": String(id) },
      count: 1,
    });
    return page.items[0];
  };

  return { search, get };
};
