import { describe, expect, it } from "vitest";

import { PortersResourceError } from "./porters-error";
import { resourceCategory, resourceError } from "./resource-error";

describe("resource error classification (ADR-0006)", () => {
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
    expect(resourceCategory(7)).toBe("notFound"); // the `7` branch
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

  it("retryable: only transient resource codes", () => {
    expect(resourceError(9, "x").retryable).toBe(true);
    expect(resourceError(403, "x").retryable).toBe(false);
  });

  it("produces the right instance and carries code/category/hint", () => {
    const r = resourceError(403, "no perm", { resource: "Candidate" });
    expect(r).toBeInstanceOf(PortersResourceError);
    expect(r.category).toBe("permission");
    expect(r.code).toBe(403);
    expect(r.hint).toBeTypeOf("string");
  });

  it("carries non-empty hints only for the codes that have one", () => {
    // hint *content* (an empty string is still a string, so assert substrings)
    expect(resourceError(403, "x").hint).toContain("permission");
    expect(resourceError(404, "x").hint).toContain("Partition");
    expect(resourceError(9, "x").hint).toBeUndefined(); // resourceHint default
  });
});
