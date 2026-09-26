import { describe, expect, it } from "vitest";

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
