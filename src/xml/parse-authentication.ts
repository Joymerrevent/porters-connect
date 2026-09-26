// Parsing an Authentication API response (ADR-0011).

import { authError } from "../errors/auth-error";
import { PortersAuthError, PortersError } from "../errors/index";
import { asRecord } from "./as-record";
import { asString } from "./as-string";
import { parseXml, toCode } from "./parse-xml";

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

  // <Error> は必ず返る（reference の応答例）。欠けた・空の応答を 0（成功）と読まない（RV-90）。
  if ((asString(body.Error)?.trim() ?? "") === "") throw unparseable();
  const error = toCode(body.Error, unparseable);
  if (error !== 0) {
    throw authError(
      error,
      asString(body.Message) ?? `authentication error ${error}`,
    );
  }

  // 10 進の整数でない値（"30min" など）は欠けたのと同じ扱い＝期限 0 で取り直す側に倒す（RV-89）。
  // NaN のまま返すと期限の比較がいつも偽になり、期限切れと見なされずに使い続けられる。
  const num = (v: unknown): number | undefined => {
    const s = asString(v)?.trim();
    return s !== undefined && /^\d+$/.test(s) ? Number(s) : undefined;
  };
  return {
    code: asString(body.Code),
    accessToken: asString(body.AccessToken),
    accessTokenExpiresIn: num(body.AccessTokenExpiresIn),
    refreshToken: asString(body.RefreshToken),
    refreshTokenExpiresIn: num(body.RefreshTokenExpiresIn),
  };
};
