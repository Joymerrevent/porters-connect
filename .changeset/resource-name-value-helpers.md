---
"@joymerrevent/porters-connect": minor
---

リソース名と数値を相互変換する **`resourceValueOf` / `resourceNameOf`** を公開した（ADR-0079）。

PORTERS は「どのリソースか」を**非連続な数値**で表します（Candidate `1` / Job `3` / Client `5` /
Recruiter `9` / Sales `11` / …）。欠番（`6`）も取り違え（Recruiter `9` と Sales `11`）も、数値
リテラルでは気づけません。名前から引いてください。

```ts
import { resourceNameOf, resourceValueOf } from "@joymerrevent/porters-connect";

await t.activity.create({
  P_Owner: 5,
  P_Title: "一次面談",
  P_Resource: resourceValueOf("candidate"), // 1
  P_ResourceId: 10001,
});

await t.activity.search({
  condition: { P_Resource: { eq: resourceValueOf("candidate") } },
});
```

`resourceNameOf` は**知らない数値をそのまま返します**（`ResourceName | number`）。Resource List は
PORTERS のもので増えるので（Contact `27` は後から増えました）、知らない値はエラーにせずデータとして
通します。

なお**項目の値は数値のまま**です。ライブラリが名前で受けるのは、PORTERS が `resource=` を
パラメータで要求する場所（`t.phase.of("client")` など）だけで、`Activity.P_Resource` のように
レコードごとに違う値は、宣言した Data Type（`Number`）どおりに扱います。
