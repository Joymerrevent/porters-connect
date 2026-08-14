// XML parsing + error routing (ADR-0011). The parser returns raw strings
// (`parseTagValue: false`); all type coercion happens in `decode.ts`.

import { XMLParser } from "fast-xml-parser";

import { authError, resourceError } from "../errors/classify";
import { PortersAuthError, PortersResourceError } from "../errors/index";
import { asArray, asRecord, asString } from "./raw";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  ignoreDeclaration: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  // asArray() already normalizes a single/missing/repeated <Item> into an array,
  // so isArray is belt-and-suspenders: these mutants are equivalent (no test can
  // observe the difference once asArray() runs).
  // Stryker disable next-line ArrowFunction,ConditionalExpression,StringLiteral: equivalent — asArray() normalizes regardless
  isArray: (name) => name === "Item",
});

// fast-xml-parser yields raw strings; coerce an attribute/code node to an int,
// treating a missing node as 0. The explicit `undefined` check keeps the
// fallback observable — `Number("") === 0`, so a `?? "0"` default would be an
// equivalent mutant.
const toInt = (v: unknown): number => {
  const s = asString(v);
  return s === undefined ? 0 : Number(s);
};

/** One `<Item>`: a map of field alias -> raw node (string or nested object). */
export type RawItem = Record<string, unknown>;

export type ResourcePage = {
  total: number;
  count: number;
  start: number;
  items: RawItem[];
};

// 200 でも PORTERS が答えているとは限らない（ADR-0051）。中間装置を疑う先を示す。
const MIDDLEBOX_HINT =
  "A middlebox (proxy, captive portal, SSO login page, WAF notice) may be answering instead of PORTERS. " +
  "Check PORTERS_HOST and the network path from this process to the API.";

/**
 * Parse a Resource Read response.
 *
 * Identifies the envelope *before* reading it (ADR-0051): the root element must be the
 * `resource` we asked for, and it must carry a `<Code>` — the two facts every documented
 * Read response has. An HTTP 200 body that fails either is not PORTERS answering, and
 * returning it as an empty page would be indistinguishable from "no data" (RV-20).
 * Identity comes before value: until the response is known to be ours, its `<Code>` is not
 * ours either.
 *
 * Then reads `<Code>` and, if non-zero, throws the mapped PortersError (ADR-0006) —
 * HTTP 200 + `<Code>≠0` is an error, not data.
 */
export const parseResourcePage = (
  xml: string,
  resource: string,
): ResourcePage => {
  const root = asRecord(parser.parse(xml) as unknown);
  const rootKey = root ? Object.keys(root)[0] : undefined;
  // `root` is always a record here and `root[rootKey]` is undefined exactly when
  // rootKey is, so dropping/forcing either guard collapses to the same throw.
  // Stryker disable next-line ConditionalExpression,LogicalOperator: equivalent — both branches converge on the unparseable throw
  const body = root && rootKey ? asRecord(root[rootKey]) : undefined;
  if (!body) {
    throw new PortersResourceError("unparseable resource response", {
      category: "unknown",
    });
  }

  // 観測した名前をメッセージに載せる: 何が返ってきたかが分かれば利用者が切り分けられる。
  if (rootKey !== resource) {
    throw new PortersResourceError(
      `resource response root is <${rootKey}>, expected <${resource}>`,
      { category: "unknown", hint: MIDDLEBOX_HINT, context: { resource } },
    );
  }
  // 存在の検査であって値の検査ではない。`<Code/>` は "" として存在扱い（従来どおり 0＝成功）。
  if (body.Code === undefined) {
    throw new PortersResourceError(
      "resource response has no <Code> (not a PORTERS envelope)",
      { category: "unknown", hint: MIDDLEBOX_HINT, context: { resource } },
    );
  }

  const code = toInt(body.Code);
  if (code !== 0) {
    // `rootKey` は同定を通った時点で `resource` と等しい（引数の側を使う＝型も string で済む）。
    throw resourceError(code, `resource returned code ${code}`, { resource });
  }

  return {
    total: toInt(body["@_Total"]),
    count: toInt(body["@_Count"]),
    start: toInt(body["@_Start"]),
    items: asArray(body.Item).map((it) => asRecord(it) ?? {}),
  };
};

/** One written record's outcome: the assigned/updated `Id` and its Result `Code`. */
export type WriteResultItem = {
  id: number;
  code: number;
};

/**
 * Parse a Resource Write response. A *successful* one has no root `<Code>` nor
 * Total/Count/Start: each `<Item>` carries its own `<Id>` (assigned on create /
 * echoed on update) and `<Code>` (per-item Result Code). Applying the per-item
 * code policy (throw on `!= 0`) is the accessor's job, since a bulk write mixes
 * successes and failures — see write-format.md. A request rejected as a *whole*
 * answers with a root `<Code>` instead, which is read first and thrown (ADR-0045).
 */
export const parseWriteResult = (xml: string): WriteResultItem[] => {
  const root = asRecord(parser.parse(xml) as unknown);
  const rootKey = root ? Object.keys(root)[0] : undefined;
  // Same equivalence as parseResourcePage: both guards converge on the throw.
  // Stryker disable next-line ConditionalExpression,LogicalOperator: equivalent — both branches converge on the unparseable throw
  const body = root && rootKey ? asRecord(root[rootKey]) : undefined;
  if (!body) {
    throw new PortersResourceError("unparseable write response", {
      category: "unknown",
    });
  }

  // A request-level failure (too many records, malformed XML, no permission) leaves no `<Item>` to
  // carry the reason, so the Result Code sits at the root — the same place Read puts it. Reading it
  // here is what keeps it from being lost: a single write would otherwise report "no result item"
  // and a bulk write a result-count mismatch, both `unknown` (ADR-0045 / RV-14). A successful
  // response has no root `<Code>`, so `toInt` reads 0 and the success path is untouched.
  // VERIFY(live): that failures answer this way is an assumption — the reference documents only the
  // success shape. See docs/live-verification.md (LV-11).
  const code = toInt(body.Code);
  if (code !== 0) {
    throw resourceError(code, `write returned code ${code}`, {
      resource: rootKey,
      operation: "write",
    });
  }

  return asArray(body.Item).map((it) => {
    const item = asRecord(it) ?? {};
    return { id: toInt(item.Id), code: toInt(item.Code) };
  });
};

/** Parsed `<Authentication>` response (OAuth `code_direct` / Token). */
export type AuthResponse = {
  code?: string;
  accessToken?: string;
  accessTokenExpiresIn?: number;
  refreshToken?: string;
  refreshTokenExpiresIn?: number;
};

/**
 * Parse an `<Authentication>` response. Reads `<Error>` first and, if non-zero,
 * throws the mapped PortersAuthError (ADR-0006).
 */
export const parseAuthentication = (xml: string): AuthResponse => {
  const root = asRecord(parser.parse(xml) as unknown);
  const body = root ? asRecord(root.Authentication) : undefined;
  if (!body) {
    throw new PortersAuthError("unparseable authentication response", {
      category: "unknown",
    });
  }

  const error = toInt(body.Error);
  if (error !== 0) {
    throw authError(
      error,
      asString(body.Message) ?? `authentication error ${error}`,
    );
  }

  const num = (v: unknown): number | undefined => {
    const s = asString(v);
    return s === undefined ? undefined : Number(s);
  };
  return {
    code: asString(body.Code),
    accessToken: asString(body.AccessToken),
    accessTokenExpiresIn: num(body.AccessTokenExpiresIn),
    refreshToken: asString(body.RefreshToken),
    refreshTokenExpiresIn: num(body.RefreshTokenExpiresIn),
  };
};
