// Public surface. Only what is exported here is part of the supported API.

export { PortersClient } from "./client";
// `TenantScope` is the partition-bound accessor bundle from `porters.tenant(id)` (ADR-0040 / F-3).
export type { PortersClientOptions, TenantScope } from "./client";

export {
  PortersError,
  PortersAuthError,
  PortersResourceError,
  PortersNetworkError,
  PortersConfigError,
} from "./errors";
export type {
  ErrorCategory,
  PortersErrorContext,
  PortersErrorOptions,
} from "./errors";

export type {
  GetAccessTokenOptions,
  StoredTokens,
  TokenProvider,
  TokenStore,
} from "./auth";
// OAuth public surface `porters.auth.*` (ADR-0007 SD-3/SD-6 / ADR-0034 F-1).
export type {
  AuthApi,
  AuthorizationUrlOptions,
  RevokeUrlOptions,
} from "./auth";
export type { Transport, TransportRequest, TransportResponse } from "./http";
// Mock transport for offline evaluation / unit tests (R-17 / ADR-0024).
export { createMockTransport } from "./http";
export type { MockHandler, MockReply, MockTransportOptions } from "./http";
// `Scheme` is the access-point URL scheme accepted by `PortersClientOptions.scheme` (ADR-0047).
export type { PartitionId, Scheme, Scope } from "./types";

// Custom field declaration DSL (R-16 / ADR-0023): declare tenant U_/A_ fields so they
// are typed and decode/encode by their declared Data Type.
export { defineFields } from "./fields";
export type {
  CustomDataType,
  DefinedFields,
  FieldBuilder,
  FieldDecls,
  FieldDef,
} from "./fields";
// Constraint types of the public generics (`PortersClient<C>` / `TenantScope<C>`). Exported so a
// helper that takes a client can name its type instead of relying on `typeof porters` (RV-30).
export type {
  CustomFieldResource,
  CustomFor,
  DeclaredCatalogs,
} from "./fields";

// Typed Read query surface shared by data resources (ADR-0038 / F-2): condition / order /
// keywords / itemstate. Per-resource `*SearchQuery` aliases below specialise `SearchQuery`.
// `ReadFieldAlias` is what `field` accepts — bare aliases, prefixed by the library (ADR-0059).
export type {
  Condition,
  ItemState,
  Order,
  ReadFieldAlias,
  SearchQuery,
} from "./resources";
// Bulk write result from createMany / updateMany (ADR-0041 / F-4).
export type { BulkWriteResult, BulkWriteResultItem } from "./resources";
// Reference expansion (ADR-0058): `expand` reads the referenced record's fields, not just its id.
// `ExpandedReadRecord` / `ResourcePageOf` name what a read with `expand` resolves to.
export type {
  Expand,
  ExpandedReadRecord,
  ReferenceMap,
  ResourcePageOf,
} from "./resources";

export type {
  Candidate,
  CandidateCreateInput,
  CandidateUpdateInput,
  CandidatePage,
  CandidateResource,
  CandidateSearchQuery,
} from "./resources";
export type {
  Job,
  JobCreateInput,
  JobUpdateInput,
  JobPage,
  JobResource,
  JobSearchQuery,
} from "./resources";
export type {
  Client,
  ClientCreateInput,
  ClientUpdateInput,
  ClientPage,
  ClientResource,
  ClientSearchQuery,
} from "./resources";
export type {
  Opportunity,
  OpportunityCreateInput,
  OpportunityUpdateInput,
  OpportunityPage,
  OpportunityResource,
  OpportunitySearchQuery,
} from "./resources";
export type {
  Contact,
  ContactCreateInput,
  ContactUpdateInput,
  ContactPage,
  ContactResource,
  ContactSearchQuery,
} from "./resources";
export type {
  Recruiter,
  RecruiterCreateInput,
  RecruiterUpdateInput,
  RecruiterPage,
  RecruiterResource,
  RecruiterSearchQuery,
} from "./resources";
export type {
  Process,
  ProcessCreateInput,
  ProcessUpdateInput,
  ProcessPage,
  ProcessResource,
  ProcessSearchQuery,
} from "./resources";
export type {
  Resume,
  ResumeCreateInput,
  ResumeUpdateInput,
  ResumePage,
  ResumeResource,
  ResumeSearchQuery,
} from "./resources";
export type {
  Attachment,
  AttachmentCreate,
  AttachmentPage,
  AttachmentResource,
  AttachmentSearchQuery,
  AttachmentUpdate,
} from "./resources";

// Master Read resources (read-only — ADR-0021/0022).
export type {
  Partition,
  PartitionPage,
  PartitionResource,
  PartitionSearchQuery,
} from "./resources";
export type {
  User,
  UserPage,
  UserResource,
  UserSearchQuery,
} from "./resources";
export type {
  Field,
  FieldPage,
  FieldResource,
  FieldSearchQuery,
  ResourceType,
} from "./resources";
export type { Option, OptionResource, OptionSearchQuery } from "./resources";

// `ReferenceRecord` is an expanded `System[Reference]` value (`expand` — ADR-0058).
export type { FieldValue, ReferenceRecord, UserRef } from "./xml";

// Opt-in binary <-> Base64 helpers for Attachment content (ADR-0018).
export { base64ToBytes, bytesToBase64 } from "./util/base64";
