# 宣言と突合

テナント固有のカスタム項目（`U_` / `A_`）を型付きで使うための関数です。宣言を書く・テナントの項目定義から宣言を
生成する・宣言と実際の項目を突き合わせる・宣言していない項目を読む、の 4 つの場面で使います。使い方の流れは
[カスタム項目][custom-fields]にあります。

- **import 元**: `@joymerrevent/porters-connect`
- **PORTERS を呼ぶもの**: `generateFieldDecls`／`verifyFields`／`readCustomCatalog`（`field_r` スコープが要る）
- **使う場面**: 宣言と生成は開発時、突合は起動時や CI、`rawValue` は実行時

## 呼べる関数

<!-- 根拠: ADR-0023（defineFields）・ADR-0069（生成と突合）・ADR-0074（rawValue） -->

| 関数                                             | 何をするか                                                                                                                                       | 失敗の届き方                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `defineFields(decls)`                            | カスタム項目を宣言する。戻り値を `tenant(id, { fields })` に渡す                                                                                 | 同期 throw（alias が `U_` / `A_` でない・リソース名が既知でない） |
| `generateFieldDecls(scope, resources, options?)` | テナントの項目定義を読み、`defineFields` の呼び出しを TypeScript のソース文字列で返す。`active`（既定は使用中だけ）・`includeNames`・`constName` | reject                                                            |
| `verifyFields(scope, fields, options?)`          | 宣言とテナントの実際の項目を突き合わせ、食い違いのレポートを返す。例外は投げない                                                                 | reject（Field Read が読めない場合は `unverifiable` として返る）   |
| `assertFieldsMatch(report)`                      | `verifyFields` のレポートに食い違いか読めないリソースがあれば `PortersConfigError` を投げる。起動時に止めたいときに使う                          | 同期 throw                                                        |
| `readCustomCatalog(scope, resource, options?)`   | 1 リソースのカスタム項目を「alias → Data Type」で読む。宣言を作る前に中身だけ見たいときに使う                                                    | reject                                                            |
| `rawValue(record, alias)`                        | 宣言していない項目の値を、変換せずそのまま読む（無ければ `undefined`、入れ子なら `null`、あれば文字列）                                          | 失敗しない                                                        |

```ts
import {
  defineFields,
  verifyFields,
  assertFieldsMatch,
} from "@joymerrevent/porters-connect";

const fields = defineFields({
  candidate: (f) => ({ U_score: f.number() }),
});
const scope = porters.tenant(1, { fields });

// 起動時に、宣言がテナントの実際の項目と合っているかを確かめる
assertFieldsMatch(await verifyFields(scope, fields));
```

## 固有の注意

これらの関数に共通する注意です。宣言の書き方と、宣言しないとどうなるかは[カスタム項目][custom-fields]にあります。

- **`generateFieldDecls` は開発時に使うものです。** 返るのはソースコードの文字列で、ファイルに書き出してアプリが `import` します。実行時に呼んでも型には反映されません（[カスタム項目][custom-fields]の「宣言を自動生成する」）。
- **`verifyFields` は例外を投げません。** 止めるかどうかは利用側が決めます。起動時に止めたいときだけ `assertFieldsMatch` を続けて呼びます。`assertFieldsMatch` は「読めなかった」も止めます。確かめられなかったことは「問題なし」ではないからです。
- **`defineFields` と `assertFieldsMatch` は `Promise` を返さないので、失敗は同期 throw です。** `Promise` を返す 3 つは reject で届きます（[エラーと再試行][errors]）。
- **`rawValue` は変換しません。** 日時は PORTERS の書式（`2026/09/10 12:00:00`）のまま、数値は文字列のままです。型付きで扱いたい項目は宣言してください。

## 型

この章の関数の引数と戻り値に出てくる型と役割です。正確な定義は各リンク先（公開 API リファレンス）にあります。

