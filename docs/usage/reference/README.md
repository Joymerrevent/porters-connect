# PORTERS API の事実（Connect API の仕様の整理）

PORTERS Connect API の仕様のうち、**このライブラリを使ううえで必要な PORTERS 側の事実**を、自分たちの言葉で
整理したものです。公式ドキュメントの逐語コピーではありません（非公式・著作権配慮）。ライブラリが内側に隠しているもの
（XML の書式・OAuth の細部）も載せていますが、載せるのは「使ううえで必要な事実」までです。
PORTERS の API 2 種（Authentication API / Resource API）と、両方に共通する事項で構成します。

## 出典

- 一次情報: PORTERS Connect API ヘルプセンター（`https://hrbcapi.porters.jp/hc/ja`）。
- 取得日: **2026-06-12**（初回）／ **2026-09-20**（再取得・差分反映）。各ファイルに参照記事の URL と
  `updated_at` を併記しています。

<!-- 再取得の手順（Zendesk API 経由の取得・差分の取り方・gen-resources.mjs を使わない理由）は
     CONTRIBUTING.md「PORTERS ヘルプセンターの再取得」にある。利用者向けのこのページには置かない。 -->

## 構成

### Authentication API（[authentication-api/][auth]）

接続認証。[OAuth][auth-oauth] ／ [Token][auth-token] ／ [HTTP ヘッダ][auth-headers] ／ [認証エラー][auth-errors]。

### Resource API（[resource-api/][rapi]）

- [概要][rapi]: エンドポイント・Read / Write パラメータ・XML 形式・各種制限。
- [result-codes][rapi-rc]: リソース系 Result Code 一覧・リトライ方針（認証エラーとは別系統）。
- [field-data-types][rapi-fdt]: Field Type / Data Type の型システム・値書式。
- [write-format][rapi-wf]: Write の XML 形式・新規/更新・Phase 更新。
- [resources-list][rapi-list]: 全リソースの一覧・読み書き・必要スコープ・alias の注意点。
- [resources/][rapi-resources]: リソース別の項目（フィールド）リファレンス（全 18）。

### 両方に共通

[glossary][glossary]（用語）／ [gotchas][gotchas]（レート/課金/実行環境/Alias/開発環境/仕様変更）／
[troubleshooting][troubleshooting]（症状 → 原因 → 対処の早見表）。

## 重要な前提・落とし穴（使ううえで影響するもの）

- レスポンスは **XML のみ**（`charset=UTF-8`）。利用者には型付きオブジェクトのみ返す。
- **既定ホストは `api-hrbc-jp.porterscloud.com`**（共有サーバ）。個別サーバ契約時のみ別ホスト → `PORTERS_HOST` で受ける。
  - ※ これは理解のための**参考値**。コード・設定に**ハードコードしない**。実値は常に `PORTERS_HOST` 経由。<!-- 根拠: CLAUDE.md「ホスト名は非公開」 -->
- 認証コードの有効期限は **30 秒**。Access Token **約30分**、Refresh Token **約2時間**。
- **削除 API は無い**が、`itemstate=deleted|all` で**削除済みデータの読み取りは可能**（90日以内の制約あり）。
- **エラーコードが 2 系統**ある（認証系 `<Authentication><Error>` → [auth-errors] ／ リソース系 `<Code>` → [rapi-rc]）。番号が重複しても意味が違う。リソース系は **Read がルート直下、Write は `<Item>` ごと**と出る場所が違う。
- 1 リクエスト最大 **200 レコード**、1 分あたり Read **2000** / Write **500**、リクエスト長 **約15000文字**（将来 16KB を検討中・未確定）。
- **Field Alias の接頭辞はリソース名と一致しないことがある**（例: Candidate の項目は `Person.P_*`）。

[auth]: authentication-api/README.md
[auth-oauth]: authentication-api/oauth.md
[auth-token]: authentication-api/token.md
[auth-headers]: authentication-api/headers.md
[auth-errors]: authentication-api/errors.md
[rapi]: resource-api/README.md
[rapi-rc]: resource-api/result-codes.md
[rapi-fdt]: resource-api/field-data-types.md
[rapi-wf]: resource-api/write-format.md
[rapi-list]: resource-api/resources-list.md
[rapi-resources]: resource-api/resources/README.md
[glossary]: glossary.md
[gotchas]: gotchas.md
[troubleshooting]: troubleshooting.md
