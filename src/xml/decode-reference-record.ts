// Decoding an expanded `System[Reference]` node into the referenced record (ADR-0058).

import { bareAlias } from "../util/alias";
import type { DataType } from "../porters/data-type";
import { asRecord } from "./as-record";
import { decodeField } from "./decode-field";
import type { ReferenceRecord } from "./field-value";

/**
 * Decode an **expanded** `System[Reference]` node (`field=Job.P_Client(Client.P_Id,Client.P_Name)`)
 * into the referenced record, using the referenced resource's catalog (ADR-0058).
 *
 * `types` is handed in rather than looked up: `xml/` must not depend on `resources/` (RV-8), and
 * this is also what keeps the decode **tag-independent** — the wrapper element is the referenced
 * resource (`<Client>`), which we neither know nor need here. That matters because the literal tag
 * is unconfirmed against the live API (LV-10); reading the first record-valued child means an
 * unexpected tag costs nothing. An alias outside the catalog decodes as a raw string, exactly as
 * an unknown alias does on the top-level record.
 */
export const decodeReferenceRecord = (
  raw: unknown,
  types: ReadonlyMap<string, DataType | null>,
): ReferenceRecord | null => {
  const outer = asRecord(raw);
  if (!outer) return null;
  for (const value of Object.values(outer)) {
    const inner = asRecord(value);
    if (!inner) continue;
    const out: ReferenceRecord = {};
    for (const [key, child] of Object.entries(inner)) {
      const alias = bareAlias(key);
      out[alias] = decodeField(types.get(alias) ?? null, child, alias);
    }
    return out;
  }
  return null;
};
