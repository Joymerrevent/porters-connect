import { describe, expect, it } from "vitest";

import { PortersAuthError } from "./porters-error";
import { authCategory, authError } from "./auth-error";

describe("auth error classification (ADR-0006)", () => {
  it("maps auth codes to categories", () => {
    expect(authCategory(400)).toBe("auth");
    expect(authCategory(401)).toBe("auth");
    expect(authCategory(100)).toBe("validation");
    expect(authCategory(111)).toBe("permission");
    expect(authCategory(108)).toBe("server");
    expect(authCategory(999)).toBe("unknown");
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
