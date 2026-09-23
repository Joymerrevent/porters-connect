# auth（認証の操作）

`porters.auth` は、初回の権限付与の補助・トークンの確認・権限の削除を行うメソッド群です。日々のトークンの
取得と更新はライブラリが自動で行うので、普段は使いません。使うのは、初回の権限付与を自分のアプリに組み込むときと、
起動時に設定の不備を確かめたいときです。

- **アクセサ**: `porters.auth`（App 単位。`tenant(id)` の下にはない）
- **既定の認証方式**: `code_direct` でトークンを取り、期限が切れたら自動で更新する

## 呼べるメソッド

<!-- 根拠: ADR-0007 SD-3 / SD-6（公開メソッドの範囲）・ADR-0034（詳細設計） -->

6 つあります。`auth` オプションに独自の `TokenProvider` を渡している場合は、ライブラリが代行できない 4 つが
`PortersConfigError` になります（右の列）。

| メソッド                          | 戻り値            | 何をするか                                                                          | 独自 `TokenProvider` のとき |
| --------------------------------- | ----------------- | ----------------------------------------------------------------------------------- | --------------------------- |
| `authorizationUrl(options)`       | `string`          | 初回の権限付与のためにブラウザで開く URL を作る                                     | `PortersConfigError`        |
| `exchangeAuthorizationCode(code)` | `Promise<void>`   | リダイレクトで戻ってきた `code` をトークンに交換し、ライブラリの中に保存する        | `PortersConfigError`        |
| `ensureAuthenticated()`           | `Promise<void>`   | いまトークンを取りに行く。起動時に設定の不備を見つけるために使う                    | ○（`TokenProvider` に委譲） |
| `getToken()`                      | `Promise<string>` | 有効な Access Token を返す（デバッグ用）。Refresh Token は返さない                  | ○（`TokenProvider` に委譲） |
| `revokeUrl(options)`              | `string`          | 権限を削除するためにブラウザで開く URL を作る                                       | `PortersConfigError`        |
| `clearTokens()`                   | `Promise<void>`   | ライブラリが持つトークン（キャッシュと `tokenStore`）を消す。PORTERS 側の権限は残る | `PortersConfigError`        |

```ts
// 初回の権限付与: URL を人がブラウザで開いて承諾し、戻ってきた ?code= を 30 秒以内に交換する
const url = porters.auth.authorizationUrl({
  redirectUrl: "https://your.app/callback", // PORTERS に登録済みのもの
  scopes: ["partition_r", "candidate_r", "user_r", "option_r"],
});
await porters.auth.exchangeAuthorizationCode(codeFromRedirect);

// 起動時の確認: 取れなければこの行でエラーになる
await porters.auth.ensureAuthenticated();
```

## 固有の注意

このアクセサだけに当てはまる注意です。認証の流れと考え方は[認証とトークン][auth]にあります。

- **`code` の有効期限は発行から 30 秒です。** リダイレクトを受けたハンドラの中でそのまま `exchangeAuthorizationCode` に渡してください。
- **`authorizationUrl` / `revokeUrl` は `string` を返すので、失敗は同期 throw です。** `appId` が無い・スコープが空、のときに `PortersConfigError` になります。`Promise` を返す 4 つは、失敗も reject で届きます（[エラーと再試行][errors]）。
- **`scopes` を省略すると、クライアントに渡した `scopes` を使います。** どちらも空なら `PortersConfigError` です。
- **`state` はリダイレクトにそのまま引き継がれます。** CSRF 対策などに使えます。
- **`exchangeAuthorizationCode` は値を返しません。** 取得したトークンはライブラリの中（と `tokenStore`）に保存され、以降のリソース呼び出しが自動で使います。
- **`clearTokens` は手元のトークンを消すだけです。** PORTERS 側の権限を消すには `revokeUrl` の URL をブラウザで開いて承諾する必要があります。
- **`current()` で「いま誰か」を確かめるのは [User][r-user] です。** 既定の方式ではアプリ自身の User が返ります。

## 型

このページで出てくる型と役割です。正確な定義は各リンク先（公開 API リファレンス）にあります。

| 型                                                                                      | 役割                                                                                                  |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [`AuthApi`][t-AuthApi]                                                                  | `porters.auth` の型                                                                                   |
| [`AuthorizationUrlOptions`][t-AuthorizationUrlOptions]                                  | `authorizationUrl` の引数（`redirectUrl` / `scopes` / `state`）                                       |
| [`RevokeUrlOptions`][t-RevokeUrlOptions]                                                | `revokeUrl` の引数（`authorizationUrl` と同じかたち）                                                 |
| [`Scope`][t-Scope]                                                                      | `scopes` に渡すスコープ名                                                                             |
| [`TokenProvider`][t-TokenProvider] / [`GetAccessTokenOptions`][t-GetAccessTokenOptions] | 自前でトークンを管理するときに `auth` オプションへ渡す型と、`getAccessToken` の引数（`forceRefresh`） |
| [`TokenStore`][t-TokenStore] / [`StoredTokens`][t-StoredTokens]                         | `tokenStore` オプションに渡す保存先と、保存されるトークンのかたち                                     |
| [`PortersAuthError`][t-PortersAuthError]                                                | 認証の失敗として届く例外（[エラーと再試行][errors]）                                                  |

## 関連

- 導入: [認証を通して、疎通を確認する][s-auth]（手元で 1 回済ませる手順・うまくいかないとき）
- 主題: [認証とトークン][auth]（2 つのフェーズ・トークンの置き場所・自前で管理するとき）／[エラーと再試行][errors]（`PortersAuthError` と `category`）
- クライアント: [PortersClient][cl-client]（構築オプションの `appId` / `appSecret` / `scopes` / `tokenStore` / `auth`）
- リソース別: [Partition][r-partition]（権限付与した Company DB の一覧）／[User][r-user]（`current()`）
- リファレンス: [認証 API（OAuth/Token/フロー）][auth-ref]／[公開 API リファレンス][api]
- ほかの目的から探す: [目次][index]

[index]: ../index.md
[s-auth]: ../start/authenticate.md
[auth]: ../topics/auth.md
[errors]: ../topics/errors.md
[cl-client]: client.md
[r-partition]: ../resources/partition.md
[r-user]: ../resources/user.md
[auth-ref]: ../reference/authentication-api/README.md
[t-AuthApi]: ../api/type-aliases/AuthApi.md
[t-AuthorizationUrlOptions]: ../api/type-aliases/AuthorizationUrlOptions.md
[t-RevokeUrlOptions]: ../api/type-aliases/RevokeUrlOptions.md
[t-Scope]: ../api/type-aliases/Scope.md
[t-TokenProvider]: ../api/type-aliases/TokenProvider.md
[t-GetAccessTokenOptions]: ../api/type-aliases/GetAccessTokenOptions.md
[t-TokenStore]: ../api/type-aliases/TokenStore.md
[t-StoredTokens]: ../api/type-aliases/StoredTokens.md
[t-PortersAuthError]: ../api/classes/PortersAuthError.md
[api]: ../api/index.md
