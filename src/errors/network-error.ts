// The error for a failure on the way to PORTERS (no PORTERS code; ADR-0006).

import { PortersNetworkError } from "./porters-error";

/** Build a PortersNetworkError (no PORTERS code; retryable for idempotent ops). */
export const networkError = (
  message: string,
  cause?: unknown,
): PortersNetworkError =>
  new PortersNetworkError(message, {
    category: "network",
    retryable: true,
    cause,
  });
