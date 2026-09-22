# Contract（契約）

- **アクセサ**: `t.contract`
- **画面名**: Agent「契約」／ Staffing「契約」
- **スコープ**: 読み `contract_r`（＋ 参照先の `client_r` / `user_r` / `option_r`）／ 書き `contract_w`
- **項目の接頭辞**: `Contract.`（書くときは付けない）

企業との契約です。企業（`P_Client`）に紐づきます。

## 呼べるメソッド

| 読み                           | 書き                                              |
| ------------------------------ | ------------------------------------------------- |
| `search` / `searchAll` / `get` | `create` / `update` / `createMany` / `updateMany` |

```ts
const page = await t.contract.search({
  condition: { P_Client: { eq: 20001 } },
});
const id = await t.contract.create({ P_Client: 20001 }); // P_Owner は無い
```

`delete` はありません（[削除と削除済みデータ][deleted]）。200 件を超える書き込みは `createMany` / `updateMany` が
自動で分割します（[書き込み][write]）。

## 固有の注意

このリソースだけに効く注意です。共通の規則（検索・書き込み・上限）は主題別のページにあります。

- **所有者（`P_Owner`）の項目がありません**。データ系で唯一です。PORTERS が公表している項目一覧に無いので、ライブラリも足していません。
- 参照型の項目（`P_Client`）は、既定では参照先の id だけが返ります。`expand` で参照先の項目も読めます（[検索][query]）。

## 新規作成の必須項目

| 項目       | 必須の種類        | どこで止まるか               |
| ---------- | ----------------- | ---------------------------- |
| `P_Client` | ●（無条件で必須） | 渡さないとコンパイルで止まる |

●（無条件で必須）は `create` の入力型が要求し、渡さないとコンパイルで止まります。※（条件付き必須）は
他のレコードの状態に依存するため型では止めず、PORTERS の判定に委ねます（[書き込み][write]の「型で止めないもの」）。
`P_Id` も出典では必須ですが、ライブラリが新規作成の印を送るので渡しません。
このリソースに ※（条件付き必須）の項目はありません。
`P_Owner` の項目が無いので、必須は `P_Client` だけです。

## 項目と型

- 標準項目（`P_`）の一覧: [Contract の項目][ref]（PORTERS の事実）
- 型: [`Contract`][t-read]（読み取り）／ [`ContractCreateInput`][t-create] ／ [`ContractUpdateInput`][t-update] ／
  [`ContractSearchQuery`][t-query] ／ [`ContractPage`][t-page] ／ [`ContractResource`][t-resource]
- テナント固有の項目（`U_` / `A_`）は宣言してから使います（[カスタム項目][custom-fields]）

## 関連

- 主題: [検索][query]／[書き込み][write]／[上限とレート][limits]
- リソースの一覧: [リソースと操作][resources]
- ほかの目的から探す: [目次][index]

[ref]: ../reference/resource-api/resources/contract.md
[t-read]: ../api/type-aliases/Contract.md
[t-create]: ../api/type-aliases/ContractCreateInput.md
[t-update]: ../api/type-aliases/ContractUpdateInput.md
[t-query]: ../api/type-aliases/ContractSearchQuery.md
[t-page]: ../api/type-aliases/ContractPage.md
[t-resource]: ../api/type-aliases/ContractResource.md
[query]: ../topics/query.md
[write]: ../topics/write.md
[limits]: ../topics/limits.md
[custom-fields]: ../topics/custom-fields.md
[resources]: README.md
[index]: ../index.md
[deleted]: ../topics/deleted.md
