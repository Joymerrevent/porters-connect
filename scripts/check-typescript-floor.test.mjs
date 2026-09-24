import { describe, expect, it } from "vitest";

import {
  CONSUMER,
  MODES,
  judge,
  pickVersions,
} from "./check-typescript-floor.mjs";

describe("pickVersions", () => {
  const published = [
    "5.3.2",
    "5.3.3",
    "5.4.1-rc",
    "5.4.2",
    "5.4.5",
    "5.5.0-beta",
    "5.5.2",
    "6.0.3",
  ];

  it("takes the oldest stable release of the floor, and the newest stable one below it", () => {
    expect(pickVersions(published, "5.4")).toEqual({
      floor: "5.4.2",
      below: "5.3.3",
    });
  });

  it("ignores prereleases on both sides", () => {
    expect(pickVersions(["5.3.3", "5.4.0-rc", "5.4.3"], "5.4")).toEqual({
      floor: "5.4.3",
      below: "5.3.3",
    });
  });

  it("compares numerically, not as text", () => {
    expect(pickVersions(["5.9.3", "5.10.0", "5.10.1"], "5.10")).toEqual({
      floor: "5.10.0",
      below: "5.9.3",
    });
  });

  it("fails rather than silently skipping when a version is missing", () => {
    expect(() => pickVersions(["5.3.3"], "5.4")).toThrow(
      "TypeScript 5.4 の安定版が見つかりません",
    );
    expect(() => pickVersions(["5.4.2"], "5.4")).toThrow(
      "TypeScript 5.4 より前の安定版が見つかりません",
    );
  });
});

describe("judge", () => {
  it("passes a clean compile when a pass is expected", () => {
    expect(
      judge({ expect: "pass", floor: "5.4", status: 0, output: "" }),
    ).toBeUndefined();
  });

  it("reports a failed compile when a pass is expected", () => {
    expect(
      judge({ expect: "pass", floor: "5.4", status: 2, output: "boom" }),
    ).toContain("boom");
  });

  it("requires the message when a failure is expected", () => {
    expect(
      judge({
        expect: "fail",
        floor: "5.4",
        status: 2,
        output:
          "Type '\"@joymerrevent/porters-connect requires TypeScript 5.4 or later\"' has no construct signatures.",
      }),
    ).toBeUndefined();
    expect(
      judge({
        expect: "fail",
        floor: "5.4",
        status: 2,
        output: "Cannot find name 'NoInfer'.",
      }),
    ).toContain("の文言がありません");
    expect(
      judge({ expect: "fail", floor: "5.4", status: 0, output: "" }),
    ).toContain("向け先が効いていません");
  });
});

describe("the consumer and the modes", () => {
  it("covers the four resolution modes", () => {
    expect(MODES.map((m) => m.name)).toEqual([
      "bundler",
      "node16-esm",
      "node16-cjs",
      "node",
    ]);
  });

  it("keeps lines that must fail, so types collapsing to `any` cannot pass unnoticed", () => {
    expect(CONSUMER.match(/@ts-expect-error/g)?.length).toBeGreaterThanOrEqual(
      3,
    );
  });
});
