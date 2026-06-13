# HTTP ヘッダ

出典: <https://hrbcapi.porters.jp/hc/ja/articles/115008016967-HTTP-Header>（updated_at 2025-03-27、取得 2026-06-12）。
全体像は [認証 README](README.md)。

| ヘッダ                       | 用途                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `X-porters-hrbc-oauth-token` | Resource API 呼び出し時に Access Token を載せる（`: [Access Token]`）。                                                  |
| `Content-Type`               | Write（XML）: `application/xml; charset=UTF-8` / Token: `application/x-www-form-urlencoded`。charset は **UTF-8 のみ**。 |
| `X-P-ConnectAPI-Version`     | API バージョン。現行最新 **`2`**（担当者型・ユーザー型・部署型 Link が使える）。値は 1 / 2。                             |
