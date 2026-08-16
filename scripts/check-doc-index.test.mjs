import { describe, expect, it } from "vitest";

import { checkTarget, parseIndexTable } from "./check-doc-index.mjs";

// 実ファイルを読まずに検査するため、対象定義とファイル内容を注入する。
// dir/pattern はディレクトリ走査に使うので、テストでは実在する docs/adr を借りて
// 「索引と本文の突合」ロジックだけを見る……のではなく、走査自体も差し替えたいので
// 対象は「実在するディレクトリ ＋ 注入した read」の組み合わせで組む。
const INDEX = "docs/adr/index.md";

const target = (overrides = {}) => ({
  name: "ADR",
  index: INDEX,
  dir: "docs/adr",
  pattern: /^(\d{4})-.+\.md$/,
  skip: new Set(["0000"]),
  idFromRow: (cell) => cell.match(/\[(\d{4})\]/)?.[1],
  columns: [
    { header: "タイトル", meta: null },
    { header: "フェーズ", meta: null },
    {
      header: "ステータス",
      meta: "Status",
      vocabulary: new Set(["proposed", "accepted", "rejected", "deprecated"]),
      prefixMatch: "superseded",
    },
    { header: "実装", meta: "Implemented" },
  ],
  ...overrides,
});

// 実在する ADR の番号を借りて「索引 1 行 ＋ その本文」だけの世界を作る。
// 走査対象の docs/adr には他の ADR も居るので、索引に無い分は (1) で検出される。
// ここでは 1 対 1 の検査を切り離したいので、対象を 1 件に絞った pattern を使う。
const only = (num) => ({
  pattern: new RegExp(`^(${num})-.+\\.md$`),
  skip: new Set(),
});

const reader = (indexText, bodyText) => (path) =>
  path === INDEX ? indexText : bodyText;

const indexWith = (row) =>
  [
    "| #            | タイトル | フェーズ | ステータス | 実装 |",
    "| ------------ | -------- | -------- | ---------- | ---- |",
    row,
  ].join("\n");

describe("parseIndexTable", () => {
  it("ヘッダと区切り行を落として ID 付きの行だけ返す", () => {
    const rows = parseIndexTable(
      indexWith("| [0051][0051] | 題 | 詳細設計 | accepted | 0.8.0 |"),
      (cell) => cell.match(/\[(\d{4})\]/)?.[1],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("0051");
    expect(rows[0].cells[3]).toBe("accepted");
  });

  it("テーブル以外の行は無視する", () => {
    const rows = parseIndexTable("散文\n\n- 箇条書き\n", () => undefined);
    expect(rows).toEqual([]);
  });
});

describe("checkTarget — 一致していれば問題なし", () => {
  it("ステータスと実装が本文と一致する行を通す", () => {
    const problems = checkTarget(
      target(only("0051")),
      reader(
        indexWith("| [0051][0051] | 題 | 詳細設計 | accepted | 0.8.0 |"),
        "- Status: accepted\n- Implemented: 0.8.0\n",
      ),
    );
    expect(problems).toEqual([]);
  });

  it("本文に Implemented が無ければ索引は — で一致とみなす（任意項目）", () => {
    const problems = checkTarget(
      target(only("0001")),
      reader(
        indexWith("| [0001][0001] | 題 | プロセス | accepted | — |"),
        "- Status: accepted\n",
      ),
    );
    expect(problems).toEqual([]);
  });

  it("superseded は本文の補足（by [[0039]]）を許して前方一致で見る", () => {
    const problems = checkTarget(
      target(only("0037")),
      reader(
        indexWith("| [0037][0037] | 題 | プロセス | superseded | — |"),
        "- Status: superseded by [[0039-commitlint-release-range]]\n",
      ),
    );
    expect(problems).toEqual([]);
  });
});

describe("checkTarget — 食い違いを検出する", () => {
  it("ステータスがズレたら落とす（accepted なのに索引は proposed）", () => {
    const problems = checkTarget(
      target(only("0051")),
      reader(
        indexWith("| [0051][0051] | 題 | 詳細設計 | proposed | 0.8.0 |"),
        "- Status: accepted\n- Implemented: 0.8.0\n",
      ),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("ステータス");
    expect(problems[0]).toContain('索引="proposed"');
    expect(problems[0]).toContain('本文="accepted"');
  });

  it("実装の版がズレたら落とす（0.4.0 で公開済みなのに索引が —）", () => {
    const problems = checkTarget(
      target(only("0038")),
      reader(
        indexWith("| [0038][0038] | 題 | 詳細設計 | accepted | — |"),
        "- Status: accepted\n- Implemented: 0.4.0\n",
      ),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("実装");
    expect(problems[0]).toContain('本文="0.4.0"');
  });

  it("索引が実装済みと言うのに本文に記載が無ければ落とす（逆向き）", () => {
    const problems = checkTarget(
      target(only("0038")),
      reader(
        indexWith("| [0038][0038] | 題 | 詳細設計 | accepted | 0.4.0 |"),
        "- Status: accepted\n",
      ),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('索引="0.4.0"');
    expect(problems[0]).toContain('本文="—"');
  });

  it("既定の語彙にないステータスを落とす", () => {
    const problems = checkTarget(
      target(only("0051")),
      reader(
        indexWith("| [0051][0051] | 題 | 詳細設計 | 実装待ち | 0.8.0 |"),
        "- Status: 実装待ち\n- Implemented: 0.8.0\n",
      ),
    );
    expect(problems.some((p) => p.includes("既定の語彙にない"))).toBe(true);
  });

  it("実ファイルがあるのに索引に行が無ければ落とす", () => {
    const problems = checkTarget(
      target(only("0051")),
      reader(indexWith("| [0052][0052] | 題 | プロセス | accepted | — |"), ""),
    );
    expect(problems.some((p) => p.includes("索引に行が無い"))).toBe(true);
  });

  it("索引に行があるのに実ファイルが無ければ落とす（幽霊行）", () => {
    const problems = checkTarget(
      target(only("0051")),
      reader(
        [
          indexWith("| [0051][0051] | 題 | 詳細設計 | accepted | 0.8.0 |"),
          "| [9999][9999] | 幽霊 | プロセス | accepted | — |",
        ].join("\n"),
        "- Status: accepted\n- Implemented: 0.8.0\n",
      ),
    );
    expect(problems.some((p) => p.includes("実ファイルが無い"))).toBe(true);
  });
});

describe("checkTarget — 対象が存在しないとき", () => {
  it("optional な対象はディレクトリが無くても通す（移行前の findings）", () => {
    const problems = checkTarget(
      target({ dir: "docs/does-not-exist", optional: true }),
      reader("", ""),
    );
    expect(problems).toEqual([]);
  });

  it("optional でない対象はディレクトリが無ければ落とす", () => {
    const problems = checkTarget(
      target({ dir: "docs/does-not-exist" }),
      reader("", ""),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("ディレクトリが見つからない");
  });

  it("索引が読めなければ落とす", () => {
    const problems = checkTarget(target(only("0051")), () => {
      throw new Error("ENOENT");
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("索引が読めない");
  });
});
