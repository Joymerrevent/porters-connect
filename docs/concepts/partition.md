# Partition（Company DB）とテナント

PORTERS のデータは **Partition** という単位に分かれています。1 つの Partition が 1 つの
**Company DB**（企業のデータベース）です。候補者も求人も添付も、必ずどれか 1 つの Partition に属します。

このライブラリで最初につまずくのはここです。**ほぼすべての操作が「どの Partition か」を要求します。**

## client は Partition を持たない

`PortersClient` を作っただけでは、まだどのデータも読めません。**Partition を束ねるのは
`tenant(id)` です**（[ADR-0055][adr55]）。

```ts
const porters = new PortersClient({ host, appId, appSecret });

// ✗ porters.candidate は無い
const t = porters.tenant(123); // ← ここで Partition を束ねる
const page = await t.candidate.search();
```

client 側に既定の Partition を置く形にはしていません。既定があると
**「どの Partition に書いたか分からない書き込み」**が起こりえるためです。`tenant(id)` を通すと、
読み書きのすべてがどの Partition のものか呼び出し側のコードに現れます。

## Partition をまたぐには `tenant(id)` を呼び直す

スコープは Partition ごとに作ります。トークンやカタログは client が持つので、
`tenant(id)` は安い操作です。

```ts
const tokyo = porters.tenant(1);
const osaka = porters.tenant(2);
```

テナントごとに**カスタム項目の構成が違う**場合や、**トークンを分けたい**場合は client 自体を
分けます。使い分けは[マルチテナント][multi-tenant]にあります。

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
> `partition.current()` は**提供していません**（[ADR-0022][adr22]）。アクセスできる Partition の
> 一覧から選んでください。

## 1 つのトークンで複数 Partition を叩けるか — 未確認

このライブラリは既定で**トークンを client 単位で共有**し、`tenant(id)` は `partition=` を
差し替えるだけです。1 つの App トークンで複数の Partition にアクセスできる前提です。

**これは実機で確かめていません**（[ライブ検証][lv] LV-13）。契約環境で不都合が出たら、
Partition ごとに client を分ける形に切り替えてください — **設計は両対応**にしてあります。

## 覚えておくこと

- **`tenant(id)` を通さないと読み書きできない。** 既定の Partition は無い
- **`porters.partition` だけは client 直下。** Partition を探すための読み取り
- **`porters.auth` も client 直下。** 認証は Partition に紐づかない
- Partition をまたぐ操作は、**それぞれのスコープで**行う

## 関連

- 決定: [ADR-0055][adr55]（`tenant(id)` に束ねる）／[ADR-0008][adr8]（マルチテナント運用）
- 手順: [マルチテナント][multi-tenant]（1 プロセスで複数テナントを扱う）／[認証][authenticate]
- API 事実: [リソース一覧][res-list]（Partition は `/v1/partition`）

[adr8]: ../adr/0008-multitenancy-partition.md
[adr22]: ../adr/0022-master-read-query-surface.md
[adr55]: ../adr/0055-partition-binding-guard.md
[authenticate]: ../howto/authenticate.md
[lv]: ../live-verification.md
[multi-tenant]: ../howto/multi-tenant.md
[res-list]: ../reference/resource-api/resources-list.md
