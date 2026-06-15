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
  CandidateInput,
  CandidatePage,
  CandidateResource,
  CandidateSearchQuery,
} from "./resources";
export type {
  Job,
  JobInput,
  JobPage,
  JobResource,
  JobSearchQuery,
} from "./resources";
export type {
  Client,
  ClientInput,
  ClientPage,
  ClientResource,
  ClientSearchQuery,
} from "./resources";
export type {
  Process,
  ProcessInput,
  ProcessPage,
  ProcessResource,
  ProcessSearchQuery,
} from "./resources";
export type { FieldValue, UserRef } from "./xml";
