import { describe, expect, it } from "vitest";

import {
  PortersAuthError,
  PortersNetworkError,
  PortersResourceError,
} from "./porters-error";
import {
  authCategory,
  authError,
  networkError,
  resourceCategory,
  resourceError,
} from "./classify";

describe("error classification (ADR-0006)", () => {
  it("maps resource codes to categories", () => {
    expect(resourceCategory(9)).toBe("transient");
    expect(resourceCategory(302)).toBe("transient");
    expect(resourceCategory(403)).toBe("permission");
    expect(resourceCategory(404)).toBe("notFound");
    expect(resourceCategory(100)).toBe("validation");
    expect(resourceCategory(116)).toBe("validation");
    expect(resourceCategory(301)).toBe("conflict");
    expect(resourceCategory(1000)).toBe("server");
    expect(resourceCategory(99999)).toBe("unknown");
  });

  it("maps auth codes to categories", () => {
    expect(authCategory(400)).toBe("auth");
    expect(authCategory(401)).toBe("auth");
    expect(authCategory(100)).toBe("validation");
    expect(authCategory(111)).toBe("permission");
    expect(authCategory(108)).toBe("server");
  });

  it("retryable: only transient resource codes; network is retryable", () => {
    expect(resourceError(9, "x").retryable).toBe(true);
    expect(resourceError(403, "x").retryable).toBe(false);
    expect(networkError("timeout").retryable).toBe(true);
  });

  it("produces the right instances and carries code/category/hint", () => {
    const r = resourceError(403, "no perm", { resource: "Candidate" });
    expect(r).toBeInstanceOf(PortersResourceError);
    expect(r.category).toBe("permission");
    expect(r.code).toBe(403);
    expect(r.hint).toBeTypeOf("string");

    expect(authError(401, "x")).toBeInstanceOf(PortersAuthError);
    expect(networkError("x")).toBeInstanceOf(PortersNetworkError);
  });
});
