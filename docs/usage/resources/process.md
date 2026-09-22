# Process（選考プロセス）

- **アクセサ**: `t.process`
- **画面名**: Agent「選考プロセス」／ Staffing「引当 / 就業管理」
- **スコープ**: 読み `process_r`（＋ 参照先の `candidate_r` / `resume_r` / `client_r` / `recruiter_r` / `job_r` / `user_r` / `option_r`）／ 書き `process_w`
- **項目の接頭辞**: `Process.`（書くときは付けない）

個人連絡先（レジュメ）と JOB を結ぶ選考の記録です。JOB とレジュメの組ごとに 1 件だけ作れます。

## 呼べるメソッド

| 読み                           | 書き                                              |
| ------------------------------ | ------------------------------------------------- |
| `search` / `searchAll` / `get` | `create` / `update` / `createMany` / `updateMany` |

```ts
const existing = await t.process.search({
  field: [],
  condition: { P_Job: { eq: 40001 }, P_Resume: { eq: 50001 } },
});
if (existing.total === 0) {
  await t.process.create({
    P_Owner: 5,
    P_Client: 20001,
    P_Recruiter: 30001,
    P_Job: 40001,
    P_Candidate: 10001,
    P_Resume: 50001,
  });
}
```

`delete` はありません（[削除と削除済みデータ][deleted]）。200 件を超える書き込みは `createMany` / `updateMany` が
自動で分割します（[書き込み][write]）。

## 固有の注意

- **JOB × レジュメの組で一意**です。同じ組を二度作ると Result Code `301` で失敗します（`category` は `conflict`）。作る前に `P_Job` と `P_Resume` で `search` して有無を確かめると往復が減ります。
- 参照型の項目は `P_Client` / `P_Recruiter` / `P_Job` / `P_Candidate` / `P_Resume` です。既定では参照先の id だけが返り、`expand` を書くと参照先の項目も一緒に読めます（[検索][query]）。
- フェーズの項目（`P_Phase` / `P_PhaseDate` / `P_PhaseMemo`）は**最新フェーズに対する条件**があります（フェーズ日付が最新より新しいこと、など）。同じフェーズなら上書き、違うフェーズなら追加です。履歴そのものは [Phase][r-phase] で読みます。

## 新規作成の必須項目

`P_Owner` / `P_Client` / `P_Recruiter` / `P_Job` / `P_Candidate` / `P_Resume`

出典で `●`（無条件で必須）の項目だけを `create` の入力型が要求します。`※`（条件付き必須）は型で止めず、
PORTERS の判定に委ねます（[書き込み][write]）。

## 項目と型

- 標準項目（`P_`）の一覧: [Process の項目][ref]（PORTERS の事実）
- 型: [`Process`][t-read]（読み取り）／ [`ProcessCreateInput`][t-create] ／ [`ProcessUpdateInput`][t-update] ／
  [`ProcessSearchQuery`][t-query] ／ [`ProcessPage`][t-page] ／ [`ProcessResource`][t-resource]
- テナント固有の項目（`U_` / `A_`）は宣言してから使います（[カスタム項目][custom-fields]）

## 関連

- 主題: [検索][query]／[書き込み][write]／[上限とレート][limits]
- リソースの一覧: [リソースと操作][resources]
- ほかの目的から探す: [目次][index]

[ref]: ../reference/resource-api/resources/process.md
[t-read]: ../api/type-aliases/Process.md
[t-create]: ../api/type-aliases/ProcessCreateInput.md
[t-update]: ../api/type-aliases/ProcessUpdateInput.md
[t-query]: ../api/type-aliases/ProcessSearchQuery.md
[t-page]: ../api/type-aliases/ProcessPage.md
[t-resource]: ../api/type-aliases/ProcessResource.md
[query]: ../topics/query.md
[write]: ../topics/write.md
[limits]: ../topics/limits.md
[custom-fields]: ../topics/custom-fields.md
[resources]: README.md
[index]: ../index.md
[r-phase]: phase.md
[deleted]: ../topics/deleted.md
