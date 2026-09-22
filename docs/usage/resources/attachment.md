# Attachment（添付ファイル）

レコードに付くファイルです。ほかのリソースとはかたちが違い、一覧では本体を運ばず、1 件ずつ `get` で取ります。

- **アクセサ**: `t.attachment.of("resume")` のように、**どのリソースの添付かを先に束ねる**
- **画面名**: 各レコードの「添付ファイル」
- **スコープ**: 読み `attachment_r`（＋ 束ねたリソースの `_r`）／ 書き `attachment_w`
- **項目の接頭辞**: 無し（`id` / `resource` / `resourceId` / `contentType` / `fileName` / `content`）

## まず、どのリソースの添付かを束ねる

Attachment の Read は **どのリソースの添付か（`resource`）が必須**です（[Attachment の項目と
Mime Type][ref-attachment]）。ライブラリはこれを `of()` で 1 回だけ受け取り、以降のすべての
呼び出しに載せます<!-- 根拠: ADR-0080 -->。

```ts
const files = t.attachment.of("resume"); // 履歴書に付く添付
```

名前はアクセサと同じ綴り（`"candidate"` / `"job"` / …）です。番号ではなく名前なので、
打ち間違いはコンパイルエラーになります。

束ねた値は**作成時の付け先にもなります** — `create` に `resource` はありません。
別のリソースに付けたければ、別の `of()` から作ってください。

## 呼べるメソッド

このリソースで呼べるメソッドと、使い方の例です。

| 読み                           | 書き                            |
| ------------------------------ | ------------------------------- |
| `search` / `searchAll` / `get` | `create` / `update`（一括なし） |

```ts
await files.search(); // 一覧（本体は含まない）
await files.searchAll(); // 200 件を超える一覧を順に（本体は含まない）
await files.get(900); // 1 件（**本体つき — 本体はここだけ**）
await files.create(file); // 追加 → 採番された id
await files.update(900, { fileName: "new.pdf" }); // 差し替え
```

**作成と更新で受ける項目が違います。** `create` は 4 項目すべてが必須、`update` は
`contentType` / `fileName` / `content` の 3 つだけが任意です。**付け先（`resourceId`）は
更新の入力型に入れていません** — 付け替えができると PORTERS が公表していないので、
できることにしていません。

`delete` はありません（[削除 API が無いということ][no-delete]）。

## 固有の注意

このリソースだけに効く注意です。それぞれの詳しい説明は、このページの以降の節にあります。

- 読み書きは `of()` で束ねたリソースの添付だけが対象で、束ねた値は作成時の付け先にもなります。
- `search` / `searchAll` は本体（`content`）を返しません。本体は `get` で 1 件ずつ取ります。
- 絞り込めるのは `resourceId` と `id` だけで、ファイル名や Mime Type では探せません。
- 本体は 10MB までです。超えると送信前に `PortersConfigError` で止まります。
- `createMany` / `updateMany` はありません。付け先（`resourceId`）は更新で変えられません。

## 追加する

```ts
import { bytesToBase64 } from "@joymerrevent/porters-connect";

const id = await t.attachment.of("candidate").create({
  resourceId: 10001, // そのレコードの id
  contentType: "application/pdf",
  fileName: "履歴書.pdf",
  content: bytesToBase64(fileBytes), // Base64 の本体
});
```

**`resourceId` は数値で、型は `number`** です。間違った id もコンパイルは通ります。しかも
**付け先は `update` で変えられません**（上記）。間違えたら正しい先に作り直すことになり、
**間違えたほうは消せません**（[削除 API が無いということ][no-delete]）。付ける前に
`of()` の名前と `resourceId` を確かめてください。

## 読むときは、本体が付いてこない

**`search` は本体（`content`）を返しません。** メタ情報
（`id` / `resource` / `resourceId` / `contentType` / `fileName`）だけです。

```ts
const page = await files.search({ resourceId: 10001 }); // 1 レコードの添付だけ
for (const a of page.items) console.log(a.fileName, a.contentType);
```

一覧で本体まで返すと、**ファイル全部をダウンロードすることになる**からです。
**本体を取れるのは `get` だけ**です<!-- 根拠: ADR-0075 -->。1 ページは最大 200 件なので、
本体を混ぜると 1 回の応答が**読める大きさを越える**ことがあります（1 ファイル 2MB 超 × 200 件で、
文字列の上限に当たって `RangeError` になります）。Attachment はファイルサイズを返さないので、
「何件までなら安全か」を呼び出し側が判断することもできません。

この「本体を運ぶか」は PORTERS 側では `requestType` というパラメータで、ライブラリは
**メソッドから決めます** — `search` / `searchAll` が `1`（本体なし）、`get` が `0`（本体あり）です。
呼び出し側が選ぶものではありません。

```ts
const one = await files.get(900);
if (one?.content) {
  const bytes = base64ToBytes(one.content);
  console.log(bytes.length);
}
```

200 件を超える添付を順に見るときは `searchAll` が使えます。こちらも**メタデータだけ**が流れるので、
全部を歩いても本体はダウンロードされません。要るファイルだけ `get` で取ってください。

