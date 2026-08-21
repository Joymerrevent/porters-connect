---
"@joymerrevent/porters-connect": minor
---

**⚠️ 破壊的変更**: **`PortersClient` から `partition` を外しました**（[ADR-0055][adr55]）。
partition（Company DB）スコープのリソースは **`porters.tenant(id)` 経由でのみ**取得します。
**単一テナントでも同じ形**です。

### 移行

`partition` を渡していたコードは、**スコープを一度束ねる**形へ置き換えてください。

```diff
- const porters = new PortersClient({ host, appId, appSecret, partition: 123 });
- await porters.candidate.search();
+ const porters = new PortersClient({ host, appId, appSecret });
+ const t = porters.tenant(123);
+ await t.candidate.search();
```

`t` は以降クライアントのように使えるので、**呼び出し側の書き味は変わりません**。
影響を受けるのは `candidate` / `job` / `client` / `process` / `resume` / `attachment` /
`user` / `field` / `option` の 9 アクセサです。

**App レベルのものは `porters` 側に残ります**（いずれも `partition` を取りません）。

```ts
await porters.auth.ensureAuthenticated(); // OAuth
const partitions = await porters.partition.search(); // partition の発見
```

### なぜ変えたか

`partition` 未設定のクライアントは、これまで **`partition=0`** を全リクエストに載せていました。
`0` は PORTERS のドキュメントに存在しない値で、由来は最初の PoC の穴埋めです。
実際には Result Code **404**（partition が存在しない / ID 誤り）を招くため、
**設定漏れが「サーバーが 404 を返す」形に化け、自分が設定し忘れたことに気づけません**でした。

`tenant(id)` を唯一の経路にすることで、**「partition を束ね忘れたクライアント」という状態が
型として存在しなくなります**。実行時ガードを足すのではなく、設計で防ぐ形にしました。
partition の解決も `tenant(id)` の 1 層だけになり、「スコープと client 既定のどちらが効いているか」を
考える必要がなくなります。

なお**誤った partition を渡すこと自体は妨げません** — それは利用者の選択で、404 はサーバーが答えます。
本変更の主題は**ライブラリが値を捏造しないこと**です。

[adr55]: docs/adr/0055-partition-binding-guard.md
