# PortersClient（クライアント）

ライブラリの入口です。契約で受け取った 3 つの値から 1 つ作り、App 単位のもの（`auth`・`partition`・`tenant()`）を
持ちます。Partition（Company DB）に属する読み書きは、`tenant(id)` が返すスコープの先にあります。

- **作り方**: `new PortersClient(options)`
- **持っているもの**: `tenant(id, options?)`／`partition`／`auth`

## 呼べるメソッドとプロパティ

<!-- 根拠: ADR-0040 F-3・ADR-0055（既定の Partition を持たない）・ADR-0087（宣言は tenant で受ける） -->

`porters` から直接呼べるものです。Partition を取らないものだけがここにあり、それ以外はすべて `tenant(id)` の先です。

| メンバー               | 何をするか                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| `tenant(id, options?)` | Partition を指定したスコープを返す（[tenant(id)][cl-tenant]）。同期で、PORTERS は呼ばない                     |
| `partition`            | アクセスできる Company DB の一覧を読むマスタ（[Partition][r-partition]）。`tenant()` を通さない唯一の読み取り |
| `auth`                 | 初回の権限付与・トークンの確認・権限の削除（[auth][cl-auth]）                                                 |

```ts
import { PortersClient } from "@joymerrevent/porters-connect";

const client = new PortersClient({
  hostname: process.env.PORTERS_HOST ?? "",
  appId: process.env.PORTERS_APP_ID ?? "",
  appSecret: process.env.PORTERS_APP_SECRET ?? "",
});

await client.auth.ensureAuthenticated(); // 設定の不備を起動時に見つける（省略可）
const partitions = await client.partition.search(); // 使える Company DB の一覧
const scope = client.tenant(partitions.items[0]?.P_Id ?? 0); // 以降の読み書きはこのスコープから
```

## 構築オプション

`new PortersClient({ ... })` に渡すものです。必須は `hostname` だけで、残りは用途に応じて足します。

| オプション   | 既定                                     | 何を渡すか                                                                                                                            |
| ------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `hostname`   | （必須）                                 | 契約で通知されたサーバー名だけ。スキーム・パス・ポートを含めると構築時にエラーになる（[インストール][s-install]）                     |
| `port`       | 無し（スキームの既定）                   | ローカルのフェイクサーバーやプロキシに向けるときだけ。1〜65535 の整数                                                                 |
| `scheme`     | `"https"`                                | `"http"` を明示したときだけ平文で送り、毎プロセス 1 回警告が出る（[契約なしでテストする][testing]の「接続先を環境変数で切り替える」） |
| `appId`      | 無し                                     | 契約で通知された App ID。既定の認証方式では要る                                                                                       |
| `appSecret`  | 無し                                     | 契約で通知された App Secret。既定の認証方式では要る                                                                                   |
| `scopes`     | 無し                                     | 初回の権限付与で渡すスコープ。`authorizationUrl` で省略したときに使われる（[認証とトークン][auth]）                                   |
| `tokenStore` | インメモリ                               | トークンの保存先を差し替える（[認証とトークン][auth]の「トークンの永続化」）                                                          |
| `auth`       | 既定の方式（`code_direct`＋自動更新）    | トークンの取得を自前で管理する `TokenProvider`（[認証とトークン][auth]の「トークンを自前で管理するとき」）                            |
| `transport`  | fetch                                    | HTTP の送信を差し替える。タイムアウトを延ばす・モックにする（[単独の関数][cl-functions]の「上限と接続」）                             |
| `throttle`   | 接続先ごとにプロセス内で共有するバケット | 1 分あたりの上限を別に持つ・プロセスを跨いで協調する（[上限とレート][limits]）                                                        |

## 固有の注意

このクラスだけに当てはまる注意です。認証・上限・テストの詳しい規則は主題別のページにあります。

- **既定の Partition はありません。** データの読み書きは、必ず `tenant(id)` で Partition を指定してから行います（[Partition とテナントスコープ][tenant]）。
- **`hostname` の書き方の誤りは構築した瞬間にエラーになります。** 値そのものの誤り（App ID の間違いなど）は、最初のリクエストでエラーになります。
- **`appId` / `appSecret` を省略できるのは、`auth` に独自の `TokenProvider` を渡すときだけです。** 既定の方式で省略すると、最初にトークンを取りに行くときに `PortersConfigError` になります。
- **カスタム項目の宣言はここには渡せません。** 宣言は Partition ごとのものなので、`tenant(id, { fields })` に渡します（[カスタム項目][custom-fields]）。渡すと構築時にエラーになります。
- **同じ接続先を向くクライアントは、上限の枠を 1 つ共有します。** クライアントを分けても 1 分あたりの上限は増えません（[上限とレート][limits]）。
- **クライアントを分けるのは、トークンを分けたいときだけです。** テナントごとに項目が違うだけなら、同じクライアントから `tenant(id, { fields })` を作り分けます（[複数テナント][multi-tenant]）。

