# 添付ファイルを扱いたい

添付は **Attachment** という専用リソースです。ほかのリソースとは形が違います
（接頭辞なし・中身は Base64・`createMany` が無い）ので、ここだけ別に説明します。

## 5 つのメソッド

```ts
await t.attachment.search(); // 一覧（本体は含まない）
await t.attachment.searchAll(); // 200 件を超える一覧を順に（本体は含まない）
await t.attachment.get(900); // 1 件（**本体つき — 本体はここだけ**）
await t.attachment.create(file); // 追加 → 採番された id
await t.attachment.update(900, { fileName: "new.pdf" }); // 差し替え
```

**作成と更新で受ける項目が違います。** `create` は 5 項目すべてが必須、`update` は
`contentType` / `fileName` / `content` の 3 つだけが任意です。**付け先（`resource` /
`resourceId`）は更新の入力型に入れていません** — 付け替えができると PORTERS が公表していないので、
できることにしていません。

`delete` はありません（[削除 API が無いということ][no-delete]）。

## 追加する

```ts
import { bytesToBase64 } from "@joymerrevent/porters-connect";

const id = await t.attachment.create({
  resource: 1, // どのリソースに付けるか（数値。下の表）
  resourceId: 10001, // そのレコードの id
  contentType: "application/pdf",
  fileName: "履歴書.pdf",
  content: bytesToBase64(fileBytes), // Base64 の本体
});
```

**`resource` は数値**です。型は `number` なので、間違った番号もコンパイルは通ります
（`resourceId` の取り違えと同じく、実行するまで分かりません）。しかも
**付け先は `update` で変えられません**（上記）。間違えたら正しい先に作り直すことになり、
**間違えたほうは消せません**（[削除 API が無いということ][no-delete]）。付ける前に
`resource` と `resourceId` を確かめてください。

| リソース  | 値  | リソース  | 値  | リソース    | 値  |
| --------- | --- | --------- | --- | ----------- | --- |
| Candidate | 1   | Recruiter | 9   | Activity    | 19  |
| Job       | 3   | Sales     | 11  | Opportunity | 25  |
| Client    | 5   | Contract  | 13  | Contact     | 27  |
| Process   | 7   | Resume    | 17  |             |     |

正典は[リソース一覧][res-list]の `Value` 列です。

## 読むときは、本体が付いてこない

**`search` は既定で本体（`content`）を返しません。** メタ情報
（`id` / `resource` / `resourceId` / `contentType` / `fileName`）だけです。

```ts
const page = await t.attachment.search({
  condition: { "ResourceId:eq": "10001" },
});
for (const a of page.items) console.log(a.fileName, a.contentType);
```

一覧で本体まで返すと、**ファイル全部をダウンロードすることになる**からです。
**本体を取れるのは `get` だけ**で、`search` / `searchAll` の `field` に `"Content"` は書けません
（[ADR-0075][adr75]）。1 ページは最大 200 件なので、本体を混ぜると 1 回の応答が
**読める大きさを越える**ことがあります（1 ファイル 2MB 超 × 200 件で、文字列の上限に当たって
`RangeError` になります）。Attachment はファイルサイズを返さないので、「何件までなら安全か」を
呼び出し側が判断することもできません。

```ts
const one = await t.attachment.get(900);
if (one?.content) {
  const bytes = base64ToBytes(one.content);
  console.log(bytes.length);
}
```

200 件を超える添付を順に見るときは `searchAll` が使えます。こちらも**メタデータだけ**が流れるので、
全部を歩いても本体はダウンロードされません。要るファイルだけ `get` で取ってください。

```ts
for await (const a of t.attachment.searchAll({
  condition: { "Resource:eq": "17" },
})) {
  if (a.id === null || !a.fileName?.endsWith(".pdf")) continue;
  const file = await t.attachment.get(a.id); // 本体はここで 1 件ずつ
  if (file?.content) console.log(file.fileName, file.content.length);
}
```

本体が大きいと、既定の **30 秒**（1 リクエストあたり）に収まらないことがあります。
その場合は transport を組んで延ばしてください（[上限][limits]）。

```ts
transport: createFetchTransport({ timeoutMs: 120_000 });
```

`condition` は**ゆるい形**（`{ "Id:eq": "123" }`）です。Attachment は Data Type のカタログを
持たないので、ほかのリソースのような型付き条件にはなっていません。

## 上限は 10MB、送信前に弾かれる

```ts
// PortersConfigError: attachment content is 14000001 characters, over the ~10MB file limit
await t.attachment.create({ ...file, content: base64 });
```

`category` は `config` です。通常の「リクエストが長すぎる」ガード（約 15000 文字）は
**アップロードでは迂回される**ので、Attachment 専用の上限を別に持っています
（詳しくは[上限][limits]）。

## まとめて作成する方法は無い

`createMany` / `updateMany` は Attachment にはありません。ファイルは 1 件ずつです。
たくさん送るときは、レートの自制（1 分あたり Write 500）がライブラリ側で効きます。

## 関連

- 手順: [一括書き込み][bulk-write]（データ系リソースの 200 件分割）／[失敗の扱い][handle-failures]
- 考え方: [上限][limits]（長さ・件数・レート）／[削除 API が無いということ][no-delete]
- API 事実: [リソース一覧][res-list]（`Value` 列）／[Attachment の項目と Mime Type][ref-attachment]
- ほかの目的から探す: [目次][index]

[adr75]: ../../adr/0075-attachment-search-all.md
[bulk-write]: bulk-write.md
[handle-failures]: handle-failures.md
[limits]: ../concepts/limits.md
[ref-attachment]: ../reference/resource-api/resources/attachment.md
[no-delete]: ../concepts/no-delete.md
[res-list]: ../reference/resource-api/resources-list.md
[index]: ../index.md
