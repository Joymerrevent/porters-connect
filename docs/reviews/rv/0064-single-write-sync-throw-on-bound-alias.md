# RV-64 🟢 単件の `create` / `update` が、束ねた alias を渡されたときだけ同期 throw する（ADR-0046 の契約違反）

- 重要度: 🟢 ／ 観点: API 忠実性 / エラーモデル
- 状態: fixed

## 概要

[ADR-0046][adr46] は「`Promise` を返す公開メソッドは、いかなる理由でも同期 throw しない。設定ミスも含めて
すべて reject で届く」を契約として確定した。ところが単件の `create` / `update` だけが `async` でなく、
`write(withDefaults({...}), ...)` の**引数の評価中**に走る `withDefaults` の拒否（[RV-47][rv47]: `of()` で束ねた
alias、いまは Phase の `Resource`）が**同期 throw** になっていた。`t.phase.of("candidate").create({ ..., Resource: 1 })`
は `.catch()` で拾えない。

## 根拠

- `src/resources/resource.ts` — 修正前の `create` / `update` は `async` でない arrow で、`write(withDefaults(...))` の
  形。`withDefaults` は束ねた alias が入力にあると `PortersConfigError` を throw する（RV-47 の処置）。
  同じファイルの `createMany` / `updateMany` は「引数の評価が `runBulkWrite` に入る前に行われるので `async`」と
  コメント付きで対処済み（ADR-0046）。単件だけが漏れていた。
- 実測（2026-09-23・vitest で 7 経路を呼び分け）: 検索の `keywords` 超過・作成の日時書式・更新の選択肢 alias・
  Attachment の 10MB・独自 provider での `exchangeAuthorizationCode` は **reject**。Phase の `create` / `update` に
  `Resource` を渡した場合だけ **同期 throw**（`PortersConfigError`）。
- `docs/usage/topics/errors.md`「例外の届き方」— 「`Promise` を返す公開メソッドは、いかなる理由でも同期 throw
  しません」と読者に約束している。

## 影響

🟢。到達経路は狭い。`Resource` は入力型で `?: never` に塞いであるので（RV-47）、TypeScript から普通に書く限り
渡せない。到達するのは `as any` を通した場合と、JavaScript から呼ぶ場合。ただし到達すれば
`porters.phase.of(...).create(input).catch(handler)` が例外を取り逃がし、ADR-0046 が挙げた「`.catch()` 利用者が
捕まえられない」そのものになる。ガイドの約束にも反する。

## 検出経緯

使い方ドキュメントの校閲中（#378）に、stakeholder が「`Promise` を返す公開メソッドは同期 throw しません」の
文が正しいかを質問。ADR-0046 とテスト（`resource.test.ts` / `read-core.test.ts`）を確かめたうえで、公開メソッド
の実装が `async` かを一覧し、`create` / `update` だけが `async` でないことに気づき、7 経路を実際に呼んで
同期 throw を再現した。RV-47 の処置（`withDefaults` の拒否）が ADR-0046 の後に入り、そのとき `async` 化が
漏れた、という類型。

## 推奨

- (a) `create` / `update` を `async` にする（引数の評価も Promise の内側に入る）。1 行ずつの変更で、
  例外の種類・メッセージ・`category` は変わらない＝非破壊。`createMany` / `updateMany` と同じコメントを添える。
- (b) 回帰テスト: 束ねた alias を渡した `create` / `update` が「同期 throw せず reject する」ことを、
  ADR-0046 の既存テストと同じ形（`expect(() => …).not.toThrow()` ＋ `rejects`）で押さえる。
- (c) ガイド「例外の届き方」の「この規則の例外は `Promise` を返さない API です — `new PortersClient` …」は
  網羅していない（`tenant()`・`createThrottle`・`createFetchTransport`・`encodeTimeOfDay` / `decodeTimeOfDay`・
  `assertFieldsMatch` も同期 throw）。列挙をやめて規則で書くか「例:」を付ける。**#378 側で直す**
  （利用者向け文書はそちらで編集中のため、衝突を避ける）。

## 処置

**実施（案 (a)・(b)・2026-09-23・本 PR）。** `src/resources/resource.ts` の単件 `create` / `update` を `async` にし、
根拠のコメントを添えた。`src/resources/resource.test.ts` の RV-47 の describe に、`create` / `update` それぞれで
「同期 throw せず reject で届く」テストを足した。案 (c) は #378 で扱う。

## 検証

- `pnpm exec vitest run src/resources/resource.test.ts` — 53 件 pass（新規 2 件を含む。修正前は `not.toThrow()` で落ちる）。
- `pnpm typecheck` / `pnpm lint` / `pnpm check:api` — 緑（公開型は変わらないので API リファレンスに差分なし）。

[adr46]: ../../adr/0046-guard-error-contract.md
[rv47]: 0047-phase-binding-overridable.md
