/** OAuth scope string: `<resource>_r` (read) or `<resource>_w` (write). */
export type Scope = `${string}_r` | `${string}_w`;

/** A PORTERS partition (Company DB) id. */
export type PartitionId = number;

/**
 * URL scheme of the API access point (ADR-0047). `https` is the default; `http` is opt-in,
 * meant for a local fake server or a trusted tunnel, and always warns (see
 * `PortersClientOptions.scheme`).
 */
export type Scheme = "https" | "http";
