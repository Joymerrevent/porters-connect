# Resume（レジュメ）

- **アクセサ**: `t.resume`
- **画面名**: Agent「レジュメ」／ Staffing「スタッフ」
- **スコープ**: 読み `resume_r`（＋ 参照先の `candidate_r` / `user_r` / `option_r`）／ 書き `resume_w`
- **項目の接頭辞**: `Resume.`（書くときは付けない）

個人連絡先に属する経歴です。本人（`P_Candidate`）に必ず紐づき、選考（[Process][r-process]）と添付の付け先になります。

## 呼べるメソッド

| 読み                           | 書き                                              |
| ------------------------------ | ------------------------------------------------- |
| `search` / `searchAll` / `get` | `create` / `update` / `createMany` / `updateMany` |

```ts
const page = await t.resume.search({
  condition: { P_Candidate: { eq: 10001 } },
}); // 1 人のレジュメ
const id = await t.resume.create({ P_Owner: 5, P_Candidate: 10001 });
```

`delete` はありません（[削除と削除済みデータ][deleted]）。200 件を超える書き込みは `createMany` / `updateMany` が
自動で分割します（[書き込み][write]）。

## 固有の注意

- 参照型の項目は `P_Candidate` です。既定では参照先の id だけが返り、`expand` を書くと参照先の項目も一緒に読めます（[検索][query]）。
- フェーズの項目（`P_Phase` / `P_PhaseDate` / `P_PhaseMemo`）は**最新フェーズに対する条件**があります（フェーズ日付が最新より新しいこと、など）。同じフェーズなら上書き、違うフェーズなら追加です。履歴そのものは [Phase][r-phase] で読みます。

## 新規作成の必須項目

`P_Owner` / `P_Candidate`

出典で `●`（無条件で必須）の項目だけを `create` の入力型が要求します。`※`（条件付き必須）は型で止めず、
PORTERS の判定に委ねます（[書き込み][write]）。

## 項目と型

- 標準項目（`P_`）の一覧: [Resume の項目][ref]（PORTERS の事実）
- 型: [`Resume`][t-read]（読み取り）／ [`ResumeCreateInput`][t-create] ／ [`ResumeUpdateInput`][t-update] ／
  [`ResumeSearchQuery`][t-query] ／ [`ResumePage`][t-page] ／ [`ResumeResource`][t-resource]
- テナント固有の項目（`U_` / `A_`）は宣言してから使います（[カスタム項目][custom-fields]）

## 関連

- 主題: [検索][query]／[書き込み][write]／[上限とレート][limits]
- リソースの一覧: [リソースと操作][resources]
- ほかの目的から探す: [目次][index]

[ref]: ../reference/resource-api/resources/resume.md
[t-read]: ../api/type-aliases/Resume.md
[t-create]: ../api/type-aliases/ResumeCreateInput.md
[t-update]: ../api/type-aliases/ResumeUpdateInput.md
[t-query]: ../api/type-aliases/ResumeSearchQuery.md
[t-page]: ../api/type-aliases/ResumePage.md
[t-resource]: ../api/type-aliases/ResumeResource.md
[query]: ../topics/query.md
[write]: ../topics/write.md
[limits]: ../topics/limits.md
[custom-fields]: ../topics/custom-fields.md
[resources]: README.md
[index]: ../index.md
[r-process]: process.md
[r-phase]: phase.md
[deleted]: ../topics/deleted.md
