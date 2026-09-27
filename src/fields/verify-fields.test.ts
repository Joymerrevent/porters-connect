import { describe, expect, it } from "vitest";

import { PortersConfigError, PortersResourceError } from "../errors";
import type { Field } from "../resources/field";
import { defineFields } from "./define-fields";
import type { FieldCatalogSource } from "./read-custom-catalog";
import { assertFieldsMatch, verifyFields } from "./verify-fields";

// Field Read stub keyed by resource, so a per-resource failure is expressible.
const sourceOf = (
  byResource: Readonly<Record<string, readonly Partial<Field>[] | Error>>,
): FieldCatalogSource => ({
  field: {
    of: (resource) => ({
      searchAll: () => {
        const rows = byResource[resource] ?? [];
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
    }),
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

    // The exemption above is per alias. If it were not, a single undeclarable field in the
    // tenant would excuse every missing declaration on that resource.
    it("still reports a missing field when a different one is undeclarable", async () => {
      const fields = defineFields({ job: (f) => ({ U_gone: f.number() }) });
      const source = sourceOf({ job: [{ P_Alias: "Job.U_ref", P_Type: 16 }] });

      const report = await verifyFields(source, fields);

      expect(report.missing).toEqual([
        { resource: "job", alias: "U_gone", declared: "Number" },
      ]);
      expect(report.undeclarable).toHaveLength(1);
    });
  });

  it("reads every field by default so unused ones are not called missing", async () => {
    const queries: unknown[] = [];
    const source: FieldCatalogSource = {
      field: {
        of: (resource) => ({
          searchAll: (query) => {
            queries.push({ resource, query });
            return {
              [Symbol.asyncIterator]: () => ({
                next: () =>
                  Promise.resolve({ done: true as const, value: undefined }),
              }),
            };
          },
        }),
      },
    };

    await verifyFields(source, defineFields({ job: () => ({}) }));

    expect(queries).toEqual([{ resource: "job", query: { active: -1 } }]);
  });

  it("passes an explicit active through", async () => {
    const queries: unknown[] = [];
    const source: FieldCatalogSource = {
      field: {
        of: (resource) => ({
          searchAll: (query) => {
            queries.push({ resource, query });
            return {
              [Symbol.asyncIterator]: () => ({
                next: () =>
                  Promise.resolve({ done: true as const, value: undefined }),
              }),
            };
          },
        }),
      },
    };

    await verifyFields(source, defineFields({ job: () => ({}) }), {
      active: 1,
    });

    expect(queries).toEqual([{ resource: "job", query: { active: 1 } }]);
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
        requiredMismatch: [],
        declaredUndeclarable: [],
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
      requiredMismatch: [],
      declaredUndeclarable: [],
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
      // One finding per line: run together, a report of several fields is unreadable.
      expect(err.message).toMatch(/\n {2}job\.U_gone:/);
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
      requiredMismatch: [],
      declaredUndeclarable: [],
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
        requiredMismatch: [],
        declaredUndeclarable: [],
      }),
    ).not.toThrow();
  });
});

