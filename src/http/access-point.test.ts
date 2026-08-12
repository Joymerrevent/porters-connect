// The single URL builder (ADR-0047). Every request in the library is rendered here, so these
// cases pin the shape the API sees: scheme default, opt-in http, and query joining.
// The validator (ADR-0048) is pinned alongside it: what `apiUrl` is allowed to be handed.

import { describe, expect, it } from "vitest";

import { PortersConfigError } from "../errors/index";
import { apiUrl, validateAccessPoint } from "./access-point";
import type { Scheme } from "../types/index";

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

describe("validateAccessPoint (ADR-0048 / ADR-0049)", () => {
  it("accepts what a working configuration already looks like", () => {
    // The guarantee that matters: nothing that works today has to change by one character.
    for (const host of [
      "xxxxx.example.com",
      "a.test:8080",
      "127.0.0.1:4010",
      "localhost:4010",
      "[::1]:4010",
      "XXXXX.EXAMPLE.COM", // upper case is valid; the probe scheme leaves it alone (ADR-0049)
      "xn--eckwd4c7c.test", // a non-ASCII host, written the way it has to be written
      // Redundant but legal: a port equal to the scheme's default. Parsing with `https://` used to
      // drop these and reject them (RV-21) — the probe scheme has no default port (ADR-0049).
      "a.test:443",
      "a.test:80",
    ]) {
      expect(() => validateAccessPoint({ host }), host).not.toThrow();
    }
    expect(() =>
      validateAccessPoint({ host: "a.test", scheme: "http" }),
    ).not.toThrow();
    expect(() =>
      validateAccessPoint({ host: "a.test", scheme: "https" }),
    ).not.toThrow();
    // The verdict does not depend on which scheme the request will use.
    expect(() =>
      validateAccessPoint({ host: "localhost:443", scheme: "http" }),
    ).not.toThrow();
  });

  it.each([
    { host: "https://a.test", why: "a scheme (the PORTERS_HOST mix-up)" },
    { host: "http://a.test", why: "a scheme, the other one" },
    { host: "", why: "empty — an unset env pushed through with `!`" },
    { host: "a.test/", why: "a trailing slash" },
    { host: "a.test/gw", why: "a path prefix (out of scope — ADR-0047)" },
    { host: "user@a.test", why: "userinfo" },
    { host: "a test", why: "whitespace" },
    { host: "//a.test", why: "a protocol-relative prefix" },
    { host: "a.test?partition=1", why: "a query string" },
    { host: "a.test#frag", why: "a fragment" },
    { host: "a.test\\gw", why: "a backslash separator" },
    { host: "日本語.test", why: "non-ASCII (punycode is required)" },
    { host: "a.test:", why: "a colon with no port" },
    { host: "a.test:abc", why: "a non-numeric port" },
  ])("rejects $host — $why", ({ host }) => {
    let err: unknown;
    try {
      validateAccessPoint({ host });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersConfigError);
    expect((err as PortersConfigError).category).toBe("config");
    // The value is echoed back so the reader sees what was actually configured...
    expect((err as PortersConfigError).message).toContain(JSON.stringify(host));
    // ...and the hint says how to fix it, including the one known limit that remains.
    expect((err as PortersConfigError).hint).toContain("host name only");
    expect((err as PortersConfigError).hint).toContain("punycode");
    // The default-port caveat is gone with ADR-0049 — the hint must not resurrect it.
    expect((err as PortersConfigError).hint).not.toContain("443");
  });

  it("rejects a scheme the type forbids but JS can still pass", () => {
    let err: unknown;
    try {
      // What an untyped caller (or an `as` cast) can hand over: without this it would quietly
      // assemble `ftp://a.test/v1/...`.
      validateAccessPoint({ host: "a.test", scheme: "ftp" as Scheme });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersConfigError);
    expect((err as PortersConfigError).message).toContain("ftp");
    expect((err as PortersConfigError).hint).toContain("https");
  });
});
