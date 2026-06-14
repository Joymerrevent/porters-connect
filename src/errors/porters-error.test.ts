import { describe, expect, it } from "vitest";

import {
  PortersAuthError,
  PortersError,
  PortersResourceError,
} from "./porters-error";

describe("PortersError", () => {
  it("subclasses are catchable as PortersError and carry classification", () => {
    const err = new PortersAuthError("refresh token expired", {
      category: "auth",
      code: 401,
      hint: "re-authenticate via the browser code grant",
    });

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(PortersError);
    expect(err).toBeInstanceOf(PortersAuthError);
    expect(err.name).toBe("PortersAuthError");
    expect(err.category).toBe("auth");
    expect(err.code).toBe(401);
    expect(err.retryable).toBe(false);
  });

  it("defaults code to null and retryable to false (fail-safe)", () => {
    const err = new PortersResourceError("unexpected", { category: "unknown" });

    expect(err.code).toBeNull();
    expect(err.retryable).toBe(false);
  });
});
