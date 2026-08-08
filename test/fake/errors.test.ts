// The error vocabulary (ADR-0043 phase 4): the fake has to produce envelopes that are
// *interchangeable* with the reference's own error examples, and the whole documented Result Code
// catalogue has to reach the caller as the category ADR-0006 promises.
//
// The fixtures under `test/fixtures/errors/**` are the reference shapes; the assertions below check
// the fake against them rather than against a hand-written expectation of the fake's own output.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { PortersError } from "../../src/errors/index";
import {
  parseAuthentication,
  parseResourcePage,
  parseWriteResult,
} from "../../src/xml/parser";
import {
  buildAuthenticationXml,
  buildResourceErrorXml,
  buildWriteResultXml,
} from "./wire";

const fixture = (path: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../fixtures/${path}`, import.meta.url)),
    "utf8",
  );

// The error a body produces when the library parses it — the only thing a caller ever sees.
const resourceFailure = (body: string): PortersError => {
  try {
    parseResourcePage(body);
    throw new Error("expected the envelope to fail");
  } catch (error) {
    if (error instanceof PortersError) return error;
    throw error;
  }
};

const authFailure = (body: string): PortersError => {
  try {
    parseAuthentication(body);
    throw new Error("expected the envelope to fail");
  } catch (error) {
    if (error instanceof PortersError) return error;
    throw error;
  }
};

const shape = (error: PortersError) => ({
  name: error.name,
  code: error.code,
  category: error.category,
  retryable: error.retryable,
});

describe("the fake's error envelopes match the reference fixtures", () => {
  const cases = [
    { fixture: "errors/resource-403.xml", code: 403 },
    { fixture: "errors/resource-401.xml", code: 401 },
    { fixture: "errors/resource-124.xml", code: 124 },
    { fixture: "errors/resource-1000.xml", code: 1000 },
  ];

  it.each(cases)(
    "produces the same typed error as $fixture",
    ({ fixture: path, code }) => {
      const fromFixture = resourceFailure(fixture(path));
      const fromFake = resourceFailure(
        buildResourceErrorXml("Candidate", code, "whatever the message says"),
      );

      expect(shape(fromFake)).toEqual(shape(fromFixture));
    },
  );

  it("produces the same per-item outcomes as the partial-write fixture", () => {
    const fromFixture = parseWriteResult(
      fixture("candidate/write-partial.xml"),
    );
    const fromFake = parseWriteResult(
      buildWriteResultXml("Candidate", [
        { id: 10001, code: 0 },
        { id: 0, code: 133 },
      ]),
    );

    expect(fromFake).toEqual(fromFixture);
  });

  it.each([
    { fixture: "errors/auth-103.xml", error: 103 },
    { fixture: "errors/auth-401.xml", error: 401 },
  ])(
    "produces the same typed authentication error as $fixture",
    ({ fixture: path, error }) => {
      const fromFixture = authFailure(fixture(path));
      const fromFake = authFailure(
        buildAuthenticationXml({ Error: String(error), Message: "whatever" }),
      );

      expect(shape(fromFake)).toEqual(shape(fromFixture));
    },
  );
});

describe("Result Code catalogue -> category", () => {
  // Every code docs/reference/resource-api/result-codes.md lists, with the category ADR-0006 maps
  // it to. Driving them through the fake's envelope proves the fake can *raise* each of them and
  // that the classification survives the round-trip.
  const catalogue: [number, string][] = [
    [5, "unknown"], // ユーザー ID 無効 (uncategorised by ADR-0006)
    [6, "permission"],
    [7, "notFound"],
    [8, "validation"],
    [9, "transient"],
    [100, "validation"],
    [101, "validation"],
    [102, "validation"],
    [103, "validation"],
    [116, "validation"],
    [124, "validation"],
    [126, "validation"],
    [127, "validation"],
    [133, "validation"],
    [146, "validation"],
    [301, "conflict"],
    [302, "transient"],
    [303, "conflict"],
    [304, "conflict"],
    [400, "permission"],
    [401, "auth"],
    [402, "auth"],
    [403, "permission"],
    [404, "notFound"],
    [406, "permission"],
    [500, "validation"],
    [601, "permission"],
    [1000, "server"],
  ];

  it.each(catalogue)("code %i -> category %s", (code, category) => {
    const error = resourceFailure(
      buildResourceErrorXml("Candidate", code, `code ${code}`),
    );

    expect(error.category).toBe(category);
    expect(error.code).toBe(code);
    // Only the transient codes are worth retrying (ADR-0006 / result-codes.md).
    expect(error.retryable).toBe(category === "transient");
  });

  it("keeps an undocumented code visible rather than swallowing it", () => {
    const error = resourceFailure(
      buildResourceErrorXml("Candidate", 9999, "brand new code"),
    );

    expect(error.category).toBe("unknown");
    expect(error.code).toBe(9999);
  });
});

describe("Authentication error family", () => {
  // A different numbering from the Resource codes — 401 means "refresh expired" here, not
  // "access token expired" (docs/reference authentication-api/errors.md).
  const catalogue: [number, string][] = [
    [100, "validation"],
    [102, "validation"],
    [103, "auth"],
    [104, "auth"],
    [105, "auth"],
    [107, "auth"],
    [108, "server"],
    [110, "validation"],
    [111, "permission"],
    [112, "validation"],
    [114, "auth"],
    [115, "permission"],
    [116, "permission"],
    [117, "auth"],
    [400, "auth"],
    [401, "auth"],
    [402, "permission"],
  ];

  it.each(catalogue)("error %i -> category %s", (error, category) => {
    const failure = authFailure(
      buildAuthenticationXml({
        Error: String(error),
        Message: `error ${error}`,
      }),
    );

    expect(failure.category).toBe(category);
    expect(failure.name).toBe("PortersAuthError");
    expect(failure.retryable).toBe(false);
  });
});
