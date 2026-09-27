import { describe, expect, it } from "vitest";

import { PortersConfigError } from "../errors/index";
import type { DataType } from "../porters/data-type";
import { encodeWriteItem } from "./encode-write-item";

const FIELDS = new Map<string, DataType | null>([
  ["P_Id", "System[Id]"],
  ["P_Name", "SinglelineText"],
  ["P_Deleted", null],
]);

describe("encodeWriteItem", () => {
  it("wraps the prefixed fields in <Item> and omits null / undefined", () => {
    expect(
      encodeWriteItem("Person", FIELDS, {
        P_Id: -1,
        P_Name: "A & B",
        U_memo: null,
        U_other: undefined,
      }),
    ).toBe(
      "<Item><Person.P_Id>-1</Person.P_Id><Person.P_Name>A &amp; B</Person.P_Name></Item>",
    );
  });

  it("writes an alias with no Data Type as escaped text (an unknown alias, or a catalogued null)", () => {
    expect(encodeWriteItem("W", FIELDS, { U_x: "<a>", P_Deleted: "1" })).toBe(
      "<Item><W.U_x>&lt;a&gt;</W.U_x><W.P_Deleted>1</W.P_Deleted></Item>",
    );
  });

  it("uses the bare alias as the tag when there is no prefix (Phase)", () => {
    expect(encodeWriteItem("", FIELDS, { P_Name: "x" })).toBe(
      "<Item><P_Name>x</P_Name></Item>",
    );
  });

  it("refuses an alias that is not a valid XML Name", () => {
    expect(() => encodeWriteItem("W", FIELDS, { "a b": "x" })).toThrow(
      PortersConfigError,
    );
  });
});

// 接頭辞の付いた alias は、自分のリソースのものでも拒否する（外すと、書き込みの前の検査を素通りする。RV-105）。
describe("a prefixed alias", () => {
  it.each(["Person.P_Name", "Person.P_Id", "Job.P_Name", "X.Y", ".P_Name"])(
    "refuses %s",
    (alias) => {
      expect(() => encodeWriteItem("Person", FIELDS, { [alias]: "x" })).toThrow(
        expect.objectContaining({
          name: "PortersConfigError",
          category: "validation",
          message: `${alias}: a field alias to write must be bare (like "P_Name"), without a prefix`,
          hint: "Write each field under its bare alias; the library adds the resource's own prefix.",
          context: { operation: "encode" },
        }),
      );
    },
  );

  it("writes a bare alias with the resource's prefix, or as it is without one", () => {
    expect(encodeWriteItem("Person", FIELDS, { P_Name: "x" })).toBe(
      "<Item><Person.P_Name>x</Person.P_Name></Item>",
    );
    expect(encodeWriteItem("", FIELDS, { P_Name: "x" })).toBe(
      "<Item><P_Name>x</P_Name></Item>",
    );
  });
});

it("names a field alias that is not an XML name", () => {
  expect(() => encodeWriteItem("Person", FIELDS, { "a b": "x" })).toThrow(
    'a b: field alias "a b" is not a valid XML element name',
  );
});
