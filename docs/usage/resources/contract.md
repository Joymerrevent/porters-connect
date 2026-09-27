# Contract（契約）

企業との契約です。企業（`P_Client`）に紐づきます。

- **アクセサ**: `t.contract`
- **画面名**: Agent「契約」／ Staffing「契約」
- **スコープ**: 読み `contract_r`（＋ 参照先の `client_r` / `user_r` / `option_r`）／ 書き `contract_w`
- **項目の接頭辞**: `Contract.`（書くときは付けない）

## 呼べるメソッド

このリソースで呼べるメソッドと、使い方の例です。

| 読み                                       | 書き                                              |
| ------------------------------------------ | ------------------------------------------------- |
| `search` / `searchAll` / `get` / `getMany` | `create` / `update` / `createMany` / `updateMany` |

```ts
const page = await t.contract.search({
  condition: { P_Client: { eq: 20001 } },
});
const id = await t.contract.create({ P_Client: 20001 }); // P_Owner は無い
```

`delete` はありません（[削除と削除済みデータ][deleted]）。200 件を超える書き込みは `createMany` / `updateMany` が
自動で分割します（[書き込み][write]）。

## 固有の注意

このリソースだけに当てはまる注意です。共通の規則（検索・書き込み・上限）はガイドのページにあります。

- **所有者（`P_Owner`）の項目がありません**。PORTERS が公表している項目一覧に無いので、ライブラリも足していません。
- **参照型の項目（`P_Client`）は、既定では参照先の id だけが返ります。**`expand` で参照先の項目も読めます（[検索][query]）。

## 新規作成の必須項目

`create` の必須項目（無条件か、条件付きか）と、渡さないとどこで止まるかです。表にあるのは呼び出し側が渡す項目だけです。

| 項目       | 必須の種類        | どこで止まるか               |
| ---------- | ----------------- | ---------------------------- |
| `P_Client` | ●（無条件で必須） | 渡さないとコンパイルで止まる |

●（無条件で必須）は `create` の入力型が要求し、渡さないとコンパイルで止まります。※（条件付き必須）は
他のレコードの状態に依存するため型では止めず、PORTERS の判定に委ねます（[書き込み][write]の「型で止めないもの」）。
`P_Id` も PORTERS のリファレンスでは必須ですが、新規作成を表す値をライブラリが送るので渡しません。

このリソースに ※（条件付き必須）の項目はありません。

このリソースには所有者（`P_Owner`）の項目が無いので、必須は `P_Client` だけです。

## 項目と型

標準項目の一覧と、このライブラリの型を引く先です。

- 項目の一覧: [Contract の項目][ref]（PORTERS の事実）
- カスタム項目（`U_` / `A_`）: 宣言してから使います（[カスタム項目][custom-fields]）

| 型                                             | 役割                            |
| ---------------------------------------------- | ------------------------------- |
| [`Contract`][t-Contract]                       | 読み取った 1 件                 |
| [`ContractCreateInput`][t-ContractCreateInput] | `create` / `createMany` の入力  |
| [`ContractUpdateInput`][t-ContractUpdateInput] | `update` / `updateMany` の入力  |
| [`ContractSearchQuery`][t-ContractSearchQuery] | `search` / `searchAll` のクエリ |
| [`ContractPage`][t-ContractPage]               | `search` の戻り値（1 ページ）   |
| [`ContractResource`][t-ContractResource]       | `t.contract` の型               |

## 関連

- ガイド: [検索][query]（条件の書き方）／[書き込み][write]（必須と一括）／[上限とレート][limits]（200 件・リクエスト長）
- リソースの一覧: [リソースと操作][resources]
- ほかの目的から探す: [目次][index]

[ref]: ../reference/resource-api/resources/contract.md
[query]: ../topics/query.md
[write]: ../topics/write.md
[limits]: ../topics/limits.md
[custom-fields]: ../topics/custom-fields.md
[resources]: README.md
[index]: ../index.md
[deleted]: ../topics/deleted.md
[t-Contract]: ../api/type-aliases/Contract.md
[t-ContractCreateInput]: ../api/type-aliases/ContractCreateInput.md
[t-ContractUpdateInput]: ../api/type-aliases/ContractUpdateInput.md
[t-ContractSearchQuery]: ../api/type-aliases/ContractSearchQuery.md
[t-ContractPage]: ../api/type-aliases/ContractPage.md
[t-ContractResource]: ../api/type-aliases/ContractResource.md
