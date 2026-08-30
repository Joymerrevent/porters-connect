import { describe, expect, expectTypeOf, it } from "vitest";

import { RESOURCE_VALUES, type ResourceName } from "./resource-list";

describe("RESOURCE_VALUES", () => {
  it("matches the Resource List (docs/reference resources-list.md)", () => {
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
