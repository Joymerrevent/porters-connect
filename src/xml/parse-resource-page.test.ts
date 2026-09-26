import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { PortersResourceError } from "../errors/index";
import { parseResourcePage } from "./parse-resource-page";

const fixture = (path: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../../test/fixtures/${path}`, import.meta.url)),
    "utf8",
  );

describe("parseResourcePage (ADR-0011)", () => {
  it("reads Total/Count/Start and Items as raw strings", () => {
    const page = parseResourcePage(
      fixture("candidate/read-basic.xml"),
      "Candidate",
    );
    expect(page.total).toBe(2);
    expect(page.count).toBe(2);
    expect(page.start).toBe(0);
    expect(page.items).toHaveLength(2);
    // raw string: no coercion at the parser layer
    expect(page.items[0]["Person.P_Id"]).toBe("10001");
  });

  it("normalizes a 0-item response to an empty array", () => {
    const page = parseResourcePage(
      fixture("candidate/read-empty.xml"),
      "Candidate",
    );
    expect(page.total).toBe(0);
    expect(page.items).toEqual([]);
  });

  it("reads non-zero Total/Count/Start from their own attributes", () => {
    // read-basic has Start="0", which can't distinguish the @_Start lookup from
    // the missing-attribute default — use non-zero values for all three.
    const page = parseResourcePage(
      `<Candidate Total="9" Count="3" Start="6"><Code>0</Code></Candidate>`,
      "Candidate",
    );
    expect(page.total).toBe(9);
    expect(page.count).toBe(3);
    expect(page.start).toBe(6);
  });

  it("trims surrounding whitespace from raw values", () => {
    const page = parseResourcePage(
      `<Candidate Total="1" Count="1" Start="0"><Code>0</Code><Item><A>  hi  </A></Item></Candidate>`,
      "Candidate",
    );
    expect(page.items[0].A).toBe("hi");
  });

  it("routes <Code>!=0 to a mapped PortersError (200+Code is an error)", () => {
    let err: unknown;
    try {
      parseResourcePage(fixture("errors/resource-403.xml"), "Candidate");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersResourceError);
    expect((err as PortersResourceError).code).toBe(403);
    expect((err as PortersResourceError).category).toBe("permission");
    expect((err as PortersResourceError).message).toBe(
      "resource returned code 403",
    );
    expect((err as PortersResourceError).context?.resource).toBe("Candidate");
  });

  it("surfaces unparseable XML as PortersResourceError(unknown)", () => {
    let err: unknown;
    try {
      parseResourcePage("plain text", "Candidate");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersResourceError);
    expect((err as PortersResourceError).category).toBe("unknown");
    expect((err as PortersResourceError).message).toBe(
      "unparseable resource response",
    );
  });

  // RV-71。Total が無い応答を 0 と読むと、searchAll が 1 ページで黙って止まる。Option 以外は読まない。
  it.each([
    [
      "Total",
      `<Candidate Count="1" Start="0"><Code>0</Code></Candidate>`,
      "null",
    ],
    [
      "Count",
      `<Candidate Total="1" Start="0"><Code>0</Code></Candidate>`,
      "null",
    ],
    [
      "Start",
      `<Candidate Total="1" Count="1"><Code>0</Code></Candidate>`,
      "null",
    ],
    [
      "Total",
      `<Candidate Total="abc" Count="1" Start="0"><Code>0</Code></Candidate>`,
      '"abc"',
    ],
    [
      "Start",
      `<Candidate Total="1" Count="1" Start="-1"><Code>0</Code></Candidate>`,
      '"-1"',
    ],
    [
      "Count",
      `<Candidate Total="1" Count="1x" Start="0"><Code>0</Code></Candidate>`,
      '"1x"',
    ],
  ])(
    "refuses a response whose %s attribute is missing or not a count",
    (name, xml, got) => {
      let err: unknown;
      try {
        parseResourcePage(xml, "Candidate");
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(PortersResourceError);
      const e = err as PortersResourceError;
      expect(e.message).toBe(
        `resource response has no valid ${name} attribute (got ${got})`,
      );
      expect(e.category).toBe("unknown");
      expect(e.hint).toContain("middlebox");
      expect(e.context).toEqual({ resource: "Candidate" });
    },
  );

  it("reads Option, whose response carries no page attributes, with them as 0", () => {
    const page = parseResourcePage(
      "<Option><Code>0</Code><Item><Option.P_Id>1</Option.P_Id></Item></Option>",
      "Option",
    );
    expect(page).toMatchObject({ total: 0, count: 0, start: 0 });
    expect(page.items).toHaveLength(1);
  });

  it("normalizes a non-record Item to an empty object", () => {
    const page = parseResourcePage(
      `<Candidate Total="1" Count="1" Start="0"><Code>0</Code><Item>txt</Item></Candidate>`,
      "Candidate",
    );
    expect(page.items).toEqual([{}]);
  });
});

// ADR-0051: an HTTP 200 whose body is not this resource's envelope must not read as an empty
// page. Silently returning `total: 0` is indistinguishable from "no data", and the caller's
// "get, and create if absent" pattern then writes a duplicate (RV-20). Every row below used to
// resolve as a normal 0-item (or, for <Job>, a 3-item) page.
describe("parseResourcePage: envelope identification (ADR-0051)", () => {
  const notOurs = (
    xml: string,
    resource = "Candidate",
  ): PortersResourceError => {
    let err: unknown;
    try {
      parseResourcePage(xml, resource);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersResourceError);
    const e = err as PortersResourceError;
    // Not PORTERS answering: no PORTERS code to report, and retrying can't help.
    expect(e.category).toBe("unknown");
    expect(e.code).toBeNull();
    expect(e.retryable).toBe(false);
    expect(e.context?.resource).toBe(resource);
    // The hint has to name both the suspect and where to look, or it isn't actionable.
    expect(e.hint).toContain("middlebox");
    expect(e.hint).toContain("PORTERS_HOST");
    return e;
  };

  it("rejects a captive portal / SSO login page (HTML on a 200)", () => {
    const err = notOurs(
      `<html><head><title>Sign in</title></head><body><h1>Wi-Fi</h1></body></html>`,
    );
    expect(err.message).toBe(
      "resource response root is <html>, expected <Candidate>",
    );
  });

  it("rejects a WAF notice that happens to be XML", () => {
    const err = notOurs(`<error><message>Request blocked</message></error>`);
    expect(err.message).toBe(
      "resource response root is <error>, expected <Candidate>",
    );
  });

  it("rejects an authentication envelope delivered on a resource path", () => {
    // Auth errors on the resource path arrive as <Candidate><Code>401</Code> instead, so an
    // <Authentication> body here means something else answered.
    const err = notOurs(`<Authentication><Error>401</Error></Authentication>`);
    expect(err.message).toBe(
      "resource response root is <Authentication>, expected <Candidate>",
    );
  });

  it("rejects another resource's valid envelope (would have read as 3 items)", () => {
    const err = notOurs(
      `<Job Total="3" Count="3" Start="0"><Code>0</Code><Item><Job.P_Id>1</Job.P_Id></Item></Job>`,
    );
    expect(err.message).toBe(
      "resource response root is <Job>, expected <Candidate>",
    );
  });

  it("rejects the right root without a <Code> (not a PORTERS envelope)", () => {
    const err = notOurs(
      `<Candidate><Item><Person.P_Id>1</Person.P_Id></Item></Candidate>`,
    );
    expect(err.message).toBe(
      "resource response has no <Code> (not a PORTERS envelope)",
    );
  });

  it("checks identity before value: a foreign root's <Code> is not ours to map", () => {
    // <Job><Code>403</Code> must not surface as a permission error for a Candidate read.
    const err = notOurs(`<Job><Code>403</Code></Job>`);
    expect(err.message).toBe(
      "resource response root is <Job>, expected <Candidate>",
    );
    expect(err.category).not.toBe("permission");
  });

  it("accepts an empty <Code/>: presence is the test, not the value", () => {
    // fast-xml-parser yields "" for an empty element; toInt("") is 0, so this stays a success.
    const page = parseResourcePage(
      `<Candidate Total="0" Count="0" Start="0"><Code/></Candidate>`,
      "Candidate",
    );
    expect(page.items).toEqual([]);
  });

  it("compares root names exactly (XML is case-sensitive)", () => {
    const err = notOurs(`<candidate><Code>0</Code></candidate>`);
    expect(err.message).toBe(
      "resource response root is <candidate>, expected <Candidate>",
    );
  });

  it("identifies each resource against its own expected root", () => {
    // The master reads pass their descriptor name; Option's envelope has no paging attributes
    // (ADR-0022 fact 5) — <Code> is what identifies it.
    expect(
      parseResourcePage(`<Option><Code>0</Code></Option>`, "Option").items,
    ).toEqual([]);
    expect(() =>
      parseResourcePage(`<Option><Code>0</Code></Option>`, "Field"),
    ).toThrow("resource response root is <Option>, expected <Field>");
  });
});
