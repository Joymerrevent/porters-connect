import { describe, expect, expectTypeOf, it } from "vitest";

import { PortersConfigError } from "../errors";
import {
  declaredRequired,
  defineFields,
  type FieldDecls,
} from "./define-fields";

// defineFields is the single validation boundary (ADR-0023 D4): it builds a per-resource
// catalog (alias -> Data Type) from the typed builder and throws synchronously on bad input.
describe("defineFields — builder -> catalog", () => {
  it("maps each builder method to its Data Type literal", () => {
    const fields = defineFields({
      candidate: (f) => ({
        U_score: f.number(),
        U_note: f.singlelineText(),
        U_bio: f.multilineText(),
        U_mail2: f.mail(),
        U_tel2: f.telephone(),
        U_site: f.url(),
        U_join: f.date(),
        U_seen: f.dateTime(),
        U_born: f.age(),
        U_tags: f.option(),
        U_sub: f.user(),
        U_photo: f.image(),
        U_link: f.link(),
      }),
    });
    expect(fields.candidate).toEqual({
      U_score: "Number",
      U_note: "SinglelineText",
      U_bio: "MultilineText",
      U_mail2: "Mail",
      U_tel2: "Telephone",
      U_site: "URL",
      U_join: "Date",
      U_seen: "DateTime",
      U_born: "Age",
      U_tags: "Option",
      U_sub: "User",
      U_photo: "Image",
      U_link: "Link",
    });
  });

  it("accepts U_ and A_ aliases across multiple resources", () => {
    const fields = defineFields({
      candidate: (f) => ({ U_score: f.number() }),
      job: (f) => ({ A_flag: f.option() }),
    });
    expect(fields.candidate).toEqual({ U_score: "Number" });
    expect(fields.job).toEqual({ A_flag: "Option" });
  });

  it("returns a frozen result (branded as validated — the client does not re-check)", () => {
    const fields = defineFields({
      candidate: (f) => ({ U_score: f.number() }),
    });
    expect(Object.isFrozen(fields)).toBe(true);
  });

  it("infers literal Data Types in the result type", () => {
    const fields = defineFields({
      candidate: (f) => ({ U_score: f.number(), U_tags: f.option() }),
    });
    expectTypeOf(fields.candidate).toEqualTypeOf<{
      U_score: "Number";
      U_tags: "Option";
    }>();
  });
});

describe("defineFields — validation (fail-safe, synchronous)", () => {
  it("rejects an alias that is not U_/A_ prefixed", () => {
    // Alias prefix is a runtime check (the type allows any string key); P_ is the static
    // catalog's territory and a bare name is neither U_ nor A_.
    expect(() =>
      defineFields({ candidate: (f) => ({ P_Name: f.singlelineText() }) }),
    ).toThrow(PortersConfigError);
    expect(() =>
      defineFields({ candidate: (f) => ({ score: f.number() }) }),
    ).toThrow(PortersConfigError);
  });

  it("accepts every implemented data resource as a key", () => {
    // The runtime list and the `CustomFieldResource` union have to stay in step: a resource
    // that types fine but throws at runtime would be the worst of both (ADR-0060 D1 adds one
    // per PR, so this is the guard that says "wire both sides").
    const declared = defineFields({
      candidate: (f) => ({ U_a: f.number() }),
      job: (f) => ({ U_a: f.number() }),
      client: (f) => ({ U_a: f.number() }),
      recruiter: (f) => ({ U_a: f.number() }),
      contact: (f) => ({ U_a: f.number() }),
      opportunity: (f) => ({ U_a: f.number() }),
      activity: (f) => ({ U_a: f.number() }),
      contract: (f) => ({ U_a: f.number() }),
      sales: (f) => ({ U_a: f.number() }),
      process: (f) => ({ U_a: f.number() }),
      resume: (f) => ({ U_a: f.number() }),
    });
    expect(Object.keys(declared).sort()).toEqual([
      "activity",
      "candidate",
      "client",
      "contact",
      "contract",
      "job",
      "opportunity",
      "process",
      "recruiter",
      "resume",
      "sales",
    ]);
  });

  it("rejects an unknown resource key (e.g. a typo) at runtime", () => {
    // The typed surface only allows the implemented data resources; this guards untyped callers.
    const bad = {
      candiate: (f: { number: () => { dataType: "Number" } }) => ({
        U_x: f.number(),
      }),
    } as unknown as FieldDecls;
    expect(() => defineFields(bad)).toThrow(PortersConfigError);
  });

  it("rejects an alias that merely contains U_ / A_ (the rule is a prefix)", () => {
    // `P_SubU_score` is a standard field. Matching U_ anywhere would take it for a custom one,
    // and the declaration would then shadow a built-in field with the wrong Data Type.
    expect(() =>
      defineFields({ candidate: (f) => ({ P_SubU_score: f.number() }) }),
    ).toThrow(/must start with "U_" or "A_"/);
  });

  it("names the unknown key and the accepted resources when the key is a typo", () => {
    // The message is the only guidance a caller gets here: the typo itself, and what was expected.
    const bad = {
      candiate: (f: { number: () => { dataType: "Number" } }) => ({
        U_x: f.number(),
      }),
    } as unknown as FieldDecls;

    try {
      defineFields(bad);
      expect.unreachable("should have thrown");
    } catch (e) {
      const err = e as PortersConfigError;
      expect(err.message).toContain('unknown resource "candiate"');
      expect(err.message).toContain("candidate, job");
      expect(err.category).toBe("config");
    }
  });

  it("skips a resource key whose declaration is undefined", () => {
    // Callers build declarations conditionally (`job: wantJob ? decl : undefined`). The key is
    // then present with no value, and treating that as a declaration would put an empty catalog
    // on the client — every custom field of that resource would silently stop resolving.
    const fields = defineFields({
      candidate: (f) => ({ U_score: f.number() }),
      job: undefined,
    });

    expect(Object.keys(fields)).toEqual(["candidate"]);
    expect(fields.candidate).toEqual({ U_score: "Number" });
  });

  it("uses the config error category", () => {
    try {
      defineFields({ candidate: (f) => ({ bad: f.number() }) });
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(PortersConfigError);
      expect((e as PortersConfigError).category).toBe("config");
    }
  });
});

