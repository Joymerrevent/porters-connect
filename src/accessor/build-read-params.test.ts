import { describe, expect, it } from "vitest";

import { buildReadParams, buildReadUrl } from "./build-read-params";
import { fieldParamContext } from "./field-param";

const CTX = fieldParamContext("W", {
  P_Id: "System[Id]",
  P_Name: "SinglelineText",
});

describe("buildReadParams", () => {
  it("sends the partition, the fixed params, the field list and the typed query — and no paging", () => {
    const p = buildReadParams(
      12,
      { field: ["P_Name"], condition: { P_Name: { eq: "x" } } },
      { ...CTX, params: { resource: "5" } },
    );
    expect(p.get("partition")).toBe("12");
    expect(p.get("resource")).toBe("5");
    expect(p.get("field")).toBe("W.P_Name");
    expect(p.get("condition")).toBe("W.P_Name:eq=x");
    expect(p.has("count")).toBe(false);
    expect(p.has("start")).toBe(false);
  });

  it("sends every catalogued alias when field is omitted, and no field for []", () => {
    expect(buildReadParams(1, {}, CTX).get("field")).toBe("W.P_Id,W.P_Name");
    expect(buildReadParams(1, { field: [] }, CTX).has("field")).toBe(false);
  });
});

describe("buildReadUrl", () => {
  it("renders one page of the query at the access point", () => {
    const url = buildReadUrl(
      { hostname: "h.test" },
      12,
      "widget",
      { field: ["P_Id"], count: 5, start: 10 },
      CTX,
    );
    expect(url).toBe(
      "https://h.test/v1/widget?partition=12&field=W.P_Id&count=5&start=10",
    );
  });
});
