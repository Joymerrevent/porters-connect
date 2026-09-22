# Department（部署）

ユーザーの部署のマスタです。ユーザー部署型（Link）の項目と `User.P_Department` の参照先になります。

- **アクセサ**: `t.department`
- **スコープ**: `user_r`（専用のスコープは無い）
- **読み取り専用**（PORTERS に Write API が無い）

## 呼べるメソッド

このリソースで呼べるメソッドと、使い方の例です。

| 読み                   | 書き              |
| ---------------------- | ----------------- |
| `search` / `searchAll` | —（読み取り専用） |

```ts
for await (const d of t.department.searchAll())
  console.log(d.P_Id, d.P_Name, d.P_Hidden);
```

マスタ 5 種は語彙が違います。`condition` と `get(id)` はありません（[検索][query]の「マスタは語彙が違う」）。

## 固有の注意

このリソースだけに効く注意です。共通の規則（検索・書き込み・上限）は主題別のページにあります。

- **絞り込みはありません**。PORTERS の Department Read が条件を受けないため、Partition の部署を全件読んで手元で選びます。`get(id)` もありません。
- **スコープは `user_r` です。** PORTERS は `department_r` を定義していません。
- **2025 年 3 月（Connect API 8.2.1）に追加されたマスタです。** 読み取り専用です。

## 新規作成の必須項目

このリソースは読み取り専用なので、`create` はありません。

## 項目と型

標準項目の一覧と、このライブラリの型を引く先です。

- 項目の一覧: [Department の項目][ref]（PORTERS の事実）
- カスタム項目（`U_` / `A_`）: ありません

| 型                                                 | 役割                                   |
| -------------------------------------------------- | -------------------------------------- |
| [`Department`][t-Department]                       | 読み取った 1 件                        |
| [`DepartmentPage`][t-DepartmentPage]               | `search` の戻り値（1 ページ）          |
| [`DepartmentSearchQuery`][t-DepartmentSearchQuery] | `search` / `searchAll` のクエリ        |
| [`DepartmentResource`][t-DepartmentResource]       | `t.department` の型                    |
| [`DepartmentRef`][t-DepartmentRef]                 | 部署型の項目が読みで返す入れ子のかたち |

## 関連

- 主題: [項目と値のかたち][fields]（部署型の読みと書きのかたち）
- リソースの一覧: [リソースと操作][resources]
- ほかの目的から探す: [目次][index]

[ref]: ../reference/resource-api/resources/department.md
[resources]: README.md
[index]: ../index.md
[fields]: ../topics/fields.md
[query]: ../topics/query.md
[t-Department]: ../api/type-aliases/Department.md
[t-DepartmentPage]: ../api/type-aliases/DepartmentPage.md
[t-DepartmentSearchQuery]: ../api/type-aliases/DepartmentSearchQuery.md
[t-DepartmentResource]: ../api/type-aliases/DepartmentResource.md
[t-DepartmentRef]: ../api/type-aliases/DepartmentRef.md
