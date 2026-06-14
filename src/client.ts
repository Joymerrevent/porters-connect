import { createDefaultTokenProvider } from "./auth";
import type { TokenProvider, TokenStore } from "./auth";
import {
  createFetchTransport,
  createRequester,
  createThrottle,
  expoBackoff,
} from "./http";
import type { Transport } from "./http";
import { createCandidateResource } from "./resources";
import type { CandidateResource } from "./resources";
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
 * Entry point of the library. Wires the default transport / auth / throttle /
 * requester and exposes namespaced resource accessors such as `candidate`
 * (ADR-0005).
 */
export class PortersClient {
  readonly candidate: CandidateResource;
  readonly #host: string;

  constructor(options: PortersClientOptions) {
    const transport = options.transport ?? createFetchTransport();
    const auth =
      options.auth ??
      createDefaultTokenProvider({
        host: options.host,
        appId: options.appId ?? "",
        appSecret: options.appSecret ?? "",
        transport,
        tokenStore: options.tokenStore,
      });
    const requester = createRequester({
      transport,
      auth,
      throttle: createThrottle(),
      backoff: expoBackoff(),
    });
    this.#host = options.host;
    this.candidate = createCandidateResource({
      requester,
      host: options.host,
      partition: options.partition ?? 0,
    });
  }

  /** The configured API host. */
  get host(): string {
    return this.#host;
  }
}
