# PORTERS Connect API リファレンス（自前整理）

設計を実 API に接地するための**事実ベースのメモ**です。公式ドキュメントの逐語コピーではなく、
本ライブラリ設計に必要な要点を自分たちの言葉で再構成したものです（非公式・著作権配慮）。
**ここだけで仕様が分かる**ことを目標に、API の 2 本柱（Authentication API / Resource API）＋横断、で構成します。

## 出典と取得方法

- 一次情報: PORTERS Connect API ヘルプセンター（Zendesk）。ブラウザ表示は `https://hrbcapi.porters.jp/hc/ja`。
- 取得経路: Zendesk の公開コンテンツ API（Cloudflare の JS チャレンジを経由しない）。
  - 一覧: `https://hrbc-api.zendesk.com/api/v2/help_center/ja/articles.json?per_page=100`
  - 各記事に `html_url`（人間用）, `updated_at`, `body`（HTML）が含まれる。
- 取得日: **2026-06-12**。各ファイルに参照記事の URL と `updated_at` を併記する。
- 注意: ブラウザ直アクセス（`hrbcapi.porters.jp`）は Cloudflare の "Just a moment..." チャレンジで
  ボット拒否される。コンテンツ API 経由なら取得できる。

## 構成

### Authentication API（[authentication/][auth]）

接続認証。[OAuth][auth-oauth] ／ [Token][auth-token] ／ [HTTP ヘッダ][auth-headers] ／ [認証エラー][auth-errors]。

### Resource API（[resource-api/][rapi]）

- [概要][rapi]: エンドポイント・Read パラメータ・XML 形式・Result Code・各種制限。
- [field-data-types][rapi-fdt]: Field Type / Data Type の型システム・値書式。
- [write-format][rapi-wf]: Write の XML 形式・新規/更新・Phase 更新。
- [resources-list][rapi-list]: 全リソースの一覧・R/W・必要スコープ・Alias の注意点。
- [resources/][rapi-resources]: リソース別の項目（フィールド）リファレンス（全 17）。

### 横断

[glossary][glossary]（用語）／ [gotchas][gotchas]（レート/課金/実行環境/Alias/開発環境/仕様変更）。

## 重要な前提・落とし穴（設計に効くもの）

- レスポンスは **XML のみ**（`charset=UTF-8`）。利用者には型付きオブジェクトのみ返す。
- **既定ホストは `api-hrbc-jp.porterscloud.com`**（共有サーバ）。個別サーバ契約時のみ別ホスト → `PORTERS_HOST` で受ける。
- 認証コードの有効期限は **30 秒**。Access Token **約30分**、Refresh Token **約2時間**。
- **削除 API は無い**が、`itemstate=deleted|all` で**削除済みデータの読み取りは可能**（90日以内の制約あり）。
- **エラーコードが 2 系統**ある（認証系 `<Authentication><Error>` と リソース系 `<Resource><Code>`）。番号が重複しても意味が違う。
- 1 リクエスト最大 **200 レコード**、1 分あたり Read **2000** / Write **500**、リクエスト長 **約15000文字**（将来 16KB 予定）。
  - ※ `SPEC_v1.md` の「32KB」は旧情報。最新は約15000文字。
- **Field Alias の接頭辞はリソース名と一致しないことがある**（例: Candidate の項目は `Person.P_*`）。

## 再取得の手順

`tmp/porters-docs/`（git 管理外）に取得・生成スクリプトを置いている。最新へ更新する場合:

```bash
# 記事を取得 → 本文をテキスト化 → リソース別ファイルを生成
curl -sS -A "Mozilla/5.0" \
  "https://hrbc-api.zendesk.com/api/v2/help_center/ja/articles.json?per_page=100" \
  -o tmp/porters-docs/articles-ja.json
node tmp/porters-docs/extract.mjs
node tmp/porters-docs/gen-resources.mjs
```

[auth]: authentication/README.md
[auth-oauth]: authentication/oauth.md
[auth-token]: authentication/token.md
[auth-headers]: authentication/headers.md
[auth-errors]: authentication/errors.md
[rapi]: resource-api/README.md
[rapi-fdt]: resource-api/field-data-types.md
[rapi-wf]: resource-api/write-format.md
[rapi-list]: resource-api/resources-list.md
[rapi-resources]: resource-api/resources/README.md
[glossary]: glossary.md
[gotchas]: gotchas.md
