# tenant(id)（テナントスコープ）

`porters.tenant(id)` が返す、Partition（Company DB）を指定したスコープです。レコードの読み書きはすべてここから行い、
単一テナントでも同じ書き方です。

- **作り方**: `porters.tenant(id, { fields })`（`fields` は任意）
- **持っているもの**: データ系 13 種とマスタ 4 種のアクセサ

## 呼べるアクセサ

<!-- 根拠: ADR-0040 F-3（tenant(id) 経由のみ）・ADR-0061（of() で束ねる）・ADR-0087（宣言は tenant で受ける） -->

このスコープ（下の例では `t`）で呼べるアクセサと、使い方の例です。呼べるメソッドはリソースごとに違うので、
一覧は[リソースと操作][resources]にあります。

| 種類                     | アクセサ                                                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| データ系（読み書き）     | `t.candidate`／`t.job`／`t.client`／`t.recruiter`／`t.contact`／`t.opportunity`／`t.activity`／`t.contract`／`t.sales`／`t.process`／`t.resume`／`t.phase`／`t.attachment` |
| マスタ系（読み取り専用） | `t.user`／`t.department`／`t.field`／`t.option`                                                                                                                            |

`t.phase`・`t.attachment`・`t.field` は、先に `of("candidate")` のように**どのリソースのものか**を指定してから使います
（[Phase][r-phase]／[Attachment][r-attachment]／[Field][r-field]）。

```ts
const t = porters.tenant(123); // 以降 `t` をクライアントのように使う

const page = await t.candidate.search({ field: ["P_Id", "P_Name"] });
const phases = t.phase.of("candidate"); // Phase・Attachment・Field は対象リソースを先に指定する
```

## 固有の注意

このスコープだけに当てはまる注意です。共通の規則（Partition の指定のしかた・id の探し方）は主題別のページにあります。

- **`tenant(id)` は同期で、PORTERS を呼びません。** Partition 付きのアクセサを作り直すだけなので軽く、リクエストごとに作って構いません。トークンはクライアントが持ちます。
- **id の存在は確かめません。** 無い Partition や権限の無い Partition は、最初のリクエストで PORTERS のエラーになります。id は `porters.partition.search()` で探します（[Partition][r-partition]）。
- **`auth`・`partition`・`tenant` はスコープにありません。** どれも Partition を取らないので、`porters` から直接呼びます（[PortersClient][cl-client]）。スコープを入れ子にすることもできません。
- **カスタム項目の宣言は Partition ごとです。** `{ fields }` を渡し忘れたスコープで `U_` の項目を使うとコンパイルエラーになります。別のテナントの宣言が気づかないうちに適用されることはありません。
- **呼び出しごとに Partition を渡す引数はありません。** Partition を決める場所は `tenant(id)` の 1 箇所だけです。
- **スコープを関数の引数に取るときの型**は[複数テナント][multi-tenant]の「宣言したスコープを関数に渡す」にあります。

## オプション

`tenant(id, options)` の第 2 引数に渡すものです。

| オプション | 何を渡すか                                                                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fields`   | この Partition のカスタム項目の宣言（`defineFields` の戻り値。[宣言と突合][fn-declare]）。渡すと `U_` / `A_` の項目が型付きで読み書きできる（[カスタム項目][custom-fields]） |

```ts
const scope = porters.tenant(123, { fields: myFields }); // カスタム項目を宣言つきで使う
```

## 型

このページで出てくる型と役割です。正確な定義は各リンク先（[公開 API リファレンス][api]）にあります。

| 型                                             | 役割                                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [`TenantScope`][t-TenantScope]                 | `tenant(id)` の戻り値。型引数はその Partition のカスタム項目の宣言                                                  |
| [`TenantOptions`][t-TenantOptions]             | `tenant()` の第 2 引数（`fields`）                                                                                  |
| [`PartitionId`][t-PartitionId]                 | `id` の型                                                                                                           |
| [`DefinedFields`][t-DefinedFields]             | `fields` に渡す、`defineFields` の戻り値                                                                            |
| [`DeclaredCatalogs`][t-DeclaredCatalogs]       | 宣言の中身（リソース → カスタム項目）。どの宣言のスコープでも受ける関数の引数に使う（[複数テナント][multi-tenant]） |
| [`CustomFor`][t-CustomFor]                     | 宣言から 1 リソース分のカスタム項目を取り出す型                                                                     |
| [`CustomFieldResource`][t-CustomFieldResource] | カスタム項目を宣言できるリソース名の一覧                                                                            |
| [`ResourceName`][t-ResourceName]               | `of()` に渡すリソース名（アクセサと同じ綴り）                                                                       |

## 関連

- 主題: [Partition とテナントスコープ][tenant]（Partition の考え方と探し方）／[カスタム項目][custom-fields]（宣言を渡す場所）
- クライアント: [PortersClient][cl-client]／[auth][cl-auth]
- ほかの目的から探す: [目次][index]

[index]: ../index.md
[tenant]: ../topics/tenant.md
[custom-fields]: ../topics/custom-fields.md
[cl-client]: client.md
[cl-auth]: auth.md
[fn-declare]: ../functions/declare.md
[resources]: ../resources/README.md
[r-partition]: ../resources/partition.md
[r-phase]: ../resources/phase.md
[r-attachment]: ../resources/attachment.md
[r-field]: ../resources/field.md
[multi-tenant]: ../recipes/multi-tenant.md
[t-TenantScope]: ../api/type-aliases/TenantScope.md
[t-TenantOptions]: ../api/type-aliases/TenantOptions.md
[t-PartitionId]: ../api/type-aliases/PartitionId.md
[t-DefinedFields]: ../api/type-aliases/DefinedFields.md
[t-DeclaredCatalogs]: ../api/type-aliases/DeclaredCatalogs.md
[t-CustomFor]: ../api/type-aliases/CustomFor.md
[t-CustomFieldResource]: ../api/type-aliases/CustomFieldResource.md
[t-ResourceName]: ../api/type-aliases/ResourceName.md
[api]: ../api/index.md
