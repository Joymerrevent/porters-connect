import { createAuthApi, createDefaultTokenProvider } from "./auth";
import { PortersConfigError } from "./errors";
import type {
  AuthApi,
  AuthProviderControls,
  TokenProvider,
  TokenStore,
} from "./auth";
import {
  authorityOf,
  createFetchTransport,
  createRequester,
  sharedThrottleFor,
  expoBackoff,
  validateAccessPoint,
  warnIfInsecureScheme,
} from "./http";
import type { AccessPoint, Throttle, Transport } from "./http";
import {
  createAttachmentAccessor,
  createCandidateResource,
  createClientResource,
  createFieldAccessor,
  createJobResource,
  createOptionResource,
  createPartitionResource,
  createProcessResource,
  createContactResource,
  createActivityResource,
  createContractResource,
  createPhaseAccessor,
  createSalesResource,
  createOpportunityResource,
  createRecruiterResource,
  createResumeResource,
  createUserResource,
  createDepartmentResource,
} from "./resources";
import type {
  AttachmentAccessor,
  CandidateResource,
  ClientResource,
  FieldAccessor,
  JobResource,
  OptionResource,
  PartitionResource,
  ProcessResource,
  ContactResource,
  ActivityResource,
  ContractResource,
  PhaseAccessor,
  SalesResource,
  OpportunityResource,
  RecruiterResource,
  ResumeResource,
  UserResource,
  DepartmentResource,
} from "./resources";
import type { CustomFor, DeclaredCatalogs, DefinedFields } from "./fields";
import type { EmptyCatalog } from "./resources/read-core";
import type { PartitionId, Scheme, Scope } from "./types";

/**
 * Options for constructing a {@link PortersClient}. App-level only: custom field declarations
 * belong to a partition and go to {@link PortersClient.tenant} as {@link TenantOptions} (ADR-0087).
 */
export type PortersClientOptions = {
  /**
   * API server name. Required and supplied via `PORTERS_HOST` — never hard-code it.
   * (A representative value lives in docs/usage/reference.)
   *
   * The **name and nothing else**: no port, no scheme, no path, no userinfo, no whitespace
   * (ADR-0078). PORTERS issues a server name and speaks https, so a port never arrives with it;
   * when you need one (a local fake, a proxy) pass {@link PortersClientOptions.port}. A value
   * like `https://xxxxx.example.com` or `a.test:4010` is rejected at construction with a
   * {@link PortersConfigError} rather than silently addressing something else (ADR-0048).
   * Write a non-ASCII name in punycode; bracket an IPv6 address (`[::1]`).
   */
  hostname: string;
  /**
   * Port of the access point (ADR-0078). **Omit it for PORTERS** — the contract gives you a name
   * and the scheme decides the port. Set it only for a local fake server or a proxy:
   * `{ hostname: "127.0.0.1", port: 4010, scheme: "http" }`. An integer 1–65535; anything else
   * is rejected at construction.
   */
  port?: number;
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
   * Rate-limit self-restraint (ADR-0073). Defaults to the **process-wide bucket for this destination**,
   * so several clients aimed at the same PORTERS add up to one limit instead of one each.
   *
   * Pass your own to opt out of that sharing, to run different limits, or to coordinate across
   * processes — a `Throttle` backed by Redis is what makes the multi-instance case honest
   * (ADR-0010 left that to the caller). `createThrottle()` builds the default implementation.
   */
  throttle?: Throttle;
  /**
   * **Not a client option any more** (ADR-0087). Custom fields belong to a partition, so the
   * declaration goes to {@link PortersClient.tenant} as `tenant(id, { fields })`. Typed `never`
   * so a configuration object that still carries the pre-0.21 `fields` fails to compile even when
   * it is not a fresh literal; at runtime the constructor rejects it with {@link PortersConfigError}
   * rather than silently dropping the declaration (the same fail-closed stance as `hostname`,
   * ADR-0048).
   */
  fields?: never;
};

/**
 * Options for {@link PortersClient.tenant}. `C` is inferred from `fields` (ADR-0023 / ADR-0087).
 *
 * Declared per partition, not per client, because that is how PORTERS defines custom fields:
 * every resource article lists `U_[Name]` / `A_[Name]` as differing per tenant (Company DB).
 * The scope that binds the partition is therefore the one that states its field shape — a
 * declaration written for one tenant cannot silently apply to another (ADR-0087).
 */
