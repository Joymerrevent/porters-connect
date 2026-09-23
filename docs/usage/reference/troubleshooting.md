# トラブルシューティング（症状 → 原因 → 対処）

症状から引く早見表です。エラーの型・`category`・届き方の説明は[エラーと再試行][errors]に、
生コードの一覧は [リソース Result Code][result-codes] と [認証エラーコード][auth-errors] にあります。
認証系とリソース系は番号が重複して意味が違うので、**まず系統（`instanceof`）を見てから** `code` を引いてください。

## 症状 → 原因 → 対処

| 症状                                            | 系統 / code                           | category        | 対処                                                                           |
| ----------------------------------------------- | ------------------------------------- | --------------- | ------------------------------------------------------------------------------ |
| `PortersAuthError` が出て処理が止まる           | 認証 `401`                            | `auth`          | Refresh Token 失効。**初回ブラウザ `code` 付与**をその Company DB で再実施     |
| 認証で `app_id` / `secret` 系のエラー           | 認証 `104` / `105`                    | `auth`          | App ID / App Secret を確認（`.env`・ハードコード禁止）                         |
| データ取得で権限エラー                          | リソース `403`                        | `permission`    | 対象 Company DB へ権限付与（初回 `code` 付与）／スコープを確認                 |
| `partition` が見つからない                      | リソース `404`                        | `notFound`      | partition id と契約期間（未開始 / 解約）を確認                                 |
| 作成・更新で値が弾かれる                        | リソース `100`〜`116`                 | `validation`    | パラメータ・書式・型・日時・Option を見直す                                    |
| 宣言したカスタム項目で `validation`             | リソース `100`                        | `validation`    | その partition に項目が実在するか `t.field.of(...).search()` で確認            |
| `itemstate` / `version` 不正                    | リソース `133` / `146`                | `validation`    | 値を見直す（itemstate・ConnectAPI Version）                                    |
| 重複・依存で作成/削除できない                   | リソース `301`/`303`/`304`            | `conflict`      | 重複作成を避ける／子要素・被参照を解消                                         |
| IP 制限 / アプリ権限不足                        | リソース `406` / `601`                | `permission`    | IP アドレス申請／アプリ権限の申請                                              |
| 登録最大件数超過                                | リソース `500`                        | `validation`    | 件数を減らす／200 件以下のバッチに分割                                         |
| `PortersConfigError`（送信前）                  | サイズ超過                            | `config`        | field / condition を絞る／書き込みを 200 件以下に分割（約 15000 字が上限）     |
| `PortersConfigError`（`defineFields` 等）       | 宣言・オプション不正                  | `config`        | alias は `U_`/`A_` で始める・リソース名は既知のもの・オプションを修正          |
| **読み取りで宣言型と実データが食い違う**        | —（応答のかたちが違う）               | `validation`    | 宣言した Data Type が実際の項目と違う。`verifyFields` で突き合わせて宣言を直す |
| **書き込み・condition の日時が変換不能**        | —（渡した値の書式）                   | `validation`    | 日時は **ISO 8601** で渡す（`2026-09-10` / `...T12:00:00Z`）                   |
| `new PortersClient(...)` がその場でエラーになる | `hostname` / `port` / `scheme` の書式 | `config`        | `hostname` は**サーバー名だけ**・ポートは `port`（下記）                       |
| `PortersNetworkError` が断続的に出る            | —（切断 / タイムアウト）              | `network`       | 自動リトライ後も失敗なら時間をおく／レート・回線を確認                         |
| `code` が `null` で `httpStatus` がある         | —（HTTP のみ）                        | status から分類 | PORTERS の応答ではない。間のロードバランサ / プロキシ / WAF を確認（上記の節） |
| `resource response root is …` が出る            | —（200 ＋ 別物のボディ）              | `unknown`       | 中間装置が代わりに応答している。`hostname` と経路を確認                        |

<!-- 根拠:
- 「`resource response root is …` が出る」の行: ADR-0051
-->

## 繋いだ直後に起きやすいもの

| 症状                                                                  | たいてい原因                                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 構築した瞬間にエラーになる                                            | `hostname` に `https://` ・パス・ポートが入っている（[インストール][install]） |
| `PortersResourceError`（`code` が `403`、`category` が `permission`） | その Company DB の権限付与（初回のブラウザ手順）が済んでいない                 |
| `code` を交換すると失敗する                                           | 30 秒を超えた／同じ `code` を 2 回使った                                       |
| Partition の一覧が空で返る                                            | 権限付与した Company DB が無い／`partition_r` を付与していない                 |
| スコープ不足で読めない                                                | `authorizationUrl` に渡したスコープに、使うリソースが入っていない              |

## 関連

- 主題: [エラーと再試行][errors]／[認証とトークン][auth]／[上限とレート][limits]
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
