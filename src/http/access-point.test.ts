// The single URL builder (ADR-0047). Every request in the library is rendered here, so these
// cases pin the shape the API sees: scheme default, opt-in http, and query joining.
// The validator (ADR-0048) is pinned alongside it: what `apiUrl` is allowed to be handed.

import { describe, expect, it } from "vitest";

import { PortersConfigError } from "../errors/index";
import { apiUrl, validateAccessPoint } from "./access-point";
import type { Scheme } from "../types/index";

describe("apiUrl (ADR-0047)", () => {
  it("defaults to https when no scheme is configured", () => {
    expect(apiUrl({ hostname: "example.test" }, "token")).toBe(
      "https://example.test/v1/token",
    );
  });

  it("uses http only when it is asked for, port and all", () => {
    expect(
      apiUrl(
        { hostname: "localhost", port: 4010, scheme: "http" },
        "candidate",
      ),
    ).toBe("http://localhost:4010/v1/candidate");
    expect(
      apiUrl({ hostname: "gw.internal", scheme: "https" }, "candidate"),
    ).toBe("https://gw.internal/v1/candidate");
  });

  it("appends the query, and omits the `?` when there is none", () => {
    const params = new URLSearchParams({ partition: "12" });
    params.append("field", "Person.P_Id,Person.P_Name");

    expect(apiUrl({ hostname: "h.test" }, "candidate", params)).toBe(
      "https://h.test/v1/candidate?partition=12&field=Person.P_Id%2CPerson.P_Name",
    );
    // An empty parameter set is not "?" — the URL stays exactly as it would without one.
    expect(
      apiUrl({ hostname: "h.test" }, "candidate", new URLSearchParams()),
    ).toBe("https://h.test/v1/candidate");
  });
});

describe("validateAccessPoint (ADR-0048 / ADR-0078)", () => {
  it("accepts a bare server name — with or without a port alongside it", () => {
    for (const hostname of [
      "xxxxx.example.com",
      "127.0.0.1",
      "localhost",
      "[::1]", // IPv6 は角括弧付きで渡す（裸のコロンは弾かれる）
      "XXXXX.EXAMPLE.COM", // 大文字は valid。probe scheme は case を変えない
      "xn--eckwd4c7c.test", // 非 ASCII は punycode で
    ]) {
      expect(() => validateAccessPoint({ hostname }), hostname).not.toThrow();
    }
    expect(() =>
      validateAccessPoint({ hostname: "a.test", scheme: "http" }),
    ).not.toThrow();
    expect(() =>
      validateAccessPoint({ hostname: "a.test", scheme: "https" }),
    ).not.toThrow();
    // ポートは別項目。scheme の既定ポートと同じ値でも通る（冗長なだけで誤りではない）。
    for (const port of [1, 80, 443, 4010, 65535]) {
      expect(
        () => validateAccessPoint({ hostname: "a.test", port }),
        `port=${port}`,
      ).not.toThrow();
    }
  });

  // ADR-0078 の芯: ポートが `hostname` に紛れ込んだら**黙って落とさず**弾く。
  // 素通しすると、呼び出し側は指定したつもりで既定ポートへ送られる。
  it.each(["a.test:4010", "a.test:443", "127.0.0.1:4010", "[::1]:4010"])(
    "rejects %s — ポートは `port` で渡す",
    (hostname) => {
      let err: unknown;
      try {
        validateAccessPoint({ hostname });
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(PortersConfigError);
      expect((err as PortersConfigError).hint).toContain("`port`");
    },
  );

  it.each([0, -1, 65536, 1.5, Number.NaN])(
    "rejects port=%s（1〜65535 の整数だけ）",
    (port) => {
      let err: unknown;
      try {
        validateAccessPoint({ hostname: "a.test", port });
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(PortersConfigError);
      expect((err as PortersConfigError).category).toBe("config");
      expect((err as PortersConfigError).message).toContain("port");
      expect((err as PortersConfigError).hint).toContain("65535");
    },
  );

  it.each([
    { hostname: "https://a.test", why: "a scheme (the PORTERS_HOST mix-up)" },
    { hostname: "http://a.test", why: "a scheme, the other one" },
    { hostname: "", why: "empty — an unset env pushed through with `!`" },
    { hostname: "a.test/", why: "a trailing slash" },
    { hostname: "a.test/gw", why: "a path prefix (out of scope — ADR-0047)" },
    { hostname: "user@a.test", why: "userinfo" },
    { hostname: "a test", why: "whitespace" },
    { hostname: "//a.test", why: "a protocol-relative prefix" },
    { hostname: "a.test?partition=1", why: "a query string" },
    { hostname: "a.test#frag", why: "a fragment" },
    { hostname: "a.test\\gw", why: "a backslash separator" },
    { hostname: "日本語.test", why: "non-ASCII (punycode is required)" },
    { hostname: "a.test:", why: "a colon with no port" },
    { hostname: "a.test:abc", why: "a non-numeric port" },
    { hostname: "::1", why: "a bare IPv6 address (brackets are required)" },
  ])("rejects $hostname — $why", ({ hostname }) => {
    let err: unknown;
    try {
      validateAccessPoint({ hostname });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersConfigError);
    expect((err as PortersConfigError).category).toBe("config");
    // The value is echoed back so the reader sees what was actually configured...
    expect((err as PortersConfigError).message).toContain(
      JSON.stringify(hostname),
    );
    // ...and the hint says how to fix it, including the two known limits that remain.
    expect((err as PortersConfigError).hint).toContain("server name only");
    expect((err as PortersConfigError).hint).toContain("punycode");
    expect((err as PortersConfigError).hint).toContain("[::1]");
  });

  it("rejects a scheme the type forbids but JS can still pass", () => {
    let err: unknown;
    try {
      // What an untyped caller (or an `as` cast) can hand over: without this it would quietly
      // assemble `ftp://a.test/v1/...`.
      validateAccessPoint({ hostname: "a.test", scheme: "ftp" as Scheme });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersConfigError);
    expect((err as PortersConfigError).message).toContain("ftp");
    expect((err as PortersConfigError).hint).toContain("https");
  });
});
