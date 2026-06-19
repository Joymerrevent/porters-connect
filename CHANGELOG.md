# Changelog

このプロジェクトの主な変更を記録します。形式は [Keep a Changelog][kac] に準拠し、
バージョニングは [Semantic Versioning][semver] に従います。

## [Unreleased]

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
[kac]: https://keepachangelog.com/en/1.1.0/
[semver]: https://semver.org/
[unreleased]: https://github.com/Joymerrevent/porters-connect/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Joymerrevent/porters-connect/releases/tag/v0.1.0
