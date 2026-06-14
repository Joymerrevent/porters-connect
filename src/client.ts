import type { TokenProvider, TokenStore } from "./auth";
import type { Transport } from "./http";
import type { PartitionId, Scope } from "./types";

/** Options for constructing a {@link PortersClient}. */
export type PortersClientOptions = {
  /**
   * API host. Required and supplied via `PORTERS_HOST` — never hard-code it.
   * (A representative value lives in docs/reference.)
   */
  host: string;
  appId?: string;
  appSecret?: string;
  scopes?: Scope[];
  /** Default partition; overridable per call (ADR-0008). */
  partition?: PartitionId;
  /** Custom auth strategy; defaults to the transparent code_direct strategy. */
  auth?: TokenProvider;
  /** Token persistence; defaults to in-memory. */
  tokenStore?: TokenStore;
  /** Injectable HTTP transport; defaults to a fetch-based transport. */
  transport?: Transport;
};

/**
 * Entry point of the library. Holds configuration and (incrementally) exposes
 * namespaced resource accessors such as `candidate`, `job`, … (ADR-0005).
 */
export class PortersClient {
  readonly #options: PortersClientOptions;

  constructor(options: PortersClientOptions) {
    this.#options = options;
  }

  /** The configured API host. */
  get host(): string {
    return this.#options.host;
  }
}
