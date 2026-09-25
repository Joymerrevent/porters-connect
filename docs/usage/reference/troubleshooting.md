# トラブルシューティング（症状 → 原因 → 対処）

症状から引く早見表です。エラーの型・`category`・例外をどう受け取るかの説明は[エラーと再試行][errors]に、
生コードの一覧は [リソース Result Code][result-codes] と [認証エラーコード][auth-errors] にあります。
認証系とリソース系は番号が重複して意味が違うので、**まず系統（`instanceof`）を見てから** `code` を引いてください。

## 症状 → 原因 → 対処

| 症状                                                                                     | 系統 / code                                  | category        | 対処                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------- | -------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PortersAuthError` が出て処理が止まる                                                    | 認証（`code_direct` の失敗）                 | `auth`          | 既定の取り方は Refresh Token の失効を `code_direct` で取り直すので、ここに来るのは `code_direct` も通らないとき。その Company DB の**初回ブラウザ `code` 付与**が済んでいるか（取り消されていないか）を確かめ、必要なら再実施 |
| 認証で `app_id` / `secret` 系のエラー                                                    | 認証 `104` / `105`                           | `auth`          | App ID / App Secret を確認（環境変数で渡し、コードに直接書かない）                                                                                                                                                            |
| データ取得で権限エラー                                                                   | リソース `403`                               | `permission`    | 対象 Company DB へ権限付与（初回 `code` 付与）／スコープを確認                                                                                                                                                                |
| `partition` が見つからない                                                               | リソース `404`                               | `notFound`      | partition id と契約期間（未開始 / 解約）を確認                                                                                                                                                                                |
| 作成・更新で値が弾かれる                                                                 | リソース `100`〜`116`                        | `validation`    | パラメータ・書式・型・日時・Option を見直す                                                                                                                                                                                   |
| 宣言したカスタム項目で `validation`                                                      | リソース `100`                               | `validation`    | その partition に項目が実在するか `t.field.of(...).search()` で確認                                                                                                                                                           |
| `itemstate` / `version` 不正                                                             | リソース `133` / `146`                       | `validation`    | 値を見直す（itemstate・ConnectAPI Version）                                                                                                                                                                                   |
| 重複・依存で作成/削除できない                                                            | リソース `301`/`303`/`304`                   | `conflict`      | 重複作成を避ける／子要素・被参照を解消                                                                                                                                                                                        |
| IP 制限 / アプリ権限不足                                                                 | リソース `406` / `601`                       | `permission`    | IP アドレス申請／アプリ権限の申請                                                                                                                                                                                             |
| 登録最大件数超過                                                                         | リソース `500`                               | `validation`    | 件数を減らす／200 件以下のバッチに分割                                                                                                                                                                                        |
| `PortersConfigError`（送信前）                                                           | サイズ超過                                   | `config`        | field / condition を絞る／書き込みを 200 件以下に分割（約 15000 字が上限）                                                                                                                                                    |
| `PortersConfigError`（`defineFields` 等）                                                | 宣言・オプション不正                         | `config`        | alias は `U_`/`A_` で始める・リソース名は既知のもの・オプションを修正                                                                                                                                                         |
| **読み取りで宣言型と実データが食い違う**                                                 | —（応答のかたちが違う）                      | `validation`    | 宣言した Data Type が実際の項目と違う。`verifyFields` で突き合わせて宣言を直す                                                                                                                                                |
| **書き込み・condition の日時が変換不能**                                                 | —（渡した値の書式）                          | `validation`    | 日時は **ISO 8601** で渡す（`Date` は `2026-09-10`、`DateTime` は `2026-09-10T12:00:00Z` のように時刻とタイムゾーンを付ける）                                                                                                 |
| `new PortersClient(...)` がその場でエラーになる                                          | `hostname` / `port` / `scheme` の書式        | `config`        | `hostname` は**サーバー名だけ**・ポートは `port`（下記）                                                                                                                                                                      |
| `unknown option "…"` でエラーになる（`new PortersClient(...)` / `tenant()`）             | 定義していないオプション                     | `config`        | キーの打ち間違いか、アプリの設定オブジェクトを丸ごと渡している。`hint` に使えるキーが並ぶので、使うものだけを渡す                                                                                                             |
| `appId and appSecret are required to obtain a token`                                     | 最初のリクエスト（PORTERS へは何も送らない） | `config`        | 既定の取り方には `appId` / `appSecret` が要る。渡すか、`tokenProvider` を渡す                                                                                                                                                 |
| `tokenProvider.acquire returned no usable access token`（`refresh` / `exchange` も同じ） | 渡した `tokenProvider` の返り値              | `config`        | `{ accessToken: { token, expiresAt? } }` の形で、空でない文字列の `token` を返す                                                                                                                                              |
| `exchangeAuthorizationCode needs a tokenProvider with exchange(code)`                    | 渡した `tokenProvider`                       | `config`        | `code` を交換するなら、`tokenProvider` に `exchange(code)` を持たせる                                                                                                                                                         |
| `appId is required to build an OAuth URL`                                                | `authorizationUrl` / `revokeUrl`             | `config`        | URL には App ID が入るので、`tokenProvider` を渡していても `appId` を渡す                                                                                                                                                     |
| `at least one scope is required for the code/remove grant`                               | `authorizationUrl` / `revokeUrl`             | `config`        | 呼び出しかクライアントに `scopes` を渡す                                                                                                                                                                                      |
| `PortersNetworkError` が断続的に出る                                                     | —（切断 / タイムアウト）                     | `network`       | 自動リトライ後も失敗なら時間をおく／レート・回線を確認                                                                                                                                                                        |
| `code` が `null` で `httpStatus` がある                                                  | —（HTTP のみ）                               | status から分類 | PORTERS の応答ではない。間のロードバランサ / プロキシ / WAF（Web アプリケーションファイアウォール）を確認（[エラーと再試行][errors] の「PORTERS 以外が返した HTTP エラー」）                                                  |
| `resource response root is …` が出る                                                     | —（200 ＋ 別物のボディ）                     | `unknown`       | 中間装置が代わりに応答している。`hostname` と経路を確認                                                                                                                                                                       |

<!-- 根拠:
- 「`resource response root is …` が出る」の行: ADR-0051
-->

## 繋いだ直後に起きやすいもの

| 症状                                                                  | たいてい原因                                                                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 構築した瞬間にエラーになる                                            | `hostname` に `https://` ・パス・ポートが入っている（[インストール][install]）／オプションのキーを打ち間違えている |
| `PortersResourceError`（`code` が `403`、`category` が `permission`） | その Company DB の権限付与（初回のブラウザ手順）が済んでいない                                                     |
| `code` を交換すると失敗する                                           | 30 秒を超えた／同じ `code` を 2 回使った                                                                           |
| Partition の一覧が空で返る                                            | 権限付与した Company DB が無い／`partition_r` を付与していない                                                     |
| スコープ不足で読めない                                                | `authorizationUrl` に渡したスコープに、使うリソースが入っていない                                                  |

## 関連

- ガイド: [エラーと再試行][errors]／[認証とトークン][auth]／[上限とレート][limits]
- 導入: [認証を通して、疎通を確認する][s-auth]
- ほかの目的から探す: [目次][index]

[errors]: ../topics/errors.md
[auth]: ../topics/auth.md
[limits]: ../topics/limits.md
[install]: ../start/install.md
[s-auth]: ../start/authenticate.md
[result-codes]: resource-api/result-codes.md
[auth-errors]: authentication-api/errors.md
[index]: ../index.md