## 型

このページで出てくる型と役割です。正確な定義は各リンク先（公開 API リファレンス）にあります。

| 型                                                                                                                 | 役割                                                          |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| [`PortersClient`][t-PortersClient]                                                                                 | クライアントそのもの（クラス）                                |
| [`PortersClientOptions`][t-PortersClientOptions]                                                                   | `new PortersClient()` に渡す構築オプション                    |
| [`Scheme`][t-Scheme]                                                                                               | `scheme` に渡せる値（`"https"` / `"http"`）                   |
| [`Scope`][t-Scope]                                                                                                 | `scopes` に渡すスコープ名（`candidate_r` など）               |
| [`TokenStore`][t-TokenStore] / [`StoredTokens`][t-StoredTokens]                                                    | `tokenStore` に渡す保存先と、そこに保存されるトークンのかたち |
| [`TokenProvider`][t-TokenProvider] / [`GetAccessTokenOptions`][t-GetAccessTokenOptions]                            | `auth` に渡す自前のトークン取得と、`getAccessToken` の引数    |
| [`Transport`][t-Transport] / [`TransportRequest`][t-TransportRequest] / [`TransportResponse`][t-TransportResponse] | `transport` に渡す HTTP 送信と、その要求・応答のかたち        |
| [`Throttle`][t-Throttle] / [`ThrottleOptions`][t-ThrottleOptions]                                                  | `throttle` に渡すスロットルと、`createThrottle` のオプション  |
| [`PartitionId`][t-PartitionId]                                                                                     | `tenant(id)` に渡す id                                        |
| [`TenantScope`][t-TenantScope] / [`TenantOptions`][t-TenantOptions]                                                | `tenant()` の戻り値と第 2 引数（[tenant(id)][cl-tenant]）     |
| [`AuthApi`][t-AuthApi]                                                                                             | `auth` の型（[auth][cl-auth]）                                |
| [`PartitionResource`][t-PartitionResource]                                                                         | `partition` の型（[Partition][r-partition]）                  |

## 関連

- 導入: [インストールと、クライアントの構築][s-install]（3 つの値から作る）
- 主題: [Partition とテナントスコープ][tenant]／[認証とトークン][auth]／[上限とレート][limits]／[契約なしでテストする][testing]
- クライアントと関数: [tenant(id)][cl-tenant]／[auth][cl-auth]／[単独の関数][cl-functions]
- リソース別: [Partition][r-partition]
- 実践例: [複数テナント][multi-tenant]（クライアントを分けるか）
- リファレンス: [公開 API リファレンス][api]
- ほかの目的から探す: [目次][index]

[index]: ../index.md
[s-install]: ../start/install.md
[tenant]: ../topics/tenant.md
[auth]: ../topics/auth.md
[limits]: ../topics/limits.md
[testing]: ../topics/testing.md
[custom-fields]: ../topics/custom-fields.md
[cl-tenant]: tenant-scope.md
[cl-auth]: auth.md
[cl-functions]: functions.md
[r-partition]: ../resources/partition.md
[multi-tenant]: ../recipes/multi-tenant.md
[t-PortersClient]: ../api/classes/PortersClient.md
[t-PortersClientOptions]: ../api/type-aliases/PortersClientOptions.md
[t-Scheme]: ../api/type-aliases/Scheme.md
[t-Scope]: ../api/type-aliases/Scope.md
[t-TokenStore]: ../api/type-aliases/TokenStore.md
[t-StoredTokens]: ../api/type-aliases/StoredTokens.md
[t-TokenProvider]: ../api/type-aliases/TokenProvider.md
[t-GetAccessTokenOptions]: ../api/type-aliases/GetAccessTokenOptions.md
[t-Transport]: ../api/type-aliases/Transport.md
[t-TransportRequest]: ../api/type-aliases/TransportRequest.md
[t-TransportResponse]: ../api/type-aliases/TransportResponse.md
[t-Throttle]: ../api/type-aliases/Throttle.md
[t-ThrottleOptions]: ../api/type-aliases/ThrottleOptions.md
[t-PartitionId]: ../api/type-aliases/PartitionId.md
[t-TenantScope]: ../api/type-aliases/TenantScope.md
[t-TenantOptions]: ../api/type-aliases/TenantOptions.md
[t-AuthApi]: ../api/type-aliases/AuthApi.md
[t-PartitionResource]: ../api/type-aliases/PartitionResource.md
[api]: ../api/index.md
