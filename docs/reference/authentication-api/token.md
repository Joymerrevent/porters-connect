# Token API

出典: <https://hrbcapi.porters.jp/hc/ja/articles/115008017467-Token>（updated_at 2019-02-01、取得 2026-06-12）。
全体像は [認証 README][readme]。

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

取得した Access Token は [HTTP ヘッダ][headers] の `X-porters-hrbc-oauth-token` に載せて Resource API を呼ぶ。
失効時は `grant_type=refresh_token`（`code` に Refresh Token）で更新。エラーは [認証エラー][errors]。

[readme]: README.md
[headers]: headers.md
[errors]: errors.md
