// The catalogs the response decoder needs for an expanded read (ADR-0058).

import type { DataType } from "../porters/data-type";
import { fieldTypesOf } from "./catalog";
import type { ReferenceMap, ExpandSelection } from "./expand";
import { selectedExpansions } from "./selected-expansions";

/**
 * The catalogs the response decoder needs: expanded alias -> the referenced resource's Data-Type
 * map. Built per call because it depends on what this query asked to expand; a read that expands
 * nothing gets `undefined` and reuses the resource's cached decoder.
 */
export const expansionCatalogs = (
  expand: ExpandSelection | undefined,
  references: ReferenceMap,
): ReadonlyMap<string, ReadonlyMap<string, DataType | null>> | undefined => {
  const selected = selectedExpansions(expand, references);
  return selected.length === 0
    ? undefined
    : new Map(
        selected.map(([alias, target]) => [alias, fieldTypesOf(target.fields)]),
      );
};
