// reference（docs/reference/.../resources/*.md）↔ 静的カタログ（src/resources/*.ts）の突合。
//
// なぜ要るか（RV-29）: フェイクサーバーは src の descriptor を直接使うので「実装 ↔ フェイク」は
// 構造的にズレないが、「reference ↔ カタログ」は誰も見ていなかった。その結果 RV-23（Candidate が
// 標準 4 項目を欠く）が 0.1.0 から 12 版・563 テストをすべて素通りしていた。人の目だけが防波堤に
// なっていたので、仕組みで守る。
//
// 何を見るか:
//   1) reference にある値付きの標準項目が、すべてカタログに存在する（取りこぼしの検出）
//   2) カタログにある項目が、すべて reference に存在する（綴り間違い・幻の項目の検出）
//   3) Field Type → Data Type の対応が一致する（型を取り違えていないか）
//
// 対象はデータ系 12 種 ＋ マスタ 4 種（ADR-0060 D2 で拡張）。マスタは 2 通りに分かれる:
//   - **User** は reference が Field Type 列を持つので、データ系とまったく同じ検査に載せる。
//   - **Field / Option / Partition** は reference（＝ Read 記事の出力表）に**型の列が無い**ので、
//     項目の有無だけを両方向で検査する。型の対応は突き合わせる相手がいない。
// Attachment だけは接頭辞なしの bespoke で「カタログ＝reference の全項目」が成り立たないため対象外。

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CANDIDATE_DESCRIPTOR } from "../../src/resources/candidate";
import { FIELD_DESCRIPTOR } from "../../src/resources/field";
import { OPTION_DESCRIPTOR } from "../../src/resources/option";
import { PARTITION_DESCRIPTOR } from "../../src/resources/partition";
import { USER_DESCRIPTOR } from "../../src/resources/user";
import { CLIENT_DESCRIPTOR } from "../../src/resources/client";
import { JOB_DESCRIPTOR } from "../../src/resources/job";
import { PHASE_DESCRIPTOR } from "../../src/resources/phase";
import { PROCESS_DESCRIPTOR } from "../../src/resources/process";
import { ACTIVITY_DESCRIPTOR } from "../../src/resources/activity";
import { CONTACT_DESCRIPTOR } from "../../src/resources/contact";
import { CONTRACT_DESCRIPTOR } from "../../src/resources/contract";
import { OPPORTUNITY_DESCRIPTOR } from "../../src/resources/opportunity";
import { RECRUITER_DESCRIPTOR } from "../../src/resources/recruiter";
import { RESUME_DESCRIPTOR } from "../../src/resources/resume";
import { SALES_DESCRIPTOR } from "../../src/resources/sales";
import type { ResourceDescriptor } from "../../src/resources/resource";
import type { DataType } from "../../src/xml/decode";

// Field Type（reference の表記）→ Data Type（ライブラリ内部の粒度）。ADR-0016 の対応表。
// Option の 3 サブタイプは Option に、Currency は Number に畳む（PORTERS 自身の Data Type と同じ）。
// `ー` は「PORTERS が Data Type を与えていない」＝ `null`（ADR-0056）。新しい型ではなく不在の記録。
const DATA_TYPE_OF: Record<string, DataType | null> = {
  ー: null,
  "System[Id]": "System[Id]",
  "System[DateTime]": "System[DateTime]",
  "System[Reference]": "System[Reference]",
  "System[Department]": "System[Department]",
  User: "User",
  "Option[Checkbox]": "Option",
  "Option[Dropdown]": "Option",
  "Option[Radiobutton]": "Option",
  Currency: "Number",
  Number: "Number",
  Date: "Date",
  Age: "Age",
  DateTime: "DateTime",
  SinglelineText: "SinglelineText",
  MultilineText: "MultilineText",
  Mail: "Mail",
  Telephone: "Telephone",
  URL: "URL",
};

// カタログに載せない Field Type。
// - `Reference`（Field Type 16）は「**当該項目自体にデータを持つことはありません**」（docs/reference の
//   型一覧）＝値が無いので読む対象にならない。除外の理由は「値を持たない」ことであって「型が無い」ことではない。
// - `ー`（＝ `P_Deleted`）は**除外しない**。型は無いが**値は持つ**（0/1）ので、`null` として
//   カタログに載せる（ADR-0056）。この 2 つを一緒くたにしていたのが RV-26 の原因。
const NOT_IN_CATALOG = new Set(["Reference"]);

