---
"@joymerrevent/porters-connect": minor
---

**添付ファイルの Read が PORTERS の語彙に揃いました**（ADR-0081）。破壊的変更です。

PORTERS の `Attachment - Read` が取るのは `requestType` / `resource` / `resourceId` / `id` で、
**`field` と `condition` は挙げられていません**。これまでのライブラリは逆で、必須の 2 つを送らず、
記載の無い 2 つを送っていました。出典に一致する側へ倒しました。

```ts
// これまで
await t.attachment.search({ condition: { "ResourceId:eq": "10001" } });
await t.attachment.get(900);
await t.attachment.create({ resource: 17, resourceId: 10001, ...file });

// これから
const files = t.attachment.of("resume"); // resource を 1 回束ねる
await files.search({ resourceId: 10001 });
await files.get(900);
await files.create({ resourceId: 10001, ...file }); // resource は束ねた値
```

変わるのは 3 つです。

- **`of(resource)` で束ねてから使います。** 束ねた値は Read の `resource=` と、書き込みの
  `<Resource>` の両方を埋めます。`create` の入力から `resource` は消えました — 付け先を
  取り違えても添付は消せないので、書ける場所を減らしています。
- **`field` / `condition` は無くなりました。** 本体（`content`）を運ぶかは引き続きメソッドが
  決めます（`get` だけが運びます）。絞り込めるのは `resourceId`（1 レコードの添付）と
  `id`（1 件）だけで、**ファイル名などでの検索はできません**（PORTERS が提供していません）。
  名前で探すときは `searchAll` で歩きながら絞ってください。
- 読み取った `resource` は**数値のまま**です。名前に戻すなら `resourceNameOf` が使えます。

`of()` に渡すのは名前（`"resume"` / `"candidate"` …）なので、番号の取り違えは起きません。
なお**出典どおりの形が実機で通るかは未確認**です（契約環境でのみ確かめられます）。
