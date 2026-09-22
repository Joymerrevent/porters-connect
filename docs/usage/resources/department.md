# Department（部署）

- **アクセサ**: `t.department`
- **スコープ**: `user_r`（専用のスコープは無い）
- **読み取り専用**（PORTERS に Write API が無い）

ユーザーの部署です。ユーザー部署型（Link）の項目と `User.P_Department` の参照先になります。Connect API 8.2.1（2025/03）で追加された読み取り専用のマスタです。

## 呼べるメソッド

| 読み                   |
| ---------------------- |
| `search` / `searchAll` |

```ts
for await (const d of t.department.searchAll())
  console.log(d.P_Id, d.P_Name, d.P_Hidden);
```

マスタ 5 種は語彙が違います。`condition` と `get(id)` はありません（[検索][query]の「マスタは語彙が違う」）。

## 固有の注意

- **絞り込みはありません**。PORTERS の Department Read が条件を受けないため、Partition の部署を全件読んで手元で選びます。`get(id)` もありません。
- スコープは **`user_r`** です。PORTERS は `department_r` を定義していません。
- 項目は `P_Id` / `P_Name` / `P_Hidden` / `P_SortNo` / `P_RegistrationDate` / `P_UpdateDate` の 6 つです。

## 項目と型

- 項目の一覧: [Department の項目][ref]（PORTERS の事実）
- 型: [`Department`][t-Department] ／ [`DepartmentPage`][t-DepartmentPage] ／ [`DepartmentSearchQuery`][t-DepartmentSearchQuery] ／ [`DepartmentResource`][t-DepartmentResource] ／ [`DepartmentRef`][t-DepartmentRef]

## 関連

- 主題: [項目と値の形][fields]（部署型の読みと書きの形）
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
