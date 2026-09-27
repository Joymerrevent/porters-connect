import { describe, expect, it } from "vitest";

import { PortersConfigError } from "../errors";
import { assertRecordId } from "./assert-record-id";

describe("assertRecordId", () => {
  it.each([1, 2, 10_001, Number.MAX_SAFE_INTEGER])("accepts %s", (id) => {
    expect(() => {
      assertRecordId(id, "update", "Candidate");
    }).not.toThrow();
  });

  it.each([
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
    "1",
    undefined,
    null,
  ])("refuses %s", (id) => {
    expect(() => {
      // JS の呼び出し側を模して、数でない値も渡す。
      assertRecordId(id as number, "update", "Candidate");
    }).toThrow(PortersConfigError);
  });

  it("names the method and the value, and says how to create instead", () => {
    let err: unknown;
    try {
      assertRecordId(-1, "update", "Candidate");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersConfigError);
    const e = err as PortersConfigError;
    expect(e.message).toBe(
      "Candidate.update: id must be a positive integer, got -1",
    );
    expect(e.category).toBe("config");
    expect(e.hint).toContain("create()");
    expect(e.context).toEqual({ resource: "Candidate", operation: "update" });
  });

  it("shows NaN and a string as they were passed", () => {
    expect(() => {
      assertRecordId(Number.NaN, "get", "Job");
    }).toThrow("Job.get: id must be a positive integer, got NaN");
    expect(() => {
      assertRecordId("1" as unknown as number, "get", "Job");
    }).toThrow('Job.get: id must be a positive integer, got "1"');
  });

  it("shows a value JSON cannot spell, such as undefined", () => {
    expect(() => {
      assertRecordId(undefined as unknown as number, "get", "Job");
    }).toThrow("Job.get: id must be a positive integer, got undefined");
  });
});

// BigInt を渡しても、メッセージを作るところで TypeError にせず PortersConfigError で止める（RV-126）。
it("refuses a BigInt id as a PortersConfigError", () => {
  expect(() =>
    assertRecordId(10001n as unknown as number, "get", "Candidate"),
  ).toThrow(
    expect.objectContaining({
      name: "PortersConfigError",
      message: "Candidate.get: id must be a positive integer, got 10001",
    }),
  );
});
