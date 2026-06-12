# 認証（OAuth / Token / ヘッダ / スコープ）

出典: OAuth（`updated_at` 2025-06-03）/ Token（2019-02-01）/ HTTP Header（2025-03-27）/
Authentication and Authorization Error（2021-06-03）。取得日 2026-06-12。

- <https://hrbcapi.porters.jp/hc/ja/articles/115008017487-OAuth>
- <https://hrbcapi.porters.jp/hc/ja/articles/115008017527-Steps-for-Authentication>
- <https://hrbcapi.porters.jp/hc/ja/articles/115008017467-Token>
- <https://hrbcapi.porters.jp/hc/ja/articles/115008016967-HTTP-Header>
- <https://hrbcapi.porters.jp/hc/ja/articles/115008172688-Authentication-and-Authorization-Error>

## 全体フロー

1. **（初回のみ）Company DB へのアクセス権付与**: `response_type=code` でブラウザから OAuth API を叩き、
   PORTERS にログイン → 権限付与を承諾。これを実施しないと以降の Resource アクセスはエラーになる。
2. **code を取得**: OAuth API が `code` を返す（ブラウザは redirect、code_direct は XML）。**有効期限 30 秒**。
3. **Access Token を取得**: Token API に `code` を渡して交換。Access / Refresh Token を得る。
4. **Resource API を呼ぶ**: ヘッダ `X-porters-hrbc-oauth-token: [Access Token]` を付ける。
5. **更新**: Access Token 失効時は Refresh Token で更新。Refresh Token も失効したら 2 からやり直し。

サーバ間の自動運用では、初回の権限付与（手順1, ブラウザ必須）だけ手作業で済ませ、
以降は **`code_direct`** で code 取得 → Token 交換を無人で回せる。

## OAuth API

`GET https://{host}/v1/oauth?app_id=&redirect_url=&response_type=&scope=&state=`

| パラメータ      | 必須             | 内容                                                             |
| --------------- | ---------------- | ---------------------------------------------------------------- |
| `app_id`        | ●                | アプリ登録時に発行された App ID。                                |
| `redirect_url`  | ●（code/remove） | 登録した Redirect URL。`code_direct` では不要。                  |
| `response_type` | ●                | `code` / `code_direct` / `remove`。                              |
| `scope`         | ●（code/remove） | 取得・削除する権限。カンマ区切り。`code_direct` では指定しない。 |
| `state`         | 任意             | redirect 時に引き継がれる任意値（CSRF 対策等に使える）。         |

`response_type`:

- `code`: ブラウザ経由。redirect で `?code=...`(または `?error=...`)。**初回の権限付与はこれが必須**。
- `code_direct`: サーバ間直接。Response Body に XML で code を返す。`redirect_url` / `scope` 不要。
- `remove`: 取得済み権限を削除（利用終了時）。redirect で `remove_confirmation=0`(成功)/`-1`(失敗)。

`code_direct` の出力例:

```xml
<Authentication>
  <Code>aaa</Code>
  <Error>0</Error>
  <Message>Success</Message>
</Authentication>
```

## Token API

`POST https://{host}/v1/token`（`Content-Type: application/x-www-form-urlencoded`）

Body（URL エンコード）:

| パラメータ   | 内容                                                      |
| ------------ | --------------------------------------------------------- |
| `app_id`     | App ID。                                                  |
| `secret`     | App Secret。                                              |
| `grant_type` | `oauth_code`（新規取得）/ `refresh_token`（更新）。       |
| `code`       | 新規取得時は OAuth の code。更新時は Refresh Token の値。 |

出力 XML（有効期限はミリ秒）:

```xml
<Authentication>
  <AccessToken>bbb</AccessToken>
  <AccessTokenExpiresIn>1800000</AccessTokenExpiresIn>
  <RefreshToken>ccc</RefreshToken>
  <RefreshTokenExpiresIn>7200000</RefreshTokenExpiresIn>
  <Error>0</Error>
  <Message>Success</Message>
</Authentication>
```

- **Access Token 有効期限: 約 30 分（1,800,000 ms）**
- **Refresh Token 有効期限: 約 2 時間（7,200,000 ms）**

## HTTP ヘッダ

| ヘッダ                       | 用途                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `X-porters-hrbc-oauth-token` | Resource API 呼び出し時に Access Token を載せる（`: [Access Token]`）。                                                  |
| `Content-Type`               | Write（XML）: `application/xml; charset=UTF-8` / Token: `application/x-www-form-urlencoded`。charset は **UTF-8 のみ**。 |
| `X-P-ConnectAPI-Version`     | API バージョン。現行最新 **`2`**（担当者型・ユーザー型・部署型 Link が使える）。値は 1 / 2。                             |

## スコープ一覧

リソース別に R/W が分かれる（`{resource}_r` / `{resource}_w`）。複数はカンマ区切り。

- **マスタ系（読み取りのみ）**: `partition_r` / `user_r` / `field_r` / `option_r`
- **データ系（R/W あり）**: `client` / `recruiter` / `contact` / `job` / `candidate` / `resume` /
  `process` / `activity` / `contract` / `sales` / `phase` / `attachment` / `opportunity`
  （各 `_r` / `_w`）

注意: Read でも複数スコープが要ることがある。例えば Candidate Read には
`candidate_r, user_r, option_r` が必要（参照・選択肢項目の取得のため）。

## 認証エラーコード（リソースの Result Code とは別系統）

OAuth / Token のエラーは root 要素 `<Authentication>` の `<Error>` に出る。
redirect の場合は `?error=コード`。**Resource API の Result Code とは番号体系が異なる**ので混同しない。

```xml
<Authentication>
  <Error>100</Error>
  <Message>Wrong redirect_url</Message>
</Authentication>
```

| Code | 意味                                      |
| ---- | ----------------------------------------- |
| 0    | 成功                                      |
| -1   | キャンセル                                |
| 100  | redirect_url が無効                       |
| 101  | redirect_url 未指定                       |
| 102  | scope が無効                              |
| 103  | code が無効                               |
| 104  | app_id が無効                             |
| 105  | secret が無効                             |
| 106  | Access Token が無効                       |
| 107  | Refresh Token が無効                      |
| 108  | 認証サーバー内部エラー                    |
| 109  | セッション情報が取得できない              |
| 110  | response_type が無効                      |
| 111  | 削除できる権限が無い                      |
| 112  | grant_type が無効                         |
| 113  | 登録アプリのサイトが無い                  |
| 114  | ユーザーが見つからない                    |
| 115  | アクセス拒否                              |
| 116  | アクセス権限が無い                        |
| 117  | Access Token 未指定                       |
| 400  | **Access Token の有効期限切れ** → Refresh |
| 401  | **Refresh Token の有効期限切れ** → 再認証 |
| 402  | アクセス許可が無い                        |
