import { describe, expect, it } from "vitest";

import { expansionCatalogs } from "./expansion-catalogs";
import type { ExpandContext, ReferenceTarget } from "./expand";

// Unit-level counterpart to the wiring tests in data-reader.test.ts: those drive expansion through
// the resource factory (does a search send/decode the right thing), this pins `expansionCatalogs` (the catalogs to decode the answer with) on its
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
