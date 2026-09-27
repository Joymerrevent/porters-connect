// The Data Types a custom U_/A_ field may declare (ADR-0023 D3 / ADR-0064 案5a).

import type { DataType } from "../porters/data-type";

// Data Types a custom U_/A_ field may declare (ADR-0023 D3): the value-shaped types. The
// System family (System[Id]/[DateTime]/[Reference]) is system-managed = standard territory,
// so it is not offered. Image / Link are here (ADR-0064 案5a) and **only** here: no standard
// field carries either type, so declaring one is the only way a tenant's image / link field
// can be read or written at all.
export const CUSTOM_DATA_TYPES = [
  "Number",
  "SinglelineText",
  "MultilineText",
  "Mail",
  "Telephone",
  "URL",
  "Date",
  "DateTime",
  "Age",
  "Option",
  "User",
  "Image",
  "Link",
] as const satisfies readonly DataType[];

export type CustomDataType = (typeof CUSTOM_DATA_TYPES)[number];
