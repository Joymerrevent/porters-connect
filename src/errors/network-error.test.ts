import { describe, expect, it } from "vitest";

import { PortersNetworkError } from "./porters-error";
import { networkError } from "./network-error";

describe("networkError (ADR-0006)", () => {
  it("is a retryable network error", () => {
    const e = networkError("timeout");
    expect(e).toBeInstanceOf(PortersNetworkError);
    expect(e.category).toBe("network");
    expect(e.retryable).toBe(true);
  });
});
