import { describe, expect, it } from "vitest";

import type { Field, FieldSearchQuery } from "../resources/field";
import { readCustomCatalog, type FieldCatalogSource } from "./tenant-catalog";

// A Field Read stub. Records the queries it was asked, so the `active` default is testable.
const sourceOf = (
  rows: readonly Partial<Field>[],
): FieldCatalogSource & {
  readonly queries: Omit<FieldSearchQuery, "count" | "start">[];
} => {
  const queries: Omit<FieldSearchQuery, "count" | "start">[] = [];
  return {
    queries,
    field: {
      searchAll: (query) => {
        queries.push(query);
        // A sync generator satisfies `AsyncIterable` here via `Symbol.asyncIterator` only if we
        // wrap it, so build the async iterator explicitly — there is nothing to await.
        let i = 0;
        return {
          [Symbol.asyncIterator]: () => ({
            next: () =>
              Promise.resolve(
                i < rows.length
                  ? { done: false as const, value: rows[i++] }
                  : { done: true as const, value: undefined },
              ),
          }),
        };
      },
    },
  };
};

describe("readCustomCatalog", () => {
  it("maps a tenant's custom fields to the shape defineFields produces", async () => {
    const source = sourceOf([
      { P_Alias: "Person.U_score", P_Type: 3 },
      { P_Alias: "Person.U_source", P_Type: 7 },
      { P_Alias: "Person.A_imported", P_Type: 1 },
    ]);

    const catalog = await readCustomCatalog(source, "candidate");

    expect(catalog.resource).toBe("candidate");
    expect(catalog.fields).toEqual({
      U_score: "Number",
      U_source: "Option",
      A_imported: "SinglelineText",
    });
    expect(catalog.undeclarable).toEqual([]);
  });

  it("leaves standard P_ fields out — they are the static catalogs' job", async () => {
    const source = sourceOf([
      { P_Alias: "Person.P_Name", P_Type: 1 },
      { P_Alias: "Person.P_Owner", P_Type: 17 },
      { P_Alias: "Person.U_score", P_Type: 3 },
    ]);

    const catalog = await readCustomCatalog(source, "candidate");

    expect(catalog.fields).toEqual({ U_score: "Number" });
  });

  // ADR-0069 論点7 / 案7a: LV-12 leaves the alias form unconfirmed, so both must work. Getting
  // this wrong would report an empty catalog, which reads as "the tenant has no custom fields".
  it("accepts both a qualified and a bare P_Alias (LV-12)", async () => {
    const qualified = await readCustomCatalog(
      sourceOf([{ P_Alias: "Person.U_score", P_Type: 3 }]),
      "candidate",
    );
    const bare = await readCustomCatalog(
      sourceOf([{ P_Alias: "U_score", P_Type: 3 }]),
      "candidate",
    );

    expect(qualified.fields).toEqual({ U_score: "Number" });
    expect(bare.fields).toEqual(qualified.fields);
  });

  it("strips Candidate's `Person` prefix, not just the resource name", async () => {
    const catalog = await readCustomCatalog(
      sourceOf([{ P_Alias: "Person.U_score", P_Type: 3 }]),
      "candidate",
    );

    expect(Object.keys(catalog.fields)).toEqual(["U_score"]);
  });

  it("reads all fields by default, so unused ones are not reported as missing", async () => {
    const source = sourceOf([]);

    await readCustomCatalog(source, "job");

    // -1 = every field. Narrowing to 1 here would make a later comparison call an existing but
    // unused field "missing" — a false alarm (ADR-0069, accept 時の決定).
    expect(source.queries).toEqual([{ resource: "job", active: -1 }]);
  });

  it("passes an explicit active through", async () => {
    const source = sourceOf([]);

    await readCustomCatalog(source, "job", { active: 1 });

    expect(source.queries).toEqual([{ resource: "job", active: 1 }]);
  });

  describe("fields it cannot declare are reported, never dropped (論点4)", () => {
    it("reports a Field Type PORTERS has not published", async () => {
      const source = sourceOf([{ P_Alias: "U_new", P_Type: 99 }]);

      const catalog = await readCustomCatalog(source, "candidate");

      expect(catalog.fields).toEqual({});
      expect(catalog.undeclarable).toEqual([
        { alias: "U_new", fieldType: 99, reason: "unknown-field-type" },
      ]);
    });

    it("reports a published type that carries no value (16 Reference)", async () => {
      const source = sourceOf([{ P_Alias: "U_ref", P_Type: 16 }]);

      const catalog = await readCustomCatalog(source, "candidate");

      expect(catalog.undeclarable).toEqual([
        {
          alias: "U_ref",
          fieldType: 16,
          label: "Reference",
          reason: "no-data-type",
        },
      ]);
    });

    it("reports a system-managed type the builder does not offer (11)", async () => {
      const source = sourceOf([{ P_Alias: "U_sys", P_Type: 11 }]);

      const catalog = await readCustomCatalog(source, "candidate");

      expect(catalog.undeclarable).toEqual([
        {
          alias: "U_sys",
          fieldType: 11,
          label: "System",
          reason: "not-declarable",
        },
      ]);
    });

    it("reports a row that carried no Field Type at all", async () => {
      const source = sourceOf([{ P_Alias: "U_blank", P_Type: null }]);

      const catalog = await readCustomCatalog(source, "candidate");

      expect(catalog.undeclarable).toEqual([
        { alias: "U_blank", fieldType: null, reason: "unknown-field-type" },
      ]);
    });

    it("keeps the declarable ones alongside the reported ones", async () => {
      const source = sourceOf([
        { P_Alias: "U_score", P_Type: 3 },
        { P_Alias: "U_new", P_Type: 99 },
      ]);

      const catalog = await readCustomCatalog(source, "candidate");

      expect(catalog.fields).toEqual({ U_score: "Number" });
      expect(catalog.undeclarable).toHaveLength(1);
    });
  });

  it("skips a row with no alias — there is nothing to match or report", async () => {
    const source = sourceOf([
      { P_Alias: null, P_Type: 3 },
      { P_Type: 3 },
      { P_Alias: "U_score", P_Type: 3 },
    ]);

    const catalog = await readCustomCatalog(source, "candidate");

    expect(catalog.fields).toEqual({ U_score: "Number" });
    expect(catalog.undeclarable).toEqual([]);
  });
});
