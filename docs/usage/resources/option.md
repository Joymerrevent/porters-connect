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
const options = await t.option.search({ alias: "Option.P_Gender" }); // 部分木を深さ優先で平らに
for (const o of options) console.log(o.P_Alias, o.P_Name, o.P_ParentId);
```

マスタ 5 種は語彙が違います。`condition` と `get(id)` はありません（[検索][query]の「マスタは語彙が違う」）。

## 固有の注意

このリソースだけに効く注意です。共通の規則（検索・書き込み・上限）は主題別のページにあります。

- **`searchAll` はありません**。PORTERS の Option Read に `start` が無く、ページを進める手段が無いためです。`search` の戻り値もページではなく **`Option[]`** です。
- `alias` で部分木の根を、`level` で深さ（`-1` すべて・既定、`0` 兄弟、`1` 以上は子孫）を、`enabled` で使用中かを選べます。木は `P_ParentId` から組み立て直せます。
- 既定の選択肢の一覧は PORTERS の Default Option List にありますが、テナントで上書きされるので、実際の値は必ずここで読んでください。
- フリーワード検索（`keywords`）は選択肢型の項目を対象にできません。選択肢は `condition` で絞ります。

## 新規作成の必須項目

このリソースは読み取り専用なので、`create` はありません。

## 項目と型

標準項目の一覧と、このライブラリの型を引く先です。

- 項目の一覧: [Option の項目][ref]（PORTERS の事実）
- 型: [`Option`][t-Option] ／ [`OptionSearchQuery`][t-OptionSearchQuery] ／ [`OptionResource`][t-OptionResource]

## 関連

- 主題: [検索][query]（選択肢型の `condition`）
- リソースの一覧: [リソースと操作][resources]
- ほかの目的から探す: [目次][index]

[ref]: ../reference/resource-api/resources/option.md
[resources]: README.md
[index]: ../index.md
[query]: ../topics/query.md
[t-Option]: ../api/type-aliases/Option.md
[t-OptionSearchQuery]: ../api/type-aliases/OptionSearchQuery.md
[t-OptionResource]: ../api/type-aliases/OptionResource.md
