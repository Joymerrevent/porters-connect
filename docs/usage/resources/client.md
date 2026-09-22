# Client（企業）

取引先の企業です。企業担当者・JOB・契約・コンタクト・商談は、それぞれの `P_Client` でここに紐づきます。

- **アクセサ**: `t.client`
- **画面名**: Agent「企業」／ Staffing「企業」
- **スコープ**: 読み `client_r`（＋ 参照先の `user_r` / `option_r`）／ 書き `client_w`
- **項目の接頭辞**: `Client.`（書くときは付けない）

## 呼べるメソッド

このリソースで呼べるメソッドと、使い方の例です。

| 読み                           | 書き                                              |
| ------------------------------ | ------------------------------------------------- |
| `search` / `searchAll` / `get` | `create` / `update` / `createMany` / `updateMany` |

```ts
const page = await t.client.search({ condition: { P_Name: { part: "商事" } } });
const id = await t.client.create({ P_Owner: 5, P_Name: "株式会社サンプル" });
```

`delete` はありません（[削除と削除済みデータ][deleted]）。200 件を超える書き込みは `createMany` / `updateMany` が
自動で分割します（[書き込み][write]）。

## 固有の注意

このリソースだけに効く注意です。共通の規則（検索・書き込み・上限）は主題別のページにあります。

- フェーズの項目（`P_Phase` / `P_PhaseDate` / `P_PhaseMemo`）には、最新フェーズに対する条件があります（日付が最新より新しいこと、など）。詳しくは [Phase][r-phase]。

## 新規作成の必須項目

`create` で必ず渡す項目と、渡さないとどこで止まるかです。

| 項目      | 必須の種類        | どこで止まるか               |
| --------- | ----------------- | ---------------------------- |
| `P_Owner` | ●（無条件で必須） | 渡さないとコンパイルで止まる |

●（無条件で必須）は `create` の入力型が要求し、渡さないとコンパイルで止まります。※（条件付き必須）は
他のレコードの状態に依存するため型では止めず、PORTERS の判定に委ねます（[書き込み][write]の「型で止めないもの」）。
`P_Id` も出典では必須ですが、ライブラリが新規作成の印を送るので渡しません。

このリソースに ※（条件付き必須）の項目はありません。

## 項目と型

標準項目の一覧と、このライブラリの型を引く先です。

- 標準項目（`P_`）の一覧: [Client の項目][ref]（PORTERS の事実）
- 型: [`Client`][t-read]（読み取り）／ [`ClientCreateInput`][t-create] ／ [`ClientUpdateInput`][t-update] ／
  [`ClientSearchQuery`][t-query] ／ [`ClientPage`][t-page] ／ [`ClientResource`][t-resource]
- テナント固有の項目（`U_` / `A_`）は宣言してから使います（[カスタム項目][custom-fields]）

## 関連

- 主題: [検索][query]／[書き込み][write]／[上限とレート][limits]
- リソースの一覧: [リソースと操作][resources]
- ほかの目的から探す: [目次][index]

[ref]: ../reference/resource-api/resources/client.md
[t-read]: ../api/type-aliases/Client.md
[t-create]: ../api/type-aliases/ClientCreateInput.md
[t-update]: ../api/type-aliases/ClientUpdateInput.md
[t-query]: ../api/type-aliases/ClientSearchQuery.md
[t-page]: ../api/type-aliases/ClientPage.md
[t-resource]: ../api/type-aliases/ClientResource.md
[query]: ../topics/query.md
[write]: ../topics/write.md
[limits]: ../topics/limits.md
[custom-fields]: ../topics/custom-fields.md
[resources]: README.md
[index]: ../index.md
[r-phase]: phase.md
[deleted]: ../topics/deleted.md
