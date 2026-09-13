---
"@joymerrevent/porters-connect": minor
---

スロットルをホストごとに共有するようにした（ADR-0073・RV-43）。

**既定の挙動が変わる。** これまで 1 分あたりの上限を自制するバケットは `PortersClient` ごとに
作られていた。ガイドはテナント別に client を立てることを勧めている（トークンを分けたい・
カスタム項目の構成が違う）ため、そのとおりに書くと **client の数だけ上限が並ぶ**状態だった。
PORTERS から見えるのは合計なので、50 テナントなら上限の 50 倍まで出せてしまう。

同じホストを向く client は、同じバケットを通るようにした。ローカルのフェイクは別ホストなので
本番向けの枠を食わない。**同じホストへ複数 client を立てていた場合、以前より待つことがある。**
それが本来の上限で、超えていたほうが誤り。

あわせて `Throttle` を差し替えられるようにした（追加のみ）。

```ts
import { createThrottle, PortersClient } from "@joymerrevent/porters-connect";

// 共有から降りる／別の上限で走らせる
const porters = new PortersClient({
  host,
  appId,
  appSecret,
  throttle: createThrottle(),
});
```

`Throttle` は `take(write: boolean): Promise<void>` の 1 メソッドなので、Redis などに載せれば
**プロセスを跨いだ協調**も書ける。[ADR-0010][adr10] が利用側に残していた点で、ライブラリの
責務にはしない（月次の累積管理と同じ線引き）が、書けるようにはした。

新しい公開記号: `createThrottle` ／ `Throttle` ／ `ThrottleOptions` ／
`PortersClientOptions.throttle`。

[adr10]: https://github.com/Joymerrevent/porters-connect/blob/main/docs/adr/0010-retry-throttle.md
