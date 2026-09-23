# 単独の関数

クライアントやスコープに属さず、`import` して呼ぶ関数です。用途は 3 つに分かれます。カスタム項目の宣言と
突合、上限と接続の差し替え、値の変換です。それぞれの引数と戻り値の正確な定義は[公開 API リファレンス][api]にあります。

- **import 元**: `@joymerrevent/porters-connect`（すべて同じ）
- **PORTERS を呼ぶもの**: `generateFieldDecls`／`verifyFields`／`readCustomCatalog` の 3 つだけ（`field_r` スコープが要る）
- **それ以外**: 純粋な関数で、通信しない

## 宣言と突合

<!-- 根拠: ADR-0023（defineFields）・ADR-0069（生成と突合）・ADR-0074（rawValue） -->

テナント固有のカスタム項目（`U_` / `A_`）を型付きで使うための関数です。使い方の流れは[カスタム項目][custom-fields]にあります。

| 関数                                             | 何をするか                                                                                                                                       | 失敗の届き方                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `defineFields(decls)`                            | カスタム項目を宣言する。戻り値を `tenant(id, { fields })` に渡す                                                                                 | 同期 throw（alias が `U_` / `A_` でない・リソース名が既知でない） |
| `generateFieldDecls(scope, resources, options?)` | テナントの項目定義を読み、`defineFields` の呼び出しを TypeScript のソース文字列で返す。`active`（既定は使用中だけ）・`includeNames`・`constName` | reject                                                            |
| `verifyFields(scope, fields, options?)`          | 宣言とテナントの実際の項目を突き合わせ、食い違いのレポートを返す。例外は投げない                                                                 | reject（Field Read が読めない場合は `unverifiable` として返る）   |
| `assertFieldsMatch(report)`                      | `verifyFields` のレポートに食い違いか読めないリソースがあれば `PortersConfigError` を投げる。起動時に止めたいときに使う                          | 同期 throw                                                        |
| `readCustomCatalog(scope, resource, options?)`   | 1 リソースのカスタム項目を「alias → Data Type」で読む。宣言を作る前に中身だけ見たいときに使う                                                    | reject                                                            |
| `rawValue(record, alias)`                        | 宣言していない項目の値を、変換せずそのまま読む（無ければ `undefined`、入れ子なら `null`、あれば文字列）                                          | 失敗しない                                                        |

## 上限と接続

<!-- 根拠: ADR-0010（スロットリング）・ADR-0024（Transport）・ADR-0073（バケットの共有単位） -->

`new PortersClient({ throttle, transport })` に渡すものを作る関数です。

| 関数                                     | 何をするか                                                                                                                                        | 失敗の届き方                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `createThrottle(options?)`               | 1 分あたりの上限を守るスロットルを作る。`readPerMin`／`writePerMin`／`safety`。共有の枠から切り離すときに渡す（[上限とレート][limits]）           | 同期 throw（範囲外の値）                            |
| `createFetchTransport(options?)`         | 既定の HTTP 送信を作る。`timeoutMs` でタイムアウトを延ばす・縮める、`fetchImpl` で `fetch` を差し替える                                           | 同期 throw（`timeoutMs` が正の整数でない）          |
| `createMockTransport(handler, options?)` | PORTERS の代わりに応答を返す送信を作る。契約なしでテストするときに渡す（[契約なしでテストする][testing]）。`auth: false` で認証の自動応答を止める | 失敗しない（応答が無いリクエストは実行時に reject） |

## 値の変換

<!-- 根拠: ADR-0079（リソース番号）・ADR-0086（時分型）・ADR-0064（Image の Base64） -->

PORTERS の値と、コードで扱いやすい値を行き来する関数です。

| 関数                    | 何をするか                                                                                                                     | 失敗の届き方                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| `encodeTimeOfDay(time)` | `"HH:mm"` / `"HH:mm:ss"`（00:00〜47:59）を、時分型の項目に書く ISO 8601 に変える（[日時と時分型][datetime]）                   | 同期 throw（範囲外・書式違い）         |
| `decodeTimeOfDay(iso)`  | 時分型の項目から読んだ ISO 8601 を `"HH:mm"`（秒があれば `"HH:mm:ss"`）に戻す                                                  | 同期 throw（基準日以外・時計の範囲外） |
| `resourceValueOf(name)` | リソース名（`"candidate"` など）を、PORTERS がリソースを表す数値に変える。`P_Resource` を書く・絞るときに使う（[検索][query]） | 失敗しない（名前は型で限定される）     |
| `resourceNameOf(value)` | 読んだ数値をリソース名に戻す。知らない数値は数値のまま返す                                                                     | 失敗しない                             |
| `bytesToBase64(bytes)`  | バイト列を Base64 の文字列にする。画像や添付の本体を送るときに使う（[Attachment][r-attachment]）                               | 失敗しない                             |
| `base64ToBytes(b64)`    | Base64 の文字列をバイト列に戻す。添付の本体を受け取ったときに使う                                                              | 失敗しない                             |

