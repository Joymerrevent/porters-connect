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
  validateAccessPoint,
  warnIfInsecureScheme,
} from "./http";
import type { AccessPoint, Transport } from "./http";
import {
  createAttachmentResource,
  createCandidateResource,
  createClientResource,
  createFieldResource,
  createJobResource,
  createOptionResource,
  createPartitionResource,
  createProcessResource,
  createContactResource,
  createActivityResource,
  createOpportunityResource,
  createRecruiterResource,
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
  ContactResource,
  ActivityResource,
  OpportunityResource,
  RecruiterResource,
  ResumeResource,
  UserResource,
} from "./resources";
import type { CustomFor, DeclaredCatalogs, DefinedFields } from "./fields";
import type { EmptyCatalog } from "./resources/read-core";
import type { PartitionId, Scheme, Scope } from "./types";

/** Options for constructing a {@link PortersClient}. `C` is inferred from `fields` (ADR-0023). */
export type PortersClientOptions<C extends DeclaredCatalogs = EmptyCatalog> = {
  /**
   * API host. Required and supplied via `PORTERS_HOST` — never hard-code it.
   * (A representative value lives in docs/reference.) May carry a port — `localhost:4010`.
   *
   * The **host and nothing else**: no scheme, no path, no userinfo, no whitespace. A value like
   * `https://xxxxx.example.com` is rejected at construction with a {@link PortersConfigError}
   * rather than silently addressing a different host (ADR-0048). Any port is fine — including a
   * redundant `:443` (ADR-0049). Write a non-ASCII host in punycode.
   */
  host: string;
  /**
   * URL scheme of the access point (ADR-0047). Defaults to `"https"`. Set `"http"` only for a
   * local fake server or a trusted tunnel: it sends every request — the OAuth token header
   * included — in cleartext, so the library warns once per process (loopback is not exempt).
   * Silence it only where cleartext is intended, with the env var
   * `PORTERS_SUPPRESS_INSECURE_HTTP_WARNING=1`.
   */
  scheme?: Scheme;
  appId?: string;
  appSecret?: string;
  scopes?: Scope[];
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
 * **This is the only way to reach a partition-scoped resource** (ADR-0055): PORTERS requires
 * `partition` on every one of these calls, so the API makes you supply it exactly once, explicitly.
 * `auth` (App-level), the `partition` master (discovery — partition-less), and `tenant` itself
 * (no nesting) are deliberately absent: none of them takes a partition.
 */
export type TenantScope<C extends DeclaredCatalogs = EmptyCatalog> = {
  readonly candidate: CandidateResource<CustomFor<C, "candidate">>;
  readonly job: JobResource<CustomFor<C, "job">>;
  readonly client: ClientResource<CustomFor<C, "client">>;
  readonly recruiter: RecruiterResource<CustomFor<C, "recruiter">>;
  readonly contact: ContactResource<CustomFor<C, "contact">>;
  readonly opportunity: OpportunityResource<CustomFor<C, "opportunity">>;
  readonly activity: ActivityResource<CustomFor<C, "activity">>;
  readonly process: ProcessResource<CustomFor<C, "process">>;
  readonly resume: ResumeResource<CustomFor<C, "resume">>;
  readonly attachment: AttachmentResource;
  readonly user: UserResource;
  readonly field: FieldResource;
  readonly option: OptionResource;
};

/**
 * Entry point of the library. Wires the default transport / auth / throttle / requester and exposes
 * the **App-level** surface: `auth`, the `partition` master (discovery), and {@link PortersClient.tenant}.
 *
 * Everything that PORTERS scopes to a partition (Company DB) lives behind `tenant(id)` — see
 * {@link TenantScope}. The client holds no default partition (ADR-0055): a partition is bound
 * explicitly, exactly once, so "unbound" is not a state this API can be in.
 *
 * @example
 * const porters = new PortersClient({ host, appId, appSecret });
 * await porters.auth.ensureAuthenticated();   // App-level
 * const t = porters.tenant(123);              // bind the partition once
 * const page = await t.candidate.search();
 */
export class PortersClient<C extends DeclaredCatalogs = EmptyCatalog> {
  /** OAuth surface: initial browser grant, token warm-up/inspection, local revoke (ADR-0007/0034). */
  readonly auth: AuthApi;
  /**
   * Master Read: the partitions this App can reach (ADR-0021/0022). Takes no `partition` itself —
   * it is how you *discover* the ids to pass to {@link PortersClient.tenant}.
   */
  readonly partition: PartitionResource;
  /**
   * Bind a partition (Company DB) and get the accessors that route through it (ADR-0040 F-3).
   * **Single-tenant apps use this too** — it is the only path to a partition-scoped resource
   * (ADR-0055). Hold the scope once and use it like a client:
   *
   * ```ts
   * const t = porters.tenant(123);
   * await t.candidate.search();
   * ```
   *
   * `auth` (App-level), the `partition` master (discovery — takes no partition), and `tenant`
   * itself (no nesting) are intentionally absent from the returned scope. For a fully separated
   * per-partition token, construct a dedicated {@link PortersClient} per tenant (ADR-0008 案3).
   */
  readonly tenant: (id: PartitionId) => TenantScope<C>;
  readonly #accessPoint: AccessPoint;

  constructor(options: PortersClientOptions<C>) {
    // Where every URL is sent (ADR-0047). Resolved once here; `apiUrl` is the only place that
    // renders it. Checked once here too (ADR-0048): a malformed `host` is a configuration
    // problem, so it fails where the configuration was handed over — before any credential can
    // be posted to whatever the wrong value happens to resolve to. Plain http warns loudly
    // (once per process) — allowing it never silences it.
    const accessPoint: AccessPoint = {
      host: options.host,
      scheme: options.scheme,
    };
    validateAccessPoint(accessPoint);
    warnIfInsecureScheme(options.scheme, options.host);
    const transport = options.transport ?? createFetchTransport();
    // Custom strategy (案3) takes over token supply; otherwise the default transparent
    // provider also exposes cache/clear controls for the auth surface (ADR-0034 SD-7/SD-8).
    let auth: TokenProvider;
    let controls: AuthProviderControls | undefined = undefined;
    if (options.auth) {
      auth = options.auth;
    } else {
      const provider = createDefaultTokenProvider({
        accessPoint,
        appId: options.appId ?? "",
        appSecret: options.appSecret ?? "",
        transport,
        tokenStore: options.tokenStore,
      });
      auth = provider;
      controls = provider;
    }
    this.auth = createAuthApi({
      accessPoint,
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
    this.#accessPoint = accessPoint;
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
      const deps = { requester, accessPoint, partition };
      return {
        candidate: createCandidateResource(deps, customFor("candidate")),
        job: createJobResource(deps, customFor("job")),
        client: createClientResource(deps, customFor("client")),
        recruiter: createRecruiterResource(deps, customFor("recruiter")),
        contact: createContactResource(deps, customFor("contact")),
        opportunity: createOpportunityResource(deps, customFor("opportunity")),
        activity: createActivityResource(deps, customFor("activity")),
        process: createProcessResource(deps, customFor("process")),
        resume: createResumeResource(deps, customFor("resume")),
        attachment: createAttachmentResource(deps),
        user: createUserResource(deps),
        field: createFieldResource(deps),
        option: createOptionResource(deps),
      };
    };
    this.tenant = buildScope;
    // Partition Read takes no `partition` param (it discovers them); App-level, not tenant-bound.
    this.partition = createPartitionResource({ requester, accessPoint });
  }

  /** The configured API host. */
  get host(): string {
    return this.#accessPoint.host;
  }
}
