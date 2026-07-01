# 35. 利用ドキュメントの構成（README の役割とトピック別 docs/guide の役割分担）

- Status: accepted
- Date: 2026-06-23
- Deciders: jun.shiromoto (Joymerrevent)

> F-1（`porters.auth.*`・[[0034-oauth-public-surface-impl]]）の実装を機に、**機能の使い方をどこに・どの粒度で書くか**の
> 方針を決める。今後 F-2〜F-4 でも公開 API が増えるため、**再利用できる構成方針**として起票。案A で `accepted`（2026-06-23）。

## Context and Problem Statement

F-1 で `porters.auth.*`（初回ブラウザ付与 `authorizationUrl` / `exchangeAuthorizationCode`、利用終了 `revokeUrl` /
`clearTokens`、`ensureAuthenticated` / `getToken`）を実装した。しかし `README.md` の「認証」節は**透過 `code_direct` の
自動取得まで**で、**初回ブラウザ付与の手順・コード例が無い**。「前提」節のリンク先は PORTERS の API リファレンス
（[authentication-api][auth-ref]）で、**ライブラリ `porters.auth.*` の使い方ではない**。＝実利用者が初回付与を実装する
手がかりが README から辿れない（ドキュメントの穴）。

今後 **F-2（Read クエリ）・F-3（マルチテナント）・F-4（一括書き込み）** でも公開 API が増える。毎回 README に全部
書けば**肥大化**し、書かなければ利用者が手順を**見つけられない**（フェイルセーフに反する）。
既に [`docs/guide/error-handling.md`][error-handling]（README は短い節＋ `>` ポインタ、深掘りはガイド）という**前例**がある。

決めるべきは「**利用ドキュメントをどこに・どの粒度で・どう増やすか**」。本 ADR はその方針を定め、**F-1 を最初の適用例**にする
（実装＝ガイド本文の執筆は accepted 後の別 PR）。

## Decision Drivers

- **普及（discoverability）**: README は npm/GitHub の第一印象。**機能の存在は README で気づけること**（`使われること` が最優先）。
- **保守性**: README の肥大化を避ける。**1 トピック 1 ファイル**＝差分が小さく・探しやすい・更新箇所が局所化。
- **フェイルセーフ**: 初回付与のような**必須手順が必ず辿れる**こと。穴（手順が無い）を作らない。
- **既存パターンとの一貫**: [`error-handling`][error-handling] と同形なら学習コストが低く、F-2〜F-4 も同じ型で足せる。
- **日本語ファースト →（後で）英語**（`CLAUDE.md`）。公開 API の用語・型名は英語、解説は日本語。
- **md 規約**: 参照スタイルリンク・markdownlint（`CLAUDE.md`）。

## Considered Options

- 案A: **README＝短い節＋ポインタ／深掘り＝`docs/guide/<topic>.md`**（[`error-handling`][error-handling] と同形）。
  F-1 は `docs/guide/oauth.md` を新設。（推奨）
- 案B: **README にすべて書く**（独立ガイドを作らない）。
- 案C: **ガイドのみ**（README には使い方を書かず、`docs/guide` へのリンク集に留める）。

## Decision Outcome

**採用: 案A**。README は「**存在に気づき、最短で動かす**」入口に保ち、各機能の網羅的な手順は
`docs/guide/<topic>.md` に逃がす＝**肥大化を避けつつ穴も作らない**。[`error-handling`][error-handling] の前例と一貫し、
F-2〜F-4 も同じ型で増やせる（再利用）。

F-1 への具体的な適用（accepted・別 PR で実施）:

- **新規 `docs/guide/oauth.md`**（章立て案）:
  1. 全体像（普段は透過 `code_direct`／初回だけ人手のブラウザ付与）
  2. 初回権限付与: `authorizationUrl({ redirectUrl, scopes, state })` → ブラウザで承諾 → redirect の `?code=` を
     `exchangeAuthorizationCode(code)`（成功 `void`・失敗 throw）
  3. 起動時の確認: `ensureAuthenticated()`（fail-fast）／ デバッグ: `getToken()`
  4. 利用終了: `revokeUrl()`（ブラウザ・サーバ側削除）＋ `clearTokens()`（ローカル破棄）
  5. カスタム `TokenProvider` 時の挙動（credential 依存メソッドは `PortersConfigError`）
  6. 出典: [[0007-oauth-public-surface]] / [[0034-oauth-public-surface-impl]] / [authentication-api][auth-ref]
- **README の最小追記**: 「認証」節に `porters.auth.*`（初回付与）を 3〜5 行＋ `>` でガイドへ誘導。「前提」節のリンクを
  ガイドへ向け直し、末尾にリンク定義を追加。

### Consequences

- Good: README は簡潔なまま、機能は発見可能で、必須手順の穴を塞ぐ。トピック別で保守が容易。F-2〜F-4 に再利用できる型になる。
- Bad: 管理するファイルが増える。README とガイドで軽い二重メンテ（README は要点のみ＝負担を抑制）。
- Neutral: 英語版は後追い（日本語ファースト）。各ガイドの粒度・例の量はトピックごとに判断。

## Pros and Cons of the Options

### 案A: README 短節＋ポインタ／深掘りはガイド（推奨）

- Good: 既存（error-handling）と一貫・README 肥大化を回避・機能は発見可能・穴を塞ぐ・横展開しやすい。
- Bad: ファイルが増える。README↔ガイドの整合を保つ手間（要点のみで軽減）。

### 案B: README に全部書く

- Good: リンク追跡が不要・情報が 1 箇所。
- Bad: README が肥大化し読みにくい。機能追加のたびに巨大化。差分が大きく履歴が追いにくい。

### 案C: ガイドのみ（README はリンク集）

- Good: README は最小。
- Bad: **機能の存在に気づきにくく普及に逆行**。初回付与のような必須手順が入口から埋もれる（フェイルセーフに反する）。

## More Information

- 起点: F-1 実装（`porters.auth.*`・[[0034-oauth-public-surface-impl]] / [[0007-oauth-public-surface]]）。
- 前例: [`docs/guide/error-handling.md`][error-handling]（README 短節＋ポインタ＝本 ADR が一般化する形）。
- 規約: `CLAUDE.md`（日本語ファースト／公開 API は英語／md 参照スタイル）。
- 後続: 本 ADR が `accepted` になったら、**別 PR**で `docs/guide/oauth.md` 新設＋README 追記（ADR 先行→実装の順）。
  F-2〜F-4 も同じ型（`docs/guide/<topic>.md` ＋ README 短節）で追加する。

[auth-ref]: ../reference/authentication-api/README.md
[error-handling]: ../guide/error-handling.md
