import { createAuthApi, createDefaultTokenProvider } from "./auth";
import type {
  AuthApi,
  AuthProviderControls,
  TokenProvider,
  TokenStore,
} from "./auth";
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
import type { CustomFor, DeclaredCatalogs, DefinedFields } from "./fields";
import type { EmptyCatalog } from "./resources/read-core";
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
  /**
   * Default partition (Company DB) for every call. For multi-tenant routing, bind a partition
   * per call with {@link PortersClient.tenant} (ADR-0040 / F-3); for a fully separated per-partition
   * token, construct a dedicated client per tenant instead (ADR-0008 案3).
   */
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
 * The partition-bound resource accessors returned by {@link PortersClient.tenant} (ADR-0040 / F-3).
 * Every accessor here routes to the bound tenant's partition. `auth` (App-level), the `partition`
 * master (discovery — partition-less), and `tenant` itself (no nesting) are deliberately absent.
 */
export type TenantScope<C extends DeclaredCatalogs = EmptyCatalog> = {
  readonly candidate: CandidateResource<CustomFor<C, "candidate">>;
  readonly job: JobResource<CustomFor<C, "job">>;
  readonly client: ClientResource<CustomFor<C, "client">>;
  readonly process: ProcessResource<CustomFor<C, "process">>;
  readonly resume: ResumeResource<CustomFor<C, "resume">>;
  readonly attachment: AttachmentResource;
  readonly user: UserResource;
  readonly field: FieldResource;
  readonly option: OptionResource;
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
  /** OAuth surface: initial browser grant, token warm-up/inspection, local revoke (ADR-0007/0034). */
  readonly auth: AuthApi;
  /** Master Read: accessible partitions (ADR-0021/0022). */
  readonly partition: PartitionResource;
  /** Master Read: users, plus `current()` self-identification (ADR-0021/0022). */
  readonly user: UserResource;
  /** Master Read: a resource's field catalog (ADR-0021/0022). */
  readonly field: FieldResource;
  /** Master Read: a tenant's choice (option) master (ADR-0021/0022). */
  readonly option: OptionResource;
  /**
   * Bind a tenant's partition (Company DB) once and route every call through it — the multi-tenant
   * scope (ADR-0008 案2 / renamed in ADR-0021 / implemented in ADR-0040 F-3).
   * `porters.tenant(123).candidate.search(...)` sends `partition=123` without repeating it, overriding
   * the client-default `partition`. Returns the partition-bound accessors (data + attachment + master
   * User/Field/Option); `auth` (App-level), the `partition` master (discovery — takes no partition),
   * and `tenant` itself (no nesting) are intentionally omitted. For a fully separated per-partition
   * token, construct a dedicated {@link PortersClient} per tenant instead (ADR-0008 案3).
   */
  readonly tenant: (id: PartitionId) => TenantScope<C>;
  readonly #host: string;

  constructor(options: PortersClientOptions<C>) {
    const transport = options.transport ?? createFetchTransport();
    // Custom strategy (案3) takes over token supply; otherwise the default transparent
    // provider also exposes cache/clear controls for the auth surface (ADR-0034 SD-7/SD-8).
    let auth: TokenProvider;
    let controls: AuthProviderControls | undefined = undefined;
    if (options.auth) {
      auth = options.auth;
    } else {
      const provider = createDefaultTokenProvider({
        host: options.host,
        appId: options.appId ?? "",
        appSecret: options.appSecret ?? "",
        transport,
        tokenStore: options.tokenStore,
      });
      auth = provider;
      controls = provider;
    }
    this.auth = createAuthApi({
      host: options.host,
      appId: options.appId,
      appSecret: options.appSecret,
      scopes: options.scopes,
      transport,
      provider: auth,
      controls,
    });
    const requester = createRequester({
      transport,
      auth,
      throttle: createThrottle(),
      backoff: expoBackoff(),
    });
    this.#host = options.host;
    // The per-resource custom catalog declared via defineFields (or {} when none). Branded
    // = already validated (ADR-0023 D4), so the factory merges it without re-checking.
    const customFor = <K extends keyof DeclaredCatalogs>(
      key: K,
    ): CustomFor<C, K> => (options.fields?.[key] ?? {}) as CustomFor<C, K>;
    // Build the partition-bound accessor bundle for a given partition. The root client uses the
    // default partition; `tenant(id)` re-binds it (ADR-0040 / F-3) by re-running the same factories
    // with `partition` overridden — resources are already `deps.partition`-driven, so the factories
    // need no change. Partition Read is App-level (no partition) and built once below, not here.
    const buildScope = (partition: number): TenantScope<C> => {
      const deps = { requester, host: options.host, partition };
      return {
        candidate: createCandidateResource(deps, customFor("candidate")),
        job: createJobResource(deps, customFor("job")),
        client: createClientResource(deps, customFor("client")),
        process: createProcessResource(deps, customFor("process")),
        resume: createResumeResource(deps, customFor("resume")),
        attachment: createAttachmentResource(deps),
        user: createUserResource(deps),
        field: createFieldResource(deps),
        option: createOptionResource(deps),
      };
    };
    this.tenant = buildScope;
    const root = buildScope(options.partition ?? 0);
    this.candidate = root.candidate;
    this.job = root.job;
    this.client = root.client;
    this.process = root.process;
    this.resume = root.resume;
    this.attachment = root.attachment;
    this.user = root.user;
    this.field = root.field;
    this.option = root.option;
    // Partition Read takes no `partition` param (it discovers them); App-level, not tenant-bound.
    this.partition = createPartitionResource({ requester, host: options.host });
  }

  /** The configured API host. */
  get host(): string {
    return this.#host;
  }
}
