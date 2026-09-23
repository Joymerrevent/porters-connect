# Attachment（添付ファイル）

レコードに付くファイルです。ほかのリソースとはかたちが違い、一覧にはファイルの本体が含まれず、1 件ずつ `get` で取ります。

- **アクセサ**: `t.attachment.of("resume")` のように、**どのリソースの添付かを先に指定する**
- **画面名**: 各レコードの「添付ファイル」
- **スコープ**: 読み `attachment_r`（＋ 指定したリソースの `_r`）／ 書き `attachment_w`
- **項目の接頭辞**: 無し（`id` / `resource` / `resourceId` / `contentType` / `fileName` / `content`）

## まず、どのリソースの添付かを指定する

Attachment の Read は **どのリソースの添付か（`resource`）が必須**です（[Attachment の項目と
Mime Type][ref-attachment]）。ライブラリはこれを `of()` で 1 回だけ受け取り、以降のすべての
呼び出しに載せます<!-- 根拠: ADR-0080 -->。

```ts
const files = t.attachment.of("resume"); // 履歴書に付く添付
```

名前はアクセサと同じ綴り（`"candidate"` / `"job"` / …）です。番号ではなく名前なので、
打ち間違いはコンパイルエラーになります。

指定した値は**作成時の付け先にもなります** — `create` に `resource` はありません。
別のリソースに付けたければ、別の `of()` から作ってください。

## 呼べるメソッド

このリソースで呼べるメソッドと、使い方の例です。

| 読み                           | 書き                            |
| ------------------------------ | ------------------------------- |
| `search` / `searchAll` / `get` | `create` / `update`（一括なし） |

```ts
await files.search(); // 一覧（本体は含まない）
await files.searchAll(); // 200 件を超える一覧を順に（本体は含まない）
await files.get(900); // 1 件（本体つき。本体はここだけ）
await files.create(file); // 追加 → 採番された id
await files.update(900, { fileName: "new.pdf" }); // 差し替え
```

**作成と更新で受ける項目が違います。** `create` は 4 項目すべてが必須です。`update` で渡せるのは
`contentType` / `fileName` / `content` の 3 つで、いずれも省略できます。**付け先（`resourceId`）は
更新の入力型に入れていません** — 付け替えができると PORTERS が公表していないので、
ライブラリでも変更できないようにしています。

`delete` はありません（[削除と削除済みデータ][no-delete]）。

## 固有の注意

このリソースだけに当てはまる注意です。共通の規則（検索・書き込み・上限）は主題別のページにあります。
要点は次の 6 つで、詳しくはこの節の下の各項目にあります。

- **先に `of()` でリソースを指定します。** 指定した値は作成時の付け先にもなります（上の「まず、どのリソースの添付かを指定する」）。
- **付け先（`resourceId`）は更新で変えられません。** 間違えたら正しい先に作り直し、間違えたほうは消せません。
- **一覧は本体（`content`）を返しません。** 本体は `get` で 1 件ずつ取ります。
- **絞り込めるのは `resourceId` と `id` だけです。** ファイル名や Mime Type では探せません。
- **本体は 10MB までです。** 超えると送信前に `PortersConfigError` で止まります。
- **一括はありません。** `createMany` / `updateMany` が無く、ファイルは 1 件ずつです。

### 追加する（付け先は変えられない）

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
**間違えたほうは消せません**（[削除と削除済みデータ][no-delete]）。付ける前に
`of()` の名前と `resourceId` を確かめてください。

### 読むときは、本体が付いてこない

**`search` は本体（`content`）を返しません。** メタ情報
（`id` / `resource` / `resourceId` / `contentType` / `fileName`）だけです。

```ts
const page = await files.search({ resourceId: 10001 }); // 1 レコードの添付だけ
for (const a of page.items) console.log(a.fileName, a.contentType);
```

一覧で本体まで返すと、**ファイル全部をダウンロードすることになる**からです。
**本体を取れるのは `get` だけ**です<!-- 根拠: ADR-0075 -->。1 ページは最大 200 件なので、
本体を混ぜると 1 回の応答が **JavaScript が 1 つの文字列として扱える上限を超える**ことがあります
（1 ファイル 2MB 超 × 200 件で `RangeError` になります）。Attachment はファイルサイズを返さないので、
「何件までなら安全か」を呼び出し側が判断することもできません。

この「本体を含めるか」は PORTERS 側では `requestType` というパラメータで、ライブラリは
**メソッドから決めます** — `search` / `searchAll` が `1`（本体なし）、`get` が `0`（本体あり）です。
呼び出し側が選ぶものではありません。

