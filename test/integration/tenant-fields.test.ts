// L1 integration for the tenant field tooling (ADR-0069). The unit tests drive `readCustomCatalog`
// with a stub; these go through the real path — Field Read over the fake transport, XML parsed and
// decoded by the library — so the `P_Alias` / `P_Type` handling is exercised as it will actually run.

import { describe, expect, it } from "vitest";

import { PortersClient } from "../../src/client";
import {
  assertFieldsMatch,
  defineFields,
  generateFieldDecls,
  readCustomCatalog,
  verifyFields,
} from "../../src/index";
import { createFakeTransport } from "../fake/index";
import type { FakeTransportOptions } from "../fake/types";

const setup = (options: FakeTransportOptions = {}) => {
  const fake = createFakeTransport(options);
  const porters = new PortersClient({
    host: "fake.test",
    appId: "app-id",
    appSecret: "app-secret",
    transport: fake,
  });
  return { fake, porters, t: porters.tenant(1) };
};

// What a tenant might actually have configured.
const TENANT: FakeTransportOptions = {
  customFields: {
    candidate: {
      U_score: "Number",
      U_source: "Option",
      A_importedAt: "DateTime",
    },
    job: { U_headcount: "Number" },
  },
  customFieldNames: {
    candidate: { U_score: "適性スコア", U_source: "流入経路" },
  },
};

describe("readCustomCatalog over a real Field Read", () => {
  it("picks the tenant's custom fields out of a response full of standard ones", async () => {
    const { t } = setup(TENANT);

    const catalog = await readCustomCatalog(t, "candidate");

    expect(catalog.fields).toEqual({
      U_score: "Number",
      U_source: "Option",
      A_importedAt: "DateTime",
    });
    // Candidate's standard fields are prefixed `Person.` and must not leak in.
    expect(Object.keys(catalog.fields).some((a) => a.startsWith("P_"))).toBe(
      false,
    );
    expect(catalog.undeclarable).toEqual([]);
  });

  it("collects P_Name without a second round trip", async () => {
    const { t } = setup(TENANT);

    const catalog = await readCustomCatalog(t, "candidate");

    expect(catalog.names.U_score).toBe("適性スコア");
  });

  it("returns an empty catalog for a resource with no custom fields", async () => {
    const { t } = setup();

    const catalog = await readCustomCatalog(t, "resume");

    expect(catalog.fields).toEqual({});
  });

  // RV-37 made Process selectable; `defineFields` accepts it, so the tooling must reach it too.
  it("reaches every resource defineFields accepts, Process included", async () => {
    const { t } = setup({ customFields: { process: { U_note: "Number" } } });

    const catalog = await readCustomCatalog(t, "process");

    expect(catalog.fields).toEqual({ U_note: "Number" });
  });
});

describe("verifyFields over a real Field Read", () => {
  it("passes a declaration that matches the tenant", async () => {
    const { t } = setup(TENANT);
    const fields = defineFields({
      candidate: (f) => ({
        U_score: f.number(),
        U_source: f.option(),
        A_importedAt: f.dateTime(),
      }),
      job: (f) => ({ U_headcount: f.number() }),
    });

    const report = await verifyFields(t, fields);

    expect(report.ok).toBe(true);
    expect(() => assertFieldsMatch(report)).not.toThrow();
  });

  it("catches the mismatch that would otherwise read back as null", async () => {
    const { t } = setup(TENANT);
    // U_source is an Option in the tenant; declaring it as text makes every read return null.
    const fields = defineFields({
      candidate: (f) => ({ U_source: f.singlelineText() }),
    });

    const report = await verifyFields(t, fields);

    expect(report.typeMismatch).toEqual([
      {
        resource: "candidate",
        alias: "U_source",
        declared: "SinglelineText",
        actual: "Option",
      },
    ]);
    expect(() => assertFieldsMatch(report)).toThrow(
      /candidate\.U_source: declared SinglelineText, tenant has Option/,
    );
  });

  it("reports a declared field the tenant does not have", async () => {
    const { t } = setup(TENANT);
    const fields = defineFields({ candidate: (f) => ({ U_gone: f.number() }) });

    const report = await verifyFields(t, fields);

    expect(report.missing).toEqual([
      { resource: "candidate", alias: "U_gone", declared: "Number" },
    ]);
  });

  it("lists tenant fields nobody declared without failing", async () => {
    const { t } = setup(TENANT);
    const fields = defineFields({ job: (f) => ({ U_headcount: f.number() }) });

    const report = await verifyFields(t, fields);

    expect(report.ok).toBe(true);
    expect(report.undeclared).toEqual([]);
  });
});

describe("generateFieldDecls over a real Field Read", () => {
  it("prints a declaration that matches what verifyFields then accepts", async () => {
    const { t } = setup(TENANT);

    const src = await generateFieldDecls(t, ["candidate", "job"]);

    expect(src).toContain("  candidate: (f) => ({");
    expect(src).toContain("    A_importedAt: f.dateTime(),");
    expect(src).toContain("    U_score: f.number(),");
    expect(src).toContain("    U_source: f.option(),");
    expect(src).toContain("  job: (f) => ({");
    expect(src).toContain("    U_headcount: f.number(),");

    // The round trip that matters: hand-writing exactly what was generated verifies clean.
    const fields = defineFields({
      candidate: (f) => ({
        A_importedAt: f.dateTime(),
        U_score: f.number(),
        U_source: f.option(),
      }),
      job: (f) => ({ U_headcount: f.number() }),
    });
    expect((await verifyFields(t, fields)).ok).toBe(true);
  });

  it("leaves the tenant's own wording out unless asked", async () => {
    const { t } = setup(TENANT);

    const plain = await generateFieldDecls(t, ["candidate"]);
    const named = await generateFieldDecls(t, ["candidate"], {
      includeNames: true,
    });

    expect(plain).not.toContain("適性スコア");
    expect(named).toContain("U_score: f.number(), // 適性スコア");
  });
});
