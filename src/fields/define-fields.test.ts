import { describe, expect, expectTypeOf, it } from "vitest";

import { PortersConfigError } from "../errors";
import { defineFields, type FieldDecls } from "./define-fields";

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

  it("rejects an unknown resource key (e.g. a typo) at runtime", () => {
    // The typed surface only allows the 5 data resources; this guards untyped/dynamic callers.
    const bad = {
      candiate: (f: { number: () => { dataType: "Number" } }) => ({
        U_x: f.number(),
      }),
    } as unknown as FieldDecls;
    expect(() => defineFields(bad)).toThrow(PortersConfigError);
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
