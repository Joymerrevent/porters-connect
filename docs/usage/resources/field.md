# Field（項目定義）

各リソースの項目の定義です。テナントごとに違うカスタム項目（`U_` / `A_`）は、ここを読んで見つけます。

- **アクセサ**: `t.field.of("candidate")` のように、**どのリソースの項目かを先に束ねる**
- **スコープ**: `field_r`
- **読み取り専用**（PORTERS に Write API が無い）

## 呼べるメソッド

このリソースで呼べるメソッドと、使い方の例です。

| 読み                   |
| ---------------------- |
| `search` / `searchAll` |

```ts
const fields = t.field.of("candidate");
for await (const f of fields.searchAll({ active: 1 })) {
  console.log(f.P_Alias, f.P_Name, f.P_Type, f.P_Required);
}
```

マスタ 5 種は語彙が違います。`condition` と `get(id)` はありません（[検索][query]の「マスタは語彙が違う」）。

## 固有の注意

このリソースだけに効く注意です。共通の規則（検索・書き込み・上限）は主題別のページにあります。

- PORTERS は Field Read のすべてに `resource=` を要求します。ライブラリはそれを `of()` で 1 回だけ受け取ります。名前はアクセサと同じ綴りで、打ち間違いはコンパイルエラーです。
- `active` で使用中（`1`）／未使用（`0`）／すべて（`-1`・既定）を選べます。
- `P_Required` が **テナントが入力必須にしたカスタム項目**を表します。これは `defineFields` の宣言には載らないので、必須の欠落は型では止まりません。
- 時分型（2026/08 追加）は年月日時分型と同じ Field Type で返るため、**ここからは見分けが付きません**（[日時と時分型][datetime]）。
- `generateFieldDecls` / `verifyFields` / `readCustomCatalog` はこのリソースの上に組んであります（[カスタム項目][custom-fields]）。

## 項目と型

標準項目の一覧と、このライブラリの型を引く先です。

- 項目の一覧: [Field の項目][ref]（PORTERS の事実）
- 型: [`Field`][t-Field] ／ [`FieldPage`][t-FieldPage] ／ [`FieldSearchQuery`][t-FieldSearchQuery] ／ [`FieldResource`][t-FieldResource] ／ [`FieldAccessor`][t-FieldAccessor]

## 関連

- 主題: [カスタム項目][custom-fields]／[日時と時分型][datetime]
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
[t-FieldResource]: ../api/type-aliases/FieldResource.md
[t-FieldAccessor]: ../api/type-aliases/FieldAccessor.md
