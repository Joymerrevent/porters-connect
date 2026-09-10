import { describe, expect, it } from "vitest";

import { PortersConfigError, PortersResourceError } from "../errors";
import type { Field } from "../resources/field";
import { defineFields } from "./define-fields";
import type { FieldCatalogSource } from "./tenant-catalog";
import { assertFieldsMatch, verifyFields } from "./verify-fields";

// Field Read stub keyed by resource, so a per-resource failure is expressible.
const sourceOf = (
  byResource: Readonly<Record<string, readonly Partial<Field>[] | Error>>,
): FieldCatalogSource => ({
  field: {
    searchAll: (query) => {
      const rows = byResource[query.resource] ?? [];
      let i = 0;
      return {
        [Symbol.asyncIterator]: () => ({
          next: () =>
            rows instanceof Error
              ? Promise.reject(rows)
              : Promise.resolve(
                  i < rows.length
                    ? { done: false as const, value: rows[i++] }
                    : { done: true as const, value: undefined },
                ),
        }),
      };
    },
  },
});

describe("verifyFields", () => {
  it("reports nothing when the declaration matches the tenant", async () => {
    const fields = defineFields({
      candidate: (f) => ({ U_score: f.number(), U_source: f.option() }),
    });
    const source = sourceOf({
      candidate: [
        { P_Alias: "Person.U_score", P_Type: 3 },
        { P_Alias: "Person.U_source", P_Type: 7 },
      ],
    });

    const report = await verifyFields(source, fields);

    expect(report.ok).toBe(true);
    expect(report).toMatchObject({
      missing: [],
      typeMismatch: [],
      undeclared: [],
      unverifiable: [],
      undeclarable: [],
    });
  });

  // The reason this whole thing exists: a mismatched type reads back as null, which looks
  // identical to an empty field.
  it("reports a Data Type mismatch — the failure that is otherwise silent", async () => {
    const fields = defineFields({
      candidate: (f) => ({ U_source: f.singlelineText() }),
    });
    const source = sourceOf({
      candidate: [{ P_Alias: "Person.U_source", P_Type: 7 }],
    });

    const report = await verifyFields(source, fields);

    expect(report.ok).toBe(false);
    expect(report.typeMismatch).toEqual([
      {
        resource: "candidate",
        alias: "U_source",
        declared: "SinglelineText",
        actual: "Option",
      },
    ]);
  });

  it("reports a declared field the tenant does not have", async () => {
    const fields = defineFields({ job: (f) => ({ U_gone: f.number() }) });
    const source = sourceOf({ job: [] });

    const report = await verifyFields(source, fields);

    expect(report.ok).toBe(false);
    expect(report.missing).toEqual([
      { resource: "job", alias: "U_gone", declared: "Number" },
    ]);
  });

  it("reports a tenant field nobody declared, without failing", async () => {
    const fields = defineFields({ job: (f) => ({ U_known: f.number() }) });
    const source = sourceOf({
      job: [
        { P_Alias: "Job.U_known", P_Type: 3 },
        { P_Alias: "Job.U_extra", P_Type: 1 },
      ],
    });

    const report = await verifyFields(source, fields);

    // Undeclared fields pass through untyped, which is the documented behaviour — not a problem.
    expect(report.ok).toBe(true);
    expect(report.undeclared).toEqual([
      { resource: "job", alias: "U_extra", actual: "SinglelineText" },
    ]);
  });

  it("checks only the resources that were declared", async () => {
    const fields = defineFields({ job: (f) => ({ U_known: f.number() }) });
    const source = sourceOf({
      job: [{ P_Alias: "Job.U_known", P_Type: 3 }],
      candidate: [{ P_Alias: "Person.U_other", P_Type: 3 }],
    });

    const report = await verifyFields(source, fields);

    expect(report.undeclared).toEqual([]);
  });

  describe("unverifiable is kept apart from missing (論点5)", () => {
    it("reports a resource whose catalog could not be read", async () => {
      const fields = defineFields({ job: (f) => ({ U_score: f.number() }) });
      const boom = new PortersResourceError("no permission", {
        category: "permission",
      });
      const source = sourceOf({ job: boom });

      const report = await verifyFields(source, fields);

      expect(report.ok).toBe(false);
      expect(report.unverifiable).toEqual([{ resource: "job", cause: boom }]);
      // The declaration must NOT be called missing — that would be a false alarm.
      expect(report.missing).toEqual([]);
    });

    it("still checks the resources it could read", async () => {
      const fields = defineFields({
        job: (f) => ({ U_score: f.number() }),
        client: (f) => ({ U_rank: f.number() }),
      });
      const source = sourceOf({
        job: new PortersResourceError("no permission", {
          category: "permission",
        }),
        client: [{ P_Alias: "Client.U_rank", P_Type: 7 }],
      });

      const report = await verifyFields(source, fields);

      expect(report.unverifiable).toHaveLength(1);
      expect(report.typeMismatch).toEqual([
        {
          resource: "client",
          alias: "U_rank",
          declared: "Number",
          actual: "Option",
        },
      ]);
    });
  });

  describe("fields that exist but cannot be declared (論点4)", () => {
    it("carries them through with their resource", async () => {
      const fields = defineFields({ job: (f) => ({ U_score: f.number() }) });
      const source = sourceOf({
        job: [
          { P_Alias: "Job.U_score", P_Type: 3 },
          { P_Alias: "Job.U_new", P_Type: 99 },
        ],
      });

      const report = await verifyFields(source, fields);

      expect(report.ok).toBe(true);
      expect(report.undeclarable).toEqual([
        {
          resource: "job",
          alias: "U_new",
          fieldType: 99,
          reason: "unknown-field-type",
        },
      ]);
    });

    // Declaring one of these is a mistake, but calling it "missing" would send the reader looking
    // for a field that is right there.
    it("does not call a declared-but-undeclarable field missing", async () => {
      const fields = defineFields({ job: (f) => ({ U_ref: f.number() }) });
      const source = sourceOf({ job: [{ P_Alias: "Job.U_ref", P_Type: 16 }] });

      const report = await verifyFields(source, fields);

      expect(report.missing).toEqual([]);
      expect(report.undeclarable).toEqual([
        {
          resource: "job",
          alias: "U_ref",
          fieldType: 16,
          label: "Reference",
          reason: "no-data-type",
        },
      ]);
    });
  });

  it("reads every field by default so unused ones are not called missing", async () => {
    const queries: unknown[] = [];
    const source: FieldCatalogSource = {
      field: {
        searchAll: (query) => {
          queries.push(query);
          return {
            [Symbol.asyncIterator]: () => ({
              next: () =>
                Promise.resolve({ done: true as const, value: undefined }),
            }),
          };
        },
      },
    };

    await verifyFields(source, defineFields({ job: () => ({}) }));

    expect(queries).toEqual([{ resource: "job", active: -1 }]);
  });

  it("passes an explicit active through", async () => {
    const queries: unknown[] = [];
    const source: FieldCatalogSource = {
      field: {
        searchAll: (query) => {
          queries.push(query);
          return {
            [Symbol.asyncIterator]: () => ({
              next: () =>
                Promise.resolve({ done: true as const, value: undefined }),
            }),
          };
        },
      },
    };

    await verifyFields(source, defineFields({ job: () => ({}) }), {
      active: 1,
    });

    expect(queries).toEqual([{ resource: "job", active: 1 }]);
  });

  it("accepts a plain catalog map, not only a branded declaration", async () => {
    const source = sourceOf({ job: [{ P_Alias: "Job.U_score", P_Type: 3 }] });

    const report = await verifyFields(source, { job: { U_score: "Number" } });

    expect(report.ok).toBe(true);
  });
});