export type TenantOptions<C extends DeclaredCatalogs = EmptyCatalog> = {
  /**
   * This partition's custom field declarations from {@link defineFields} (ADR-0023). Each
   * resource's declared `U_`/`A_` fields are merged onto its static catalog, so they decode /
   * encode by their declared Data Type and appear typed on reads / writes. Omit for standard
   * `P_` only. `generateFieldDecls` writes one from the tenant's Field Read and `verifyFields`
   * checks one against it (ADR-0069) — both take the same `tenant(id)` scope.
   */
  fields?: DefinedFields<C>;
};

/**
 * The partition-bound resource accessors returned by {@link PortersClient.tenant} (ADR-0040 / F-3).
 * **This is the only way to reach a partition-scoped resource** (ADR-0055): PORTERS requires
 * `partition` on every one of these calls, so the API makes you supply it exactly once, explicitly.
 * `C` is that partition's custom field catalog, from `tenant(id, { fields })` (ADR-0087).
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
  readonly contract: ContractResource<CustomFor<C, "contract">>;
  readonly sales: SalesResource<CustomFor<C, "sales">>;
  /**
   * Phase history, reached through the resource it belongs to: `t.phase.of("client")`.
   * PORTERS requires that `resource` on every Phase call, so it is bound once (ADR-0061 案2a).
   */
  readonly phase: PhaseAccessor;
  readonly process: ProcessResource<CustomFor<C, "process">>;
  readonly resume: ResumeResource<CustomFor<C, "resume">>;
  /**
   * Attachments, reached through the resource they belong to: `t.attachment.of("resume")`.
   * PORTERS requires that `resource` on every Attachment Read, and the same value fills the
   * `<Resource>` field on write, so it is bound once (ADR-0080 / ADR-0081).
   */
  readonly attachment: AttachmentAccessor;
  readonly user: UserResource;
  /**
   * Department master Read (Connect API 8.2.1+): the user departments a department-typed Link field
   * or `User.P_Department` points at. Read-only, listed whole — no filter, no `get(id)`. Covered
   * by the `user_r` scope (PORTERS defines no `department_r`).
   */
  readonly department: DepartmentResource;
  /**
   * Field master Read, reached through the resource whose catalog you want:
   * `t.field.of("candidate")`. PORTERS requires `resource=` on every Field Read, so it is bound
   * once (ADR-0080).
   */
  readonly field: FieldAccessor;
  readonly option: OptionResource;
};

/**
 * Entry point of the library. Wires the default transport / auth / throttle / requester and exposes
 * the **App-level** surface: `auth`, the `partition` master (discovery), and {@link PortersClient.tenant}.
 *
 * Everything that PORTERS scopes to a partition (Company DB) lives behind `tenant(id)` — see
 * {@link TenantScope}. The client holds no default partition (ADR-0055) and no custom field
 * declaration (ADR-0087): both are bound explicitly, exactly once, at `tenant(id, { fields })`,
 * so "unbound" and "declared for some other tenant" are not states this API can be in.
 *
 * @example
 * const porters = new PortersClient({ hostname, appId, appSecret });
 * await porters.auth.ensureAuthenticated();   // App-level
 * const t = porters.tenant(123, { fields: myFields }); // bind the partition (and its fields) once
 * const page = await t.candidate.search();
 */
export class PortersClient {
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
   * That partition's custom fields are declared here as well (ADR-0087), since PORTERS defines
   * them per partition — see {@link TenantOptions}. Tenants with different fields share one
   * client (and one token):
   *
   * ```ts
   * const a = porters.tenant(1, { fields: fieldsA });
   * const b = porters.tenant(2, { fields: fieldsB });
   * ```
   *
   * `auth` (App-level), the `partition` master (discovery — takes no partition), and `tenant`
   * itself (no nesting) are intentionally absent from the returned scope. For a fully separated
   * per-partition token, construct a dedicated {@link PortersClient} per tenant (ADR-0008 案3).
   */
  readonly tenant: <C extends DeclaredCatalogs = EmptyCatalog>(
    id: PartitionId,
    options?: TenantOptions<C>,
  ) => TenantScope<C>;
  readonly #accessPoint: AccessPoint;

