# Activity（アクティビティ）

- **アクセサ**: `t.activity`
- **画面名**: Agent「アクティビティ」／ Staffing「アクティビティ」
- **スコープ**: 読み `activity_r`（＋ 参照先の `client_r` / `recruiter_r` / `job_r` / `candidate_r` / `resume_r` / `process_r` / `sales_r` / `user_r` / `option_r`）／ 書き `activity_w`
- **項目の接頭辞**: `Activity.`（書くときは付けない）

レコードに付く活動の記録です。**どのリソースの、どのレコードに付くか**を `P_Resource`（リソースの番号）と
`P_ResourceId`（そのレコードの id）で持ちます。

## 呼べるメソッド

| 読み                           | 書き                                              |
| ------------------------------ | ------------------------------------------------- |
| `search` / `searchAll` / `get` | `create` / `update` / `createMany` / `updateMany` |

```ts
import { resourceValueOf } from "@joymerrevent/porters-connect";

const page = await t.activity.search({
  condition: { P_Resource: { eq: resourceValueOf("candidate") } }, // 個人連絡先に付いたものだけ
});
const id = await t.activity.create({ P_Owner: 5, P_Title: "電話で状況確認" });
```

`delete` はありません（[削除と削除済みデータ][deleted]）。200 件を超える書き込みは `createMany` / `updateMany` が
自動で分割します（[書き込み][write]）。

## 固有の注意

- `P_Resource` は**数値**です（Candidate `1` / Job `3` / Client `5` …）。書くときも絞るときも `resourceValueOf("candidate")` で名前から引き、読んだ値は `resourceNameOf` で名前に戻せます（[検索][query]の「リソース種別で絞る」）。
- 参照型の項目は `P_ResourceId` です。既定では参照先の id だけが返り、`expand` を書くと参照先の項目も一緒に読めます（[検索][query]）。
- フェーズの項目（`P_Phase` / `P_PhaseDate` / `P_PhaseMemo`）は**最新フェーズに対する条件**があります（フェーズ日付が最新より新しいこと、など）。同じフェーズなら上書き、違うフェーズなら追加です。履歴そのものは [Phase][r-phase] で読みます。

## 新規作成の必須項目

`P_Owner` / `P_Title`

出典で `●`（無条件で必須）の項目だけを `create` の入力型が要求します。`※`（条件付き必須）は型で止めず、
PORTERS の判定に委ねます（[書き込み][write]）。

## 項目と型

- 標準項目（`P_`）の一覧: [Activity の項目][ref]（PORTERS の事実）
- 型: [`Activity`][t-read]（読み取り）／ [`ActivityCreateInput`][t-create] ／ [`ActivityUpdateInput`][t-update] ／
  [`ActivitySearchQuery`][t-query] ／ [`ActivityPage`][t-page] ／ [`ActivityResource`][t-resource]
- テナント固有の項目（`U_` / `A_`）は宣言してから使います（[カスタム項目][custom-fields]）

## 関連

- 主題: [検索][query]／[書き込み][write]／[上限とレート][limits]
- リソースの一覧: [リソースと操作][resources]
- ほかの目的から探す: [目次][index]

[ref]: ../reference/resource-api/resources/activity.md
[t-read]: ../api/type-aliases/Activity.md
[t-create]: ../api/type-aliases/ActivityCreateInput.md
[t-update]: ../api/type-aliases/ActivityUpdateInput.md
[t-query]: ../api/type-aliases/ActivitySearchQuery.md
[t-page]: ../api/type-aliases/ActivityPage.md
[t-resource]: ../api/type-aliases/ActivityResource.md
[query]: ../topics/query.md
[write]: ../topics/write.md
[limits]: ../topics/limits.md
[custom-fields]: ../topics/custom-fields.md
[resources]: README.md
[index]: ../index.md
[r-phase]: phase.md
[deleted]: ../topics/deleted.md
