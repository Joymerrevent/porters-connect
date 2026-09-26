# RV-71 🟡 `searchAll` が、`Total` の無い応答で 1 ページだけ返して黙って終わる

- 重要度: 🟡 ／ 観点: API 忠実性 / フェイルセーフ
- 状態: open

## 概要

`Total` が無い応答では `toInt` が 0 を返すので、`searchAll` は 1 ページ目で終わる。応答の `Start` を確かめないので、`start` を無視する応答では同じページを何度も返す。

## 根拠

- `src/accessor/paginate.ts:24` が `start >= page.total` で止まる。`Total` の欠けは `toInt` で 0 になる。
- [Read の reference][readref] は Option を除くすべてのリソースで `Total` / `Count` / `Start` が返ると書いている。
- 実測（サブエージェント・2026-09-26）: `Total` の無い応答では 1 回のリクエストで終わり、`start` を無視する応答では同じ 200 件を 5 回返した。

## 影響

🟡。取れていないのに、取り終えたように見える。前提（PORTERS が `Total` を省くか）は確かめていない。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- Option 以外で `Total` / `Start` が無い、または整数でない応答は読めない応答として投げる。
- `paginate` で、応答の `Start` が要求した `start` と同じであることを確かめる。

## 処置

—

[readref]: ../../usage/reference/resource-api/README.md
