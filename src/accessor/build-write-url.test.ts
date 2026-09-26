import { describe, expect, it } from "vitest";

import { buildWriteUrl } from "./build-write-url";

describe("buildWriteUrl", () => {
  it("puts only the partition on the Write URL, at the access point", () => {
    expect(buildWriteUrl({ hostname: "h.test" }, 12, "candidate")).toBe(
      "https://h.test/v1/candidate?partition=12",
    );
  });
});
