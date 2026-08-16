# RV-15 🟢 送信前ガードが同期 throw する経路がある

- 重要度: 🟢 ／ 観点: エラーモデル / DX
- 状態: fixed

## 概要

Promise を返す公開メソッドの一部が、**Promise を返す前に同期 throw** する。`search()` は URL 組立
（`buildReadUrl` → `appendReadQuery`）を **async 境界の外**で行うため、`keywords` 100 字超・`itemstate` 制限違反は
同期例外になる。`attachment.create/update` の 10MB ガードも同様。一方 `requester` のサイズガードは async 内なので
reject される＝**同じ `PortersConfigError` が経路によって throw だったり reject だったり**する。
`porters.candidate.search(q).catch(handler)` は前者を捕まえられない（`await` + try/catch なら捕まる）

## 根拠

`src/resources/resource.ts:210-215`（`search` が `readUrl(...)` を同期評価）/ `src/resources/query.ts:240`（keywords ガード）,
`:186`（itemstate ガード）/ `src/resources/attachment.ts:200,214`（`guardContent`）/ 対比: `src/http/requester.ts:83`（async 内）。
方針としては [ADR-0024][adr24] の `createMockTransport` が「**同期 throw ではなく reject** させる（Transport 契約に忠実）」と
明記しており、公開リソース面がその原則から外れている

## 検出経緯

[ADR-0043][adr43] フェーズ4 の制約テスト作成中（`expect(...).rejects` が効かず判明）

## 推奨

公開メソッドを `async` にする／ガードを Promise 内へ移すなどで **常に reject** に統一する（薄い変更・挙動は
「例外の届き方」のみ）。破壊的ではないが公開契約の明確化なので **ADR で一言決める**のが妥当

## 処置

[ADR-0046][adr46] を **accepted**（案A＝公開メソッドを `async` 化して reject に統一・decider 2026-08-09）ののち**実装**。
データ系（`search` / `create` / `update` / `createMany` / `updateMany`）・Attachment（`search` / `create` / `update`）・
マスタ Read 4 種の `search`・`auth.getToken` を `async` 化した（**ガードのロジックも実装位置も不変**＝例外の届き方だけを変更）。
`get` / `current` / `exchangeAuthorizationCode` / `clearTokens` / `ensureAuthenticated` は元から async、
`searchAll` は async generator で呼び出し時点では何も起きない（変更せずテストで固定）。
`test/integration/exception-contract.test.ts` で公開サーフェス全体を歩き「同期 throw しない」を退行防止。
README・[エラーハンドリング ガイド][guide]に「例外の届き方」節を追加。semver は minor

[adr24]: ../../adr/0024-mock-transport.md
[adr43]: ../../adr/0043-local-fake-server.md
[adr46]: ../../adr/0046-guard-error-contract.md
[guide]: ../../guide/error-handling.md
