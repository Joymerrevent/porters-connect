# 上限と接続

`new PortersClient({ throttle, transport })` に渡すものを作る関数です。1 分あたりの上限の枠を分ける・
タイムアウトを変える・PORTERS に繋がずにテストする、の 3 つの場面で使います。上限の考え方は
[上限とレート][limits]、テストの書き方は[契約なしでテストする][testing]にあります。

- **import 元**: `@joymerrevent/porters-connect`
- **PORTERS を呼ぶもの**: なし（作ったものを `PortersClient` に渡してから通信が起きる）
- **使う場面**: クライアントを構築するとき

## 呼べる関数

<!-- 根拠: ADR-0010（スロットリング）・ADR-0024（Transport）・ADR-0073（バケットの共有単位） -->

| 関数                                     | 何をするか                                                                                                     | 失敗の届き方                                        |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `createThrottle(options?)`               | 1 分あたりの上限を守るスロットルを作る。`readPerMin`／`writePerMin`／`safety`。共有の枠から切り離すときに渡す  | 同期 throw（範囲外の値）                            |
| `createFetchTransport(options?)`         | 既定の HTTP 送信を作る。`timeoutMs` でタイムアウトを延ばす・縮める、`fetchImpl` で `fetch` を差し替える        | 同期 throw（`timeoutMs` が正の整数でない）          |
| `createMockTransport(handler, options?)` | PORTERS の代わりに応答を返す送信を作る。契約なしでテストするときに渡す。`auth: false` で認証の自動応答を止める | 失敗しない（応答が無いリクエストは実行時に reject） |

```ts
import {
  PortersClient,
  createFetchTransport,
  createThrottle,
} from "@joymerrevent/porters-connect";

const batchClient = new PortersClient({
  hostname: process.env.PORTERS_HOST ?? "",
  appId: process.env.PORTERS_APP_ID ?? "",
  appSecret: process.env.PORTERS_APP_SECRET ?? "",
  throttle: createThrottle({ readPerMin: 500 }), // バッチ用に控えめな枠
  transport: createFetchTransport({ timeoutMs: 120_000 }), // 大きな添付のために延ばす
});
```

## 固有の注意

これらの関数に共通する注意です。上限の値と挙動は[上限とレート][limits]にあります。

- **`createThrottle` で作ったスロットルは、共有の枠に入りません。** 渡したクライアントだけの上限になります。プロセスを跨いで合計を守りたいときは、`Throttle` を自分で実装して渡します。
- **`createThrottle` と `createFetchTransport` は `Promise` を返さないので、失敗は同期 throw です。** 範囲外の値は `PortersConfigError` になります。
- **`createMockTransport` は、応答を用意していないリクエストをエラーにします。** 黙って空を返さないので、モックし忘れに気づけます（[契約なしでテストする][testing]）。
- **既定の transport と throttle は、渡さなければライブラリが作ります。** 変えたいときだけ渡します（[PortersClient][cl-client]の「構築オプション」）。

## 型

この章の関数の引数と戻り値に出てくる型と役割です。正確な定義は各リンク先（公開 API リファレンス）にあります。

| 型                                                                                                                 | 役割                                                             |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| [`Throttle`][t-Throttle] / [`ThrottleOptions`][t-ThrottleOptions]                                                  | `createThrottle` の戻り値とオプション                            |
| [`Transport`][t-Transport] / [`TransportRequest`][t-TransportRequest] / [`TransportResponse`][t-TransportResponse] | 送信の差し替え口と、その要求・応答のかたち                       |
| [`FetchTransportOptions`][t-FetchTransportOptions]                                                                 | `createFetchTransport` のオプション（`timeoutMs` / `fetchImpl`） |
| [`MockHandler`][t-MockHandler] / [`MockReply`][t-MockReply] / [`MockTransportOptions`][t-MockTransportOptions]     | `createMockTransport` に渡す応答の関数・その戻り値・オプション   |

## 関連

- 主題: [上限とレート][limits]（スロットルとタイムアウト）／[契約なしでテストする][testing]（モック）
- クライアント: [PortersClient][cl-client]（`throttle` / `transport` オプション）
- リソース別: [Attachment][r-attachment]（大きな本体とタイムアウト）
- 関数: [宣言と突合][fn-declare]／[値の変換][fn-convert]
- 実践例: [毎日の差分同期][sync-batch]（バッチだけ枠を分ける）／[複数テナント][multi-tenant]（スロットルの共有）
- リファレンス: [公開 API リファレンス][api]
- ほかの目的から探す: [目次][index]

[index]: ../index.md
[api]: ../api/index.md
[limits]: ../topics/limits.md
[testing]: ../topics/testing.md
[cl-client]: ../client/client.md
[r-attachment]: ../resources/attachment.md
[fn-declare]: declare.md
[fn-convert]: convert.md
[sync-batch]: ../recipes/sync-batch.md
[multi-tenant]: ../recipes/multi-tenant.md
[t-Throttle]: ../api/type-aliases/Throttle.md
[t-ThrottleOptions]: ../api/type-aliases/ThrottleOptions.md
[t-Transport]: ../api/type-aliases/Transport.md
[t-TransportRequest]: ../api/type-aliases/TransportRequest.md
[t-TransportResponse]: ../api/type-aliases/TransportResponse.md
[t-FetchTransportOptions]: ../api/type-aliases/FetchTransportOptions.md
[t-MockHandler]: ../api/type-aliases/MockHandler.md
[t-MockReply]: ../api/type-aliases/MockReply.md
[t-MockTransportOptions]: ../api/type-aliases/MockTransportOptions.md
