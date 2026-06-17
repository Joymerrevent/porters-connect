// PortersError hierarchy (ADR-0006): source-split subclasses + a cross-cutting
// `category`. Never swallow errors; always surface a PortersError.

/** Cross-cutting classification shared by every PORTERS error. */
export type ErrorCategory =
  | "auth"
  | "permission"
  | "validation"
  | "notFound"
  | "conflict"
  // 予約（現状どの分類関数も produce しない）。PORTERS はレート超過時に判別可能なコードを
  // 返さず接続を切るため、強制切断は PortersNetworkError（category "network"）として表面化する。
  // 将来 429 相当の判別手段が得られたら配線するため型には残す（RV-3）。
  | "rateLimit"
  | "transient"
  | "network"
  | "server"
  | "config"
  | "unknown";

/** Where the failing call was aimed (for self-service debugging). */
export type PortersErrorContext = {
  resource?: string;
  operation?: string;
  partition?: number;
};

/** Construction options for {@link PortersError}. */
export type PortersErrorOptions = {
  category: ErrorCategory;
  /** PORTERS raw code; `null` for network/transport failures. */
  code?: number | null;
  retryable?: boolean;
  /** Actionable hint (English by default). */
  hint?: string;
  httpStatus?: number;
  context?: PortersErrorContext;
  cause?: unknown;
};

/** Base class for every PORTERS-originated error (catch-all). */
export class PortersError extends Error {
  readonly category: ErrorCategory;
  readonly code: number | null;
  readonly retryable: boolean;
  readonly hint?: string;
  readonly httpStatus?: number;
  readonly context?: PortersErrorContext;

  constructor(message: string, options: PortersErrorOptions) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = new.target.name;
    this.category = options.category;
    this.code = options.code ?? null;
    this.retryable = options.retryable ?? false;
    this.hint = options.hint;
    this.httpStatus = options.httpStatus;
    this.context = options.context;
  }
}

/** OAuth / Token errors. */
export class PortersAuthError extends PortersError {}

/** Resource API errors. */
export class PortersResourceError extends PortersError {}

/** Connection / timeout / forced rate-limit disconnect. */
export class PortersNetworkError extends PortersError {}

/** Misconfiguration / misuse — not PORTERS-originated; thrown synchronously. */
export class PortersConfigError extends PortersError {}