```ts
import {
  createThrottle,
  encodeTimeOfDay,
  resourceValueOf,
} from "@joymerrevent/porters-connect";

const throttle = createThrottle({ readPerMin: 500 }); // バッチ用に控えめな枠
const startsAt = encodeTimeOfDay("09:00"); // "1970-01-01T09:00:00Z"
const candidate = resourceValueOf("candidate"); // 1
```

## 固有の注意

これらの関数に共通する注意です。個々の使い方は上の各表のリンク先にあります。

- **`Promise` を返さない関数は、失敗すると同期 throw します。** `defineFields`・`assertFieldsMatch`・`createThrottle`・`createFetchTransport`・`encodeTimeOfDay`・`decodeTimeOfDay` がそれです。`Promise` を返す 3 つは reject で届きます（[エラーと再試行][errors]）。
- **`generateFieldDecls` は開発時に使うものです。** 返るのはソースコードの文字列で、ファイルに書き出してアプリが `import` します。実行時に呼んでも型には反映されません（[カスタム項目][custom-fields]の「宣言を自動生成する」）。
- **`verifyFields` は例外を投げません。** 止めるかどうかは利用側が決めます。起動時に止めたいときだけ `assertFieldsMatch` を続けて呼びます。
- **`createThrottle` で作ったスロットルは、共有の枠に入りません。** 渡したクライアントだけの上限になります。

## 型

この章の関数の引数と戻り値に出てくる型と役割です。正確な定義は各リンク先（公開 API リファレンス）にあります。

**宣言と突合**

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

**上限と接続**

| 型                                                                                                                 | 役割                                                             |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| [`Throttle`][t-Throttle] / [`ThrottleOptions`][t-ThrottleOptions]                                                  | `createThrottle` の戻り値とオプション                            |
| [`Transport`][t-Transport] / [`TransportRequest`][t-TransportRequest] / [`TransportResponse`][t-TransportResponse] | 送信の差し替え口と、その要求・応答のかたち                       |
| [`FetchTransportOptions`][t-FetchTransportOptions]                                                                 | `createFetchTransport` のオプション（`timeoutMs` / `fetchImpl`） |
| [`MockHandler`][t-MockHandler] / [`MockReply`][t-MockReply] / [`MockTransportOptions`][t-MockTransportOptions]     | `createMockTransport` に渡す応答の関数・その戻り値・オプション   |

**値の変換**

| 型                                       | 役割                                                  |
| ---------------------------------------- | ----------------------------------------------------- |
| [`ResourceName`][t-ResourceName]         | `resourceValueOf` の引数・`resourceNameOf` が返す名前 |
| [`ImageContentType`][t-ImageContentType] | 画像の本体に付ける MIME の種類（4 種）                |

## 関連

- 主題: [カスタム項目][custom-fields]（宣言・生成・突合）／[上限とレート][limits]（スロットルとタイムアウト）／[契約なしでテストする][testing]（モック）／[日時と時分型][datetime]（時分型）／[検索][query]（リソース種別で絞る）
- クライアントと関数: [PortersClient][cl-client]（`throttle` / `transport` オプション）／[tenant(id)][cl-tenant]（`fields` オプション）
- リソース別: [Field][r-field]（項目定義の Read）／[Attachment][r-attachment]（Base64 の本体）
- リファレンス: [公開 API リファレンス][api]
- ほかの目的から探す: [目次][index]

[index]: ../index.md
[api]: ../api/index.md
[custom-fields]: ../topics/custom-fields.md
[limits]: ../topics/limits.md
[testing]: ../topics/testing.md
[datetime]: ../topics/datetime.md
[query]: ../topics/query.md
[errors]: ../topics/errors.md
[cl-client]: client.md
[cl-tenant]: tenant-scope.md
[r-field]: ../resources/field.md
[r-attachment]: ../resources/attachment.md
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
[t-Throttle]: ../api/type-aliases/Throttle.md
[t-ThrottleOptions]: ../api/type-aliases/ThrottleOptions.md
[t-Transport]: ../api/type-aliases/Transport.md
[t-TransportRequest]: ../api/type-aliases/TransportRequest.md
[t-TransportResponse]: ../api/type-aliases/TransportResponse.md
[t-FetchTransportOptions]: ../api/type-aliases/FetchTransportOptions.md
[t-MockHandler]: ../api/type-aliases/MockHandler.md
[t-MockReply]: ../api/type-aliases/MockReply.md
[t-MockTransportOptions]: ../api/type-aliases/MockTransportOptions.md
[t-ResourceName]: ../api/type-aliases/ResourceName.md
[t-ImageContentType]: ../api/type-aliases/ImageContentType.md
