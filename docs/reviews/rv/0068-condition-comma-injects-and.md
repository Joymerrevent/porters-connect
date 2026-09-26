# RV-68 🔴 条件の値の中のカンマが、別の AND 条件として読まれる

- 重要度: 🔴 ／ 観点: API 忠実性 / フェイルセーフ
- 状態: fixed

## 概要

`condition` の値の中のカンマと、条件を区切るカンマが、送信時に同じ `%2C` になる。PORTERS 側では区別できないので、値の途中から別の条件として解釈される。

## 根拠

- `src/accessor/append-read-query.ts:108` が条件を `,` で連結し、値の中のカンマはそのまま残る。
- [ADR-0038][adr38] の SD-8 は「値内のエンコードは URLSearchParams 任せ」としているが、URLSearchParams は区切りのカンマと値のカンマを同じ `%2C` にする。
- [Read の reference][readref] は「`condition`: カンマ区切りは AND」とだけ書き、値の中のカンマのエスケープ方法は書いていない。
- 実測（2026-09-26）: `condition: { P_Name: { part: "山田,Person.P_Owner:eq=5" } }` の `condition` は `Person.P_Name:part=山田,Person.P_Owner:eq=5` として送られた。

## 影響

🔴。利用者の入力をそのまま条件に使うと、検索結果が黙って変わる（別の条件が足される）。削除済みを読むときの「条件に使える項目の制限」も、この形なら通ってしまう。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- **要 ADR**（ADR-0105 で起票）。SD-8 の前提を改めるため。案: 条件の値（文字列と、Option / Link の値）にカンマがあれば、送信前に `PortersConfigError` で拒否する。`keywords` の要素の中のカンマも同じく拒否する。
- コロンは拒否しない（日時の値 `HH:MM:SS` にも含まれ、PORTERS は最初のコロンで区切ると見られる）。値の中のコロンの扱いは LV に登録する。

## 処置

**実施（2026-09-26・fix/accessor-review・`49f16c2`）。** [ADR-0105][adr105] の案A で、`src/accessor/append-read-query.ts` が、条件の値のカンマ、一覧の要素のカンマとコロン、キーワードの要素のカンマを送る前に `PortersConfigError` で拒否する。テキストと日時の値のコロンは拒否しない。

## 検証

`src/accessor/append-read-query.test.ts` の「区切り文字を含む値（ADR-0105・RV-68）」。削除済みを読むときの項目の制限も、値の細工で越えられないことを確かめる。`append-read-query.ts` のミューテーションはすべて検出。

[adr38]: ../../adr/0038-read-query-surface-impl.md
[readref]: ../../usage/reference/resource-api/README.md
[adr105]: ../../adr/0105-reject-delimiters-in-query-values.md
