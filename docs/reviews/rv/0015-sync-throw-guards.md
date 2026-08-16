# RV-15 🟢 送信前ガードが同期 throw する経路がある

- 重要度: 🟢 ／ 観点: エラーモデル / DX
- 状態: fixed

## 概要

`Promise` を返す公開メソッドの一部が、**Promise を返す前に同期 throw** していた。
同じ `PortersConfigError` が、経路によって throw だったり reject だったりする状態。

## 根拠

- `src/resources/resource.ts:210-215` — `search` が URL 組立（`buildReadUrl` → `appendReadQuery`）を
  **async 境界の外**で行うため、`keywords` 100 字超・`itemstate` 制限違反は同期例外になる。
- `src/resources/query.ts:240`（keywords ガード）, `:186`（itemstate ガード）。
- `src/resources/attachment.ts:200,214` — `guardContent` の 10MB ガードも同様。
- 対比: `src/http/requester.ts:83` のサイズガードは async 内なので **reject** される。
- [ADR-0024][adr24] は `createMockTransport` について
  「**同期 throw ではなく reject** させる（Transport 契約に忠実）」と明記しており、
  公開リソース面がその原則から外れている。

## 影響

`porters.candidate.search(q).catch(handler)` が**捕まえられない**（`await` + try/catch なら捕まる）。
利用者から見ると「同じ種類のエラーなのに捕まえ方が違う」という**予測不能性**が問題で、
実害は限定的（多くの利用者は `await` を使う）なので 🟢。
ただし公開契約としての一貫性は、後から直すほど影響範囲が広がる。

## 検出経緯

[ADR-0043][adr43] フェーズ4 の制約テスト作成中。`expect(...).rejects` が効かず判明した
（[2026-08-09-01][run809]）。これも**フェイクを作らなければ踏まなかった**経路。

## 推奨

公開メソッドを `async` にする／ガードを Promise 内へ移すなどで**常に reject** に統一する。
破壊的ではないが公開契約の明確化なので、**ADR で一言決める**のが妥当。

## 処置

[ADR-0046][adr46] を **accepted**（案A＝公開メソッドを `async` 化して reject に統一）ののち実装。
データ系（`search` / `create` / `update` / `createMany` / `updateMany`）・
Attachment（`search` / `create` / `update`）・マスタ Read 4 種の `search`・`auth.getToken` を `async` 化した。
**ガードのロジックも実装位置も不変**＝例外の届き方だけを変えている。

## 検証

- `get` / `current` / `exchangeAuthorizationCode` / `clearTokens` / `ensureAuthenticated` は元から async、
  `searchAll` は async generator で呼び出し時点では何も起きないことをテストで固定（変更していない）。
- `test/integration/exception-contract.test.ts` が**公開サーフェス全体を歩いて「同期 throw しない」**を
  退行防止している（1 つでも同期 throw に戻れば落ちる）。
- README と[エラーハンドリング ガイド][guide]に「例外の届き方」節を追加。semver は minor。

[adr24]: ../../adr/0024-mock-transport.md
[adr43]: ../../adr/0043-local-fake-server.md
[adr46]: ../../adr/0046-guard-error-contract.md
[guide]: ../../guide/error-handling.md
[run809]: ../2026-08-09-01.md
