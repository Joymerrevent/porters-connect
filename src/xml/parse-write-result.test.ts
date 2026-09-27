import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { PortersResourceError } from "../errors/index";
import { parseWriteResult } from "./parse-write-result";

const fixture = (path: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../../test/fixtures/${path}`, import.meta.url)),
    "utf8",
  );

describe("parseWriteResult (ADR-0011)", () => {
  it("reads per-Item Id and Code from a Write response", () => {
    const results = parseWriteResult(
      fixture("candidate/write-result.xml"),
      "Candidate",
    );
    expect(results).toEqual([{ id: 10001, code: 0 }]);
  });

  it("preserves per-Item results and order for a bulk write", () => {
    const results = parseWriteResult(
      `<Candidate><Item><Id>10001</Id><Code>0</Code></Item>` +
        `<Item><Id>0</Id><Code>301</Code></Item></Candidate>`,
      "Candidate",
    );
    // a non-zero Code is returned, not thrown — the accessor applies the policy
    expect(results).toEqual([
      { id: 10001, code: 0 },
      { id: 0, code: 301 },
    ]);
  });

  // RV-70。Item の Code が無い応答や、成功した Item に Id が無い応答を、成功や id 0 として読まない。
  it.each([
    ["an Item with no Code", `<Candidate><Item><Id>5</Id></Item></Candidate>`],
    [
      "a successful Item with no Id",
      `<Candidate><Item><Code>0</Code></Item></Candidate>`,
    ],
    [
      "a successful Item whose Id is 0",
      `<Candidate><Item><Id>0</Id><Code>0</Code></Item></Candidate>`,
    ],
    [
      "a successful Item whose Id is not a number",
      `<Candidate><Item><Id>abc</Id><Code>0</Code></Item></Candidate>`,
    ],
    ["a non-record Item", `<Candidate><Item/></Candidate>`],
    [
      "a successful Item whose Id has trailing text",
      `<Candidate><Item><Id>12x</Id><Code>0</Code></Item></Candidate>`,
    ],
    [
      "a successful Item whose Id has leading text",
      `<Candidate><Item><Id>x12</Id><Code>0</Code></Item></Candidate>`,
    ],
    [
      "an Item Code that is not a number",
      `<Candidate><Item><Id>5</Id><Code>abc</Code></Item></Candidate>`,
    ],
  ])("refuses %s", (_label, xml) => {
    let err: unknown;
    try {
      parseWriteResult(xml, "Candidate");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersResourceError);
    expect((err as PortersResourceError).message).toBe(
      "unparseable write response",
    );
    expect((err as PortersResourceError).context).toEqual({
      resource: "Candidate",
    });
    expect((err as PortersResourceError).hint).toContain("middlebox");
  });

  // RV-87。要素の属性は読まないので、属性付きの Code もその値として読む（失敗の Code が成功に化けない）。
  it("reads an Item Code that carries an attribute by its value", () => {
    expect(
      parseWriteResult(
        `<Candidate><Item><Id>5</Id><Code type="e">103</Code></Item></Candidate>`,
        "Candidate",
      ),
    ).toEqual([{ id: 5, code: 103 }]);
  });

  it("reads an Id with surrounding whitespace", () => {
    expect(
      parseWriteResult(
        `<Candidate><Item><Id> 10001 </Id><Code>0</Code></Item><Item><Id> -1 </Id><Code>107</Code></Item></Candidate>`,
        "Candidate",
      ),
    ).toEqual([
      { id: 10001, code: 0 },
      { id: -1, code: 107 },
    ]);
  });

  it("reads a failed Item's Id as 0 when it is not a whole number", () => {
    expect(
      parseWriteResult(
        `<Candidate><Item><Id>12x</Id><Code>107</Code></Item><Item><Id>x12</Id><Code>107</Code></Item></Candidate>`,
        "Candidate",
      ),
    ).toEqual([
      { id: 0, code: 107 },
      { id: 0, code: 107 },
    ]);
  });

  it("reads a failed Item's Id as it came, or 0 when it is not a number", () => {
    expect(
      parseWriteResult(
        `<Candidate><Item><Id>-1</Id><Code>107</Code></Item><Item><Code>133</Code></Item></Candidate>`,
        "Candidate",
      ),
    ).toEqual([
      { id: -1, code: 107 },
      { id: 0, code: 133 },
    ]);
  });

  it("refuses a response whose root is another resource (ADR-0051 on the write side)", () => {
    let err: unknown;
    try {
      parseWriteResult(
        `<Job><Item><Id>5</Id><Code>0</Code></Item></Job>`,
        "Candidate",
      );
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersResourceError);
    expect((err as PortersResourceError).message).toBe(
      "write response root is <Job>, expected <Candidate>",
    );
    expect((err as PortersResourceError).category).toBe("unknown");
    expect((err as PortersResourceError).hint).toContain("middlebox");
    expect((err as PortersResourceError).context).toEqual({
      resource: "Candidate",
    });
  });

  it("surfaces unparseable XML as PortersResourceError(unknown)", () => {
    let err: unknown;
    try {
      parseWriteResult("plain text", "Candidate");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersResourceError);
    expect((err as PortersResourceError).category).toBe("unknown");
    expect((err as PortersResourceError).message).toBe(
      "unparseable write response",
    );
  });

  it("throws the root <Code> of a request-level failure (ADR-0045)", () => {
    // The whole request was rejected, so there is no <Item> to carry the reason — exactly the
    // response whose Result Code used to be lost as "no result item" (RV-14).
    let err: unknown;
    try {
      parseWriteResult(fixture("errors/write-root-102.xml"), "Candidate");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersResourceError);
    expect((err as PortersResourceError).code).toBe(102);
    expect((err as PortersResourceError).category).toBe("validation");
    expect((err as PortersResourceError).message).toBe(
      "write returned code 102",
    );
    expect((err as PortersResourceError).context).toEqual({
      resource: "Candidate",
      operation: "write",
    });
  });

  it("reads the root <Code> ahead of any <Item> that came with it", () => {
    // "Some items plus a root error" is the combination a per-item-only reader drops (ADR-0045 案B).
    expect(() =>
      parseWriteResult(
        `<Candidate><Code>403</Code><Item><Id>10001</Id><Code>0</Code></Item></Candidate>`,
        "Candidate",
      ),
    ).toThrow(expect.objectContaining({ code: 403, category: "permission" }));
  });

  it("leaves the success path alone: root <Code>0 and no root <Code> both parse", () => {
    expect(
      parseWriteResult(
        `<Candidate><Code>0</Code><Item><Id>10001</Id><Code>0</Code></Item></Candidate>`,
        "Candidate",
      ),
    ).toEqual([{ id: 10001, code: 0 }]);
    // The documented success shape has no root <Code> at all.
    expect(
      parseWriteResult(
        `<Candidate><Item><Id>10001</Id><Code>0</Code></Item></Candidate>`,
        "Candidate",
      ),
    ).toEqual([{ id: 10001, code: 0 }]);
  });
});
