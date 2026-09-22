# Partition とテナントスコープ

PORTERS のデータは **Partition** という単位に分かれています。1 つの Partition が 1 つの **Company DB**（企業のデータベース）で、
候補者も求人も添付も、必ずどれか 1 つの Partition に属します。ほぼすべての操作が「どの Partition か」を要求するので、
このライブラリで最初につまずくのはここです。

## まず知ること

- **client は Partition を持ちません。** `porters.tenant(id)` が Partition を束ねたスコープ（`TenantScope`）を返し、
  配下の呼び出しはすべてその Partition に送られます。**単一テナントでもこの形**です。
- **カスタム項目の宣言も `tenant(id, { fields })` で束ねます。** カスタム項目は Partition ごとのものだからです。
- **client 直下にあるのは Partition を取らないものだけ**です。`auth`・`partition` マスタ・`tenant()` 自身。
- **Partition の id は `porters.partition.search()` で探します。** ログイン中の Partition を返す呼び方はありません。
- 複数テナントを 1 プロセスで回す組み立て（登録・認証の分離・レート）は[実践例][multi-tenant]にあります。

## client は Partition を持たない

`PortersClient` を作っただけでは、まだどのデータも読めません。**Partition を束ねるのは
`tenant(id)` です**<!-- 根拠: ADR-0055 -->。

```ts
const porters = new PortersClient({ hostname, appId, appSecret });

// ✗ porters.candidate は無い
const t = porters.tenant(123); // ← ここで Partition を束ねる
const page = await t.candidate.search();
```

client 側に既定の Partition を置く形にはしていません。既定があると
**「どの Partition に書いたか分からない書き込み」** が起こりえるためです。`tenant(id)` を通すと、
読み書きのすべてがどの Partition のものか呼び出し側のコードに現れます。
「Partition を束ね忘れたクライアント」という状態が**存在しない**ようにしてあります。

## スコープを 1 回持つ（単一テナント）

相手が 1 つの Partition なら、**起動時に一度束ねて使い回します**。以降は `t` をクライアントのように扱えます。

```ts
const porters = new PortersClient({ hostname, appId, appSecret });
const t = porters.tenant(Number(process.env.PORTERS_PARTITION));

await t.candidate.search({ condition: { P_Name: { part: "山田" } } });
await t.job.get(jobId);
```

カスタム項目を使うなら、その宣言も**ここで一緒に**渡します — `porters.tenant(id, { fields })`
（[カスタム項目][custom-fields]）<!-- 根拠: ADR-0087 -->。client は宣言を持ちません。

App レベルの操作は `porters` 側にあります。

```ts
await porters.auth.ensureAuthenticated(); // トークンの事前取得
const partitions = await porters.partition.search(); // 使える Partition の発見
```

## リクエストごとに束ねる（複数テナント）

リクエストごとにテナントが変わるなら、Partition を**スコープで束ね**ます。`tenant(id)` は Partition を固定した
アクセサ群（`TenantScope`）を返し、配下の呼び出しはすべてその Partition に送られます。

```ts
// SaaS の 1 リクエスト = 1 テナント
const partition = await lookupPartitionForUser(req.user); // ← 利用側の責務
const t = porters.tenant(partition, { fields: fieldsFor(partition) }); // 宣言も Partition と一緒に

await t.candidate.search(query); // partition=<partition> で送信
const job = await t.job.get(jobId);
await t.attachment.of("resume").create(file);
```

- スコープに露出するのは **データ系 13 種**（`candidate` / `job` / `client` / `recruiter` / `contact` / `opportunity` /
  `activity` / `contract` / `sales` / `process` / `resume` ＋ `phase` ＋ `attachment`）**＋ マスタ Read**
  （`user` / `department` / `field` / `option`）です（[リソースと操作][resources]）。
- 含まれないもの: `auth`（App 単位・Partition 非依存）／`partition` マスタ（Partition の**発見**専用）／
  `tenant` 自身（**ネストしない**）。これらは `porters` から直接呼びます。
- **呼び出しごとの Partition 引数はありません**<!-- 根拠: ADR-0040 案1c -->。Partition の解決は **`tenant(id)` の 1 層だけ**で、
  どちらが効いているかを考える必要はありません<!-- 根拠: ADR-0055 -->。
- **カスタム項目の宣言も 1 層だけ**です<!-- 根拠: ADR-0087 -->。別のテナントの宣言が黙って効くことはありません。

トークンは client が持ち、`tenant(id)` はアクセサを束ね直すだけなので、安い操作です。

```ts
const tokyo = porters.tenant(1);
const osaka = porters.tenant(2);

// 同じ呼び出しでも、行き先の Partition が違う
const tokyoCount = (await tokyo.candidate.search({ field: [] })).total;
const osakaCount = (await osaka.candidate.search({ field: [] })).total;
console.log(tokyoCount, osakaCount);
```

client 自体を分けるのは**トークンを分けたい**ときだけです（[複数テナント][multi-tenant]）。

## Partition を発見する

Partition の id を知らないところから始めるときは、**Partition マスタ**を読みます。
これが唯一 `partition=` を送らない読み取りです（Partition を探すのだから当然です）。

```ts
const page = await porters.partition.search(); // client 直下。tenant() を通さない
for (const p of page.items) console.log(p.P_Id, p.P_Name);
```

> **ログイン中の Partition は取れません。** PORTERS には「ログイン中の企業」を返す呼び方
> （`request_type=0`）がありますが、**ブラウザ経由の認証（`response_type=code`）でしか使えず**、
> このライブラリの既定であるサーバ間認証（`code_direct`）では 403 になります。そのため
> `partition.current()` は**提供していません**<!-- 根拠: ADR-0022 -->。アクセスできる Partition の
> 一覧から選んでください（[Partition][r-partition]）。

## 1 つのトークンで複数 Partition を叩けるか — 未確認

このライブラリは既定で**トークンを client 単位で共有**し、`tenant(id)` は `partition=` を
差し替えるだけです。1 つの App トークンで複数の Partition にアクセスできる前提です。

**これは実機で確かめていません**<!-- 根拠: LV-13 -->。契約環境で不都合が出たら、
Partition ごとに client を分ける形に切り替えてください — **設計は両対応**にしてあります。

## 覚えておくこと

- **`tenant(id)` を通さないと読み書きできない。** 既定の Partition は無い
- **`porters.partition` だけは client 直下。** Partition を探すための読み取り
- **`porters.auth` も client 直下。** 認証は Partition に紐づかない
- Partition をまたぐ操作は、**それぞれのスコープで**行う

## 関連

- 主題: [認証とトークン][auth]（権限付与は Company DB ごと）／[カスタム項目][custom-fields]（宣言を Partition ごとに渡す）
- リソース別: [Partition][r-partition]／[リソースと操作][resources]（スコープの下にあるもの）
- 実践例: [複数テナント][multi-tenant]（登録・宣言の持ち方・認証の分離・レート）
- API 事実: [リソース一覧][res-list]（Partition は `/v1/partition`）
- ほかの目的から探す: [目次][index]

<!-- 根拠:
- 決定: ADR-0055（`tenant(id)` に束ねる）／ADR-0008（マルチテナント運用）／ADR-0040（実装・案1c）／
  ADR-0087（カスタム項目の宣言も `tenant()` で束ねる）
-->

[custom-fields]: custom-fields.md
[auth]: auth.md
[multi-tenant]: ../recipes/multi-tenant.md
[resources]: ../resources/README.md
[r-partition]: ../resources/partition.md
[res-list]: ../reference/resource-api/resources-list.md
[index]: ../index.md
