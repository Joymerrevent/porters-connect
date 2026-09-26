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
    const results = parseWriteResult(fixture("candidate/write-result.xml"));
    expect(results).toEqual([{ id: 10001, code: 0 }]);
  });

  it("preserves per-Item results and order for a bulk write", () => {
    const results = parseWriteResult(
      `<Candidate><Item><Id>10001</Id><Code>0</Code></Item>` +
        `<Item><Id>0</Id><Code>301</Code></Item></Candidate>`,
    );
    // a non-zero Code is returned, not thrown — the accessor applies the policy
    expect(results).toEqual([
      { id: 10001, code: 0 },
      { id: 0, code: 301 },
    ]);
  });

  it("defaults a missing Id / Code (and a non-record Item) to 0", () => {
    const results = parseWriteResult(`<Candidate><Item/></Candidate>`);
    expect(results).toEqual([{ id: 0, code: 0 }]);
  });

  it("surfaces unparseable XML as PortersResourceError(unknown)", () => {
    let err: unknown;
    try {
      parseWriteResult("plain text");
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
      parseWriteResult(fixture("errors/write-root-102.xml"));
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
      ),
    ).toThrow(expect.objectContaining({ code: 403, category: "permission" }));
  });

  it("leaves the success path alone: root <Code>0 and no root <Code> both parse", () => {
    expect(
      parseWriteResult(
        `<Candidate><Code>0</Code><Item><Id>10001</Id><Code>0</Code></Item></Candidate>`,
      ),
    ).toEqual([{ id: 10001, code: 0 }]);
    // The documented success shape has no root <Code> at all.
    expect(
      parseWriteResult(
        `<Candidate><Item><Id>10001</Id><Code>0</Code></Item></Candidate>`,
      ),
    ).toEqual([{ id: 10001, code: 0 }]);
  });
});
