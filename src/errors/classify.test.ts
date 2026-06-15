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
    expect(resourceCategory(401)).toBe("auth");
    expect(resourceCategory(402)).toBe("auth");
    // every member of the permission OR-chain
    expect(resourceCategory(6)).toBe("permission");
    expect(resourceCategory(400)).toBe("permission");
    expect(resourceCategory(403)).toBe("permission");
    expect(resourceCategory(406)).toBe("permission");
    expect(resourceCategory(601)).toBe("permission");
    expect(resourceCategory(404)).toBe("notFound");
    // every member of the conflict OR-chain
    expect(resourceCategory(301)).toBe("conflict");
    expect(resourceCategory(303)).toBe("conflict");
    expect(resourceCategory(304)).toBe("conflict");
    expect(resourceCategory(1000)).toBe("server");
    expect(resourceCategory(100)).toBe("validation"); // range floor
    expect(resourceCategory(116)).toBe("validation"); // range ceiling
    expect(resourceCategory(8)).toBe("validation"); // RESOURCE_VALIDATION set member
    expect(resourceCategory(500)).toBe("validation"); // set member outside 100-116
    expect(resourceCategory(50)).toBe("unknown"); // below the range floor, not in set
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

  it("covers remaining classify branches", () => {
    expect(authCategory(999)).toBe("unknown");
    expect(authError(100, "x").hint).toBeUndefined(); // non-auth -> no hint
    expect(resourceCategory(7)).toBe("notFound"); // the `7` branch
    expect(resourceCategory(401)).toBe("auth"); // resource 401/402 -> auth
    expect(resourceError(9, "x").hint).toBeUndefined(); // resourceHint default
    expect(resourceError(404, "x").hint).toBeTypeOf("string"); // 404 hint
  });

  it("carries non-empty hints, the network category, and the auth retryable flag", () => {
    // hint *content* (an empty string is still a string, so assert substrings)
    expect(resourceError(403, "x").hint).toContain("permission");
    expect(resourceError(404, "x").hint).toContain("Partition");

    expect(networkError("x").category).toBe("network");

    const a = authError(401, "x");
    expect(a.category).toBe("auth");
    expect(a.hint).toContain("Authentication"); // auth category -> actionable hint
    expect(a.retryable).toBe(false); // auth errors are never retryable
  });
});
