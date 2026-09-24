# トークンを DB に保存する（`tokenStore`）

トークンをプロセスの外に残したいときに読むページです。再起動のたびに `code_direct` で取り直さず、保存しておいた
トークンを使い回す `tokenStore` を、TypeScript の ORM（[Drizzle ORM][drizzle]）と PostgreSQL で組みます。
読み終えると、自分の DB にトークンを保存するクライアントを書けます。

## 使う機能

この用途で使うライブラリの機能と、それぞれの役割です。

| 機能                         | 何に使うか                                                            |
| ---------------------------- | --------------------------------------------------------------------- |
| `tokenStore`（`TokenStore`） | トークンの読み書きをライブラリから受け取る（`get` / `set` / `clear`） |
| `StoredTokens`               | 保存するトークンの形。ふつうの JSON なので、そのまま列に入れられる    |
| `porters.auth.clearTokens()` | 手元のトークンを消す。`tokenStore` の `clear` が呼ばれる              |

## 組み立て

次の順に組みます。テーブルを定義する → `tokenStore` を書く → クライアントに渡す、の 3 段です。

### 1. テーブルを定義する

1 行に 1 組のトークンを保存します。`StoredTokens` は JSON なので、`jsonb` の列にそのまま入れます。

```ts
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { StoredTokens } from "@joymerrevent/porters-connect";

export const portersTokens = pgTable("porters_tokens", {
  key: text("key").primaryKey(), // どのクライアントのトークンか（下の「キーの決め方」）
  tokens: jsonb("tokens").$type<StoredTokens>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});
```

### 2. `tokenStore` を書く

`get` / `set` / `clear` の 3 つを、この行の読み・書き・削除に対応させます。

```ts
import { eq } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { StoredTokens, TokenStore } from "@joymerrevent/porters-connect";

const portersTokens = pgTable("porters_tokens", {
  key: text("key").primaryKey(),
  tokens: jsonb("tokens").$type<StoredTokens>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const createDbTokenStore = (
  db: PgDatabase<PgQueryResultHKT>,
  key: string,
): TokenStore => ({
  get: async () => {
    const rows = await db
      .select({ tokens: portersTokens.tokens })
      .from(portersTokens)
      .where(eq(portersTokens.key, key))
      .limit(1);
    return rows[0]?.tokens; // 行が無ければ undefined（＝保存なし）
  },
  set: async (tokens) => {
    await db
      .insert(portersTokens)
      .values({ key, tokens, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: portersTokens.key,
        set: { tokens, updatedAt: new Date() },
      });
  },
  clear: async () => {
    await db.delete(portersTokens).where(eq(portersTokens.key, key));
  },
});
```

- `db` の型は `PgDatabase` なので、`drizzle-orm/node-postgres`・`drizzle-orm/postgres-js` など、どの PostgreSQL の
  ドライバで作った `db` でも渡せます。
- 読み戻した値が `StoredTokens` の形でなければ（手で書き換えた、古い形のまま残っている、など）、ライブラリは
  「保存されていない」として扱い、トークンを取り直します。`get` の中で形を確かめる必要はありません。

### 3. クライアントに渡す

```ts
import { PortersClient } from "@joymerrevent/porters-connect";

const porters = new PortersClient({
  hostname,
  appId,
  appSecret,
  tokenStore: createDbTokenStore(db, "porters"),
});
```

これで、取得・更新のたびにトークンがこの行に書かれ、次に起動したときは、まだ使えるトークンがあればそれを使います。
Access Token の期限（約 30 分）が切れていても、Refresh Token（約 2 時間）が残っていれば、`code_direct` からではなく
更新で取り直します。

## キーの決め方

`key` は「どのクライアントのトークンか」を分けるためのものです。

- **App が 1 つで、Company DB をすべて同じクライアントで扱う**なら、固定の 1 つ（例の `"porters"`）で足ります。
  トークンは App ごとに 1 組で、Partition を変えても同じトークンを使うからです。
- **テナントごとにクライアント（とトークン）を分けている**なら、テナントごとに別のキーにします
  （[複数テナント][multi-tenant]の「認証を分けるか」）。
- 同じキーを、別の App の資格情報を持つクライアントと共有しないでください。

## 複数のプロセスで同じ行を使うとき

同じキーを複数のプロセスで使うこともできますが、次の動きを知っておいてください。

- **ライブラリが保存先を読むのは、プロセスごとに最初の 1 回だけです。** それ以降は手元に持っているトークンを使い、
  ほかのプロセスが書いた新しい値は読み直しません。
- **更新のたびに Refresh Token が入れ替わります。** あるプロセスが更新すると、ほかのプロセスが手元に持っている
  Refresh Token は使えなくなります。そのプロセスが次に更新しようとすると PORTERS に拒否されますが、ライブラリは
  `code_direct` で取り直して続けます（処理は止まりません）。
- そのぶん、認証のリクエストが増えます。**トークンを 1 か所で取り、各プロセスはそれを受け取る**形にしたいときは、
  [中央のサービスからトークンを受け取る][central-token-service]を使います。

## ライブラリの外（利用側の責務）

この用途で自分で用意するものです。ライブラリは持ちません。

- テーブルの作成と移行（`drizzle-kit` など）
- **トークンは秘密情報です。** 列の暗号化、DB のアクセス権の絞り込み、バックアップの扱いを決める
- DB の接続と障害時の扱い（`get` / `set` が失敗すると、そのリクエストもエラーになります）

## 関連

- 主題: [認証とトークン][auth]（`tokenStore` の型と、トークンの取り方）
- クライアント: [PortersClient][cl-client]（構築オプションの `tokenStore`）
- 実践例: [中央のサービスからトークンを受け取る][central-token-service]／[複数テナント][multi-tenant]
- ほかの目的から探す: [目次][index]

[drizzle]: https://orm.drizzle.team/
[auth]: ../topics/auth.md
[cl-client]: ../client/client.md
[central-token-service]: central-token-service.md
[multi-tenant]: multi-tenant.md
[index]: ../index.md
