// The single URL builder (ADR-0047). Every request in the library is rendered here, so these
// cases pin the shape the API sees: scheme default, opt-in http, and query joining.

import { describe, expect, it } from "vitest";

import { apiUrl } from "./access-point";

describe("apiUrl (ADR-0047)", () => {
  it("defaults to https when no scheme is configured", () => {
    expect(apiUrl({ host: "example.test" }, "token")).toBe(
      "https://example.test/v1/token",
    );
  });

  it("uses http only when it is asked for, port and all", () => {
    expect(
      apiUrl({ host: "localhost:4010", scheme: "http" }, "candidate"),
    ).toBe("http://localhost:4010/v1/candidate");
    expect(apiUrl({ host: "gw.internal", scheme: "https" }, "candidate")).toBe(
      "https://gw.internal/v1/candidate",
    );
  });

  it("appends the query, and omits the `?` when there is none", () => {
    const params = new URLSearchParams({ partition: "12" });
    params.append("field", "Person.P_Id,Person.P_Name");

    expect(apiUrl({ host: "h.test" }, "candidate", params)).toBe(
      "https://h.test/v1/candidate?partition=12&field=Person.P_Id%2CPerson.P_Name",
    );
    // An empty parameter set is not "?" — the URL stays exactly as it would without one.
    expect(apiUrl({ host: "h.test" }, "candidate", new URLSearchParams())).toBe(
      "https://h.test/v1/candidate",
    );
  });
});
