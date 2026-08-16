# RV-7 🟢 未モック route のエラーメッセージが冗長

- 重要度: 🟢 ／ 観点: ドキュメント / DX
- 状態: fixed

## 概要

`createMockTransport` の未モック route エラー（`PortersConfigError`）が **`req.url` 全体**を
埋め込むため、[ADR-0020][adr20] の既定 field を載せた Read URL（例: Job は約 1.2KB）で
メッセージが極端に長くなる。どの route を足せばよいかは method ＋ パス部で足りる。

## 根拠

- `src/http/mock-transport.ts` — `no mock response for ${req.method} ${req.url}`。
- `pnpm sandbox` 実行時、Job 検索の未モックで巨大な URL がそのまま出力された（実測）。

## 影響

**利用者の作業を止めはしないが、必要な情報が巨大なクエリ文字列に埋もれる**。
評価用モック（R-17）は「契約なしで試す」入口なので、最初に触る人が最初に見るエラーがこれ＝
第一印象の DX に直接効く。実害は可読性のみなので 🟢。

## 検出経緯

[2026-06-19-01][run619]。R-17 の受け入れ確認として `pnpm sandbox` を実際に走らせ、
出力を目で見て気づいた（コードを読むだけでは「長い」と分からない）。

## 推奨

メッセージを method ＋ パス（`new URL(req.url).pathname` 等）に絞る。
完全な URL が要るなら `context` など別フィールドへ退避する。

## 処置

`routeLabel(method, url)` を追加し、未モック route エラーを
**method ＋ `new URL(url).pathname`**（クエリ省略）に変更した。
不正な URL は raw にフォールバックする（メッセージ生成でさらに例外を出さない＝フェイルセーフ）。

## 検証

`pnpm sandbox` の Job 未モックが `GET /v1/job` と簡潔に表示されることを実測で確認。
pathname 経路とフォールバック経路の双方に回帰テストを追加した。

[adr20]: ../../adr/0020-read-field-default.md
[run619]: ../2026-06-19-01.md
