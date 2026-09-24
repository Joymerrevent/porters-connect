import { describe, expect, it } from "vitest";

import { createMemoryTokenStore } from "./memory-store";
import type { StoredTokens } from "./index";

const tokens: StoredTokens = {
  accessToken: { token: "a", expiresAt: 1 },
  refreshToken: { token: "r", expiresAt: 2 },
};

describe("createMemoryTokenStore", () => {
  it("round-trips set / get / clear", async () => {
    const store = createMemoryTokenStore();
    expect(await store.get()).toBeUndefined();
    await store.set(tokens);
    expect(await store.get()).toEqual(tokens);
    await store.clear();
    expect(await store.get()).toBeUndefined();
  });
});
