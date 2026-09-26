import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { PortersAuthError } from "./porters-error";
import { authCategory, authError } from "./auth-error";

describe("auth error classification (ADR-0006)", () => {
  // 表を写すのではなく、コードごとの期待値を並べる（表の行が抜けたら、ここで落ちる）。
  it.each([
    [400, "auth"],
    [401, "auth"],
    [103, "auth"],
    [104, "auth"],
    [105, "auth"],
    [106, "auth"],
    [107, "auth"],
    [109, "auth"],
    [114, "auth"],
    [117, "auth"],
    [100, "validation"],
    [101, "validation"],
    [102, "validation"],
    [110, "validation"],
    [112, "validation"],
    [111, "permission"],
    [115, "permission"],
    [116, "permission"],
    [402, "permission"],
    [108, "server"],
    [113, "unknown"],
    [999, "unknown"],
  ] as const)("maps auth code %i to %s", (code, category) => {
    expect(authCategory(code)).toBe(category);
  });

  it("produces the right instance, an actionable hint for auth, and is never retryable", () => {
    const a = authError(401, "x");
    expect(a).toBeInstanceOf(PortersAuthError);
    expect(a.category).toBe("auth");
    expect(a.hint).toContain("Authentication"); // auth category -> actionable hint
    expect(a.retryable).toBe(false); // auth errors are never retryable
    expect(authError(100, "x").hint).toBeUndefined(); // non-auth -> no hint
  });
});

// reference の表を読み、載っているコードのうち分類していないものを確かめる（RV-114）。
// 表に行が足されたのに実装の表を直し忘れると、ここで落ちる。
// -1（キャンセル）と 113（登録アプリのサイトが無い）は ADR-0006 の表に無く、unknown（再試行しない）に
// 倒している。分類するかは RV-114 / RV-123 の ADR で決める。決まったら、この一覧から外す。
it("leaves only the known codes unclassified in the reference table", () => {
  const table = readFileSync(
    fileURLToPath(
      new URL(
        "../../docs/usage/reference/authentication-api/errors.md",
        import.meta.url,
      ),
    ),
    "utf8",
  );
  const codes = [...table.matchAll(/^\| *(-?\d+) *\|/gm)].map(([, c]) =>
    Number(c),
  );
  expect(codes.length).toBeGreaterThan(20);
  const unclassified = codes.filter(
    (c) => c !== 0 && authCategory(c) === "unknown",
  );
  expect(unclassified).toEqual([-1, 113]);
});