  constructor(options: PortersClientOptions) {
    // A `fields` left over from before ADR-0087 must not be ignored: the declaration would be
    // dropped and every custom field would silently come back untyped (or not at all). The type
    // already refuses it (`fields?: never`); this is the runtime side for JavaScript callers and
    // casts. Read through `unknown` because the declared type says the key is never there.
    if ((options as { fields?: unknown }).fields !== undefined) {
      throw new PortersConfigError(
        'PortersClient: "fields" is not a client option (ADR-0087) — custom fields belong to a partition',
        {
          category: "config",
          hint: "Declare them where you bind the partition: porters.tenant(id, { fields })",
        },
      );
    }
    // Where every URL is sent (ADR-0047). Resolved once here; `apiUrl` is the only place that
    // renders it. Checked once here too (ADR-0048): a malformed `hostname` is a configuration
    // problem, so it fails where the configuration was handed over — before any credential can
    // be posted to whatever the wrong value happens to resolve to. Plain http warns loudly
    // (once per process) — allowing it never silences it.
    const accessPoint: AccessPoint = {
      hostname: options.hostname,
      port: options.port,
      scheme: options.scheme,
    };
    validateAccessPoint(accessPoint);
    // The warning names the destination, port included — two access points that differ only by
    // port are different destinations (ADR-0078).
    warnIfInsecureScheme(options.scheme, authorityOf(accessPoint));
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
      // Per destination, not per client (ADR-0073): building a client per tenant is something the guides
      // recommend, and a bucket each would let the process issue N times the limit — silently
      // (RV-43). An injected throttle takes over entirely, sharing included.
      throttle: options.throttle ?? sharedThrottleFor(authorityOf(accessPoint)),
      backoff: expoBackoff(),
    });
    this.#accessPoint = accessPoint;
    // Build the partition-bound accessor bundle for a given partition (ADR-0040 / F-3) by running
    // the same factories with that `partition` — resources are already `deps.partition`-driven, so
    // the factories need no change. The custom field catalog is bound here too (ADR-0087): it is
    // per partition, so it arrives with the partition and never outlives the scope. Partition Read
    // is App-level (no partition) and built once below, not here.
    //
    // VERIFY(live): re-binding swaps only the `partition` query and keeps the **same token**, so
    // this assumes one App token reaches every partition it was granted. Whether a token's access
    // actually spans partitions is unconfirmed — docs/live-verification.md (LV-13). If it does not,
    // the recommended path becomes a dedicated client per tenant (ADR-0008 案3); the design already
    // allows that, so only the ergonomics of `tenant(id)` would change.
    const buildScope = <C extends DeclaredCatalogs = EmptyCatalog>(
      partition: number,
      scope: TenantOptions<C> = {},
    ): TenantScope<C> => {
      // The per-resource custom catalog declared via defineFields (or {} when none). Branded
      // = already validated (ADR-0023 D4), so the factory merges it without re-checking.
      const customFor = <K extends keyof DeclaredCatalogs>(
        key: K,
      ): CustomFor<C, K> => (scope.fields?.[key] ?? {}) as CustomFor<C, K>;
      const deps = { requester, accessPoint, partition };
      return {
        candidate: createCandidateResource(deps, customFor("candidate")),
        job: createJobResource(deps, customFor("job")),
        client: createClientResource(deps, customFor("client")),
        recruiter: createRecruiterResource(deps, customFor("recruiter")),
        contact: createContactResource(deps, customFor("contact")),
        opportunity: createOpportunityResource(deps, customFor("opportunity")),
        activity: createActivityResource(deps, customFor("activity")),
        contract: createContractResource(deps, customFor("contract")),
        sales: createSalesResource(deps, customFor("sales")),
        phase: createPhaseAccessor(deps),
        process: createProcessResource(deps, customFor("process")),
        resume: createResumeResource(deps, customFor("resume")),
        attachment: createAttachmentAccessor(deps),
        user: createUserResource(deps),
        department: createDepartmentResource(deps),
        field: createFieldAccessor(deps),
        option: createOptionResource(deps),
      };
    };
    this.tenant = buildScope;
    // Partition Read takes no `partition` param (it discovers them); App-level, not tenant-bound.
    this.partition = createPartitionResource({ requester, accessPoint });
  }

  /** The configured API server name (no port — see {@link PortersClient.port}). */
  get hostname(): string {
    return this.#accessPoint.hostname;
  }

  /** The configured port, or `undefined` when the scheme's own port is used (ADR-0078). */
  get port(): number | undefined {
    return this.#accessPoint.port;
  }
}
