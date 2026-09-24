import { describe, expect, it } from "vitest";

import { exportedNames, floorOf, renderStub } from "./emit-too-old-types.mjs";

const pkgWith = (importKey, requireKey) => ({
  exports: {
    ".": {
      import: { [importKey]: "./dist/old.d.ts", types: "./dist/index.d.ts" },
      require: {
        [requireKey]: "./dist/old.d.cts",
        types: "./dist/index.d.cts",
      },
    },
  },
});

describe("floorOf", () => {
  it("reads the floor and both targets from exports", () => {
    expect(floorOf(pkgWith("types@<5.4", "types@<5.4"))).toEqual({
      floor: "5.4",
      importTarget: "./dist/old.d.ts",
      requireTarget: "./dist/old.d.cts",
    });
  });

  it("rejects a condition missing on one side", () => {
    expect(() => floorOf(pkgWith("types@<5.4", "types"))).toThrow(
      'exports["."].require に types@<X の条件がありません',
    );
  });

  it("rejects import and require disagreeing", () => {
    expect(() => floorOf(pkgWith("types@<5.4", "types@<5.5"))).toThrow(
      "import と require で下限が違います（5.4 と 5.5）",
    );
  });

  it("rejects a package with no exports at all", () => {
    expect(() => floorOf({})).toThrow("types@<X の条件がありません");
  });
});

describe("exportedNames", () => {
  it("reads type-only and value exports, and the public name of `as`", () => {
    const dts = [
      "declare const a: number;",
      "export { type Foo, Bar, type Baz as Qux, quux as corge };",
      "",
    ].join("\n");
    expect(exportedNames(dts)).toEqual([
      { name: "Foo", isType: true },
      { name: "Bar", isType: false },
      { name: "Qux", isType: true },
      { name: "corge", isType: false },
    ]);
  });

  it("fails when there is no export list (never writes an empty stub)", () => {
    expect(() => exportedNames("declare const a: number;\n")).toThrow(
      "export { … } の行が見つかりません",
    );
  });
});

describe("renderStub", () => {
  const stub = renderStub("5.4", [
    { name: "PortersClient", isType: false },
    { name: "TenantScope", isType: true },
  ]);

  it("points every name at the message naming the floor", () => {
    expect(stub).toContain(
      'type RequiresNewerTypeScript = "@joymerrevent/porters-connect requires TypeScript 5.4 or later";',
    );
  });

  it("declares a value and a type for a value export, and only a type for a type export", () => {
    expect(stub).toContain(
      "export declare const PortersClient: RequiresNewerTypeScript;",
    );
    expect(stub).toMatch(
      /export type PortersClient<[^>]*> = RequiresNewerTypeScript;/,
    );
    expect(stub).toMatch(
      /export type TenantScope<[^>]*> = RequiresNewerTypeScript;/,
    );
    expect(stub).not.toContain("export declare const TenantScope");
  });
});
