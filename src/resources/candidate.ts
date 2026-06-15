// Candidate accessor (ADR-0004/0005/0011). Read (search / get) + Write
// (create / update). Standard `P_` fields use the catalog; custom `U_`/`A_`
// pass through (decode: raw string / encode: Text). The full static Candidate
// type — distinct Read vs Write shapes — is future work (SD-3).

import { PortersResourceError, resourceError } from "../errors";
import type { Requester } from "../http/requester";
import { decodeField, type FieldType, type FieldValue } from "../xml/decode";
import { buildWriteXml, type WriteItem } from "../xml/encode";
import { parseResourcePage, parseWriteResult } from "../xml/parser";

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

/**
 * Fields to write, keyed by bare alias (e.g. `P_Name`). `P_Id` is supplied by
 * `create` / `update` — don't set it. User / Reference fields take an ID
 * (number); Option fields take an alias (or aliases). `null` omits a field.
 * (A precise static Write type is future work — SD-3.)
 */
export type CandidateInput = WriteItem;

export type CandidateResource = {
  search(query?: CandidateSearchQuery): Promise<CandidatePage>;
  get(id: number): Promise<Candidate | undefined>;
  /** Create one Candidate; resolves to the newly assigned id. */
  create(input: CandidateInput): Promise<number>;
  /** Update one Candidate by id; resolves to that id. */
  update(id: number, input: CandidateInput): Promise<number>;
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

const buildWriteUrl = (host: string, partition: number): string =>
  `https://${host}/v1/candidate?partition=${partition}`;

// A single-Item Write -> the assigned/updated id. A non-zero per-item Code is a
// resource error (mapped, not swallowed); a missing result Item is unparseable.
const firstWriteId = (body: string): number => {
  const first = parseWriteResult(body)[0];
  if (first === undefined) {
    throw new PortersResourceError("write returned no result item", {
      category: "unknown",
    });
  }
  if (first.code !== 0) {
    throw resourceError(
      first.code,
      `candidate write returned code ${first.code}`,
      {
        resource: "Candidate",
      },
    );
  }
  return first.id;
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

  // create forces P_Id=-1 (non-idempotent: a retry would duplicate); update forces
  // the target id (idempotent: re-applying the same write is safe). Forcing P_Id
  // after the spread means a caller-supplied P_Id never overrides it.
  const write = (item: WriteItem, idempotent: boolean): Promise<number> =>
    deps.requester.request(
      {
        method: "POST",
        url: buildWriteUrl(deps.host, deps.partition),
        headers: {},
        body: buildWriteXml({
          resource: "Candidate",
          prefix: "Person",
          fields: FIELDS,
          items: [item],
        }),
      },
      firstWriteId,
      { write: true, idempotent },
    );

  const create = (input: CandidateInput): Promise<number> =>
    write({ ...input, P_Id: -1 }, false);

  const update = (id: number, input: CandidateInput): Promise<number> =>
    write({ ...input, P_Id: id }, true);

  return { search, get, create, update };
};
