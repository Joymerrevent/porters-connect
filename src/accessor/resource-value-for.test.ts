import { describe, expect, it } from "vitest";

import { PortersConfigError } from "../errors";
import { RESOURCE_VALUES, type ResourceName } from "../porters/resource-list";
import { resourceValueFor } from "./resource-value-for";

describe("resourceValueFor", () => {
  it("returns the Resource List value for every name", () => {
    for (const [name, value] of Object.entries(RESOURCE_VALUES)) {
      expect(resourceValueFor("phase", name as ResourceName)).toBe(value);
    }
  });

  // JS から渡された、表に無い名前（RV-113）。prototype のプロパティも名前として扱わない。
  it.each(["user", "Candidate", "toString", "", undefined, 1])(
    "refuses %j before anything is sent",
    (name) => {
      let err: unknown;
      try {
        resourceValueFor("attachment", name as ResourceName);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(PortersConfigError);
      expect((err as PortersConfigError).category).toBe("config");
      expect((err as PortersConfigError).message).toBe(
        `attachment.of: unknown resource ${JSON.stringify(name) ?? String(name)}`,
      );
      expect((err as PortersConfigError).hint).toBe(
        `Pass one of ${Object.keys(RESOURCE_VALUES).join(", ")}.`,
      );
    },
  );
});
