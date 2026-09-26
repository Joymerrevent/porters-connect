import { describe, expect, it } from "vitest";

import { PortersConfigError } from "../errors";
import { readUrlOf } from "./page-url";

describe("readUrlOf", () => {
  it("adds this page's count / start to a copy of the shared parameters", () => {
    const base = new URLSearchParams({ partition: "12" });
    expect(readUrlOf({ hostname: "h.test" }, "widget", base, 5, 10)).toBe(
      "https://h.test/v1/widget?partition=12&count=5&start=10",
    );
    // The shared parameters are not touched, so one base serves every page.
    expect(base.toString()).toBe("partition=12");
  });

  it("rejects a count outside PORTERS' range before anything is built", () => {
    expect(() =>
      readUrlOf({ hostname: "h.test" }, "widget", new URLSearchParams(), 0),
    ).toThrow(PortersConfigError);
  });
});
