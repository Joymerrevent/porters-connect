import {
  createAuthApi,
  createDefaultTokenProvider,
  createTokenManager,
} from "./auth";
import { PortersConfigError } from "./errors";
import type { AuthApi, TokenProvider, TokenStore } from "./auth";
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
import type {
  CustomFor,
  DeclaredCatalogs,
  DefinedFields,
  RequiredFor,
} from "./fields";
import type { EmptyCatalog } from "./resources/read-core";
import type { PartitionId, Scheme, Scope } from "./types";

// App-level と partition-level の線引きは ADR-0087（カスタム項目の宣言は tenant へ）。
/**
 * Options for constructing a {@link PortersClient}. App-level only: custom field declarations
 * belong to a partition and go to {@link PortersClient.tenant} as {@link TenantOptions}.
 */
export type PortersClientOptions = {
  // hostname は名前だけ・port は別項目（ADR-0078）。不正値は黙って別の宛先に向けず
  // 構築時に弾く（ADR-0048）。
  /**
   * API server name. Required and supplied via `PORTERS_HOST` — never hard-code it.
   * (A representative value lives in docs/usage/reference.)
   *
   * The **name and nothing else**: no port, no scheme, no path, no userinfo, no whitespace.
   * PORTERS issues a server name and speaks https, so a port never arrives with it;
   * when you need one (a local fake, a proxy) pass {@link PortersClientOptions.port}. A value
   * like `https://xxxxx.example.com` or `a.test:4010` is rejected at construction with a
   * {@link PortersConfigError} rather than silently addressing something else.
   * Write a non-ASCII name in punycode; bracket an IPv6 address (`[::1]`).
   */
  hostname: string;
  /**
   * Port of the access point. **Omit it for PORTERS** — the contract gives you a name
   * and the scheme decides the port. Set it only for a local fake server or a proxy:
   * `{ hostname: "127.0.0.1", port: 4010, scheme: "http" }`. An integer 1–65535; anything else
   * is rejected at construction.
   */
  port?: number;
  // http の許可と警告の抑止を分ける理由は ADR-0047。
  /**
   * URL scheme of the access point. Defaults to `"https"`. Set `"http"` only for a
   * local fake server or a trusted tunnel: it sends every request — the OAuth token header
   * included — in cleartext, so the library warns once per process (loopback is not exempt).
   * Silence it only where cleartext is intended, with the env var
   * `PORTERS_SUPPRESS_INSECURE_HTTP_WARNING=1`.
   */
  scheme?: Scheme;
  appId?: string;
  appSecret?: string;
  scopes?: Scope[];
  // 取得と保存を別々に受け、管理はクライアントが持つのは ADR-0091。
  /**
   * Where tokens come from. Leave it out for the built-in flow (`code_direct` with `appId` /
   * `appSecret`); pass one to obtain tokens another way — for example from a central service that
   * holds the App Secret. Either way the client caches, renews before expiry, retries once on an
   * expired token, and saves to `tokenStore`.
   */
  tokenProvider?: TokenProvider;
  /** Token persistence, used with every token provider; defaults to in-memory. */
  tokenStore?: TokenStore;
  // 取得を丸ごと差し替える auth は ADR-0091 で廃止。黙って無視すると認証が既定の方式に戻って
  // 動き続けるので、fields と同じく型と実行時の両方で弾く。
  /**
   * **Not a client option any more.** Pass a `tokenProvider` (`{ acquire, refresh?, exchange? }`)
   * instead; the client manages caching and renewal for it. Typed `never` so a leftover `auth`
   * fails to compile; at runtime the constructor rejects it with {@link PortersConfigError}.
   */
  auth?: never;
  /** Injectable HTTP transport; defaults to a fetch-based transport. */
  transport?: Transport;
  // 宛先ごとのプロセス共有バケットは ADR-0073。プロセス横断（Redis 等）は ADR-0010 で
  // 利用側の責務とした。
  /**
   * Rate-limit self-restraint. Defaults to the **process-wide bucket for this destination**,
   * so several clients aimed at the same PORTERS add up to one limit instead of one each.
   *
   * Pass your own to opt out of that sharing, to run different limits, or to coordinate across
   * processes — a `Throttle` backed by Redis is what makes the multi-instance case honest; the
   * library leaves that to you. `createThrottle()` builds the default implementation.
   */
  throttle?: Throttle;
  // 宣言を tenant へ移した経緯は ADR-0087。黙って捨てずに弾くのは hostname と同じ
  // fail-closed（ADR-0048）。
  /**
   * **Not a client option any more.** Custom fields belong to a partition, so the
   * declaration goes to {@link PortersClient.tenant} as `tenant(id, { fields })`. Typed `never`
   * so a configuration object that still carries the pre-0.21 `fields` fails to compile even when
   * it is not a fresh literal; at runtime the constructor rejects it with {@link PortersConfigError}
   * rather than silently dropping the declaration (the same fail-closed stance as `hostname`).
   */
  fields?: never;
};

