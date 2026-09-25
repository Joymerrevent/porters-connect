import { describe, expect, it } from "vitest";

import { PortersResourceError } from "../../errors";
import { buildWriteUrl, firstWriteResultId } from "./write";

describe("buildWriteUrl", () => {
  it("puts only the partition on the Write URL, at the access point", () => {
    expect(buildWriteUrl({ hostname: "h.test" }, 12, "candidate")).toBe(
      "https://h.test/v1/candidate?partition=12",
    );
  });
});

describe("firstWriteResultId", () => {
  it("returns the id of the first result Item", () => {
    const body = `<Candidate><Item><Id>10001</Id><Code>0</Code></Item></Candidate>`;
    expect(firstWriteResultId(body, "candidate", "Candidate")).toBe(10001);
  });

  it("maps a non-zero Code to a resource error naming the path and the resource", () => {
    const body = `<Candidate><Item><Id>-1</Id><Code>104</Code></Item></Candidate>`;
    let error: unknown;
    try {
      firstWriteResultId(body, "candidate", "Candidate");
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(PortersResourceError);
    const e = error as PortersResourceError;
    expect(e.message).toBe("candidate write returned code 104");
    expect(e.code).toBe(104);
    expect(e.context).toEqual({ resource: "Candidate" });
  });

  it("refuses a response with no result Item", () => {
    let error: unknown;
    try {
      firstWriteResultId(
        `<Candidate><Other>x</Other></Candidate>`,
        "candidate",
        "Candidate",
      );
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(PortersResourceError);
    expect((error as PortersResourceError).message).toBe(
      "write returned no result item",
    );
    expect((error as PortersResourceError).category).toBe("unknown");
  });
});
