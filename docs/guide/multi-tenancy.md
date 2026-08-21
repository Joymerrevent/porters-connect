# partition の束ね方（単一テナント / マルチテナント）

PORTERS は **partition（Company DB）スコープの全リクエストで `partition` を要求**します。
このライブラリでは **`porters.tenant(id)` が partition を束ねる唯一の方法**で、
**単一テナントでも複数テナントでも同じ形**です（[ADR-0055][adr-0055]）。

`PortersClient` は partition を持ちません。client 直下にあるのは **partition を取らないもの**
（`auth`・`partition` マスタ・`tenant(id)` 自身）だけです。
「partition を束ね忘れたクライアント」という状態が**存在しない**ようにしてあります。

設計の根拠は [ADR-0008（マルチテナント）][adr-0008]・[ADR-0021（`tenant` 改名）][adr-0021]・
[ADR-0040（実装・案1c）][adr-0040]・[ADR-0055（client から partition を外す）][adr-0055]。
partition の前提は [認証 & マルチテナント設計][bd] を参照してください。

> [!NOTE]
> **end-user ↔ 会社 ↔ partition のマッピングは利用側（SaaS）の責務**です。ライブラリ（第1層）は
> 業務ロジックを持ちません。発見した partition の保存・ルーティングは SaaS 側で行ってください。

## 1. 単一テナント — スコープを 1 回持つ

相手が 1 partition なら、**起動時に一度束ねて使い回します**。以降は `t` をクライアントのように扱えます。

```ts
const porters = new PortersClient({ host, appId, appSecret });
const t = porters.tenant(Number(process.env.PORTERS_PARTITION));

await t.candidate.search({ condition: { P_Name: { part: "山田" } } });
await t.job.get(jobId);
```

App レベルの操作は `porters` 側にあります。

```ts
await porters.auth.ensureAuthenticated(); // トークンの事前取得
const partitions = await porters.partition.search(); // 使える partition の発見
```

## 2. マルチテナント — `porters.tenant(id)` スコープ

リクエストごとにテナントが変わる SaaS では、partition を**スコープで束ね**ます。
`tenant(id)` は partition を固定したアクセサ群（`TenantScope`）を返し、配下の呼び出しは
すべてその partition に送られます。

```ts
// SaaS の 1 リクエスト = 1 テナント
const partition = await lookupPartitionForUser(req.user); // ← SaaS の責務
const t = porters.tenant(partition);

await t.candidate.search(query); // partition=<partition> で送信
const job = await t.job.get(jobId);
await t.attachment.create(file);
```

- 露出するのは **data（candidate/job/client/process/resume）＋ attachment ＋ master Read（user/field/option）**。
- 含まれないもの: `auth`（App 単位・partition 非依存）／`partition` マスタ（partition の**発見**専用で partition を取らない）／
  `tenant` 自身（**ネストしない**）。これらは `porters` から直接呼びます。
- **per-call 引数は設けません**（ADR-0040 案1c）。「呼び出しごとの partition 選択」は `tenant(id)` 経由で表します。
  partition の解決は **`tenant(id)` の 1 層だけ**です（client 既定は [ADR-0055][adr-0055] で廃止）。
  どちらが効いているかを考える必要はありません。

## 3. 認証を完全分離したい — テナント別 client

既定では `tenant(id)` は client のトークンを**共有**します（共有トークン＋partition ルーティング）。
**partition ごとに別トークン**で運用したい場合は、テナント別に `PortersClient` を構築します。

```ts
const clientFor = (partition: number, tokenStore: TokenStore) =>
  new PortersClient({ host, appId, appSecret, partition, tokenStore });
```

> [!NOTE]
> 「1 つの App トークンで複数 partition を叩けるか」は実機未確認です（[live-verification][lv]）。
> 共有トークンで不都合があればテナント別 client に切り替えてください（設計は両対応）。

## オンボーディング（partition の発見）

初回はブラウザでの権限付与（[OAuth 認証ガイド][oauth]）の後、`request_type=0` でログイン中の
partition / user を発見できます。発見した partition を SaaS の DB に「会社 ↔ partition」で保存します。

```ts
const me = await porters.partition.search({ requestType: 0 }); // ログイン中 partition（browser code 付与時）
const user = await t.user.current(); // ログイン中 user
```

[adr-0008]: ../adr/0008-multitenancy-partition.md
[adr-0021]: ../adr/0021-master-read-resources.md
[adr-0055]: ../adr/0055-partition-binding-guard.md
[adr-0040]: ../adr/0040-multitenancy-surface-impl.md
[bd]: ../design/basic-design.md
[lv]: ../live-verification.md
[oauth]: ./oauth.md
