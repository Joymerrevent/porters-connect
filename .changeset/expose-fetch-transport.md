---
"@joymerrevent/porters-connect": minor
---

既定 transport を公開し、**1 リクエストのタイムアウトを変えられる**ようにした（ADR-0077）。

既定は **30 秒**のままです。延ばしたいとき（大きな添付を細い回線で取る等）や、短くしたいとき
（対話的なツールで待たせたくない等）に、transport を組んで渡せます。

```ts
import {
  PortersClient,
  createFetchTransport,
} from "@joymerrevent/porters-connect";

const porters = new PortersClient({
  host,
  appId,
  appSecret,
  transport: createFetchTransport({ timeoutMs: 120_000 }), // 2 分
});
```

**この 30 秒は接続から本文の受信完了まで**を measure します（応答ヘッダが早く返っても、本文の
ダウンロードが遅ければそこで打ち切られます）。**1 リクエストごと**なので、自動リトライを含めると
最悪 `maxRetries + 1` 倍かかります。レートの待ち時間は含みません。

`timeoutMs` は**正の整数（ミリ秒）**だけを受けます。`0` は「無制限」ではなく即中断なので、
構築時に `PortersConfigError` で弾きます。

これまでこの値を変えるには `Transport` を自前で実装するしかなく、`PortersNetworkError` への
分類まで書き直すことになっていました。
