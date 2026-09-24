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

次の順に組みます。DB につなぐ → テーブルを定義する → `tokenStore` を書く → クライアントに渡す、の 4 段です。
例は 4 つのファイルに分けています（コード例の 1 行目がファイル名です）。

```text
db.ts           … DB の接続（手順 0）
schema.ts       … テーブルの定義（手順 1）
token-store.ts  … tokenStore（手順 2。db.ts と schema.ts を使う）
porters.ts      … PortersClient（手順 3。db.ts と token-store.ts を使う）
```

### 0. DB につなぐ

Drizzle の `db` を作ります。例は PostgreSQL のドライバ `pg`（node-postgres）を使います（`pnpm add drizzle-orm pg`）。

```ts
// ファイル: db.ts
import { drizzle } from "drizzle-orm/node-postgres";

export const db = drizzle(process.env.DATABASE_URL ?? ""); // 接続文字列から作る
```

### 1. テーブルを定義する

`porters_tokens` テーブルの 1 行に、1 組のトークン（Access Token と Refresh Token）を保存します。どの行を使うかは
`name` 列（保存先の名前）で決めます。`StoredTokens` は JSON なので、`jsonb` の列にそのまま入れます。

```ts
// ファイル: schema.ts
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { StoredTokens } from "@joymerrevent/porters-connect";

export const portersTokens = pgTable("porters_tokens", {
  name: text("name").primaryKey(), // 保存先の名前（下の「保存先の名前の決め方」）
  tokens: jsonb("tokens").$type<StoredTokens>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});
```

### 2. `tokenStore` を書く

`get` / `set` / `clear` の 3 つを、`name` が一致する行の読み取り・書き込み（無ければ追加）・削除に対応させます。テーブルは手順 1 の `schema.ts` から読みます。

```ts
// ファイル: token-store.ts
import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { TokenStore } from "@joymerrevent/porters-connect";
import { portersTokens } from "./schema";

export const createDbTokenStore = (
  db: PgDatabase<PgQueryResultHKT>,
  name: string, // 保存先の名前（name 列の値）
): TokenStore => ({
  get: async () => {
    const rows = await db
      .select({ tokens: portersTokens.tokens })
      .from(portersTokens)
      .where(eq(portersTokens.name, name))
      .limit(1);
    return rows[0]?.tokens; // 行が無ければ undefined（＝保存なし）
  },
  set: async (tokens) => {
    await db
      .insert(portersTokens)
      .values({ name, tokens, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: portersTokens.name,
        set: { tokens, updatedAt: new Date() },
      });
  },
  clear: async () => {
    await db.delete(portersTokens).where(eq(portersTokens.name, name));
  },
});
```

- `db` を引数で受け取るのは、どこで作った `db` でも使えるようにするためです。型は `PgDatabase` なので、
  `drizzle-orm/node-postgres`（手順 0）・`drizzle-orm/postgres-js` など、どの PostgreSQL のドライバで作った `db` でも渡せます。
- 読み戻した値が `StoredTokens` の形でなければ（手で書き換えた、古い形のまま残っている、など）、ライブラリは
  「保存されていない」として扱い、トークンを取り直します。`get` の中で形を確かめる必要はありません。

### 3. クライアントに渡す

手順 0 の `db` と、手順 2 の `createDbTokenStore` を使います。

```ts
// ファイル: porters.ts
import { PortersClient } from "@joymerrevent/porters-connect";
import { db } from "./db";
import { createDbTokenStore } from "./token-store";

export const porters = new PortersClient({
  hostname: process.env.PORTERS_HOST ?? "",
  appId: process.env.PORTERS_APP_ID ?? "",
  appSecret: process.env.PORTERS_APP_SECRET ?? "",
  tokenStore: createDbTokenStore(db, "porters"), // "porters" は保存先の名前
});
```

これで、トークンを取得・更新するたびに、`porters_tokens` テーブルの `name` が `"porters"` の行に書き込まれます。
次に起動したときはその行を読み、まだ使えるトークンがあればそれを使います。
Access Token の期限（約 30 分）が切れていても、Refresh Token（約 2 時間）が残っていれば、`code_direct` からではなく
更新で取り直します。

## 保存先の名前（`name`）の決め方

`name` 列の値は、どのクライアントのトークンを入れた行かを見分けるための、ただの名前です。
App Secret のような秘密の値ではありません。

- **App が 1 つで、Company DB をすべて同じクライアントで扱う**なら、固定の 1 つ（例の `"porters"`）で足ります。
  トークンは App ごとに 1 組で、Partition を変えても同じトークンを使うからです。
- **テナントごとにクライアント（とトークン）を分けている**なら、テナントごとに別の名前にします
  （[複数テナント][multi-tenant]の「認証を分けるか」）。
- 同じ名前を、別の App（別の App ID / App Secret）のクライアントと共有しないでください。

## 複数のプロセスで同じ保存先を使うとき

同じ名前の保存先を複数のプロセスで使うこともできますが、次の動きを知っておいてください。

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