// 宣言 DSL は ADR-0023、partition スコープで受ける決定は ADR-0087。
/**
 * Options for {@link PortersClient.tenant}. `C` is inferred from `fields`.
 *
 * Declared per partition, not per client, because that is how PORTERS defines custom fields:
 * every resource article lists `U_[Name]` / `A_[Name]` as differing per tenant (Company DB).
 * The scope that binds the partition is therefore the one that states its field shape — a
 * declaration written for one tenant cannot silently apply to another.
 */
export type TenantOptions<C extends DeclaredCatalogs = EmptyCatalog> = {
  // 宣言と検証（verifyFields）が同じ tenant(id) を取る理由は ADR-0069。
  /**
   * This partition's custom field declarations from {@link defineFields}. Each
   * resource's declared `U_`/`A_` fields are merged onto its static catalog, so they decode /
   * encode by their declared Data Type and appear typed on reads / writes. Omit for standard
   * `P_` only. `generateFieldDecls` writes one from the tenant's Field Read and `verifyFields`
   * checks one against it — both take the same `tenant(id)` scope.
   */
  fields?: DefinedFields<C>;
};

// tenant(id) 経由のみ（既定 partition を持たない）は ADR-0040 F-3 / ADR-0055。
// カスタム項目の宣言をここで束ねるのは ADR-0087。
/**
 * The partition-bound resource accessors returned by {@link PortersClient.tenant}.
 * **This is the only way to reach a partition-scoped resource**: PORTERS requires
 * `partition` on every one of these calls, so the API makes you supply it exactly once, explicitly.
 * `C` is that partition's custom field catalog, from `tenant(id, { fields })`.
 * `auth` (App-level), the `partition` master (discovery — partition-less), and `tenant` itself
 * (no nesting) are deliberately absent: none of them takes a partition.
 */
export type TenantScope<C extends DeclaredCatalogs = EmptyCatalog> = {
  readonly candidate: CandidateResource<
    CustomFor<C, "candidate">,
    RequiredFor<C, "candidate">
  >;
  readonly job: JobResource<CustomFor<C, "job">, RequiredFor<C, "job">>;
  readonly client: ClientResource<
    CustomFor<C, "client">,
    RequiredFor<C, "client">
  >;
  readonly recruiter: RecruiterResource<
    CustomFor<C, "recruiter">,
    RequiredFor<C, "recruiter">
  >;
  readonly contact: ContactResource<
    CustomFor<C, "contact">,
    RequiredFor<C, "contact">
  >;
  readonly opportunity: OpportunityResource<
    CustomFor<C, "opportunity">,
    RequiredFor<C, "opportunity">
  >;
  readonly activity: ActivityResource<
    CustomFor<C, "activity">,
    RequiredFor<C, "activity">
  >;
  readonly contract: ContractResource<
    CustomFor<C, "contract">,
    RequiredFor<C, "contract">
  >;
  readonly sales: SalesResource<CustomFor<C, "sales">, RequiredFor<C, "sales">>;
  // of(resource) で束ねる形は ADR-0061 案2a。
  /**
   * Phase history, reached through the resource it belongs to: `t.phase.of("client")`.
   * PORTERS requires that `resource` on every Phase call, so it is bound once.
   */
  readonly phase: PhaseAccessor;
  readonly process: ProcessResource<
    CustomFor<C, "process">,
    RequiredFor<C, "process">
  >;
  readonly resume: ResumeResource<
    CustomFor<C, "resume">,
    RequiredFor<C, "resume">
  >;
  // of(resource) で束ねる形は ADR-0080、write 側の <Resource> も同じ値で埋めるのは ADR-0081。
  /**
   * Attachments, reached through the resource they belong to: `t.attachment.of("resume")`.
   * PORTERS requires that `resource` on every Attachment Read, and the same value fills the
   * `<Resource>` field on write, so it is bound once.
   */
  readonly attachment: AttachmentAccessor;
  readonly user: UserResource;
  /**
   * Department master Read (Connect API 8.2.1+): the user departments a department-typed Link field
   * or `User.P_Department` points at. Read-only, listed whole — no filter, no `get(id)`. Covered
   * by the `user_r` scope (PORTERS defines no `department_r`).
   */
  readonly department: DepartmentResource;
  // of(resource) で束ねる形は ADR-0080。
  /**
   * Field master Read, reached through the resource whose catalog you want:
   * `t.field.of("candidate")`. PORTERS requires `resource=` on every Field Read, so it is bound
   * once.
   */
  readonly field: FieldAccessor;
  readonly option: OptionResource;
};

// 既定 partition を持たない（ADR-0055）・宣言は tenant で受ける（ADR-0087）。

