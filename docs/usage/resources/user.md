# User（ユーザー）

- **アクセサ**: `t.user`
- **スコープ**: `user_r`
- **読み取り専用**（PORTERS に Write API が無い）

PORTERS のユーザーです。`P_Owner` のようなユーザー型の項目の参照先で、読むと入れ子で返り、書くときは id だけを渡します。

## 呼べるメソッド

| 読み                               |
| ---------------------------------- |
| `search` / `searchAll` / `current` |

```ts
const me = await t.user.current(); // code_direct ではアプリ自身の User
console.log(me?.P_Id, me?.P_Name);

const page = await t.user.search({
  field: ["P_Id", "P_Name", "P_Mail", "P_Department"],
});
```

マスタ 5 種は語彙が違います。`condition` と `get(id)` はありません（[検索][query]の「マスタは語彙が違う」）。

## 固有の注意

- **`current()` は「いま API を実行しているユーザー」**です。ライブラリの既定であるサーバ間認証（`code_direct`）ではアプリ自身の User（ユーザー名 = アプリ名）が返り、ブラウザ経由の認証（`code`）ではログインユーザーが返ります。無ければ `undefined` です。
- `field` を省略するとカタログ上の 17 項目が返ります。`[]` を渡すと PORTERS 本来の既定（4 項目）になります。
- `P_Department` は部署（[Department][r-department]）を指します。
- 読むと `P_Id` / `P_Type` / `P_Name` / `P_Mail` の入れ子で返り、書くときは `P_Id` の数値だけを渡します（[項目と値のかたち][fields]）。

## 項目と型

- 項目の一覧: [User の項目][ref]（PORTERS の事実）
- 型: [`User`][t-User] ／ [`UserPage`][t-UserPage] ／ [`UserSearchQuery`][t-UserSearchQuery] ／ [`UserResource`][t-UserResource] ／ [`UserRef`][t-UserRef]

## 関連

- 主題: [項目と値のかたち][fields]（ユーザー型の読みと書きのかたち）
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
