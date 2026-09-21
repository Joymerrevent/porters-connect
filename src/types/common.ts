/** OAuth scope string: `<resource>_r` (read) or `<resource>_w` (write). */
export type Scope = `${string}_r` | `${string}_w`;

/** A PORTERS partition (Company DB) id. */
export type PartitionId = number;

// http を明示 opt-in にし、警告の抑止を別にする決定は ADR-0047。
/**
 * URL scheme of the API access point. `https` is the default; `http` is opt-in,
 * meant for a local fake server or a trusted tunnel, and always warns (see
 * `PortersClientOptions.scheme`).
 */
export type Scheme = "https" | "http";
