import { describe, expect, it } from "vitest";

import { PortersConfigError } from "../errors";
import type { DataType } from "../porters/data-type";
import { guardRawExpansion } from "./guard-raw-expansion";

describe("guardRawExpansion — field に手書きされた展開を弾く", () => {
  const FIELDS = new Map<string, DataType | null>([
    ["P_Id", "System[Id]"],
    ["P_Client", "System[Reference]"],
    ["P_Owner", "User"],
    ["P_Deleted", null],
  ]);

  it("カタログ上の System[Reference] に `()` が付いていたら弾く", () => {
    expect(() =>
      guardRawExpansion(["Job.P_Client(Client.P_Id)"], FIELDS),
    ).toThrow(PortersConfigError);
  });

  it("接頭辞なしでも弾く（bare alias で照合する）", () => {
    expect(() => guardRawExpansion(["P_Client(Client.P_Id)"], FIELDS)).toThrow(
      PortersConfigError,
    );
  });

  it("hint が expand の書き方を名指しする", () => {
    let error: unknown;
    try {
      guardRawExpansion(["Job.P_Client(Client.P_Id)"], FIELDS);
    } catch (e) {
      error = e;
    }
    expect((error as PortersConfigError).category).toBe("config");
    expect((error as PortersConfigError).message).toContain(
      'field entry "Job.P_Client(Client.P_Id)" expands a reference',
    );
    expect((error as PortersConfigError).hint).toContain(
      'expand: { P_Client: ["P_Id", ...] }',
    );
  });

  it("User 型の `()` は通す（ライブラリ自身が出す正当な形）", () => {
    expect(() =>
      guardRawExpansion(["W.P_Owner(User.P_Id,User.P_Name)"], FIELDS),
    ).not.toThrow();
  });

  it("カタログ外の alias の `()` は通す（判断の根拠が無い）", () => {
    // 例: Image 型のカスタム項目 `(FileName,ContentType,Content)` は正当な構文。
    expect(() =>
      guardRawExpansion(["W.U_photo(FileName,ContentType)"], FIELDS),
    ).not.toThrow();
  });

  it("`()` を含まないエントリは素通し", () => {
    expect(() =>
      guardRawExpansion(["W.P_Id", "W.P_Client", "W.P_Deleted"], FIELDS),
    ).not.toThrow();
  });

  it("参照 alias で**始まるだけ**の別項目は素通し（`()` の有無で判定する）", () => {
    // `W.P_ClientX` は P_Client の展開ではない。「`(` が無ければ見ない」を外して末尾 1 文字を
    // 落として照合すると、こういう項目が参照と誤認される。
    expect(() => guardRawExpansion(["W.P_ClientX"], FIELDS)).not.toThrow();
    expect(() => guardRawExpansion(["W(.P_Client"], FIELDS)).not.toThrow();
  });
});
