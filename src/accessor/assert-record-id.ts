// The id a caller passes to update / get / getMany: PORTERS numbers records from 1, and `-1` in
// the id field of a Write means "create a new record" (write-format). An id that is not a positive
// safe integer is refused before anything is sent — `update(-1)` would otherwise create a record,
// and `get(NaN)` would send `eq=NaN` and read as "not found" (RV-67 / RV-74).

import { PortersConfigError } from "../errors";

// 数は String で書く（JSON.stringify は NaN / Infinity を "null" にし、渡した値と違って見える）。
const shown = (value: unknown): string =>
  typeof value === "number"
    ? String(value)
    : (JSON.stringify(value) ?? String(value));

/** Refuse an id that is not a positive safe integer, naming the method that received it. */
export const assertRecordId = (
  // JS から文字列などが来ても、Number.isSafeInteger が false を返すので拒否される。
  id: number,
  method: string,
  resource: string,
): void => {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new PortersConfigError(
      `${resource}.${method}: id must be a positive integer, got ${shown(id)}`,
      {
        category: "config",
        hint: "Pass the record's id (1 or more). To create a record, use create() — an id of -1 would create one instead of updating.",
        context: { resource, operation: method },
      },
    );
  }
};