type RefField = { alias: string; fieldType: string };

// 接頭辞なしのリソース（Phase）は alias が素（`| Id | …`）。見出し行 `| Alias` と罫線 `| ---` を除く。
const BARE_ALIAS_ROW = /^\| ([A-Za-z][A-Za-z0-9_]*) +\|/;

/** reference の項目表から項目行を拾う（alias と Field Type 列だけ使う）。 */
const readReferenceFields = (path: string, prefix: string): RefField[] => {
  const rows: RefField[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (prefix === "") {
      const m = BARE_ALIAS_ROW.exec(line);
      if (!m || m[1] === "Alias") continue;
    } else if (!line.startsWith(`| ${prefix}.P_`)) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    const alias = prefix === "" ? cells[0] : cells[0]?.slice(prefix.length + 1);
    const fieldType = cells[2];
    if (alias === undefined || fieldType === undefined) continue;
    rows.push({ alias, fieldType });
  }
  return rows;
};

const TARGETS: { descriptor: ResourceDescriptor; doc: string }[] = [
  { descriptor: CANDIDATE_DESCRIPTOR, doc: "candidate" },
  { descriptor: JOB_DESCRIPTOR, doc: "job" },
  { descriptor: CLIENT_DESCRIPTOR, doc: "client" },
  { descriptor: RECRUITER_DESCRIPTOR, doc: "recruiter" },
  { descriptor: CONTACT_DESCRIPTOR, doc: "contact" },
  { descriptor: OPPORTUNITY_DESCRIPTOR, doc: "opportunity" },
  { descriptor: ACTIVITY_DESCRIPTOR, doc: "activity" },
  { descriptor: CONTRACT_DESCRIPTOR, doc: "contract" },
  { descriptor: SALES_DESCRIPTOR, doc: "sales" },
  { descriptor: PHASE_DESCRIPTOR, doc: "phase" },
  { descriptor: PROCESS_DESCRIPTOR, doc: "process" },
  { descriptor: RESUME_DESCRIPTOR, doc: "resume" },
  // マスタで唯一 Field Type 列を持つ（出典が Field List 記事なので型が載っている）。
  { descriptor: USER_DESCRIPTOR, doc: "user" },
];

// 型の列を持たないマスタ（出典が Read 記事の出力表＝ Tag と Definition しかない）。
// 有無だけを両方向で検査する。
const TYPELESS_MASTERS: { descriptor: ResourceDescriptor; doc: string }[] = [
  { descriptor: FIELD_DESCRIPTOR, doc: "field" },
  { descriptor: OPTION_DESCRIPTOR, doc: "option" },
  { descriptor: PARTITION_DESCRIPTOR, doc: "partition" },
];

// reference の表で「列に値が無い」ことを表す記号（全角ダッシュ）。カタログに載らない `ー`
// （＝ PORTERS が Data Type を与えていない・ADR-0056）とは別の文字なので、取り違えない。
const EMPTY_CELL = "—";

describe.each(TARGETS)(
  "reference ↔ カタログ: $descriptor.name",
  ({ descriptor, doc }) => {
    const fields = readReferenceFields(
      `docs/reference/resource-api/resources/${doc}.md`,
      descriptor.prefix,
    );
    const valued = fields.filter((f) => !NOT_IN_CATALOG.has(f.fieldType));
    const catalog = descriptor.fields as Record<string, DataType | null>;

    it("reference の表を読めている（前提の自己チェック）", () => {
      // 表の形が変わって 0 件になったら、以下の検査が素通りしてしまうので先に固定する。
      expect(fields.length).toBeGreaterThan(10);
      expect(valued.length).toBeGreaterThan(10);
    });

    it("値を持つ標準項目がすべてカタログにある（取りこぼしの検出）", () => {
      const missing = valued
        .map((f) => f.alias)
        .filter((alias) => !(alias in catalog));
      expect(missing).toEqual([]);
    });

    it("カタログの項目がすべて reference にある（幻の項目の検出）", () => {
      const known = new Set(fields.map((f) => f.alias));
      const phantom = Object.keys(catalog).filter((a) => !known.has(a));
      expect(phantom).toEqual([]);
    });

    it("Field Type → Data Type の対応が一致する（`ー` → null を含む）", () => {
      const mismatched = valued
        .filter((f) => f.alias in catalog)
        .map((f) => ({
          alias: f.alias,
          reference: DATA_TYPE_OF[f.fieldType],
          catalog: catalog[f.alias],
        }))
        .filter((x) => x.reference !== x.catalog);
      expect(mismatched).toEqual([]);
    });

    it("削除フラグの有無が reference と一致する（RV-26 / ADR-0056）", () => {
      // 持っているなら「型が無い」ことの記録が消える／`Number` 等に化けるのを防ぐ
      // （値は持つので除外もしない）。持っていないなら**こちらも持たない** — Opportunity は
      // PORTERS が P_Deleted を公表していない唯一のデータ系リソースで、揃えたくなる誘惑がある。
      // 無いものを足すのは「持っていない情報を発明する」ことなので、両方向で固定する。
      const inReference = fields.some((f) => f.alias === "P_Deleted");
      expect("P_Deleted" in catalog).toBe(inReference);
      if (inReference) expect(catalog.P_Deleted).toBeNull();
    });
  },
);

