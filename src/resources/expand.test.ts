import { describe, expect, it } from "vitest";

import { PortersConfigError } from "../errors";
import type { DataType } from "../xml/decode";
import {
  applyExpand,
  expansionCatalogs,
  guardRawExpansion,
  type ExpandContext,
  type ReferenceTarget,
} from "./expand";

// Unit-level counterpart to the wiring tests in resource.test.ts: those drive expansion through
// the resource factory (does a search send/decode the right thing), these pin the three pieces
// this module owns on their own. Two targets, because the interesting case is the one where a
// resource's alias *prefix* differs from its *name* — Candidate is `Person` (LV-16).
const CLIENT: ReferenceTarget = {
  name: "Client",
  path: "client",
  prefix: "Client",
  fields: { P_Id: "System[Id]", P_Name: "SinglelineText" },
};

const CANDIDATE: ReferenceTarget = {
  name: "Candidate",
  path: "candidate",
  prefix: "Person",
  fields: { P_Id: "System[Id]", P_Name: "SinglelineText", P_Deleted: null },
};

const ctx: ExpandContext = {
  prefix: "Process",
  references: { P_Client: CLIENT, P_Candidate: CANDIDATE },
};

describe("applyExpand — 展開を field エントリに畳み込む", () => {
  it("`{prefix}.{alias}({target}.{sub},…)` を作る", () => {
    expect(
      applyExpand(["Process.P_Id"], { P_Client: ["P_Id", "P_Name"] }, ctx),
    ).toEqual(["Process.P_Id", "Process.P_Client(Client.P_Id,Client.P_Name)"]);
  });

  it("`()` の中は参照先の **alias 接頭辞**（リソース名ではない）", () => {
    // Candidate は name=Candidate / prefix=Person。descriptor が接頭辞を持つのはこのため。
    expect(applyExpand([], { P_Candidate: ["P_Id"] }, ctx)).toEqual([
      "Process.P_Candidate(Person.P_Id)",
    ]);
  });

  it("素のエントリを**その場で**置き換える（順序を保ち、二重に送らない）", () => {
    const entries = ["Process.P_Id", "Process.P_Client", "Process.P_Phase"];
    const out = applyExpand(entries, { P_Client: ["P_Id"] }, ctx);
    expect(out).toEqual([
      "Process.P_Id",
      "Process.P_Client(Client.P_Id)",
      "Process.P_Phase",
    ]);
    // 同じ alias が `()` 有り・無しで 2 回出ない（どちらが勝つか正典に記述が無いので送らない）
    expect(out).not.toContain("Process.P_Client");
  });

  it("素のエントリが無ければ末尾に足す（要求した展開は必ず送る）", () => {
    expect(applyExpand(["Process.P_Id"], { P_Client: ["P_Id"] }, ctx)).toEqual([
      "Process.P_Id",
      "Process.P_Client(Client.P_Id)",
    ]);
  });

  it("複数の参照を同時に展開できる", () => {
    expect(
      applyExpand(
        ["Process.P_Client", "Process.P_Candidate"],
        { P_Client: ["P_Name"], P_Candidate: ["P_Name"] },
        ctx,
      ),
    ).toEqual([
      "Process.P_Client(Client.P_Name)",
      "Process.P_Candidate(Person.P_Name)",
    ]);
  });

  it("空の選択は無視する（選ぶものが無い＝既に送っている ID のみの形）", () => {
    expect(applyExpand(["Process.P_Client"], { P_Client: [] }, ctx)).toEqual([
      "Process.P_Client",
    ]);
  });

  it("参照先が登録されていない alias は無視する（Recruiter の場合）", () => {
    expect(
      applyExpand(["Process.P_Recruiter"], { P_Recruiter: ["P_Id"] }, ctx),
    ).toEqual(["Process.P_Recruiter"]);
  });

  it("expand を渡さなければエントリはそのまま", () => {
    const entries = ["Process.P_Id", "Process.P_Client"];
    expect(applyExpand(entries, undefined, ctx)).toEqual(entries);
  });

  it("入力の配列を書き換えない", () => {
    const entries = ["Process.P_Client"];
    applyExpand(entries, { P_Client: ["P_Id"] }, ctx);
    expect(entries).toEqual(["Process.P_Client"]);
  });
});

describe("expansionCatalogs — 応答を解くための参照先カタログ", () => {
  it("展開した alias に参照先の Data-Type マップを返す", () => {
    const catalogs = expansionCatalogs(
      { P_Candidate: ["P_Id"] },
      ctx.references,
    );
    expect([...(catalogs?.keys() ?? [])]).toEqual(["P_Candidate"]);
    // 選んだ項目だけでなく参照先カタログ全体を渡す（応答に何が来ても Data Type で解ける）
    expect(catalogs?.get("P_Candidate")?.get("P_Name")).toBe("SinglelineText");
    // Data Type を持たない項目（ADR-0056）も `null` として運ばれる
    expect(catalogs?.get("P_Candidate")?.get("P_Deleted")).toBeNull();
  });

  it("何も展開していなければ undefined（既定 decoder を使い回すため）", () => {
    expect(expansionCatalogs(undefined, ctx.references)).toBeUndefined();
    expect(expansionCatalogs({}, ctx.references)).toBeUndefined();
    expect(expansionCatalogs({ P_Client: [] }, ctx.references)).toBeUndefined();
    expect(
      expansionCatalogs({ P_Recruiter: ["P_Id"] }, ctx.references),
    ).toBeUndefined();
  });
});

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
});
