# 毎日の差分同期（差分取得と書き戻し）

夜間に PORTERS と自社 DB を突き合わせるような、定期の同期を組むときに読むページです。前回からの差分だけを取り、
書き戻し、失敗したところから再開するバッチを、ライブラリのどの機能で組むかが分かります。読み終えると、
取りこぼしと二重登録を避けた同期バッチを自分の環境で書けます。

## 使う機能

この用途で使うライブラリの機能と、それぞれの役割です。

| 機能                                 | 何に使うか                                             |
| ------------------------------------ | ------------------------------------------------------ |
| `searchAll` ＋ `P_UpdateDate` の条件 | 前回の起点以降に更新されたレコードだけを全件辿る       |
| `createMany` / `updateMany`          | 200 件・約 15000 文字での自動分割と、件ごとの成否      |
| `BulkWriteResult`                    | 部分成功を見て、起点を進めるか決める                   |
| 内蔵スロットル ／ `createThrottle`   | 1 分あたりの上限を自制する。バッチだけ枠を分けることも |
| `itemstate: "deleted"`               | 差分では追えない削除を別に読む                         |

## 組み立て

次の順に組みます。差分を取る → 書き戻す → 再開の判断 → レート、の 4 段です。

### 1. 前回からの差分を取る

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

`field` を省略すると、ライブラリが知っている**全項目**が返ります（[項目と値のかたち][aliases]）。同期では**使う項目だけ**挙げてください。
毎日・全件を回すぶん、転送量とリクエスト長の差がそのまま結果に出ます（[検索][search-records]）。

#### 取りこぼしを防ぐ 3 点

- **次回の起点は「今回の開始時刻」にする。** 処理中にも更新は起きます。終了時刻を起点にすると、
  処理中の更新を取りこぼします。
- **境界は重なってよい。** `ge` は「以上」なので、前回と同じレコードをもう一度拾うことがあります。
  **取り込み側を冪等に**しておけば実害はありません（取りこぼしより安全です）。
- **削除は差分で追えません。** PORTERS の API に削除はなく、画面で消されたものは更新として
  流れてきません。必要なら `itemstate` で別途読みます（[削除と削除済みデータ][no-delete]）。

### 2. 書き戻す

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

**一括書き込みは、全部成功か全部失敗か、ではありません。** 成功と失敗が混ざるので、`hasFailures` を必ず見て
ください。詳しくは[書き込み][bulk-write]にあります。

### 3. 失敗したときに、どこから再開するか

バッチで重要になるのは「**再送してよいか**」の判断です。

- **`create` は再送してはいけません。** 非冪等なので、届いていたら 2 件できます。しかも
  **消せません**。ライブラリも自動では再送しません。
- **`update` は同じ内容なら再送できます。** 冪等なので、迷ったらこちらへ倒します。
- **レート超過とネットワーク断は待って再送する価値があります。** ライブラリが自制と
  リトライをしますが、それでも尽きたときはバッチ側の判断です。

判断表は[エラーと再試行][handle-failures]にあります。

### 4. レートは自制される

1 分あたり Read 2000 / Write 500 を、ライブラリが内蔵スロットリングで抑えます。**上限に近づくと
待つ**ので、バッチ側で `sleep` を挟む必要はありません。

**バケットはホストごと**です<!-- 根拠: ADR-0073 -->。同じ PORTERS を向くクライアントをいくつ
作っても、合計が上限に収まります。バッチと Web アプリを同じプロセスで動かしても同じです。

**別プロセスで動かすなら話は別です。** 日次バッチを Web アプリとは別のプロセスで回すと、
2 つのバケットが並びます。合計で守りたいなら `Throttle` を自分で実装して渡します
（`take(write: boolean): Promise<void>` の 1 メソッドなので、Redis に載せれば協調できます）。
既定の実装は `createThrottle` で、上限だけ変えることもできます。

```ts
import { createThrottle, PortersClient } from "@joymerrevent/porters-connect";

// バッチには控えめな枠を割り当てる（Web アプリ側に余らせる）
const porters = new PortersClient({
  hostname: process.env.PORTERS_HOST ?? "",
  appId: process.env.PORTERS_APP_ID ?? "",
  appSecret: process.env.PORTERS_APP_SECRET ?? "",
  throttle: createThrottle({ readPerMin: 500, writePerMin: 100 }),
});
```

一方、**月あたり約 15 万アクセスは契約条件**で、ライブラリは数えていません。日次バッチなら
「1 回あたりのリクエスト数 × 日数」を見積もっておいてください（[上限とレート][limits]）。

### 全体の形

ここまでを 1 本にまとめると、こうなります。

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

## ライブラリの外（利用側の責務）

この用途で自分で用意するものです。ライブラリは意図的に持ちません。

- **いつ動かすか**（cron・ワークフローなどのスケジューラ）
- **前回どこまで進んだか**の保存（起点の日時）
- **業務ルール**（どの項目をどう突き合わせるか）
- **月あたりのアクセス数**の見積もりと管理（契約条件で、プロセスを跨いだ累積をライブラリは数えられない。[上限とレート][limits]）

## 関連

- 主題: [検索][search-records]（条件の書き方）／[書き込み][bulk-write]（分割と部分成功）／[エラーと再試行][handle-failures]（再送してよいか）／
  [上限とレート][limits]／[日時と時分型][datetime]（`P_UpdateDate` は ISO 8601）／[削除と削除済みデータ][no-delete]
- リソース別: [リソースと操作][resources]（呼べるメソッドはリソースごとに違う）
- 実践例: [複数テナント][multi-tenant]（レートの共有）
- ほかの目的から探す: [目次][index]

[bulk-write]: ../topics/write.md
[datetime]: ../topics/datetime.md
[handle-failures]: ../topics/errors.md
[limits]: ../topics/limits.md
[no-delete]: ../topics/deleted.md
[aliases]: ../topics/fields.md
[search-records]: ../topics/query.md
[index]: ../index.md
[multi-tenant]: multi-tenant.md
[resources]: ../resources/README.md
