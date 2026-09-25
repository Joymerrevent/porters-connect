import type { StoredTokens, TokenStore } from "./types";

/** Default in-process token store (single instance; lost on restart). */
export const createMemoryTokenStore = (): TokenStore => {
  let tokens: StoredTokens | undefined;
  return {
    get: () => Promise.resolve(tokens),
    set: (t) => {
      tokens = t;
      return Promise.resolve();
    },
    clear: () => {
      tokens = undefined;
      return Promise.resolve();
    },
  };
};
