# Contact（コンタクト）

企業との接触の記録です。企業（`P_Client`）に紐づきます。

- **アクセサ**: `t.contact`
- **画面名**: 「コンタクト」
- **スコープ**: 読み `contact_r`（＋ 参照先の `client_r` / `user_r` / `option_r`）／ 書き `contact_w`
- **項目の接頭辞**: `Contact.`（書くときは付けない）

## 呼べるメソッド

このリソースで呼べるメソッドと、使い方の例です。

| 読み                           | 書き                                              |
| ------------------------------ | ------------------------------------------------- |
| `search` / `searchAll` / `get` | `create` / `update` / `createMany` / `updateMany` |

```ts
const page = await t.contact.search({ condition: { P_Client: { eq: 20001 } } });
const id = await t.contact.create({ P_Owner: 5, P_Client: 20001 });
```

`delete` はありません（[削除と削除済みデータ][deleted]）。200 件を超える書き込みは `createMany` / `updateMany` が
自動で分割します（[書き込み][write]）。

## 固有の注意

このリソースだけに効く注意です。共通の規則（検索・書き込み・上限）は主題別のページにあります。

- 参照型の項目（`P_Client`）は、既定では参照先の id だけが返ります。`expand` で参照先の項目も読めます（[検索][query]）。
- フェーズの項目（`P_Phase` / `P_PhaseDate` / `P_PhaseMemo`）には、最新フェーズに対する条件があります（日付が最新より新しいこと、など）。詳しくは [Phase][r-phase]。

## 新規作成の必須項目

`create` で必ず渡す項目と、渡さないとどこで止まるかです。

| 項目       | 必須の種類        | どこで止まるか               |
| ---------- | ----------------- | ---------------------------- |
| `P_Owner`  | ●（無条件で必須） | 渡さないとコンパイルで止まる |
| `P_Client` | ●（無条件で必須） | 渡さないとコンパイルで止まる |

●（無条件で必須）は `create` の入力型が要求し、渡さないとコンパイルで止まります。※（条件付き必須）は
他のレコードの状態に依存するため型では止めず、PORTERS の判定に委ねます（[書き込み][write]の「型で止めないもの」）。
`P_Id` も出典では必須ですが、ライブラリが新規作成の印を送るので渡しません。
このリソースに ※（条件付き必須）の項目はありません。

## 項目と型

標準項目の一覧と、このライブラリの型を引く先です。

- 標準項目（`P_`）の一覧: [Contact の項目][ref]（PORTERS の事実）
- 型: [`Contact`][t-read]（読み取り）／ [`ContactCreateInput`][t-create] ／ [`ContactUpdateInput`][t-update] ／
  [`ContactSearchQuery`][t-query] ／ [`ContactPage`][t-page] ／ [`ContactResource`][t-resource]
- テナント固有の項目（`U_` / `A_`）は宣言してから使います（[カスタム項目][custom-fields]）

## 関連

- 主題: [検索][query]／[書き込み][write]／[上限とレート][limits]
- リソースの一覧: [リソースと操作][resources]
- ほかの目的から探す: [目次][index]

[ref]: ../reference/resource-api/resources/contact.md
[t-read]: ../api/type-aliases/Contact.md
[t-create]: ../api/type-aliases/ContactCreateInput.md
[t-update]: ../api/type-aliases/ContactUpdateInput.md
[t-query]: ../api/type-aliases/ContactSearchQuery.md
[t-page]: ../api/type-aliases/ContactPage.md
[t-resource]: ../api/type-aliases/ContactResource.md
[query]: ../topics/query.md
[write]: ../topics/write.md
[limits]: ../topics/limits.md
[custom-fields]: ../topics/custom-fields.md
[resources]: README.md
[index]: ../index.md
[r-phase]: phase.md
[deleted]: ../topics/deleted.md
