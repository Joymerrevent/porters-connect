# RV-7 🟢 未モック時エラーメッセージが冗長

- 重要度: 🟢 ／ 観点: ドキュメント / DX
- 状態: fixed

## 概要

`createMockTransport` の未モック route エラー（`PortersConfigError`）が `req.url` 全体を埋め込むため、ADR-0020 の既定 field を載せた Read URL（例 Job ~1.2KB）でメッセージが極端に長くなる。どの route を足すべきかは method + パス部で十分で、巨大なクエリ文字列はノイズ

## 根拠

`src/http/mock-transport.ts`（`no mock response for ${req.method} ${req.url}`）/ `pnpm sandbox` 実行時に Job 検索の未モックで巨大 URL がそのまま出力された

## 推奨

メッセージは method + パス（`new URL(req.url).pathname` 等）に絞るか、クエリを省略/短縮。完全 URL が要るなら `context`/別フィールドに退避

## 処置

`routeLabel(method, url)` を追加し、未モック route エラーを `method + new URL(url).pathname`（クエリ省略）に変更。不正 URL は raw にフォールバック（フェイルセーフ）。`pnpm sandbox` の Job 未モックが `GET /v1/job` と簡潔表示になることを確認。pathname/フォールバック双方の回帰テストを追加
