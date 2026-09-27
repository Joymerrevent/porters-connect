// Injectable HTTP seam types (ADR-0005 / R-12). Default is a fetch-based
// transport; a mock transport lets the library run without a contract.

/** A single HTTP request issued to the PORTERS API. */
export type TransportRequest = {
  method: "GET" | "POST";
  url: string;
  headers: Record<string, string>;
  body?: string;
};

/** The raw HTTP response. Body stays as text; XML parsing happens in `xml/`. */
export type TransportResponse = {
  status: number;
  body: string;
};

/** Sends a request and resolves the raw response. */
export type Transport = {
  send(request: TransportRequest): Promise<TransportResponse>;
};

// トークンを受け取る口の形は使う側（requester）が持つ。auth はこれを実装する（ADR-0097 案2a）。
/**
 * Internal: what the request pipeline asks for a token. `forceRefresh` is set after an
 * expired-token response (401/402), with the token that was refused as `failedToken`: when the
 * cache already holds a different one, another request renewed it meanwhile and it is reused.
 * Not part of the published API.
 */
export type AccessTokenSource = {
  getAccessToken(opts?: {
    forceRefresh?: boolean;
    failedToken?: string;
  }): Promise<string>;
};
