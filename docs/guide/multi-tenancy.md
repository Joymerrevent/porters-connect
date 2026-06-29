# マルチテナント（複数 partition の扱い）

1 つの App（App ID/Secret）で**複数の PORTERS 契約企業＝複数 partition（Company DB）**を相手にする
SaaS 向けのガイドです。partition の渡し方は 3 通りあり、用途で選びます。

設計の根拠は [ADR-0008（マルチテナント）][adr-0008]・[ADR-0021（`tenant` 改名）][adr-0021]・
[ADR-0040（実装・案1c）][adr-0040]。partition の前提は [認証 & マルチテナント設計][bd] を参照してください。

> [!NOTE]
> **end-user ↔ 会社 ↔ partition のマッピングは利用側（SaaS）の責務**です。ライブラリ（第1層）は
> 業務ロジックを持ちません。発見した partition の保存・ルーティングは SaaS 側で行ってください。

## 1. 単一テナント — client 既定 `partition`

相手が 1 partition なら、構築時に `partition` を渡し、以降はそのまま呼びます。

```ts
const porters = new PortersClient({ host, appId, appSecret, partition: 123 });
await porters.candidate.search({ condition: { P_Name: { part: "山田" } } });
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
  partition 解決は **tenant スコープ → client 既定**の 2 層です。

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
const user = await porters.user.current(); // ログイン中 user
```

[adr-0008]: ../adr/0008-multitenancy-partition.md
[adr-0021]: ../adr/0021-master-read-resources.md
[adr-0040]: ../adr/0040-multitenancy-surface-impl.md
[bd]: ../design/basic-design.md
[lv]: ../live-verification.md
[oauth]: ./oauth.md
