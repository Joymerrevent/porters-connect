// Turning one Read item into a typed record: catalogued fields decode by their Data Type, expanded
// references decode to the referenced record, unknown aliases pass through. XML stays in xml/ —
// this only picks the decoder for each field.

import { bareAlias } from "../../util/alias";
import type { DataType } from "../../porters/data-type";
import {
  decodeField,
  decodeReferenceRecord,
  type FieldValue,
} from "../../xml/decode";
import type { RawItem } from "../../xml/parser";
import type { FieldCatalog, ReadRecord } from "./catalog";

/**
 * Build a catalog-driven item decoder: catalogued `P_` fields decode by their Data Type (`null` =
 * no Data Type -> raw string), unknown `U_`/`A_` aliases pass through (raw string, or null when
 * nested). `bareAlias` strips the `{prefix}.` so `Person.P_Name` and `P_Name` both hit the catalog.
 *
 * `expansions` names the aliases this read expanded (ADR-0058) and hands over the *referenced*
 * resource's catalog for each. Those fields decode to the referenced record instead of its id —
 * the only place the Data Type alone is not enough, because the catalog knows a field is a
 * reference but not what it refers to.
 */
export const decoderFor = <F extends FieldCatalog>(
  fields: F,
  expansions?: ReadonlyMap<string, ReadonlyMap<string, DataType | null>>,
): ((item: RawItem) => ReadRecord<F>) => {
  const fieldMap = new Map<string, DataType | null>(Object.entries(fields));
  return (item) => {
    const out: Record<string, FieldValue> = {};
    for (const [key, raw] of Object.entries(item)) {
      const alias = bareAlias(key);
      const expanded = expansions?.get(alias);
      if (expanded !== undefined) {
        out[alias] = decodeReferenceRecord(raw, expanded);
        continue;
      }
      // Catalog values are `DataType | null`, never undefined — so `undefined` here means
      // "not in the catalog" and only that. A catalogued `null` goes through `decodeField`,
      // which passes the raw string on (ADR-0056).
      const type = fieldMap.get(alias);
      out[alias] =
        type === undefined
          ? typeof raw === "string"
            ? raw
            : null
          : decodeField(type, raw, alias);
    }
    return out as ReadRecord<F>;
  };
};
