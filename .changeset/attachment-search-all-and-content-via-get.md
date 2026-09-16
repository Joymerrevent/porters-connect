---
"@joymerrevent/porters-connect": minor
---

Attachment に `searchAll` を足し、**ファイル本体は `get` でだけ取れる**ようにした（ADR-0075）。

**`searchAll` が増えた。** 200 件を超える添付を、`start` を自分で回さずに順に見られる。
ほかの 15 エンドポイントと同じ語彙になった。

```ts
for await (const a of t.attachment.searchAll({
  condition: { "Resource:eq": "17" },
})) {
  console.log(a.fileName, a.contentType);
}
```

**`search` / `searchAll` の `field` に `"Content"` を書けなくなる。** 一覧はメタデータ
（`id` / `resource` / `resourceId` / `contentType` / `fileName`）だけを運ぶ。

```ts
// これまで通っていた
await t.attachment.search({ field: ["Id", "Content"] });
//                                       ^^^^^^^^^ 型エラーになる
```

**本体は `get(id)` で 1 件ずつ**取る。1 ページは最大 200 件で、PORTERS は 1 ファイル 10MB まで
許すため、本体を混ぜた一覧は**読める大きさを越えることがある** — 1 ファイル 2MB 超 × 200 件で
V8 の文字列上限（536,870,888 文字）に当たり、`RangeError` になって再送しても直らない。
Attachment はファイルサイズを返さないので、「何件までなら安全か」を呼び出し側が判断することも
できない。だから件数ではなく**メソッド**で分けた。

```ts
const file = await t.attachment.get(900);
if (file?.content) {
  /* Base64 の本体 */
}
```

型を外して `"Content"` を渡した場合も、送信前に `PortersConfigError` で止まる。
