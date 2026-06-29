# Changelog

このプロジェクトの主な変更を記録します。形式は [Keep a Changelog][kac] に準拠し、
バージョニングは [Semantic Versioning][semver] に従います。

## [Unreleased]

### Added

- **マルチテナント面**（F-3 / ADR-0040・ADR-0008/0021）。`porters.tenant(id)` で partition（Company DB）を
  束ねたアクセサ群 `TenantScope` を返します。`porters.tenant(123).candidate.search(...)` は `partition=123`
  を毎回付与し、未束ねの呼び出しは **client 既定 `partition`** を使います（解決は tenant スコープ／client 既定の 2 層）。
  - スコープは data（candidate/job/client/process/resume）＋ attachment ＋ master Read（user/field/option）を露出。
    `auth`（App 単位）・`partition` マスタ（発見専用・partition 非送信）・`tenant`（ネスト不可）は含みません。
  - partition 別トークンが必要な場合は**テナント別 `PortersClient`** を構築（ADR-0008 案3）。
  - 新規 export 型 `TenantScope`。`PortersClientOptions.partition` の JSDoc を更新（per-call 引数は設けない方針）。

## [0.4.0] - 2026-06-27

### Added

- **Read クエリ面の拡充**（F-2 / ADR-0038・ADR-0005 R-5）。データ系の `search` / `searchAll` が次を受けます。
  - `order` — 並び順 `[{ 項目: "asc" | "desc" }]`（数値・日時・System 型のみ）。
  - `keywords` — テキスト項目の AND キーワード検索（`string[]`・カンマ込み 100 文字まで。超過は送信前に `PortersConfigError`）。
  - `itemstate` — `"existing"`（既定）/ `"deleted"` / `"all"`。削除 API 非提供下で**削除済みデータを読む唯一の手段**
    （`condition` は `P_Id` / `P_UpdateDate` / `P_UpdatedBy` に限定・実行時ガード／更新日 90 日以内は PORTERS 側が自動付与）。
  - 新規 export 型 `Condition` / `Order` / `ItemState` / `SearchQuery`。

### Changed

- **（破壊的）`condition` を型安全化**。`{ "Person.P_Name:part": "山田" }`（loose な `Record<string,string>`）から
  **`{ P_Name: { part: "山田" } }`**（項目の Data Type が許す演算子だけを受ける型付き形・ADR-0038 案1a）へ変更。
  日時の値は ISO 8601（UTC `…Z`）で渡すと PORTERS 形式へ自動変換。**pre-1.0 のため minor**。
  - 移行: キーを `"Alias:suffix"` から**接頭辞なしの項目名**へ、値を `{ suffix: 値 }` へ。
    例 `{ "Person.P_Id:eq": "1" }` → `{ P_Id: { eq: 1 } }`。テキスト項目は `eq` 不可（`part` / `full`）。

## [0.3.0] - 2026-06-23

### Added

- **OAuth 公開面 `porters.auth.*`**（ADR-0007 SD-3/SD-6 ／ ADR-0034・F-1）。初回のブラウザ権限付与とトークン運用を補助します。
  - `authorizationUrl(opts)` / `revokeUrl(opts)` — ブラウザの `code` / `remove` グラント URL を生成（App Secret は URL に出さない）。
  - `exchangeAuthorizationCode(code)` — redirect の `?code=` をトークンに交換し内部保存（成功時 `void`・失敗時 throw）。
  - `clearTokens()` — ローカルの cache ＋ トークンストアを破棄。
  - `ensureAuthenticated()` / `getToken()` — トークンのウォームアップ／取得（Refresh Token は返さない）。カスタム auth ストラテジでも動作。
  - カスタムストラテジ下では credential 依存メソッドが `PortersConfigError`。新規 export 型 `AuthApi` / `AuthorizationUrlOptions` / `RevokeUrlOptions`。利用手順は [docs/guide/oauth.md][oauth-guide]。

### Fixed

- `PortersClientOptions.partition` の JSDoc 誤記（「overridable per call」）を訂正。per-call 上書きは未対応・予定（ADR-0033）で、partition は構築時に固定です（実行時の挙動変更なし）。

## [0.2.1] - 2026-06-22

メンテナンスリリース。**公開 API・実行コードの変更はありません**（`src/` 変更なし）。
主にリリース自動化・CI 整備とドキュメント拡充です。

### Fixed