```ts
for await (const a of files.searchAll()) {
  if (a.id === null || !a.fileName?.endsWith(".pdf")) continue;
  const file = await files.get(a.id); // 本体はここで 1 件ずつ
  if (file?.content) console.log(file.fileName, file.content.length);
}
```

本体が大きいと、既定の **30 秒**（1 リクエストあたり）に収まらないことがあります。
その場合は transport を組んで延ばしてください（[上限][limits]）。

```ts
transport: createFetchTransport({ timeoutMs: 120_000 });
```

## 絞り込めるのは「どのレコードの添付か」だけ

Attachment の Read が取る絞り込みは `resourceId`（1 レコードの添付）と `id`（1 件）だけで、
**ファイル名や Mime Type での検索はできません**（PORTERS が提供していません）<!-- 根拠: ADR-0081 -->。
名前で探したいときは、`searchAll` で歩きながら絞ってください（上の例）。

読み取った `a.resource` は**数値**で返ります（PORTERS のリソース番号）。名前に戻すなら
`resourceNameOf` が使えます。

```ts
import { resourceNameOf } from "@joymerrevent/porters-connect";

resourceNameOf(17); // "resume"
```

| リソース  | 値  | リソース  | 値  | リソース    | 値  |
| --------- | --- | --------- | --- | ----------- | --- |
| Candidate | 1   | Recruiter | 9   | Activity    | 19  |
| Job       | 3   | Sales     | 11  | Opportunity | 25  |
| Client    | 5   | Contract  | 13  | Contact     | 27  |
| Process   | 7   | Resume    | 17  |             |     |

正典は[リソース一覧][res-list]の `Value` 列です。

## 上限は 10MB、送信前に弾かれる

```ts
// PortersConfigError: attachment content is 14000001 characters, over the ~10MB file limit
await files.create({ ...file, content: base64 });
```

`category` は `config` です。通常の「リクエストが長すぎる」ガード（約 15000 文字）は
**アップロードでは迂回される**ので、Attachment 専用の上限を別に持っています
（詳しくは[上限][limits]）。

## まとめて作成する方法は無い

`createMany` / `updateMany` は Attachment にはありません。ファイルは 1 件ずつです。
たくさん送るときは、レートの自制（1 分あたり Write 500）がライブラリ側で効きます。

## 新規作成の必須項目

`create` で必ず渡す項目と、渡さないとどこで止まるかです。

| 項目          | 必須の種類        | どこで止まるか               |
| ------------- | ----------------- | ---------------------------- |
| `resourceId`  | ●（無条件で必須） | 渡さないとコンパイルで止まる |
| `contentType` | ●（無条件で必須） | 渡さないとコンパイルで止まる |
| `fileName`    | ●（無条件で必須） | 渡さないとコンパイルで止まる |
| `content`     | ●（無条件で必須） | 渡さないとコンパイルで止まる |

●（無条件で必須）は `create` の入力型が要求し、渡さないとコンパイルで止まります。※（条件付き必須）は
他のレコードの状態に依存するため型では止めず、PORTERS の判定に委ねます（[書き込み][write]の「型で止めないもの」）。
`id` は採番されるので渡しません。

このリソースに ※（条件付き必須）の項目はありません。

`update` は `contentType` / `fileName` / `content` の 3 つだけが任意です（付け先 `resourceId` は更新で変えられません）。

## 項目と型

標準項目の一覧と、このライブラリの型を引く先です。

- 項目と Mime Type: [Attachment の項目][ref-attachment]（PORTERS の事実）
- 型: [`Attachment`][t-read]（読み取り）／ [`AttachmentCreate`][t-create] ／ [`AttachmentUpdate`][t-update] ／
  [`AttachmentSearchQuery`][t-query] ／ [`AttachmentWalkQuery`][t-walk] ／ [`AttachmentPage`][t-page] ／
  [`AttachmentAccessor`][t-accessor] ／ [`AttachmentResource`][t-resource]

## 関連

- 手順: [一括書き込み][bulk-write]（データ系リソースの 200 件分割）／[失敗の扱い][handle-failures]
- 考え方: [上限][limits]（長さ・件数・レート）／[削除 API が無いということ][no-delete]
- API 事実: [リソース一覧][res-list]（`Value` 列）／[Attachment の項目と Mime Type][ref-attachment]
- リソースの一覧: [リソースと操作][resources]
- ほかの目的から探す: [目次][index]

[bulk-write]: ../topics/write.md
[handle-failures]: ../topics/errors.md
[limits]: ../topics/limits.md
[ref-attachment]: ../reference/resource-api/resources/attachment.md
[no-delete]: ../topics/deleted.md
[res-list]: ../reference/resource-api/resources-list.md
[index]: ../index.md
[resources]: README.md
[t-read]: ../api/type-aliases/Attachment.md
[t-create]: ../api/type-aliases/AttachmentCreate.md
[t-update]: ../api/type-aliases/AttachmentUpdate.md
[t-query]: ../api/type-aliases/AttachmentSearchQuery.md
[t-walk]: ../api/type-aliases/AttachmentWalkQuery.md
[t-page]: ../api/type-aliases/AttachmentPage.md
[t-accessor]: ../api/type-aliases/AttachmentAccessor.md
[t-resource]: ../api/type-aliases/AttachmentResource.md
[write]: ../topics/write.md
