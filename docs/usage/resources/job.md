# Job（JOB）

企業の求人です。企業（`P_Client`）と企業担当者（`P_Recruiter`）に必ず紐づき、個人連絡先との結び付きは
[Process][r-process] が持ちます。

- **アクセサ**: `t.job`
- **画面名**: Agent「JOB」／ Staffing「案件」
- **スコープ**: 読み `job_r`（＋ 参照先の `recruiter_r` / `client_r` / `user_r` / `option_r`）／ 書き `job_w`
- **項目の接頭辞**: `Job.`（書くときは付けない）

## 呼べるメソッド

このリソースで呼べるメソッドと、使い方の例です。

| 読み                           | 書き                                              |
| ------------------------------ | ------------------------------------------------- |
| `search` / `searchAll` / `get` | `create` / `update` / `createMany` / `updateMany` |

```ts
const page = await t.job.search({
  expand: { P_Client: ["P_Id", "P_Name"] }, // 参照先の項目も一緒に読む
  order: [{ P_UpdateDate: "desc" }],
});
const id = await t.job.create({
  P_Owner: 5,
  P_Client: 20001,
  P_Recruiter: 30001,
});
```

`delete` はありません（[削除と削除済みデータ][deleted]）。200 件を超える書き込みは `createMany` / `updateMany` が
自動で分割します（[書き込み][write]）。

## 固有の注意

このリソースだけに効く注意です。共通の規則（検索・書き込み・上限）は主題別のページにあります。

- **参照型の項目（`P_Client` / `P_Recruiter`）は、既定では参照先の id だけが返ります。**`expand` で参照先の項目も読めます（[検索][query]）。
- **フェーズの項目には、最新フェーズに対する条件があります**（`P_Phase` / `P_PhaseDate` / `P_PhaseMemo`。日付が最新より新しいこと、など）。詳しくは [Phase][r-phase]。

## 新規作成の必須項目

`create` で必ず渡す項目と、渡さないとどこで止まるかです。

| 項目          | 必須の種類        | どこで止まるか               |
| ------------- | ----------------- | ---------------------------- |
| `P_Owner`     | ●（無条件で必須） | 渡さないとコンパイルで止まる |
| `P_Client`    | ●（無条件で必須） | 渡さないとコンパイルで止まる |
| `P_Recruiter` | ●（無条件で必須） | 渡さないとコンパイルで止まる |

●（無条件で必須）は `create` の入力型が要求し、渡さないとコンパイルで止まります。※（条件付き必須）は
他のレコードの状態に依存するため型では止めず、PORTERS の判定に委ねます（[書き込み][write]の「型で止めないもの」）。
`P_Id` も出典では必須ですが、ライブラリが新規作成の印を送るので渡しません。

このリソースに ※（条件付き必須）の項目はありません。

## 項目と型

標準項目の一覧と、このライブラリの型を引く先です。

- 項目の一覧: [Job の項目][ref]（PORTERS の事実）
- カスタム項目（`U_` / `A_`）: 宣言してから使います（[カスタム項目][custom-fields]）

| 型                                   | 役割                            |
| ------------------------------------ | ------------------------------- |
| [`Job`][t-Job]                       | 読み取った 1 件                 |
| [`JobCreateInput`][t-JobCreateInput] | `create` / `createMany` の入力  |
| [`JobUpdateInput`][t-JobUpdateInput] | `update` / `updateMany` の入力  |
| [`JobSearchQuery`][t-JobSearchQuery] | `search` / `searchAll` のクエリ |
| [`JobPage`][t-JobPage]               | `search` の戻り値（1 ページ）   |
| [`JobResource`][t-JobResource]       | `t.job` の型                    |

## 関連

- 主題: [検索][query]（条件の書き方）／[書き込み][write]（必須と一括）／[上限とレート][limits]（200 件・リクエスト長）
- リソースの一覧: [リソースと操作][resources]
- ほかの目的から探す: [目次][index]

[ref]: ../reference/resource-api/resources/job.md
[query]: ../topics/query.md
[write]: ../topics/write.md
[limits]: ../topics/limits.md
[custom-fields]: ../topics/custom-fields.md
[resources]: README.md
[index]: ../index.md
[r-process]: process.md
[r-phase]: phase.md
[deleted]: ../topics/deleted.md
[t-Job]: ../api/type-aliases/Job.md
[t-JobCreateInput]: ../api/type-aliases/JobCreateInput.md
[t-JobUpdateInput]: ../api/type-aliases/JobUpdateInput.md
[t-JobSearchQuery]: ../api/type-aliases/JobSearchQuery.md
[t-JobPage]: ../api/type-aliases/JobPage.md
[t-JobResource]: ../api/type-aliases/JobResource.md
