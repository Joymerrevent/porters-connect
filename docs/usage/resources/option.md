# Option（選択肢）

選択肢のマスタです。選択肢型の項目（`P_Phase` や `U_` の Option 型）に入れる alias は、ここで確かめます。

- **アクセサ**: `t.option`
- **スコープ**: `option_r`
- **読み取り専用**（PORTERS に Write API が無い）

## 呼べるメソッド

このリソースで呼べるメソッドと、使い方の例です。

| 読み     | 書き              |
| -------- | ----------------- |
| `search` | —（読み取り専用） |

```ts
const options = await t.option.search({ alias: "Option.P_Gender" }); // 指定した alias 以下の選択肢を、階層順に 1 つの配列で返す
for (const o of options) console.log(o.P_Alias, o.P_Name, o.P_ParentId);
```

マスタ 5 種は、検索で指定できる引数がデータ系と違います。`condition` と `get(id)` はありません（[検索][query]の「マスタは指定できるものが違う」）。

## 固有の注意

このリソースだけに当てはまる注意です。共通の規則（検索・書き込み・上限）はガイドのページにあります。

- **`searchAll` はありません**。PORTERS の Option Read に `start` が無く、ページを進める手段が無いためです。`search` の戻り値もページではなく **`Option[]`** です。
- **読む範囲は `alias`（起点の選択肢）・`level`（階層の深さ）・`enabled`（使用中か）で選べます。** `level` は `-1` ですべて（既定）、`0` で起点と同じ階層だけ、`1` 以上で子孫を何段までたどるかです。階層は `P_ParentId` から復元できます。
- **実際の値は必ずここで読んでください。** 既定の選択肢の一覧（PORTERS の Default Option List）は、テナントで上書きされます。
- **`keywords` では選択肢型の項目を絞れません。** 選択肢は `condition` で絞ります。

## 新規作成の必須項目

このリソースは読み取り専用なので、`create` はありません。

## 項目と型

標準項目の一覧と、このライブラリの型を引く先です。

- 項目の一覧: [Option の項目][ref]（PORTERS の事実）
- カスタム項目（`U_` / `A_`）: ありません

| 型                                         | 役割                                             |
| ------------------------------------------ | ------------------------------------------------ |
| [`Option`][t-Option]                       | 読み取った 1 件（`search` は `Option[]` を返す） |
| [`OptionSearchQuery`][t-OptionSearchQuery] | `search` のクエリ                                |
| [`OptionResource`][t-OptionResource]       | `t.option` の型                                  |

## 関連

- ガイド: [検索][query]（選択肢型の `condition`）／[項目と値のかたち][fields]（選択肢は常に配列）
- リソースの一覧: [リソースと操作][resources]
- ほかの目的から探す: [目次][index]

[ref]: ../reference/resource-api/resources/option.md
[resources]: README.md
[index]: ../index.md
[query]: ../topics/query.md
[t-Option]: ../api/type-aliases/Option.md
[t-OptionSearchQuery]: ../api/type-aliases/OptionSearchQuery.md
[t-OptionResource]: ../api/type-aliases/OptionResource.md
[fields]: ../topics/fields.md
