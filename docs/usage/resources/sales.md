# Sales（成約・売上）

- **アクセサ**: `t.sales`
- **画面名**: Agent「成約（売上）」／ Staffing「個別契約」
- **スコープ**: 読み `sales_r`（＋ 参照先の `candidate_r` / `resume_r` / `client_r` / `recruiter_r` / `job_r` / `user_r` / `option_r`）／ 書き `sales_w`
- **項目の接頭辞**: `Sales.`（書くときは付けない）

成約（売上）の記録です。企業・企業担当者・JOB・契約・個人連絡先・レジュメを参照でき、その組み合わせに規則があります。

## 呼べるメソッド

| 読み                           | 書き                                              |
| ------------------------------ | ------------------------------------------------- |
| `search` / `searchAll` / `get` | `create` / `update` / `createMany` / `updateMany` |

```ts
const id = await t.sales.create({
  P_Owner: 5,
  P_Client: 20001,
  P_Recruiter: 30001,
  P_Job: 40001, // 下位（P_Job）を書くなら上位（P_Recruiter / P_Client）も一緒に
});
```

`delete` はありません（[削除と削除済みデータ][deleted]）。200 件を超える書き込みは `createMany` / `updateMany` が
自動で分割します（[書き込み][write]）。

## 固有の注意

- **参照 6 項目は条件付き必須**（出典の `※`）で、型では止めません。規則は依存の連鎖です。
  - `P_Job` を指定するなら `P_Recruiter` と `P_Client` も一緒に。`P_Contract` は `P_Client` と一緒に（下位を書くなら上位も）。
  - クリアするときは逆向きで、上位をクリアするなら下位も一緒に。
  - `P_Candidate` と `P_Resume` は新規登録で両方を指定し、整合性が検査されます。更新で片方だけ書くと、更新前のもう一方と突き合わされます。
  - 外れると PORTERS が Result Code で返します（`create` は `P_Owner` だけを必須にしてあり、`P_Client` だけの正当な呼び出しを弾かないため）。
- 参照型の項目は `P_Client` / `P_Recruiter` / `P_Job` / `P_Contract` / `P_Candidate` / `P_Resume` です。既定では参照先の id だけが返り、`expand` を書くと参照先の項目も一緒に読めます（[検索][query]）。
- フェーズの項目（`P_Phase` / `P_PhaseDate` / `P_PhaseMemo`）は**最新フェーズに対する条件**があります（フェーズ日付が最新より新しいこと、など）。同じフェーズなら上書き、違うフェーズなら追加です。履歴そのものは [Phase][r-phase] で読みます。

## 新規作成の必須項目

| 項目                                                                             | 必須の種類        | どこで止まるか                                                                      |
| -------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------- |
| `P_Owner`                                                                        | ●（無条件で必須） | 渡さないとコンパイルで止まる                                                        |
| `P_Client` / `P_Recruiter` / `P_Job` / `P_Contract` / `P_Candidate` / `P_Resume` | ※（条件付き必須） | 型は止めない。PORTERS が判定し、外れると Result Code で返る（条件は「固有の注意」） |

●（無条件で必須）は `create` の入力型が要求し、渡さないとコンパイルで止まります。※（条件付き必須）は
他のレコードの状態に依存するため型では止めず、PORTERS の判定に委ねます（[書き込み][write]の「型で止めないもの」）。
`P_Id` も出典では必須ですが、ライブラリが新規作成の印を送るので渡しません。

## 項目と型

- 標準項目（`P_`）の一覧: [Sales の項目][ref]（PORTERS の事実）
- 型: [`Sales`][t-read]（読み取り）／ [`SalesCreateInput`][t-create] ／ [`SalesUpdateInput`][t-update] ／
  [`SalesSearchQuery`][t-query] ／ [`SalesPage`][t-page] ／ [`SalesResource`][t-resource]
- テナント固有の項目（`U_` / `A_`）は宣言してから使います（[カスタム項目][custom-fields]）

## 関連

- 主題: [検索][query]／[書き込み][write]／[上限とレート][limits]
- リソースの一覧: [リソースと操作][resources]
- ほかの目的から探す: [目次][index]

[ref]: ../reference/resource-api/resources/sales.md
[t-read]: ../api/type-aliases/Sales.md
[t-create]: ../api/type-aliases/SalesCreateInput.md
[t-update]: ../api/type-aliases/SalesUpdateInput.md
[t-query]: ../api/type-aliases/SalesSearchQuery.md
[t-page]: ../api/type-aliases/SalesPage.md
[t-resource]: ../api/type-aliases/SalesResource.md
[query]: ../topics/query.md
[write]: ../topics/write.md
[limits]: ../topics/limits.md
[custom-fields]: ../topics/custom-fields.md
[resources]: README.md
[index]: ../index.md
[r-phase]: phase.md
[deleted]: ../topics/deleted.md
