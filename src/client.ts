import { createDefaultTokenProvider } from "./auth";
import type { TokenProvider, TokenStore } from "./auth";
import {
  createFetchTransport,
  createRequester,
  createThrottle,
  expoBackoff,
} from "./http";
import type { Transport } from "./http";
import {
  createCandidateResource,
  createClientResource,
  createJobResource,
  createProcessResource,
  createResumeResource,
} from "./resources";
import type {
  CandidateResource,
  ClientResource,
  JobResource,
  ProcessResource,
  ResumeResource,
} from "./resources";
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
  readonly job: JobResource;
  readonly client: ClientResource;
  readonly process: ProcessResource;
  readonly resume: ResumeResource;
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
    const deps = {
      requester,
      host: options.host,
      partition: options.partition ?? 0,
    };
    this.candidate = createCandidateResource(deps);
    this.job = createJobResource(deps);
    this.client = createClientResource(deps);
    this.process = createProcessResource(deps);
    this.resume = createResumeResource(deps);
  }

  /** The configured API host. */
  get host(): string {
    return this.#host;
  }
}
