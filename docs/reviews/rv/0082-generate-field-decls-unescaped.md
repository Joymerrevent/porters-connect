# RV-82 🟡 `generateFieldDecls` が、テナントの項目名をエスケープせずに生成するコードへ埋め込む

- 重要度: 🟡 ／ 観点: フェイルセーフ / DX
- 状態: open

## 概要

生成するソースコードに、alias を引用符なしのキーとして、項目名をコメントとしてそのまま入れる。改行を含む項目名はコメントを抜け、生成物にコードが入る。

## 根拠

- `src/fields/generate-field-decls.ts`（`includeNames` の処理と、158 行目の `export const ${constName}`）。
- 実測（サブエージェント・2026-09-26）: 出力に `U_foo-bar: f.singlelineText(),`（コンパイルできない）と、改行でコメントを抜けた `U_injected: f.number(),` の行、`export const my-fields` が出た。

## 影響

🟡。生成物はコミットする前提なので、テナントの設定から任意のコードが入りうる。PORTERS が項目名に使える文字は確かめていない。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- キーは識別子でなければ `JSON.stringify` で引用する。コメントに入れる値は改行と `*/` を取り除く。`constName` は識別子の形を確かめる。

## 処置

—
