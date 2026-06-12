# PORTERS Connect API リファレンス（自前整理）

設計を実 API に接地するための**事実ベースのメモ**です。公式ドキュメントの逐語コピーではなく、
本ライブラリ設計に必要な要点を自分たちの言葉で再構成したものです（非公式・著作権配慮）。

## 出典と取得方法

- 一次情報: PORTERS Connect API ヘルプセンター（Zendesk）。ブラウザ表示は `https://hrbcapi.porters.jp/hc/ja`。
- 取得経路: Zendesk の公開コンテンツ API（Cloudflare の JS チャレンジを経由しない）。
  - 一覧: `https://hrbc-api.zendesk.com/api/v2/help_center/ja/articles.json?per_page=100`
  - 各記事に `html_url`（人間用）, `updated_at`, `body`（HTML）が含まれる。
- 取得日: **2026-06-12**。各セクションに参照記事の URL と、その記事の `updated_at` を併記する。
- 注意: ブラウザ直アクセス（`hrbcapi.porters.jp`）は Cloudflare の "Just a moment..." チャレンジで
  ボット拒否される。コンテンツ API 経由なら取得できる。

## 構成

| ファイル                               | 内容                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------- |
| [authentication.md](authentication.md) | OAuth（code / code_direct / remove）・Token・ヘッダ・スコープ・認証エラー  |
| [resource-api.md](resource-api.md)     | エンドポイント・Read パラメータ・XML 形式・データ型・Result Code・各種制限 |
| [resources.md](resources.md)           | 全リソースの一覧・R/W 可否・必要スコープ・Field Alias の注意点             |
| [resources/](resources/README.md)      | リソース別の項目（フィールド）リファレンス（全 17、出典記事から抽出）      |

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

`tmp/porters-docs/`（git 管理外）に取得スクリプトを置いている。最新へ更新する場合:

```bash
# 一覧・セクション・カテゴリを取得し、本文を tmp/porters-docs/txt/ にテキスト化
curl -sS -A "Mozilla/5.0" \
  "https://hrbc-api.zendesk.com/api/v2/help_center/ja/articles.json?per_page=100" \
  -o tmp/porters-docs/articles-ja.json
node tmp/porters-docs/extract.mjs
```
