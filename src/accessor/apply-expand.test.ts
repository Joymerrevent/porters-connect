import { describe, expect, it } from "vitest";

import { applyExpand } from "./apply-expand";
import type { ExpandContext, ReferenceTarget } from "./expand";

// Unit-level counterpart to the wiring tests in data-reader.test.ts: those drive expansion through
// the resource factory (does a search send/decode the right thing), this pins `applyExpand` (the `field` entries to send) on its
// own. Two targets, because the interesting case is the one where a resource's alias *prefix*
// differs from its *name* — Candidate is `Person` (LV-16).
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

  it("明示的に undefined を渡した alias は無視する（`{ P_Client: undefined }`）", () => {
    // 設定を spread で組むと出る形。空の選択と同じ扱いで、`.length` を読んで落ちない。
    expect(
      applyExpand(["Process.P_Client"], { P_Client: undefined }, ctx),
    ).toEqual(["Process.P_Client"]);
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

// 接頭辞の無いリソース（Phase）でも、alias は qualify() で組み立てる（".P_Client" にしない。RV-96）。
it("builds the alias without a leading dot when the resource has no prefix", () => {
  const bare: ExpandContext = { prefix: "", references: { P_Client: CLIENT } };
  expect(applyExpand(["P_Client"], { P_Client: ["P_Id"] }, bare)).toEqual([
    "P_Client(Client.P_Id)",
  ]);
  expect(
    applyExpand(
      [],
      { P_Client: ["P_Id"] },
      {
        prefix: "Process",
        references: { P_Client: { ...CLIENT, prefix: "" } },
      },
    ),
  ).toEqual(["Process.P_Client(P_Id)"]);
});
