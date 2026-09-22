import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  GENERATED,
  LINKABLE_OUTSIDE,
  idFindings,
  linkFindings,
  readUserDocs,
  stripComments,
} from "./check-usage-docs.mjs";

const tree = (files) => new Map(Object.entries(files));

describe("stripComments（HTML コメントを剥がす）", () => {
  it("行内のコメントを消し、本文は残す", () => {
    expect(stripComments("接頭辞を書きません<!-- 根拠: ADR-0059 -->。\n")).toBe(
      "接頭辞を書きません。\n",
    );
  });

  it("複数行のコメントは同じ数の改行に置き換える（行番号がずれない）", () => {
    const src = "a\n<!-- 根拠:\n- ADR-0038\n-->\nb\n";
    const out = stripComments(src);
    expect(out.split("\n")).toHaveLength(src.split("\n").length);
    expect(out).toBe("a\n\n\n\nb\n");
  });
});

describe("idFindings（本文の保守者向け識別子）", () => {
  it("コメントに入っている識別子は拾わない", () => {
    expect(
      idFindings(
        tree({
          "docs/usage/a.md":
            "接頭辞を書きません<!-- 根拠: ADR-0059・RV-36・LV-14 -->。\n<!-- CLAUDE.md の規約 -->\n",
        }),
      ),
    ).toEqual([]);
  });

  it("本文に残った識別子は行番号付きで拾う（コメントの行数を差し引かない）", () => {
    const found = idFindings(
      tree({
        "docs/usage/a.md":
          "<!-- 根拠:\n- ADR-0001\n-->\n本文（[ADR-0059][adr59]）。\n未確認です（LV-14）。\n",
      }),
    );
    expect(found).toEqual([
      "docs/usage/a.md:4: 本文（[ADR-0059][adr59]）。",
      "docs/usage/a.md:5: 未確認です（LV-14）。",
    ]);
  });

  it("コード例のコメントも本文として見る（利用者に見える）", () => {
    expect(
      idFindings(
        tree({
          "docs/usage/a.md": "```ts\nnew X(); // 対象外（ADR-0047）\n```\n",
        }),
      ),
    ).toHaveLength(1);
  });
});

describe("linkFindings（保守者向け文書へのリンク）", () => {
  it("docs/usage の中・allowlist・外部 URL・同一ページ内は拾わない", () => {
    expect(
      linkFindings(
        tree({
          "docs/usage/topics/a.md": [
            "[b]: ../topics/b.md",
            "[c]: b.md#section",
            "[root]: ../../../README.md",
            "[docs]: ../../README.md",
            "[fake]: ../../fake-server-runbook.md",
            "[ext]: https://example.com/docs/adr/0001.md",
            "[mail]: mailto:x@example.com",
            "[frag]: #section",
            "",
          ].join("\n"),
          "README.md": "[usage]: ./docs/usage/index.md\n[lic]: ./LICENSE\n",
        }),
      ),
    ).toEqual([]);
  });

  it("docs/ の保守者向けディレクトリへのリンクを、解決先付きで拾う", () => {
    expect(
      linkFindings(
        tree({
          "docs/usage/topics/a.md": [
            "[adr]: ../../adr/0006-error-model.md",
            "[prd]: ../../design/requirements.md#r-10",
            "[rv]: ../../reviews/rv/0036.md",
            "[lv]: ../../live-verification.md",
            "",
          ].join("\n"),
          "README.md": "[rm]: ./docs/roadmap.md\n",
        }),
      ),
    ).toEqual([
      "docs/usage/topics/a.md:1: ../../adr/0006-error-model.md → docs/adr/0006-error-model.md",
      "docs/usage/topics/a.md:2: ../../design/requirements.md#r-10 → docs/design/requirements.md",
      "docs/usage/topics/a.md:3: ../../reviews/rv/0036.md → docs/reviews/rv/0036.md",
      "docs/usage/topics/a.md:4: ../../live-verification.md → docs/live-verification.md",
      "README.md:1: ./docs/roadmap.md → docs/roadmap.md",
    ]);
  });

  it("inline リンク `[text](target)` も見る（規約では使わないが、書かれたら拾う）", () => {
    expect(
      linkFindings(
        tree({
          "docs/usage/a.md": "詳しくは [ADR](../adr/0001.md) を参照。\n",
        }),
      ),
    ).toEqual(["docs/usage/a.md:1: ../adr/0001.md → docs/adr/0001.md"]);
  });

  it("docs/usage の外でも、ソースの外（`src/`・`CLAUDE.md`）へのリンクは拾う", () => {
    expect(
      linkFindings(
        tree({
          "docs/usage/a.md":
            "[src]: ../../src/index.ts\n[c]: ../../CLAUDE.md\n",
        }),
      ),
    ).toHaveLength(2);
  });

  it("コメントの中のリンクは拾わない", () => {
    expect(
      linkFindings(
        tree({
          "docs/usage/a.md": "<!-- [adr]: ../adr/0001.md -->\n",
        }),
      ),
    ).toEqual([]);
  });

  it("allowlist は開発者向け資料の入口と clone した利用者向けの手順書だけ", () => {
    // 増やすときは「利用者がそこへ行く理由」を script のコメントに書く。
    expect([...LINKABLE_OUTSIDE].filter((p) => p.startsWith("docs/"))).toEqual([
      "docs/README.md",
      "docs/fake-server-runbook.md",
    ]);
  });
});

describe("readUserDocs（対象ファイルの収集）", () => {
  let root;
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("docs/usage を再帰し、生成物 docs/usage/api と .md 以外は除き、README.md を足す", () => {
    root = mkdtempSync(join(tmpdir(), "usage-docs-"));
    mkdirSync(join(root, "docs/usage/topics"), { recursive: true });
    mkdirSync(join(root, GENERATED, "classes"), { recursive: true });
    writeFileSync(join(root, "README.md"), "# readme\n");
    writeFileSync(join(root, "docs/usage/index.md"), "# index\n");
    writeFileSync(join(root, "docs/usage/topics/a.md"), "# a\n");
    writeFileSync(join(root, "docs/usage/topics/note.txt"), "not md\n");
    writeFileSync(join(root, GENERATED, "README.md"), "generated\n");
    writeFileSync(join(root, GENERATED, "classes/X.md"), "generated\n");
    expect([...readUserDocs(root).keys()].sort()).toEqual([
      "README.md",
      "docs/usage/index.md",
      "docs/usage/topics/a.md",
    ]);
  });
});
