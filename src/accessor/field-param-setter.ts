// The `field` parameter as a setter, for a master resource (no references).

import { type FieldCatalog } from "./catalog";

// --- Read `field` assembly (ADR-0020) -------------------------------------------------------
import { fieldParamContext, fieldParam } from "./field-param";

/**
 * The `field` parameter of a master resource: {@link fieldParam} for a catalog with no references,
 * as a setter. Built once per catalog; the returned setter runs per query.
 */
export const createFieldParam = (
  prefix: string,
  fields: FieldCatalog,
): ((p: URLSearchParams, field: readonly string[] | undefined) => void) => {
  const ctx = fieldParamContext(prefix, fields);
  return (p, field) => {
    const value = fieldParam(ctx, { field });
    if (value !== undefined) p.set("field", value);
  };
};
