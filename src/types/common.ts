/** OAuth scope string: `<resource>_r` (read) or `<resource>_w` (write). */
export type Scope = `${string}_r` | `${string}_w`;

/** A PORTERS partition (Company DB) id. */
export type PartitionId = number;
