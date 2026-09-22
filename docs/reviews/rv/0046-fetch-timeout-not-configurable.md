# RV-46 🟡 既定 30 秒のタイムアウトを公開 API から変えられない

- 重要度: 🟡 ／ 観点: 公開サーフェス / フェイルセーフ
- 状態: fixed

## 概要

既定の transport は **1 リクエスト 30 秒**で打ち切る。この値を変える手段が**公開 API に無い**。
`createFetchTransport`（`timeoutMs` を取る）は `src/index.ts` から export しておらず、
`PortersClient` にもタイムアウトのオプションが無いため、**利用者に残された手は
`Transport` を自分で実装すること**だけになる。

## 根拠

実測（2026-09-16）。

- `src/http/fetch-transport.ts`: `const timeoutMs = opts.timeoutMs ?? 30_000;` を
  `AbortSignal.timeout(timeoutMs)` に渡している。**接続から本文の受信完了まで**が対象
  （ローカルサーバで本文を流し続けて確認: ヘッダ受信 8ms → 1005ms で `DOMException` 中断）。
- `src/index.ts` の http 関連の export は `Transport` / `TransportRequest` / `TransportResponse`
  の型、`createMockTransport`、`createThrottle` とその型のみ。**`createFetchTransport` は無い**。
- `PortersClient` のオプションは `transport?: Transport` を受けるだけで、タイムアウトの受け口は無い。

**同じ性質の隣人は公開されている。** スロットルは [ADR-0073][adr73] で
「自制の単位を差し替えられるように」と `createThrottle` を公開した。タイムアウトも
「環境によって適正値が違う」という同じ形の設定で、そちらだけ塞がっている。

## 影響

**中くらい。** 効いてくるのは**大きな添付**で、PORTERS は 1 ファイル 10MB まで許す
（[ADR-0075][adr75] で本体は `get(id)` に寄せた）。細い回線では 30 秒に収まらず、
`PortersNetworkError` として最大 4 回（既定 `maxRetries: 3`）取り直してから失敗する。
回避するには利用者が fetch とエラー包み直しを自前で書くことになり、
`PortersNetworkError` への分類（[ADR-0006][adr6]）を再実装させることになる。

逆向きの不便もある。短くしたい運用（対話的な CLI で待たせたくない等）でも同じく手が無い。

## 検出経緯

[ADR-0075][adr75] の実装後、「30 秒とは何の制限か」という問いから（2026-09-16）。
ADR の根拠に「既定の 30 秒タイムアウトに触れる」と書いたが、**その値を利用者が動かせるか**は
誰も確かめていなかった。ドキュメントにも記述が無かった（本 PR で [上限][limits] に追記した）。

## 推奨

**`createFetchTransport` と `FetchTransportOptions` を公開する**のが最小で、
`createThrottle` の先例（[ADR-0073][adr73]）と揃う。

```ts
new PortersClient({
  host,
  appId,
  appSecret,
  transport: createFetchTransport({ timeoutMs: 120_000 }),
});
```

検討すべき別案:

- **`PortersClient` に `timeoutMs` を足す** — 1 行で書けるが、transport を差し替えたときに
  どちらが勝つのかという曖昧さが生まれる（`transport` と併用されたら無視するのか上書きするのか）。
- **既定値そのものを見直す** — 30 秒は添付の本体（最大 10MB）を想定した値ではない。
  ただし全リクエストに効く既定なので、上げると異常時の滞留が延びる。

**公開 API の追加**なので、どれを採るにしても ADR を起こしてから実装する。

## 処置

**公開した**（2026-09-16・[ADR-0077][adr77] 案A）。推奨どおり `createFetchTransport` と
`FetchTransportOptions` を `src/index.ts` から export した。設定の置き場所が transport を作る側の
1 つに決まるので、案B（`PortersClient` に `timeoutMs`）が抱える「transport を渡したときに
どちらが勝つか」は生まれない。既定は **30 秒のまま**据え置いた。

```ts
new PortersClient({
  host,
  appId,
  appSecret,
  transport: createFetchTransport({ timeoutMs: 120_000 }),
});
```

**起票時に残した論点（`0` / 負値）も決めた。** `timeoutMs` は**正の整数だけ**を受け、
それ以外は**構築時に** `PortersConfigError` で弾く。`AbortSignal.timeout(0)` は即中断するので、
`0` を通すと全リクエストが `network` エラーになり「サーバーが落ちている」と読めてしまう
＝ 設定ミスが別の診断に化ける。手前で弾くのは `count` の範囲（[RV-28][rv28]）や
`host` の書式（[ADR-0048][adr48]）と同じ線。

## 検証

co-located テストで 4 つ固定した — signal が渡ること、**応答本文の受信が終わらなければ
その signal で中断する**こと（ヘッダは即返る応答で確認＝本文まで見ている）、
`0` / 負値 / 小数 / `NaN` は構築時に落ちること、省略すれば通ること。
ドキュメントは [上限][limits]（延ばし方と `0` を受けない理由）と
[添付ファイル][attachments]（大きなファイルのとき）に書いた。

[adr77]: ../../adr/0077-fetch-transport-timeout.md
[adr48]: ../../adr/0048-access-point-host-validation.md
[rv28]: 0028-count-range-unvalidated.md
[attachments]: ../../usage/resources/attachment.md
[adr73]: ../../adr/0073-throttle-sharing.md
[adr75]: ../../adr/0075-attachment-search-all.md
[adr6]: ../../adr/0006-error-model.md
[limits]: ../../usage/topics/limits.md
