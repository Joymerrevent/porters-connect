import { describe, expect, it } from "vitest";

import { PortersResourceError } from "../errors";
import { firstWriteResultId } from "./first-write-result-id";

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
      "write returned 0 result items for one record",
    );
    expect((error as PortersResourceError).category).toBe("unknown");
    expect((error as PortersResourceError).context).toEqual({
      resource: "Candidate",
    });
  });

  // RV-70。1 件だけ書いたのに結果が 2 件あれば、どれが自分の結果か分からない。
  it("refuses a response with more than one result Item for one record", () => {
    expect(() =>
      firstWriteResultId(
        `<Candidate><Item><Id>1</Id><Code>0</Code></Item><Item><Id>2</Id><Code>0</Code></Item></Candidate>`,
        "candidate",
        "Candidate",
      ),
    ).toThrow("write returned 2 result items for one record");
  });
});
