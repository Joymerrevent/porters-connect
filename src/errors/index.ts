// Barrel: re-exports the errors module. Implementation lives in named files.

export {
  PortersError,
  PortersAuthError,
  PortersResourceError,
  PortersNetworkError,
  PortersConfigError,
} from "./porters-error";
export type {
  ErrorCategory,
  PortersErrorContext,
  PortersErrorOptions,
} from "./porters-error";
export {
  authCategory,
  authError,
  networkError,
  resourceCategory,
  resourceError,
} from "./classify";
