# Job（JOB）

- **アクセサ**: `t.job`
- **画面名**: Agent「JOB」／ Staffing「案件」
- **スコープ**: 読み `job_r`（＋ 参照先の `recruiter_r` / `client_r` / `user_r` / `option_r`）／ 書き `job_w`
- **項目の接頭辞**: `Job.`（書くときは付けない）

企業の求人です（Staffing では案件）。企業（`P_Client`）と企業担当者（`P_Recruiter`）に必ず紐づきます。
個人連絡先との結び付きは [Process][r-process] が持ちます。

## 呼べるメソッド

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

- 参照型の項目は `P_Client` / `P_Recruiter` です。既定では参照先の id だけが返り、`expand` を書くと参照先の項目も一緒に読めます（[検索][query]）。
- フェーズの項目（`P_Phase` / `P_PhaseDate` / `P_PhaseMemo`）は**最新フェーズに対する条件**があります（フェーズ日付が最新より新しいこと、など）。同じフェーズなら上書き、違うフェーズなら追加です。履歴そのものは [Phase][r-phase] で読みます。

## 新規作成の必須項目

`P_Owner` / `P_Client` / `P_Recruiter`

出典で `●`（無条件で必須）の項目だけを `create` の入力型が要求します。`※`（条件付き必須）は型で止めず、
PORTERS の判定に委ねます（[書き込み][write]）。

## 項目と型

- 標準項目（`P_`）の一覧: [Job の項目][ref]（PORTERS の事実）
- 型: [`Job`][t-read]（読み取り）／ [`JobCreateInput`][t-create] ／ [`JobUpdateInput`][t-update] ／
  [`JobSearchQuery`][t-query] ／ [`JobPage`][t-page] ／ [`JobResource`][t-resource]
- テナント固有の項目（`U_` / `A_`）は宣言してから使います（[カスタム項目][custom-fields]）

## 関連

- 主題: [検索][query]／[書き込み][write]／[上限とレート][limits]
- リソースの一覧: [リソースと操作][resources]
- ほかの目的から探す: [目次][index]

[ref]: ../reference/resource-api/resources/job.md
[t-read]: ../api/type-aliases/Job.md
[t-create]: ../api/type-aliases/JobCreateInput.md
[t-update]: ../api/type-aliases/JobUpdateInput.md
[t-query]: ../api/type-aliases/JobSearchQuery.md
[t-page]: ../api/type-aliases/JobPage.md
[t-resource]: ../api/type-aliases/JobResource.md
[query]: ../topics/query.md
[write]: ../topics/write.md
[limits]: ../topics/limits.md
[custom-fields]: ../topics/custom-fields.md
[resources]: README.md
[index]: ../index.md
[r-process]: process.md
[r-phase]: phase.md
[deleted]: ../topics/deleted.md
