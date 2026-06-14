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
