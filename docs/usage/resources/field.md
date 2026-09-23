# Field（項目定義）

各リソースの項目の定義です。テナントごとに違うカスタム項目（`U_` / `A_`）は、ここを読んで見つけます。

- **アクセサ**: `t.field.of("candidate")` のように、**どのリソースの項目かを先に指定する**
- **スコープ**: `field_r`
- **読み取り専用**（PORTERS に Write API が無い）

## 呼べるメソッド

このリソースで呼べるメソッドと、使い方の例です。

| 読み                   | 書き              |
| ---------------------- | ----------------- |
| `search` / `searchAll` | —（読み取り専用） |

```ts
const fields = t.field.of("candidate");
for await (const f of fields.searchAll({ active: 1 })) {
  console.log(f.P_Alias, f.P_Name, f.P_Type, f.P_Required);
}
```

マスタ 5 種は、検索で指定できる引数がデータ系と違います。`condition` と `get(id)` はありません（[検索][query]の「マスタは指定できるものが違う」）。

## 固有の注意

このリソースだけに当てはまる注意です。共通の規則（検索・書き込み・上限）は主題別のページにあります。

- **先に `of()` でリソースを指定します。** PORTERS は Field Read のすべてに `resource=` を要求し、ライブラリはそれを 1 回だけ受け取ります。名前はアクセサと同じ綴りで、打ち間違いはコンパイルエラーです。
- **`active` で使用中か未使用かを選べます**（`1` 使用中／`0` 未使用／`-1` すべて・既定）。
- **`P_Required` は、テナントが入力必須にした項目です。** これはカスタム項目の宣言（`defineFields`）には載らないので、必須の欠落は型では止まりません。
- **時分型はここからは見分けが付きません。** 年月日時分型と同じ Field Type で返るためです（[日時と時分型][datetime]）。
- **カスタム項目の宣言を作る・確かめる関数は、このリソースを読んで動きます。** `generateFieldDecls` / `verifyFields` / `readCustomCatalog` です（[カスタム項目][custom-fields]）。

## 新規作成の必須項目

このリソースは読み取り専用なので、`create` はありません。

## 項目と型

標準項目の一覧と、このライブラリの型を引く先です。

- 項目の一覧: [Field の項目][ref]（PORTERS の事実）
- カスタム項目（`U_` / `A_`）: ありません

| 型                                       | 役割                            |
| ---------------------------------------- | ------------------------------- |
| [`Field`][t-Field]                       | 読み取った 1 件                 |
| [`FieldSearchQuery`][t-FieldSearchQuery] | `search` / `searchAll` のクエリ |
| [`FieldPage`][t-FieldPage]               | `search` の戻り値（1 ページ）   |
| [`FieldAccessor`][t-FieldAccessor]       | `t.field` の型（`of()` を持つ） |
| [`FieldResource`][t-FieldResource]       | `t.field.of(...)` の型          |

## 関連

- 主題: [カスタム項目][custom-fields]（宣言の生成と突き合わせ）／[日時と時分型][datetime]（時分型の見分け）
- リソースの一覧: [リソースと操作][resources]
- ほかの目的から探す: [目次][index]

[ref]: ../reference/resource-api/resources/field.md
[resources]: README.md
[index]: ../index.md
[custom-fields]: ../topics/custom-fields.md
[datetime]: ../topics/datetime.md
[query]: ../topics/query.md
[t-Field]: ../api/type-aliases/Field.md
[t-FieldPage]: ../api/type-aliases/FieldPage.md
[t-FieldSearchQuery]: ../api/type-aliases/FieldSearchQuery.md
[t-FieldAccessor]: ../api/type-aliases/FieldAccessor.md
[t-FieldResource]: ../api/type-aliases/FieldResource.md
