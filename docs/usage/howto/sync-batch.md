# 毎日同期するバッチを書きたい

「夜間に PORTERS と自社 DB を突き合わせる」のような定期同期は、実務でいちばん多い用途です。
ただし**このライブラリが受け持つのはその一部**なので、境界を先に示します。

## このページの範囲

| ライブラリが受け持つ                | あなたが用意する                                         |
| ----------------------------------- | -------------------------------------------------------- |
| 差分の取得（`P_UpdateDate` の条件） | **いつ動かすか**（cron・ワークフローなどのスケジューラ） |
| 200 件・約 15000 文字での自動分割   | **前回どこまで進んだか**の保存                           |
| レートの自制とリトライ              | **業務ルール**（どの項目をどう突き合わせるか）           |
| 部分成功の報告（`BulkWriteResult`） | **月あたりのアクセス数**の見積もりと管理                 |

右側は**意図的に持っていません**。とくに月 15 万アクセスは契約条件で、プロセスを跨いだ累積を
ライブラリが正しく数えられないためです（[上限][limits]）。

## 1. 前回からの差分を取る

更新日時で絞ります。`searchAll` がページングを引き受けるので、件数を気にせず回せます。

```ts
const since = "2026-09-01T00:00:00Z"; // 前回の実行時刻（保存はあなたの責務）

for await (const c of t.candidate.searchAll({
  field: ["P_Id", "P_Name", "P_Mail", "P_UpdateDate"],
  condition: { P_UpdateDate: { ge: since } },
  order: [{ P_UpdateDate: "asc" }],
})) {
  console.log(c.P_Id, c.P_UpdateDate);
}
```

`field` は省略すると**カタログ上の全項目**が返ります。同期では**使う項目だけ挙げる**ほうが、
転送量もリクエスト長も小さくなります（[検索][search-records]）。

### 取りこぼしを防ぐ 3 点

- **次回の起点は「今回の開始時刻」にする。** 処理中にも更新は起きます。終了時刻を起点にすると、
  処理中の更新を落とします。
- **境界は重なってよい。** `ge` は「以上」なので、前回と同じレコードをもう一度拾うことがあります。
  **取り込み側を冪等に**しておけば実害はありません（取りこぼしより安全です）。
- **削除は差分で追えません。** PORTERS の API に削除はなく、画面で消されたものは更新として
  流れてきません。必要なら `itemstate` で別途読みます（[削除 API が無いということ][no-delete]）。

## 2. 書き戻す

まとめて書くときは `createMany` / `updateMany` を使います。**200 件・約 15000 文字での分割は
ライブラリがやります**ので、件数で区切る必要はありません。

```ts
const result = await t.candidate.updateMany([
  { id: 10001, fields: { P_Memo: "同期済み" } },
  { id: 10002, fields: { P_Memo: "同期済み" } },
]);

if (result.hasFailures) {
  for (const f of result.failed) logger.warn(`#${f.index} は code ${f.code}`);
}
```

**一括書き込みはアトミックではありません。** 成功と失敗が混ざるので、`hasFailures` を必ず見て
ください。詳しくは[一括書き込み][bulk-write]にあります。

## 3. 失敗したときに、どこから再開するか

バッチで効いてくるのは「**再送してよいか**」の判断です。

- **`create` は再送してはいけません。** 非冪等なので、届いていたら 2 件できます。しかも
  **消せません**。ライブラリも自動では再送しません。
- **`update` は同じ内容なら再送できます。** 冪等なので、迷ったらこちらへ倒します。
- **レート超過とネットワーク断は待って再送する価値があります。** ライブラリが自制と
  リトライをしますが、それでも尽きたときはバッチ側の判断です。

判断表は[失敗の扱い][handle-failures]にあります。

## 4. レートは自制される

1 分あたり Read 2000 / Write 500 を、ライブラリが内蔵スロットリングで抑えます。**上限に近づくと
待つ**ので、バッチ側で `sleep` を挟む必要はありません。

一方、**月あたり約 15 万アクセスは契約条件**で、ライブラリは数えていません。日次バッチなら
「1 回あたりのリクエスト数 × 日数」を見積もっておいてください（[上限][limits]）。

## 全体の形

```ts
const startedAt = new Date().toISOString(); // 次回の起点はここ
const since = (await kv.get("porters:lastSync")) ?? "2026-01-01T00:00:00Z";

const updates: { id: number; fields: { P_Memo: string } }[] = [];
for await (const c of t.candidate.searchAll({
  field: ["P_Id", "P_UpdateDate"],
  condition: { P_UpdateDate: { ge: since } },
})) {
  // 読み取った項目は **null になりうる**（要求しても PORTERS が返さない場合がある）。
  // id が無いレコードは書き戻せないので飛ばす。
  if (typeof c.P_Id !== "number") continue;
  updates.push({ id: c.P_Id, fields: { P_Memo: "同期済み" } });
}

const r = await t.candidate.updateMany(updates);
if (!r.hasFailures) await kv.set("porters:lastSync", startedAt); // 全部成功したときだけ進める
```

**失敗が 1 件でもあれば起点を進めない**のが安全側です。次回に重複して拾いますが、更新は冪等なので
実害が出ません。

## 関連

- 手順: [一括書き込み][bulk-write]（分割と部分成功）／[検索][search-records]（条件の書き方）／[失敗の扱い][handle-failures]
- 考え方: [上限][limits]／[日時は UTC][datetime]（`P_UpdateDate` は ISO 8601）／[削除 API が無いということ][no-delete]

[bulk-write]: bulk-write.md
[datetime]: ../concepts/datetime.md
[handle-failures]: handle-failures.md
[limits]: ../concepts/limits.md
[no-delete]: ../concepts/no-delete.md
[search-records]: search-records.md
