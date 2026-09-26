# RV-83 🟡 読み込みで、値の前後の空白と改行が消え、数値文字参照がデコードされない

- 重要度: 🟡 ／ 観点: API 忠実性
- 状態: fixed

## 概要

XML の読み込みで `trimValues: true` にしているので、複数行テキストの前後の空白や改行が消える。数値文字参照（`&#12354;` など）はそのまま残る。

## 根拠

- `src/xml/parse-xml.ts:17`（`trimValues: true`）と、実体の既定の処理。
- 実測（サブエージェント・2026-09-26）: `<P_Memo>\n line1\n</P_Memo>` は `"line1"` になった。`&#12354;&#x41;` は文字のまま残った。

## 影響

🟡。複数行テキストを読んで書き戻すと、データが変わる。PORTERS が数値文字参照を返すかは確かめていない。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- 値の位置は trim しない形にし、レコードの中の空白だけのテキストを捨てる。数値文字参照をデコードする設定にする。どちらもテストで裏付ける。

## 処置

**実施（2026-09-26・fix/xml-review・`0888bfc`）。** `src/xml/parse-xml.ts` で `trimValues: false`・`htmlEntities: true` にし、整形された応答の要素の間の空白だけを読んだあとに取り除く。

## 検証

`src/xml/parse-resource-page.test.ts` の「keeps the whitespace around a value, and decodes character references」「drops the layout whitespace of a pretty-printed response」「keeps text that sits next to child elements」。
