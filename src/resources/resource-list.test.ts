import { describe, expect, expectTypeOf, it } from "vitest";

import {
  RESOURCE_VALUES,
  resourceNameOf,
  resourceValueOf,
  type ResourceName,
} from "./resource-list";

describe("RESOURCE_VALUES", () => {
  it("matches the Resource List (docs/usage/reference resources-list.md)", () => {
    expect(RESOURCE_VALUES).toEqual({
      candidate: 1,
      job: 3,
      client: 5,
      process: 7,
      recruiter: 9,
      sales: 11,
      contract: 13,
      resume: 17,
      activity: 19,
      opportunity: 25,
      contact: 27,
    });
  });

  it("covers every resource PORTERS gives a value, and no others", () => {
    // Phase / Attachment have no value in the Resource List, so they must not appear —
    // `of("phase")` has to stay a compile error.
    expect(Object.keys(RESOURCE_VALUES).sort()).toEqual([
      "activity",
      "candidate",
      "client",
      "contact",
      "contract",
      "job",
      "opportunity",
      "process",
      "recruiter",
      "resume",
      "sales",
    ]);
  });

  it("names the resources with their accessor spelling", () => {
    expectTypeOf<"client">().toExtend<ResourceName>();
    expectTypeOf<"phase">().not.toExtend<ResourceName>();
    expectTypeOf<"clinet">().not.toExtend<ResourceName>();
  });
});

// ADR-0079: 名前 ⇄ 数値の変換を公開する。**値の型は数値のまま**（項目の値は宣言した Data Type
// どおり）なので、名前で書きたい／読みたい場面をこの 2 つが担う。
describe("resourceValueOf / resourceNameOf（ADR-0079）", () => {
  it("名前から数値、数値から名前へ往復する", () => {
    for (const [name, value] of Object.entries(RESOURCE_VALUES)) {
      expect(resourceValueOf(name as ResourceName)).toBe(value);
      expect(resourceNameOf(value)).toBe(name);
    }
  });

  it("表に無い数値は、そのまま数値で返す（未知は壊さない）", () => {
    // Resource List は PORTERS が持っていて増える（Contact 27 が実例）。知らない値を
    // `undefined` にも例外にもしない — データとして通す。
    expect(resourceNameOf(29)).toBe(29);
    expect(resourceNameOf(0)).toBe(0);
    expect(resourceNameOf(-1)).toBe(-1);
  });

  it("欠番は名前にならない（1〜27 の連番ではない）", () => {
    // 6 / 8 / 15 は Resource List に無い。数値リテラルを書くと踏む穴そのもの。
    for (const gap of [2, 4, 6, 8, 10, 12, 15, 20, 26]) {
      expect(resourceNameOf(gap)).toBe(gap);
    }
  });

  it("返り値の型は `ResourceName | number`", () => {
    expectTypeOf(resourceNameOf(1)).toEqualTypeOf<ResourceName | number>();
    expectTypeOf(resourceValueOf("candidate")).toEqualTypeOf<number>();
  });
});
