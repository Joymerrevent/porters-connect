import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { decodeField, type UserRef } from "./decode";
import { parseResourcePage } from "./parser";

const fixture = (path: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../../test/fixtures/${path}`, import.meta.url)),
    "utf8",
  );

describe("decodeField (ADR-0011)", () => {
  const page = parseResourcePage(fixture("candidate/read-basic.xml"));
  const first = page.items[0];
  const second = page.items[1];

  it("decodes Id to a number", () => {
    expect(decodeField("Id", first["Person.P_Id"])).toBe(10001);
  });

  it("keeps string Data Types as strings (no numeric coercion); empty -> null", () => {
    expect(decodeField("SinglelineText", first["Person.P_Name"])).toBe(
      "山田 太郎",
    );
    expect(decodeField("Mail", second["Person.P_Mail"])).toBeNull();
  });

  it("decodes every string Data Type as a string (empty / non-string -> null)", () => {
    const stringTypes = [
      "SinglelineText",
      "MultilineText",
      "Mail",
      "Telephone",
      "URL",
    ] as const;
    for (const t of stringTypes) {
      expect(decodeField(t, "hello")).toBe("hello"); // passthrough
      expect(decodeField(t, "")).toBeNull(); // empty -> null (guard)
      expect(decodeField(t, { a: 1 })).toBeNull(); // non-string -> null
    }
  });

  it("decodes DateTime to ISO (...Z)", () => {
    expect(decodeField("DateTime", first["Person.P_UpdateDate"])).toBe(
      "2026-01-02T03:04:05Z",
    );
  });

  it("decodes User to a nested object", () => {
    const owner = decodeField("User", first["Person.P_Owner"]) as UserRef;
    expect(owner.P_Id).toBe(5);
    expect(owner.P_Type).toBe("0"); // prefixed User.P_Type resolves, not && null
    expect(owner.P_Name).toBe("採用 花子");
    expect(owner.P_Mail).toBe("hanako@example.com");
  });

  it("decodes Option to an array of selected end aliases (single + multi)", () => {
    // single selection -> a 1-element array (ADR-0017: PORTERS has no scalar form).
    // The leaf alias keeps its `Option.` prefix verbatim (no transformation).
    expect(decodeField("Option", first["Person.P_Phase"])).toEqual([
      "Option.P_PersonPhase_Applied",
    ]);
    // multi-select (Checkbox) -> every selected alias, in order
    expect(
      decodeField("Option", {
        OptionRoot: { "Option.P_Tokyo": "", "Option.P_Osaka": "" },
      }),
    ).toEqual(["Option.P_Tokyo", "Option.P_Osaka"]);
  });

  it("Option tolerates a missing OptionRoot wrapper (aliases under the field)", () => {
    // the Read API doc's sample omits OptionRoot — treat the field's children as aliases
    expect(
      decodeField("Option", {
        "Option.P_Tokyo": { "Option.P_Id": "87" },
      }),
    ).toEqual(["Option.P_Tokyo"]);
  });

  it("a field not present in the item -> null", () => {
    expect(
      decodeField("SinglelineText", second["Person.P_Country"]),
    ).toBeNull();
  });

  it("decodes Number and Date; empty -> null", () => {
    expect(decodeField("Number", "3.14")).toBe(3.14);
    expect(decodeField("Number", "")).toBeNull();
    expect(decodeField("Date", "2026/01/02")).toBe("2026-01-02");
  });

  it("decodes Age as a date (birthdate; the age is a UI-derived value)", () => {
    expect(decodeField("Age", "1990/01/02")).toBe("1990-01-02");
    expect(decodeField("Age", "")).toBeNull();
  });

  it("Option -> null for a non-record value or an empty OptionRoot", () => {
    expect(decodeField("Option", "scalar")).toBeNull(); // non-record
    expect(decodeField("Option", { OptionRoot: "" })).toBeNull(); // wrapper present but empty
  });

  it("User: prefix-less keys resolve; missing User -> null", () => {
    const u = decodeField("User", {
      User: { P_Id: "9", P_Name: "n" },
    }) as UserRef;
    expect(u.P_Id).toBe(9);
    expect(u.P_Name).toBe("n");
    expect(decodeField("User", { nope: 1 })).toBeNull();
  });

  it("decodes defensively: non-string -> null; missing nested -> null", () => {
    expect(decodeField("Id", { a: 1 })).toBeNull();
    expect(decodeField("Number", { a: 1 })).toBeNull();
    expect(decodeField("DateTime", { a: 1 })).toBeNull();
    expect(decodeField("Date", { a: 1 })).toBeNull();
    const owner = decodeField("User", { User: { P_Name: "n" } }) as UserRef;
    expect(owner.P_Id).toBeNull();
    expect(decodeField("Option", { OptionRoot: {} })).toBeNull();
  });

  it("decodes a System[Reference] to the referenced record's own id", () => {
    // <Job.P_Client><Client><Client.P_Id>100</Client.P_Id>...</Client></Job.P_Client>
    expect(
      decodeField("Reference", {
        Client: { "Client.P_Id": "100", "Client.P_Name": "Acme" },
      }),
    ).toBe(100);
  });

  it("Reference: accepts a prefix-less P_Id and skips non-record siblings", () => {
    // prefix-less id (the `?? inner.P_Id` fallback)
    expect(decodeField("Reference", { Recruiter: { P_Id: "55" } })).toBe(55);
    // an attribute / scalar sibling before the resource node is skipped, not picked
    expect(
      decodeField("Reference", {
        "@_attr": "x",
        Client: { "Client.P_Id": "7" },
      }),
    ).toBe(7);
  });

  it("Reference: missing id / non-record nested / non-record raw -> null", () => {
    expect(
      decodeField("Reference", { Client: { "Client.P_Name": "Acme" } }),
    ).toBeNull(); // no P_Id
    expect(decodeField("Reference", { Client: "oops" })).toBeNull(); // nested not a record
    expect(decodeField("Reference", "scalar")).toBeNull(); // raw not a record
  });
});
