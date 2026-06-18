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
  createAttachmentResource,
  createCandidateResource,
  createClientResource,
  createFieldResource,
  createJobResource,
  createOptionResource,
  createPartitionResource,
  createProcessResource,
  createResumeResource,
  createUserResource,
} from "./resources";
import type {
  AttachmentResource,
  CandidateResource,
  ClientResource,
  FieldResource,
  JobResource,
  OptionResource,
  PartitionResource,
  ProcessResource,
  ResumeResource,
  UserResource,
} from "./resources";
import type {
  CustomFor,
  DeclaredCatalogs,
  DefinedFields,
  EmptyCatalog,
} from "./fields";
import type { PartitionId, Scope } from "./types";

/** Options for constructing a {@link PortersClient}. `C` is inferred from `fields` (ADR-0023). */
export type PortersClientOptions<C extends DeclaredCatalogs = EmptyCatalog> = {
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
  /**
   * Tenant custom field declarations from {@link defineFields} (ADR-0023). Each resource's
   * declared `U_`/`A_` fields are merged onto its static catalog, so they decode/encode by
   * their declared Data Type and appear typed on reads / writes. Omit for standard `P_` only.
   */
  fields?: DefinedFields<C>;
};

/**
 * Entry point of the library. Wires the default transport / auth / throttle /
 * requester and exposes namespaced resource accessors such as `candidate`
 * (ADR-0005).
 */
export class PortersClient<C extends DeclaredCatalogs = EmptyCatalog> {
  readonly candidate: CandidateResource<CustomFor<C, "candidate">>;
  readonly job: JobResource<CustomFor<C, "job">>;
  readonly client: ClientResource<CustomFor<C, "client">>;
  readonly process: ProcessResource<CustomFor<C, "process">>;
  readonly resume: ResumeResource<CustomFor<C, "resume">>;
  readonly attachment: AttachmentResource;
  /** Master Read: accessible partitions (ADR-0021/0022). */
  readonly partition: PartitionResource;
  /** Master Read: users, plus `current()` self-identification (ADR-0021/0022). */
  readonly user: UserResource;
  /** Master Read: a resource's field catalog (ADR-0021/0022). */
  readonly field: FieldResource;
  /** Master Read: a tenant's choice (option) master (ADR-0021/0022). */
  readonly option: OptionResource;
  readonly #host: string;

  constructor(options: PortersClientOptions<C>) {
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
    // The per-resource custom catalog declared via defineFields (or {} when none). Branded
    // = already validated (ADR-0023 D4), so the factory merges it without re-checking.
    const customFor = <K extends keyof DeclaredCatalogs>(
      key: K,
    ): CustomFor<C, K> => (options.fields?.[key] ?? {}) as CustomFor<C, K>;
    this.candidate = createCandidateResource(deps, customFor("candidate"));
    this.job = createJobResource(deps, customFor("job"));
    this.client = createClientResource(deps, customFor("client"));
    this.process = createProcessResource(deps, customFor("process"));
    this.resume = createResumeResource(deps, customFor("resume"));
    this.attachment = createAttachmentResource(deps);
    // Partition Read takes no `partition` param (it discovers them); the rest use the default.
    this.partition = createPartitionResource({ requester, host: options.host });
    this.user = createUserResource(deps);
    this.field = createFieldResource(deps);
    this.option = createOptionResource(deps);
  }

  /** The configured API host. */
  get host(): string {
    return this.#host;
  }
}