describe("assertFieldsMatch", () => {
  it("returns quietly on a clean report", () => {
    expect(() =>
      assertFieldsMatch({
        ok: true,
        missing: [],
        typeMismatch: [],
        undeclared: [],
        unverifiable: [],
        undeclarable: [],
      }),
    ).not.toThrow();
  });

  it("throws a PortersConfigError naming each mismatched field", () => {
    const report = {
      ok: false,
      missing: [
        {
          resource: "job" as const,
          alias: "U_gone",
          declared: "Number" as const,
        },
      ],
      typeMismatch: [
        {
          resource: "candidate" as const,
          alias: "U_source",
          declared: "SinglelineText" as const,
          actual: "Option" as const,
        },
      ],
      undeclared: [],
      unverifiable: [],
      undeclarable: [],
    };

    expect(() => assertFieldsMatch(report)).toThrow(PortersConfigError);
    try {
      assertFieldsMatch(report);
      expect.unreachable();
    } catch (e) {
      const err = e as PortersConfigError;
      expect(err.category).toBe("config");
      expect(err.message).toContain(
        "candidate.U_source: declared SinglelineText, tenant has Option",
      );
      expect(err.message).toContain(
        "job.U_gone: declared Number, not in the tenant",
      );
      expect(err.hint).toContain("generateFieldDecls");
    }
  });

  // "We could not check" is not "everything is fine" — passing it silently would defeat the
  // point of calling assert at all.
  it("throws when a resource could not be read", () => {
    const report = {
      ok: false,
      missing: [],
      typeMismatch: [],
      undeclared: [],
      unverifiable: [
        { resource: "job" as const, cause: new Error("403 forbidden") },
      ],
      undeclarable: [],
    };

    expect(() => assertFieldsMatch(report)).toThrow(
      /job: could not read the field catalog/,
    );
  });

  it("does not throw for undeclared or undeclarable alone", () => {
    expect(() =>
      assertFieldsMatch({
        ok: true,
        missing: [],
        typeMismatch: [],
        undeclared: [
          {
            resource: "job",
            alias: "U_extra",
            actual: "Number",
          },
        ],
        unverifiable: [],
        undeclarable: [
          {
            resource: "job",
            alias: "U_new",
            fieldType: 99,
            reason: "unknown-field-type",
          },
        ],
      }),
    ).not.toThrow();
  });
});
