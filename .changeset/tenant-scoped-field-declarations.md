---
"@joymerrevent/porters-connect": minor
---

**（破壊的）カスタム項目の宣言は `tenant(id, { fields })` で受け取るようになりました**（[ADR-0087]）。
`PortersClientOptions` から `fields` が無くなり、`PortersClient` / `PortersClientOptions` は
型引数を取らなくなります。

カスタム項目（`U_` / `A_`）は **partition（Company DB）ごとのもの**です — 出典の各リソース記事が
「テナント毎に異なる」としています。これまで宣言は client に 1 つしか持てず、項目構成の違う
テナントを同じ client で扱うと、**別テナントの宣言が黙って適用される**形でした（実物が Option の
項目をテキストで読めば値が `null` になり、例外も警告も出ません）。partition を束ねる `tenant(id)` が、
その partition の項目の形も束ねます。

```ts
// 変更前
const porters = new PortersClient({ hostname, appId, appSecret, fields });
const t = porters.tenant(123);

// 変更後
const porters = new PortersClient({ hostname, appId, appSecret });
const t = porters.tenant(123, { fields });
```

- **移行は 1 対 1**です。コンストラクタの `fields` を `tenant()` の第 2 引数に移すだけで、
  `t` 以降のコードは変わりません。`tenant(id)`（第 2 引数なし）はこれまでどおり標準項目だけです。
- **項目構成の違うテナント群を 1 つの client（1 つのトークン）で扱えます**。
  `porters.tenant(1, { fields: a })` と `porters.tenant(2, { fields: b })` は、それぞれの宣言で
  読み書きします。client を分けるのは**トークンを分けたいとき**だけになりました。
- `A_` を App 共通、`U_` をテナント固有にしたい場合は、共通部分を関数にして各テナントの宣言に
  spread します（ライブラリは `A_` と `U_` を区別しません）。書き方は[カスタム項目ガイド][guide]に
  あります。
- 型を書くときは、`PortersClient<typeof fields>` / `PortersClientOptions<typeof fields>` が
  **コンパイルエラー**になります。スコープを受ける関数は `TenantScope<typeof fields>`（これまでどおり）、
  `tenant()` の引数を切り出すなら新設の `TenantOptions<typeof fields>` で書きます。
- `generateFieldDecls` / `verifyFields` / `readCustomCatalog` は変わりません（もともと `tenant(id)`
  スコープを取ります）。

[ADR-0087]: https://github.com/Joymerrevent/porters-connect/blob/main/docs/adr/0087-tenant-scoped-field-declarations.md
[guide]: https://github.com/Joymerrevent/porters-connect/blob/main/docs/usage/howto/custom-fields.md
