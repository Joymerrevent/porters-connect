# RV-87 🟡 XML の属性が、値に混ざる

- 重要度: 🟡 ／ 観点: API 忠実性
- 状態: open

## 概要

`ignoreAttributes: false` を全体にかけているので、ルート以外の要素の属性が値として読まれる。

## 根拠

- `src/xml/parse-xml.ts:12`。
- 実測（サブエージェント・2026-09-26）: Option の選択肢に `"@_count"` が入り、`<Item x="1">` の Item が `@_x` を持ち、属性付きの Image の子要素が `null` になった。

## 影響

🟡。PORTERS が属性を返すかは確かめていない。返せば、値が黙って変わる。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- ルートの属性（`Total` など）だけを残し、ほかの属性は無視する設定にする。

## 処置

—