describe.each(TYPELESS_MASTERS)(
  "reference ↔ カタログ（型の列なし）: $descriptor.name",
  ({ descriptor, doc }) => {
    const path = `docs/reference/resource-api/resources/${doc}.md`;
    const fields = readReferenceFields(path, descriptor.prefix);
    const catalog = descriptor.fields as Record<string, DataType | null>;

    it("reference の表を読めている（前提の自己チェック）", () => {
      expect(fields.length).toBeGreaterThan(2);
    });

    it("型の列が無いことを確かめる（載ったら通常の突合へ移す）", () => {
      // ここが崩れたら reference に型が載ったということ。TARGETS へ移して型も突き合わせる。
      const typed = fields.filter((f) => f.fieldType !== EMPTY_CELL);
      expect(typed).toEqual([]);
    });

    it("reference の項目がすべてカタログにある（取りこぼしの検出）", () => {
      const missing = fields
        .map((f) => f.alias)
        .filter((alias) => !(alias in catalog));
      expect(missing).toEqual([]);
    });

    it("カタログの項目がすべて reference にある（幻の項目の検出）", () => {
      const known = new Set(fields.map((f) => f.alias));
      const phantom = Object.keys(catalog).filter((a) => !known.has(a));
      expect(phantom).toEqual([]);
    });
  },
);

describe("接頭辞を持たない行の扱い（Option の Items）", () => {
  it("Items だけが接頭辞なしの行で、カタログには載せない", () => {
    // `Items` は**入れ子の Item コレクション**＝値ではなく構造。ライブラリは木を深さ優先で
    // 平坦化し、親子は `P_ParentId` で辿れるようにしている（ADR-0021 軸3・案3a）ので、
    // カタログの項目として持たないのが正しい。ここで固定するのは「見落として落ちたのではなく、
    // 理由があって載せていない」ことと、**他に接頭辞なしの行が増えたら気づく**ようにするため。
    const rows = readFileSync(
      "docs/reference/resource-api/resources/option.md",
      "utf8",
    )
      .split("\n")
      .filter((line) => /^\| [A-Za-z]/.test(line))
      .map((line) => line.split("|")[1]?.trim())
      .filter((alias): alias is string => alias !== undefined)
      .filter((alias) => alias !== "Alias" && !alias.startsWith("Option."));
    expect(rows).toEqual(["Items"]);
    expect("Items" in OPTION_DESCRIPTOR.fields).toBe(false);
  });
});

describe("突合の前提", () => {
  it("reference のすべての Field Type を解釈できる（未知の型を見逃さない）", () => {
    // 新しい Field Type が reference に増えたら、DATA_TYPE_OF か NOT_IN_CATALOG の
    // どちらに入れるかを決める必要がある。黙って素通りさせない。
    const unknown = new Set<string>();
    for (const { descriptor, doc } of TARGETS) {
      for (const f of readReferenceFields(
        `docs/reference/resource-api/resources/${doc}.md`,
        descriptor.prefix,
      )) {
        if (
          !NOT_IN_CATALOG.has(f.fieldType) &&
          !(f.fieldType in DATA_TYPE_OF)
        ) {
          unknown.add(f.fieldType);
        }
      }
    }
    expect([...unknown]).toEqual([]);
  });
});