- README の Node バッジ表記を `Node >= 18` → `Node >= 20` に修正（`engines` は 0.2.0 で既に `>=20`。バッジの追従漏れを解消し、以後は `check:release` でドリフトを検知）。

### Changed

- サポート方針を「最新の `0.1.x` のみ」から「**最新のリリース版のみ**」に更新（SECURITY.md）。
- リリースを半自動化：`main` マージで自動タグ（`tag.yml`）＋ GitHub Release 公開で OIDC publish（`release.yml`）（ADR-0029）。
- リリース前ゲートを CI に追加：version／CHANGELOG／README バッジのドリフト検査と版番号検証（`check:release`・ADR-0027／0031／0032）。
- 公開物の健全性検査 `check:publish`（publint／are-the-types-wrong）を追加。
- docs-only PR の CI を軽量化（ADR-0028）。

## [0.2.0] - 2026-06-20

### Changed

- **最低 Node を 20 に引き上げ**（`engines` を `>=20`、ビルド target を `node20`）。Node 18 は EOL かつ開発ツールチェーン（vitest / eslint）が非対応のため。利用には Node 20 以上が必要です。

## [0.1.1] - 2026-06-19

メンテナンスリリース。**公開 API・実行コードの変更はありません**（`src/` 変更なし）。
主に依存の更新とドキュメント整備です。

### Changed

- 依存 `fast-xml-parser` の下限を `^5.8.0` → `^5.9.2` に更新。
- README に npm バッジとインストール手順（npm / pnpm / yarn）を追加。

### Security

- 開発依存（推移的）の脆弱性 4 件を解消（`js-yaml` / `markdown-it` / `esbuild` / `qs` を `pnpm.overrides` でパッチ版に固定）。**開発・ビルド時のみの依存で、公開物（`dist/`）には影響しません。**

## [0.1.0] - 2026-06-19

初回リリース。PORTERS Connect API（旧 HRBC）を型安全・簡単に扱う**非公式** TypeScript ラッパー。
利用には PORTERS 契約＋ Connect API オプション契約が必要です。

### Added

- **`PortersClient`**: `host` / `appId` / `appSecret` / `scopes` / `partition` で初期化する型付きクライアント。
- **OAuth（独自仕様）**: `code_direct` でのトークン取得・キャッシュ・自動リフレッシュ、差し替え可能なトークンストア（既定インメモリ）。
- **リソース（MVP）**: Candidate / Job / Client / Process / Resume の Read（`search` / `searchAll` / `get`）＋ Write（`create` / `update`）、Attachment（Base64・専用アクセサ）、マスタ Read（Partition / User（＋`current()`）/ Field / Option）。
- **XML の隠蔽**: レスポンス XML → 型付きオブジェクト、入力 → XML を内部生成（Option は `string[]`、User / Reference は ID、DateTime / Date を正規化）。
- **型付き検索クエリ**（`field` / `condition` / `count` / `start`）＋ **自動ページング**（200 件刻みの `searchAll`）。
- **レート市民 ＆ リトライ**: 自前スロットリング＋指数バックオフ、送信前リクエストサイズガード（約 15000 文字・URL + body 合算）。
- **構造化エラー**: 基底 `PortersError` ＋ 系統別サブクラス（Auth / Resource / Network / Config）＋ `category`（11 種）。
- **日時**: ISO 8601（UTC）⇄ PORTERS 形式の正規化（業務タイムゾーン変換はしない）。
- **動的カスタム項目**: `defineFields` でテナント固有の `U_` / `A_` を宣言し、型安全に read / write（ADR-0023）。
- **評価用サンドボックス**: 公開モック `createMockTransport` で契約なし・オフライン動作（ADR-0024）。
- **エラー対処ガイド**: [docs/guide/error-handling.md][guide]（症状別早見表＋2 系統のコード対応表）。
- **配布**: ESM / Node.js 18+ / 型定義同梱 / MIT。`X-P-ConnectAPI-Version: 2` を既定送信（PORTERS 8.x・9.x 想定）。

[guide]: docs/guide/error-handling.md
[oauth-guide]: docs/guide/oauth.md
[kac]: https://keepachangelog.com/en/1.1.0/
[semver]: https://semver.org/
[unreleased]: https://github.com/Joymerrevent/porters-connect/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/Joymerrevent/porters-connect/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Joymerrevent/porters-connect/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/Joymerrevent/porters-connect/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/Joymerrevent/porters-connect/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/Joymerrevent/porters-connect/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Joymerrevent/porters-connect/releases/tag/v0.1.0
