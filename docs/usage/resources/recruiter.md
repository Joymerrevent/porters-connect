# Recruiter（企業担当者）

- **アクセサ**: `t.recruiter`
- **画面名**: Agent「企業担当者」／ Staffing「企業担当者」
- **スコープ**: 読み `recruiter_r`（＋ 参照先の `client_r` / `user_r` / `option_r`）／ 書き `recruiter_w`
- **項目の接頭辞**: `Recruiter.`（書くときは付けない）

企業側の担当者です。企業（`P_Client`）に必ず紐づき、JOB と商談が担当者を参照します。

## 呼べるメソッド

| 読み                           | 書き                                              |
| ------------------------------ | ------------------------------------------------- |
| `search` / `searchAll` / `get` | `create` / `update` / `createMany` / `updateMany` |

```ts
const page = await t.recruiter.search({
  condition: { P_Client: { eq: 20001 } },
}); // 1 社の担当者
const id = await t.recruiter.create({ P_Owner: 5, P_Client: 20001 });
```

`delete` はありません（[削除と削除済みデータ][deleted]）。200 件を超える書き込みは `createMany` / `updateMany` が
自動で分割します（[書き込み][write]）。

## 固有の注意

- 参照型の項目は `P_Client` です。既定では参照先の id だけが返り、`expand` を書くと参照先の項目も一緒に読めます（[検索][query]）。
- フェーズの項目（`P_Phase` / `P_PhaseDate` / `P_PhaseMemo`）は**最新フェーズに対する条件**があります（フェーズ日付が最新より新しいこと、など）。同じフェーズなら上書き、違うフェーズなら追加です。履歴そのものは [Phase][r-phase] で読みます。

## 新規作成の必須項目

| 項目       | 必須の種類        | どこで止まるか               |
| ---------- | ----------------- | ---------------------------- |
| `P_Owner`  | ●（無条件で必須） | 渡さないとコンパイルで止まる |
| `P_Client` | ●（無条件で必須） | 渡さないとコンパイルで止まる |

●（無条件で必須）は `create` の入力型が要求し、渡さないとコンパイルで止まります。※（条件付き必須）は
他のレコードの状態に依存するため型では止めず、PORTERS の判定に委ねます（[書き込み][write]の「型で止めないもの」）。
`P_Id` も出典では必須ですが、ライブラリが新規作成の印を送るので渡しません。
このリソースに ※（条件付き必須）の項目はありません。

## 項目と型

- 標準項目（`P_`）の一覧: [Recruiter の項目][ref]（PORTERS の事実）
- 型: [`Recruiter`][t-read]（読み取り）／ [`RecruiterCreateInput`][t-create] ／ [`RecruiterUpdateInput`][t-update] ／
  [`RecruiterSearchQuery`][t-query] ／ [`RecruiterPage`][t-page] ／ [`RecruiterResource`][t-resource]
- テナント固有の項目（`U_` / `A_`）は宣言してから使います（[カスタム項目][custom-fields]）

## 関連

- 主題: [検索][query]／[書き込み][write]／[上限とレート][limits]
- リソースの一覧: [リソースと操作][resources]
- ほかの目的から探す: [目次][index]

[ref]: ../reference/resource-api/resources/recruiter.md
[t-read]: ../api/type-aliases/Recruiter.md
[t-create]: ../api/type-aliases/RecruiterCreateInput.md
[t-update]: ../api/type-aliases/RecruiterUpdateInput.md
[t-query]: ../api/type-aliases/RecruiterSearchQuery.md
[t-page]: ../api/type-aliases/RecruiterPage.md
[t-resource]: ../api/type-aliases/RecruiterResource.md
[query]: ../topics/query.md
[write]: ../topics/write.md
[limits]: ../topics/limits.md
[custom-fields]: ../topics/custom-fields.md
[resources]: README.md
[index]: ../index.md
[r-phase]: phase.md
[deleted]: ../topics/deleted.md
