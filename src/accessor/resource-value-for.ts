// The number `of(name)` binds: PORTERS reads it from `resource=` and from the write's `Resource`
// field. The name is typed, but a JS caller gets past the type, and a name missing from the table
// would send `resource=undefined` (RV-113). It is refused before anything is sent.

import { PortersConfigError } from "../errors";
import { RESOURCE_VALUES, type ResourceName } from "../porters/resource-list";

/** The Resource List value for `name`, or a {@link PortersConfigError} naming the accessor. */
export const resourceValueFor = (
  accessor: string,
  name: ResourceName,
): number => {
  // in 演算子は prototype もたどる（"toString" が通る）ので、自分のプロパティだけを見る。
  if (!Object.hasOwn(RESOURCE_VALUES, name)) {
    throw new PortersConfigError(
      `${accessor}.of: unknown resource ${JSON.stringify(name) ?? String(name)}`,
      {
        category: "config",
        hint: `Pass one of ${Object.keys(RESOURCE_VALUES).join(", ")}.`,
      },
    );
  }
  return RESOURCE_VALUES[name];
};