```ts
const one = await files.get(900);
if (one?.content) {
  const bytes = base64ToBytes(one.content);
  console.log(bytes.length);
}
```

200 件を超える添付を順に見るときは `searchAll` が使えます。こちらも返るのは**メタデータだけ**なので、
全件をたどっても本体はダウンロードされません。要るファイルだけ `get` で取ってください。

```ts
for await (const a of files.searchAll()) {
  if (a.id === null || !a.fileName?.endsWith(".pdf")) continue;
  const file = await files.get(a.id); // 本体はここで 1 件ずつ
  if (file?.content) console.log(file.fileName, file.content.length);
}
```

本体が大きいと、既定の **30 秒**（1 リクエストあたり）に収まらないことがあります。
その場合は、タイムアウトを延ばした transport を `new PortersClient({ ... })` のオプションに渡してください（[上限とレート][limits]）。

```ts
transport: createFetchTransport({ timeoutMs: 120_000 });
```

### 絞り込めるのは「どのレコードの添付か」だけ

Attachment の Read が取る絞り込みは `resourceId`（1 レコードの添付）と `id`（1 件）だけで、
**ファイル名や Mime Type での検索はできません**（PORTERS が提供していません）<!-- 根拠: ADR-0081 -->。
名前で探したいときは、`searchAll` で順に読みながら絞ってください（上の例）。

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

正しい値は[リソース一覧][res-list]の `Value` 列にあります。

### 上限は 10MB、送信前に弾かれる

```ts
// PortersConfigError: attachment content is 14000001 characters, over the ~10MB file limit
await files.create({ ...file, content: base64 });
```

`category` は `config` です。通常の「リクエストが長すぎる」の検査（約 15000 文字）は
**アップロードには適用しない**ので、Attachment 専用の上限を別に持っています
（詳しくは[上限とレート][limits]）。

### まとめて作成する方法は無い

`createMany` / `updateMany` は Attachment にはありません。ファイルは 1 件ずつです。
たくさん送るときは、1 分あたり Write 500 の上限をライブラリが守ります（超えそうなら待ちます）。

## 新規作成の必須項目

`create` の必須項目（無条件か、条件付きか）と、渡さないとどこで止まるかです。表にあるのは呼び出し側が渡す項目だけです。

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

`update` で渡せるのは `contentType` / `fileName` / `content` の 3 つで、いずれも省略できます（付け先 `resourceId` は更新で変えられません）。

## 項目と型

標準項目の一覧と、このライブラリの型を引く先です。

- 項目の一覧: [Attachment の項目と Mime Type][ref-attachment]（PORTERS の事実）
- カスタム項目（`U_` / `A_`）: ありません

| 型                                                 | 役割                                 |
| -------------------------------------------------- | ------------------------------------ |
| [`Attachment`][t-Attachment]                       | 読み取った 1 件                      |
| [`AttachmentCreate`][t-AttachmentCreate]           | `create` の入力                      |
| [`AttachmentUpdate`][t-AttachmentUpdate]           | `update` の入力                      |
| [`AttachmentSearchQuery`][t-AttachmentSearchQuery] | `search` のクエリ                    |
| [`AttachmentWalkQuery`][t-AttachmentWalkQuery]     | `searchAll` のクエリ                 |
| [`AttachmentPage`][t-AttachmentPage]               | `search` の戻り値（1 ページ）        |
| [`AttachmentAccessor`][t-AttachmentAccessor]       | `t.attachment` の型（`of()` を持つ） |
| [`AttachmentResource`][t-AttachmentResource]       | `t.attachment.of(...)` の型          |

## 関連

- 主題: [書き込み][bulk-write]（一括はデータ系だけ）／[エラーと再試行][handle-failures]（再送の判断）／[上限とレート][limits]（10MB・タイムアウト）／[削除と削除済みデータ][no-delete]（消せない）
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
[write]: ../topics/write.md
[t-Attachment]: ../api/type-aliases/Attachment.md
[t-AttachmentCreate]: ../api/type-aliases/AttachmentCreate.md
[t-AttachmentUpdate]: ../api/type-aliases/AttachmentUpdate.md
[t-AttachmentSearchQuery]: ../api/type-aliases/AttachmentSearchQuery.md
[t-AttachmentWalkQuery]: ../api/type-aliases/AttachmentWalkQuery.md
[t-AttachmentPage]: ../api/type-aliases/AttachmentPage.md
[t-AttachmentAccessor]: ../api/type-aliases/AttachmentAccessor.md
[t-AttachmentResource]: ../api/type-aliases/AttachmentResource.md
