// The access point validator (ADR-0048 / ADR-0078): what `apiUrl` is allowed to be handed.

import { describe, expect, it } from "vitest";

import { PortersConfigError } from "../errors/index";
import { throttleKeyOf, validateAccessPoint } from "./access-point";
import type { Scheme } from "./access-point";

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

  // `%` は https の URL では復号されて別の名前になるか、組み立てられずに通信エラーとして届く（RV-92）。
  it.each(["a%41.test", "a%40evil.com"])("rejects %s", (hostname) => {
    expect(() => validateAccessPoint({ hostname })).toThrow(PortersConfigError);
  });

  // 送るときの scheme（https）で組み立てられない名前は、起動時に止める（RV-92）。punycode として成り立たない
  // 名前を組み立てられるかは Node の版で違う（22 と 24.3 は失敗し、それより新しい版は組み立てる）ので、
  // 名前を決め打ちせず、その Node で https の URL が組み立てられないときだけ拒否することを確かめる。
  it.each([
    "xn--",
    "xn--a.test",
    "XN--ABC.test",
    "a.test",
    "xn--eckwd4c7c.test",
  ])(
    "rejects %s exactly when https cannot address it on this Node",
    (hostname) => {
      let unaddressable = false;
      try {
        new URL(`https://${hostname}`);
      } catch {
        unaddressable = true;
      }
      let err: unknown;
      try {
        validateAccessPoint({ hostname });
      } catch (e) {
        err = e;
      }
      expect(err instanceof PortersConfigError).toBe(unaddressable);
    },
  );

  it("accepts an upper-case punycode name", () => {
    expect(() =>
      validateAccessPoint({ hostname: "XN--ECKWD4C7C.TEST" }),
    ).not.toThrow();
  });
});

// 同じサーバーに届く書き方は、同じスロットルの鍵になる（RV-92）。
describe("throttleKeyOf", () => {
  it.each([
    [{ hostname: "a.test" }, "a.test"],
    [{ hostname: "A.Test" }, "a.test"],
    [{ hostname: "a.test." }, "a.test"],
    [{ hostname: "a.test", port: 443 }, "a.test"],
    [{ hostname: "a.test", port: 443, scheme: "https" as const }, "a.test"],
    [{ hostname: "a.test", port: 80, scheme: "http" as const }, "a.test"],
    [{ hostname: "a.test", port: 80 }, "a.test:80"],
    [{ hostname: "a.test", port: 443, scheme: "http" as const }, "a.test:443"],
    [{ hostname: "a.test.", port: 4010 }, "a.test:4010"],
    [{ hostname: "[::1]", port: 4010 }, "[::1]:4010"],
  ])("keys %j as %s", (accessPoint, key) => {
    expect(throttleKeyOf(accessPoint)).toBe(key);
  });
});
