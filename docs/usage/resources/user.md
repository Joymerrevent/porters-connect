# User（ユーザー）

PORTERS のユーザーです。`P_Owner` のようなユーザー型の項目の参照先で、読むと入れ子で返り、書くときは id だけを渡します。

- **アクセサ**: `t.user`
- **スコープ**: `user_r`
- **読み取り専用**（PORTERS に Write API が無い）

## 呼べるメソッド

このリソースで呼べるメソッドと、使い方の例です。

| 読み                               | 書き              |
| ---------------------------------- | ----------------- |
| `search` / `searchAll` / `current` | —（読み取り専用） |

```ts
const me = await t.user.current(); // code_direct ではアプリ自身の User
console.log(me?.P_Id, me?.P_Name);

const page = await t.user.search({
  field: ["P_Id", "P_Name", "P_Mail", "P_Department"],
});
```

マスタ 5 種は語彙が違います。`condition` と `get(id)` はありません（[検索][query]の「マスタは語彙が違う」）。

## 固有の注意

このリソースだけに効く注意です。共通の規則（検索・書き込み・上限）は主題別のページにあります。

- **`current()` は「いま API を実行しているユーザー」**です。ライブラリの既定であるサーバ間認証（`code_direct`）ではアプリ自身の User（ユーザー名 = アプリ名）が返り、ブラウザ経由の認証（`code`）ではログインユーザーが返ります。無ければ `undefined` です。
- **`field` を省略すると 17 項目すべてが返ります。** `[]` を渡すと PORTERS 本来の既定（4 項目）になります。
- **`P_Department` は部署を指します**（[Department][r-department]）。
- **読むと入れ子、書くときは id だけです。** `P_Id` / `P_Type` / `P_Name` / `P_Mail` の入れ子で返り、書くときは `P_Id` の数値だけを渡します（[項目と値のかたち][fields]）。

## 新規作成の必須項目

このリソースは読み取り専用なので、`create` はありません。

## 項目と型

標準項目の一覧と、このライブラリの型を引く先です。

- 項目の一覧: [User の項目][ref]（PORTERS の事実）
- カスタム項目（`U_` / `A_`）: ありません

| 型                                     | 役割                                       |
| -------------------------------------- | ------------------------------------------ |
| [`User`][t-User]                       | 読み取った 1 件                            |
| [`UserSearchQuery`][t-UserSearchQuery] | `search` / `searchAll` のクエリ            |
| [`UserPage`][t-UserPage]               | `search` の戻り値（1 ページ）              |
| [`UserResource`][t-UserResource]       | `t.user` の型                              |
| [`UserRef`][t-UserRef]                 | ユーザー型の項目が読みで返す入れ子のかたち |

## 関連

- 主題: [項目と値のかたち][fields]（ユーザー型の読みと書きのかたち）／[認証とトークン][auth]（`current()` が誰になるか）
- リソースの一覧: [リソースと操作][resources]
- ほかの目的から探す: [目次][index]

[ref]: ../reference/resource-api/resources/user.md
[resources]: README.md
[index]: ../index.md
[fields]: ../topics/fields.md
[query]: ../topics/query.md
[r-department]: department.md
[t-User]: ../api/type-aliases/User.md
[t-UserPage]: ../api/type-aliases/UserPage.md
[t-UserSearchQuery]: ../api/type-aliases/UserSearchQuery.md
[t-UserResource]: ../api/type-aliases/UserResource.md
[t-UserRef]: ../api/type-aliases/UserRef.md
[auth]: ../topics/auth.md
