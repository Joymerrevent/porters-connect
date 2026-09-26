// Parsing an Authentication API response (ADR-0011).

import { authError } from "../errors/auth-error";
import { PortersAuthError, PortersError } from "../errors/index";
import { asRecord } from "./as-record";
import { asString } from "./as-string";
import { parseXml, toInt } from "./parse-xml";

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
  const unparseable = (cause?: unknown): PortersError =>
    new PortersAuthError("unparseable authentication response", {
      category: "unknown",
      cause,
    });
  const root = asRecord(parseXml(xml, unparseable));
  const body = root ? asRecord(root.Authentication) : undefined;
  if (!body) {
    throw unparseable();
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
