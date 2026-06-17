// Public surface. Only what is exported here is part of the supported API.

export { PortersClient } from "./client";
export type { PortersClientOptions } from "./client";

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
export type { Transport, TransportRequest, TransportResponse } from "./http";
export type { PartitionId, Scope } from "./types";

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

export type { FieldValue, UserRef } from "./xml";

// Opt-in binary <-> Base64 helpers for Attachment content (ADR-0018).
export { base64ToBytes, bytesToBase64 } from "./util/base64";