// 必須の食い違いは報告だけで ok は倒さない（ADR-0089 案4a）。
describe("verifyFields — required", () => {
  it("reports nothing when the declaration and the tenant agree", async () => {
    const fields = defineFields({
      candidate: (f) => ({
        U_must: f.number({ required: true }),
        U_may: f.number(),
      }),
    });
    const source = sourceOf({
      candidate: [
        { P_Alias: "Person.U_must", P_Type: 3, P_Required: 1 },
        { P_Alias: "Person.U_may", P_Type: 3, P_Required: 0 },
      ],
    });
    const report = await verifyFields(source, fields);
    expect(report.requiredMismatch).toStrictEqual([]);
    expect(report.ok).toBe(true);
  });

  it("reports both directions without clearing ok", async () => {
    const fields = defineFields({
      candidate: (f) => ({
        U_stricter: f.number({ required: true }),
        U_looser: f.number(),
      }),
    });
    const source = sourceOf({
      candidate: [
        { P_Alias: "Person.U_stricter", P_Type: 3, P_Required: 0 },
        { P_Alias: "Person.U_looser", P_Type: 3, P_Required: 1 },
      ],
    });
    const report = await verifyFields(source, fields);
    expect(report.requiredMismatch).toStrictEqual([
      {
        resource: "candidate",
        alias: "U_stricter",
        declared: true,
        tenant: false,
      },
      {
        resource: "candidate",
        alias: "U_looser",
        declared: false,
        tenant: true,
      },
    ]);
    expect(report.ok).toBe(true);
    expect(() => assertFieldsMatch(report)).not.toThrow();
  });

  it("compares required only for fields present on both sides", async () => {
    const fields = defineFields({
      candidate: (f) => ({ U_gone: f.number({ required: true }) }),
    });
    const source = sourceOf({
      candidate: [{ P_Alias: "Person.U_extra", P_Type: 3, P_Required: 1 }],
    });
    const report = await verifyFields(source, fields);
    expect(report.requiredMismatch).toStrictEqual([]);
    expect(report.missing).toHaveLength(1);
    expect(report.undeclared).toHaveLength(1);
  });

  it("reads a plain catalog map (no defineFields marker) as nothing declared required", async () => {
    const source = sourceOf({
      candidate: [{ P_Alias: "Person.U_score", P_Type: 3, P_Required: 1 }],
    });
    const report = await verifyFields(source, {
      candidate: { U_score: "Number" },
    });
    expect(report.requiredMismatch).toStrictEqual([
      {
        resource: "candidate",
        alias: "U_score",
        declared: false,
        tenant: true,
      },
    ]);
  });
});

// ADR-0104 / RV-80。宣言できない項目を宣言していたら、理由が「Data Type を持たない」「宣言の対象外」なら
// ok を倒し、「このライブラリが型を知らない」だけなら知らせるだけにする。
describe("verifyFields — declaring a field the tenant cannot express", () => {
  it("clears ok for a field with no Data Type, and names it", async () => {
    const fields = defineFields({ job: (f) => ({ U_ref: f.number() }) });
    const source = sourceOf({ job: [{ P_Alias: "Job.U_ref", P_Type: 16 }] });

    const report = await verifyFields(source, fields);

    expect(report.ok).toBe(false);
    expect(report.declaredUndeclarable).toEqual([
      {
        resource: "job",
        alias: "U_ref",
        declared: "Number",
        fieldType: 16,
        label: "Reference",
        reason: "no-data-type",
      },
    ]);
    expect(() => {
      assertFieldsMatch(report);
    }).toThrow(
      "job.U_ref: declared Number, but the tenant's field cannot be declared (no-data-type)",
    );
  });

  it("clears ok for a system-managed field", async () => {
    const fields = defineFields({ job: (f) => ({ U_sys: f.number() }) });
    const source = sourceOf({ job: [{ P_Alias: "Job.U_sys", P_Type: 11 }] });

    const report = await verifyFields(source, fields);

    expect(report.ok).toBe(false);
    expect(report.declaredUndeclarable[0]?.reason).toBe("not-declarable");
  });

  it("reports a type the library does not know, without clearing ok", async () => {
    const fields = defineFields({ job: (f) => ({ U_new: f.number() }) });
    const source = sourceOf({ job: [{ P_Alias: "Job.U_new", P_Type: 99 }] });

    const report = await verifyFields(source, fields);

    expect(report.ok).toBe(true);
    expect(report.declaredUndeclarable).toEqual([
      {
        resource: "job",
        alias: "U_new",
        declared: "Number",
        fieldType: 99,
        reason: "unknown-field-type",
      },
    ]);
    expect(() => {
      assertFieldsMatch(report);
    }).not.toThrow();
  });

  it("lists only the fields that clear ok in the thrown message", async () => {
    const fields = defineFields({
      job: (f) => ({ U_ref: f.number(), U_new: f.number() }),
    });
    const source = sourceOf({
      job: [
        { P_Alias: "Job.U_ref", P_Type: 16 },
        { P_Alias: "Job.U_new", P_Type: 99 },
      ],
    });

    let message = "";
    try {
      assertFieldsMatch(await verifyFields(source, fields));
    } catch (e) {
      message = (e as PortersConfigError).message;
    }
    expect(message).toContain("job.U_ref");
    expect(message).not.toContain("job.U_new");
  });
});
