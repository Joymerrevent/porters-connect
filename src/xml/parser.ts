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
  isArray: (name) => name === "Item",
});

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
  const body = root && rootKey ? asRecord(root[rootKey]) : undefined;
  if (!body) {
    throw new PortersResourceError("unparseable resource response", {
      category: "unknown",
    });
  }

  const code = Number(asString(body.Code) ?? "0");
  if (code !== 0) {
    throw resourceError(code, `resource returned code ${code}`, {
      resource: rootKey,
    });
  }

  return {
    total: Number(asString(body["@_Total"]) ?? "0"),
    count: Number(asString(body["@_Count"]) ?? "0"),
    start: Number(asString(body["@_Start"]) ?? "0"),
    items: asArray(body.Item).map((it) => asRecord(it) ?? {}),
  };
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

  const error = Number(asString(body.Error) ?? "0");
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