// 必須は宣言で明示したときだけ（ADR-0089 案1a / 案2a）。項目表の形は変えず、必須は別に持つ。
describe("defineFields — required on create", () => {
  it("keeps the catalog alias -> Data Type (required is not mixed into it)", () => {
    const fields = defineFields({
      candidate: (f) => ({
        U_score: f.number({ required: true }),
        U_memo: f.multilineText(),
      }),
    });
    expect(fields.candidate).toEqual({
      U_score: "Number",
      U_memo: "MultilineText",
    });
    // The runtime marker is a symbol key: code that lists the declared resources does not see it.
    expect(Object.keys(fields)).toEqual(["candidate"]);
  });

  it("records only `required: true` at runtime, per resource", () => {
    const fields = defineFields({
      candidate: (f) => ({
        U_a: f.number({ required: true }),
        U_b: f.number({ required: false }),
        U_c: f.number(),
      }),
      job: (f) => ({ U_d: f.option({ required: true }) }),
      client: (f) => ({ U_e: f.date() }),
    });
    expect([...declaredRequired(fields, "candidate")]).toEqual(["U_a"]);
    expect([...declaredRequired(fields, "job")]).toEqual(["U_d"]);
    expect(declaredRequired(fields, "client").size).toBe(0);
    expect(declaredRequired(fields, "resume").size).toBe(0); // not declared at all
  });

  it("reads a declaration that did not come from defineFields as none required", () => {
    expect(
      declaredRequired({ candidate: { U_a: "Number" } }, "candidate").size,
    ).toBe(0);
  });

  it("rejects a non-boolean `required` (a JS caller must not get a silently optional field)", () => {
    const decls = {
      candidate: (f: { number: (o: unknown) => unknown }) => ({
        U_a: { ...(f.number({}) as object), required: "yes" },
      }),
    } as unknown as FieldDecls;
    expect(() => defineFields(decls)).toThrow(
      '"required" for "U_a" on "candidate" must be true or false',
    );
    let caught: unknown;
    try {
      defineFields(decls);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(PortersConfigError);
    expect((caught as PortersConfigError).category).toBe("config");
  });

  it("accepts a hand-built definition without `required` as optional (not an error)", () => {
    const decls = {
      candidate: () => ({ U_a: { dataType: "Number" } }),
    } as unknown as FieldDecls;
    const fields = defineFields(decls);
    expect(fields.candidate).toEqual({ U_a: "Number" });
    expect(declaredRequired(fields, "candidate").size).toBe(0);
  });

  it("types `required: true` as a literal, and everything else as false", () => {
    const fields = defineFields({
      candidate: (f) => ({
        U_a: f.number({ required: true }),
        U_b: f.number({ required: false }),
        U_c: f.number(),
      }),
    });
    // The catalog type is unchanged: only the Data Type per alias.
    expectTypeOf(fields.candidate).toEqualTypeOf<{
      U_a: "Number";
      U_b: "Number";
      U_c: "Number";
    }>();
  });
});