// tokenProvider の形を構築時に確かめる（ADR-0091）。古い形（getAccessToken だけ）を黙って
// 受けると、最初のリクエストまで壊れていることに気づけない。
const validateTokenProvider = (provider: unknown): void => {
  if (provider === undefined) return;
  const p = provider as Record<string, unknown> | null;
  if (typeof p !== "object" || p === null || typeof p.acquire !== "function") {
    const old =
      p !== null &&
      typeof p === "object" &&
      typeof p.getAccessToken === "function";
    throw new PortersConfigError(
      old
        ? "PortersClient: tokenProvider has getAccessToken but no acquire — the old custom-auth shape"
        : "PortersClient: tokenProvider must have an acquire() method",
      {
        category: "config",
        hint: "Pass { acquire: async () => ({ accessToken: { token, expiresAt? } }) }, optionally with refresh(current) and exchange(code). The client caches and renews for you.",
      },
    );
  }
  for (const name of ["refresh", "exchange"] as const) {
    if (p[name] !== undefined && typeof p[name] !== "function") {
      throw new PortersConfigError(
        `PortersClient: tokenProvider.${name} must be a function when given`,
        { category: "config", hint: `Remove ${name} or make it a method.` },
      );
    }
  }
};

/**
 * Entry point of the library. Wires the default transport / auth / throttle / requester and exposes
 * the **App-level** surface: `auth`, the `partition` master (discovery), and {@link PortersClient.tenant}.
 *
 * Everything that PORTERS scopes to a partition (Company DB) lives behind `tenant(id)` — see
 * {@link TenantScope}. The client holds no default partition and no custom field
 * declaration: both are bound explicitly, exactly once, at `tenant(id, { fields })`,
 * so "unbound" and "declared for some other tenant" are not states this API can be in.
 *
 * @example
 * const porters = new PortersClient({ hostname, appId, appSecret });
 * await porters.auth.ensureAuthenticated();   // App-level
 * const t = porters.tenant(123, { fields: myFields }); // bind the partition (and its fields) once
 * const page = await t.candidate.search();
 */
export class PortersClient {
  // OAuth 公開メソッドの範囲は ADR-0007 / ADR-0034。
  /** OAuth surface: initial browser grant, token warm-up/inspection, local revoke. */
  readonly auth: AuthApi;
  // マスタ Read の公開形は ADR-0021 / ADR-0022。
  /**
   * Master Read: the partitions this App can reach. Takes no `partition` itself —
   * it is how you *discover* the ids to pass to {@link PortersClient.tenant}.
   */
  readonly partition: PartitionResource;
  // tenant(id) の設計は ADR-0040 F-3 / ADR-0055、fields を受けるのは ADR-0087、
  // partition ごとに別トークンが要る場合は client を分ける（ADR-0008 案3）。
  /**
   * Bind a partition (Company DB) and get the accessors that route through it.
   * **Single-tenant apps use this too** — it is the only path to a partition-scoped resource.
   * Hold the scope once and use it like a client:
   *
   * ```ts
   * const t = porters.tenant(123);
   * await t.candidate.search();
   * ```
   *
   * That partition's custom fields are declared here as well, since PORTERS defines
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
   * per-partition token, construct a dedicated {@link PortersClient} per tenant.
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
        'PortersClient: "fields" is not a client option — custom fields belong to a partition',
        {
          category: "config",
          hint: "Declare them where you bind the partition: porters.tenant(id, { fields })",
        },
      );
    }
    // A pre-0.24 `auth` must not be ignored: the client would fall back to the built-in flow and
    // keep running on credentials the caller meant to replace (ADR-0091).
    if ((options as { auth?: unknown }).auth !== undefined) {
      throw new PortersConfigError(
        'PortersClient: "auth" is not a client option — pass a tokenProvider instead',
        {
          category: "config",
          hint: "Replace auth: { getAccessToken } with tokenProvider: { acquire: async () => ({ accessToken: { token } }) }. The client caches and renews the token for you.",
        },
      );
    }
    validateTokenProvider(options.tokenProvider);
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
    // Obtaining is the provider's; caching, renewal and persistence are the manager's, for every
    // provider (ADR-0091). `porters.auth` and the request pipeline share the one manager.
    const provider =
      options.tokenProvider ??
      createDefaultTokenProvider({
        accessPoint,
        appId: options.appId,
        appSecret: options.appSecret,
        transport,
      });
    const manager = createTokenManager({
      provider,
      tokenStore: options.tokenStore,
    });
    this.auth = createAuthApi({
      accessPoint,
      appId: options.appId,
      scopes: options.scopes,
      provider,
      manager,
    });
    const requester = createRequester({
      transport,
      auth: manager,
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

  /** The configured port, or `undefined` when the scheme's own port is used. */
  get port(): number | undefined {
    return this.#accessPoint.port;
  }
}