| 型                                                                                                                                                                                                                                 | 役割                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [`FieldDecls`][t-FieldDecls] / [`FieldBuilder`][t-FieldBuilder] / [`FieldDef`][t-FieldDef]                                                                                                                                         | `defineFields` の引数・宣言に渡されるビルダー `f`・ビルダーの戻り値（1 項目の Data Type）                |
| [`CustomDataType`][t-CustomDataType]                                                                                                                                                                                               | 宣言できる Data Type の名前                                                                              |
| [`DefinedFields`][t-DefinedFields]                                                                                                                                                                                                 | `defineFields` の戻り値。`tenant(id, { fields })` に渡す                                                 |
| [`FieldCatalogSource`][t-FieldCatalogSource]                                                                                                                                                                                       | `generateFieldDecls` / `verifyFields` / `readCustomCatalog` の第 1 引数。`tenant(id)` のスコープを渡す   |
| [`CustomFieldResource`][t-CustomFieldResource]                                                                                                                                                                                     | 宣言できるリソース名                                                                                     |
| [`GenerateFieldDeclsOptions`][t-GenerateFieldDeclsOptions] / [`VerifyFieldsOptions`][t-VerifyFieldsOptions] / [`ReadCustomCatalogOptions`][t-ReadCustomCatalogOptions]                                                             | 各関数のオプション（`active` など）                                                                      |
| [`FieldVerification`][t-FieldVerification]                                                                                                                                                                                         | `verifyFields` のレポート（`missing` / `typeMismatch` / `undeclared` / `unverifiable` / `undeclarable`） |
| [`MissingField`][t-MissingField] / [`FieldTypeMismatch`][t-FieldTypeMismatch] / [`UndeclaredField`][t-UndeclaredField] / [`UnverifiableResource`][t-UnverifiableResource] / [`UndeclarableTenantField`][t-UndeclarableTenantField] | レポートの各区分の要素                                                                                   |
| [`TenantCustomCatalog`][t-TenantCustomCatalog] / [`UndeclarableField`][t-UndeclarableField] / [`UndeclarableReason`][t-UndeclarableReason]                                                                                         | `readCustomCatalog` の戻り値と、宣言できない項目とその理由                                               |

## 関連

- 主題: [カスタム項目][custom-fields]（宣言・生成・突合の流れ）／[エラーと再試行][errors]（`validation` で届く食い違い）
- クライアント: [tenant(id)][cl-tenant]（`fields` オプション）
- リソース別: [Field][r-field]（項目定義の Read）
- 関数: [上限と接続][fn-transport]／[値の変換][fn-convert]
- 実践例: [複数テナント][multi-tenant]（テナントごとに宣言を持つ）
- リファレンス: [公開 API リファレンス][api]
- ほかの目的から探す: [目次][index]

[index]: ../index.md
[api]: ../api/index.md
[custom-fields]: ../topics/custom-fields.md
[errors]: ../topics/errors.md
[cl-tenant]: ../client/tenant-scope.md
[r-field]: ../resources/field.md
[fn-transport]: transport.md
[fn-convert]: convert.md
[multi-tenant]: ../recipes/multi-tenant.md
[t-FieldDecls]: ../api/type-aliases/FieldDecls.md
[t-FieldBuilder]: ../api/type-aliases/FieldBuilder.md
[t-FieldDef]: ../api/type-aliases/FieldDef.md
[t-CustomDataType]: ../api/type-aliases/CustomDataType.md
[t-DefinedFields]: ../api/type-aliases/DefinedFields.md
[t-FieldCatalogSource]: ../api/type-aliases/FieldCatalogSource.md
[t-CustomFieldResource]: ../api/type-aliases/CustomFieldResource.md
[t-GenerateFieldDeclsOptions]: ../api/type-aliases/GenerateFieldDeclsOptions.md
[t-VerifyFieldsOptions]: ../api/type-aliases/VerifyFieldsOptions.md
[t-ReadCustomCatalogOptions]: ../api/type-aliases/ReadCustomCatalogOptions.md
[t-FieldVerification]: ../api/type-aliases/FieldVerification.md
[t-MissingField]: ../api/type-aliases/MissingField.md
[t-FieldTypeMismatch]: ../api/type-aliases/FieldTypeMismatch.md
[t-UndeclaredField]: ../api/type-aliases/UndeclaredField.md
[t-UnverifiableResource]: ../api/type-aliases/UnverifiableResource.md
[t-UndeclarableTenantField]: ../api/type-aliases/UndeclarableTenantField.md
[t-TenantCustomCatalog]: ../api/type-aliases/TenantCustomCatalog.md
[t-UndeclarableField]: ../api/type-aliases/UndeclarableField.md
[t-UndeclarableReason]: ../api/type-aliases/UndeclarableReason.md
