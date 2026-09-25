# Sales（成約・売上）

成約（売上）の記録です。企業・企業担当者・JOB・契約・個人連絡先・レジュメを参照でき、その組み合わせに規則があります。

- **アクセサ**: `t.sales`
- **画面名**: Agent「成約（売上）」／ Staffing「個別契約」
- **スコープ**: 読み `sales_r`（＋ 参照先の `candidate_r` / `resume_r` / `client_r` / `recruiter_r` / `job_r` / `user_r` / `option_r`）／ 書き `sales_w`
- **項目の接頭辞**: `Sales.`（書くときは付けない）

## 呼べるメソッド

このリソースで呼べるメソッドと、使い方の例です。

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

このリソースだけに当てはまる注意です。共通の規則（検索・書き込み・上限）はガイドのページにあります。

- **参照先を指す 6 項目（`P_Client` / `P_Recruiter` / `P_Job` / `P_Contract` / `P_Candidate` / `P_Resume`）は条件付き必須**（PORTERS の項目一覧で ※ が付く項目）で、型では止めません。規則は、項目どうしの依存関係です。
  - `P_Job` を指定するなら `P_Recruiter` と `P_Client` も一緒に。`P_Contract` は `P_Client` と一緒に（参照先の親子関係で、子を書くなら親も。企業 > 企業担当者 > JOB、企業 > 契約）。
  - クリアするときは逆向きで、親をクリアするなら子も一緒に。
  - `P_Candidate` と `P_Resume` は新規登録で両方を指定し、整合性が検査されます。更新で片方だけ書くと、更新前のもう一方と突き合わされます。
  - 規則から外れると PORTERS がエラーの Result Code を返します（`PortersResourceError`）。この規則はライブラリの型では検査しません。`P_Client` だけを渡す正当な呼び出しもあるため、型が必須にするのは `P_Owner` だけです。
- **参照型の項目（`P_Client` / `P_Recruiter` / `P_Job` / `P_Contract` / `P_Candidate` / `P_Resume`）は、既定では参照先の id だけが返ります。**`expand` で参照先の項目も読めます（[検索][query]）。
- **フェーズの項目には、最新フェーズに対する条件があります**（`P_Phase` / `P_PhaseDate` / `P_PhaseMemo`。日付が最新より新しいこと、など）。詳しくは [Phase][r-phase]。

## 新規作成の必須項目

`create` の必須項目（無条件か、条件付きか）と、渡さないとどこで止まるかです。表にあるのは呼び出し側が渡す項目だけです。

| 項目          | 必須の種類        | どこで止まるか                                                                                  |
| ------------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| `P_Owner`     | ●（無条件で必須） | 渡さないとコンパイルで止まる                                                                    |
| `P_Client`    | ※（条件付き必須） | 型では止まらない。PORTERS が判定し、外れるとエラーの Result Code が返る（条件は「固有の注意」） |
| `P_Recruiter` | ※（条件付き必須） | 型では止まらない。PORTERS が判定し、外れるとエラーの Result Code が返る（条件は「固有の注意」） |
| `P_Job`       | ※（条件付き必須） | 型では止まらない。PORTERS が判定し、外れるとエラーの Result Code が返る（条件は「固有の注意」） |
| `P_Contract`  | ※（条件付き必須） | 型では止まらない。PORTERS が判定し、外れるとエラーの Result Code が返る（条件は「固有の注意」） |
| `P_Candidate` | ※（条件付き必須） | 型では止まらない。PORTERS が判定し、外れるとエラーの Result Code が返る（条件は「固有の注意」） |
| `P_Resume`    | ※（条件付き必須） | 型では止まらない。PORTERS が判定し、外れるとエラーの Result Code が返る（条件は「固有の注意」） |

●（無条件で必須）は `create` の入力型が要求し、渡さないとコンパイルで止まります。※（条件付き必須）は
他のレコードの状態に依存するため型では止めず、PORTERS の判定に委ねます（[書き込み][write]の「型で止めないもの」）。
`P_Id` も PORTERS のリファレンスでは必須ですが、新規作成を表す値をライブラリが送るので渡しません。

## 項目と型

標準項目の一覧と、このライブラリの型を引く先です。

- 項目の一覧: [Sales の項目][ref]（PORTERS の事実）
- カスタム項目（`U_` / `A_`）: 宣言してから使います（[カスタム項目][custom-fields]）

| 型                                       | 役割                            |
| ---------------------------------------- | ------------------------------- |
| [`Sales`][t-Sales]                       | 読み取った 1 件                 |
| [`SalesCreateInput`][t-SalesCreateInput] | `create` / `createMany` の入力  |
| [`SalesUpdateInput`][t-SalesUpdateInput] | `update` / `updateMany` の入力  |
| [`SalesSearchQuery`][t-SalesSearchQuery] | `search` / `searchAll` のクエリ |
| [`SalesPage`][t-SalesPage]               | `search` の戻り値（1 ページ）   |
| [`SalesResource`][t-SalesResource]       | `t.sales` の型                  |

## 関連

- ガイド: [検索][query]（条件の書き方）／[書き込み][write]（必須と一括）／[上限とレート][limits]（200 件・リクエスト長）
- リソースの一覧: [リソースと操作][resources]
- ほかの目的から探す: [目次][index]

[ref]: ../reference/resource-api/resources/sales.md
[query]: ../topics/query.md
[write]: ../topics/write.md
[limits]: ../topics/limits.md
[custom-fields]: ../topics/custom-fields.md
[resources]: README.md
[index]: ../index.md
[r-phase]: phase.md
[deleted]: ../topics/deleted.md
[t-Sales]: ../api/type-aliases/Sales.md
[t-SalesCreateInput]: ../api/type-aliases/SalesCreateInput.md
[t-SalesUpdateInput]: ../api/type-aliases/SalesUpdateInput.md
[t-SalesSearchQuery]: ../api/type-aliases/SalesSearchQuery.md
[t-SalesPage]: ../api/type-aliases/SalesPage.md
[t-SalesResource]: ../api/type-aliases/SalesResource.md
