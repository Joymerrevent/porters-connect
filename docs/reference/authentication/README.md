# 認証（Authentication API）

接続認証のための API。**OAuth**（アプリ認証）と **Token**（Access Token 取得）の 2 つからなる（公式 API List 準拠）。

| API            | 概要                                  |
| -------------- | ------------------------------------- |
| [OAuth][oauth] | アプリ認証を行い `code` を得る。      |
| [Token][token] | `code` から Access Token を取得する。 |

詳細: [OAuth API][oauth] ／ [Token API][token] ／ [HTTP ヘッダ][headers] ／ [認証エラー][errors]

出典（取得日 2026-06-12）:

- <https://hrbcapi.porters.jp/hc/ja/articles/115008017487-OAuth>（2025-06-03）
- <https://hrbcapi.porters.jp/hc/ja/articles/115008017527-Steps-for-Authentication>（2024-08-23）
- <https://hrbcapi.porters.jp/hc/ja/articles/115008017467-Token>（2019-02-01）
- <https://hrbcapi.porters.jp/hc/ja/articles/115008016967-HTTP-Header>（2025-03-27）
- <https://hrbcapi.porters.jp/hc/ja/articles/115008172688-Authentication-and-Authorization-Error>（2021-06-03）

## 全体フロー

1. **（初回のみ）Company DB へのアクセス権付与**: `response_type=code` でブラウザから OAuth API を叩き、
   PORTERS にログイン → 権限付与を承諾。これを実施しないと以降の Resource アクセスはエラーになる。
2. **code を取得**: OAuth API が `code` を返す（ブラウザは redirect、`code_direct` は XML）。**有効期限 30 秒**。
3. **Access Token を取得**: Token API に `code` を渡して交換。Access / Refresh Token を得る。
4. **Resource API を呼ぶ**: ヘッダ `X-porters-hrbc-oauth-token: [Access Token]` を付ける（[HTTP ヘッダ][headers]）。
5. **更新**: Access Token 失効時は Refresh Token で更新。Refresh Token も失効したら 2 からやり直し。

サーバ間の自動運用では、初回の権限付与（手順 1・ブラウザ必須）だけ手作業で済ませ、
以降は **`code_direct`** で code 取得 → Token 交換を無人で回せる。

## 認証シーケンス（response_type 別）

- **`code`（ブラウザ）**: Company DB の Resource にアクセスするには**初回は必ず `code` で権限付与**が要る。
  サードパーティアプリ（PORTERS のアプリ一覧から利用開始する形）も `code` 認証が必要。
  既に利用開始済みなら権限付与は省略され、`code` 発行に進む。
- **`code_direct`（サーバ単体）**: ブラウザ不要。ただし**事前に `code` で対象 Company DB の権限付与済み**であること。
- **`remove`（利用終了）**: Company DB へのアクセス権を削除。サードパーティは、ユーザーが PORTERS アプリ一覧から
  任意に利用終了できるよう準備しておく。

詳細手順は [OAuth API][oauth]（権限付与・削除の手順）を参照。

[oauth]: oauth.md
[token]: token.md
[headers]: headers.md
[errors]: errors.md
