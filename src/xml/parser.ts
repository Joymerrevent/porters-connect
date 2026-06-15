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

/**
 * Parse a Resource Read response. Reads `<Code>` first and, if non-zero, throws
 * the mapped PortersError (ADR-0006) — HTTP 200 + `<Code>≠0` is an error, not
 * data.
 */
export const parseResourcePage = (xml: string): ResourcePage => {
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

  const code = toInt(body.Code);
  if (code !== 0) {
    throw resourceError(code, `resource returned code ${code}`, {
      resource: rootKey,
    });
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
 * Parse a Resource Write response. Unlike Read there is no root `<Code>` nor
 * Total/Count/Start: each `<Item>` carries its own `<Id>` (assigned on create /
 * echoed on update) and `<Code>` (per-item Result Code). Applying the per-item
 * code policy (throw on `!= 0`) is the accessor's job, since a bulk write mixes
 * successes and failures — see write-format.md.
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
