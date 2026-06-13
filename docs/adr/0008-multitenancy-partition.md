# 8. マルチテナント運用とパーティション選択

- Status: proposed
- Date: 2026-06-13
- Deciders: （チーム議論中。提案: jun.shiromoto / Claude）

> `proposed`。本ライブラリ（L1）が**複数 PORTERS 契約企業（partition）を跨いで使われる**場合の公開面を決める。
> end-user ↔ partition のマッピングは**利用側（SaaS）の責務**で L1 には持たせない、を明確化する。

## Context and Problem Statement

本ライブラリで Web サービス（SaaS）を作ると、**1 つのアプリ（App ID/Secret）が複数の PORTERS 契約企業＝
複数 partition（Company DB）を相手にする**（[glossary][glossary]）。このとき:

- **どのエンドユーザーがどの partition か**をどう特定・制御するか。
- 認証（[ADR-0007][0007] の `TokenProvider`）と `partition` をテナント単位でどう束ねるか。

PORTERS の構造（[authentication][auth] / [gotchas][gotchas]）:

- **権限付与**は Company DB（partition）単位（顧客企業の PORTERS ユーザーがブラウザ `code` で承諾）。
- **ログイン中の partition / user** は `Partition Read` / `User Read` の **`request_type=0`** で取得できる。
- Read には `partition` パラメータが必須。

## Decision Drivers

- **薄く・堅く**: end-user↔partition のマッピングは**業務ロジック**。L1 に入れない（[requirements][prd]）。
- **マルチテナント対応**: partition をテナント単位で安全にルーティングできる。
- **オンボーディングを支える**: 権限付与時に partition を発見・保存できる手段を提供。
- **[ADR-0007][0007] と整合**: 認証ストラテジをテナント単位にもできる。

## Considered Options（partition の渡し方）

- **案1: 呼び出し毎に `partition` 指定**（＋ client 既定値）
- **案2: テナント単位のスコープ**（`porters.partition(id)` で束ねる）（推奨と併用）
- **案3: テナントごとに `PortersClient` インスタンス**（partition ＋ `TokenProvider` を固定）

## Decision Outcome

**提案: 案2 ＋ 案3 を提供（案1 を土台に）**。

- **L1 が提供するプリミティブ**:
  - `partition` を**呼び出し毎に指定**でき、**client 既定値**も持てる（[ADR-0005][0005]）。
  - **テナント単位スコープ** `const t = porters.partition(123)` → `t.candidate.search(...)`（partition を束ねる）。
  - **テナントごとに client / `TokenProvider`** を分けても良い（認証も分離したい場合）。
  - **オンボーディング補助**: `auth.authorizationUrl()` / `exchangeAuthorizationCode()`（[ADR-0007][0007]）＋
    `partition`/`user` の Read（`request_type=0`）で**ログイン中の partition を発見**。
- **L1 が持たないもの（利用側＝SaaS の責務）**:
  - **end-user ↔ 会社 ↔ partition ID のマッピング**（SaaS の DB に保存）。
  - エンドユーザー認証・セッション・認可（SaaS 側）。

### 想定フロー（SaaS 目線）

```text
オンボーディング（顧客企業ごとに一度）:
  顧客の PORTERS ユーザー → ブラウザ code 承諾 → App が Company DB を取得
  → Partition Read(request_type=0) で partition を取得 → SaaS DB に「企業↔partition」保存

リクエスト時:
  エンドユーザーが SaaS にログイン → 所属企業 → SaaS DB から partition を引く
  → porters.partition(その partition).candidate.search(...) を呼ぶ
```

## オープン質問（要検証・PoC/契約/ポーターズ確認）

- **1 つの App トークンで複数 partition を叩けるのか**（`partition` パラメータでルーティング）／
  **顧客ごとに別 App 登録が要るのか**。これにより認証の持ち方が変わる
  （共有 1 トークン＋partition 切替 vs テナント別 `TokenProvider`）。**設計は両対応にしておく**。

### Consequences

- Good: マルチテナント SaaS が partition を明示ルーティングできる。L1 は薄いまま（業務ロジック非混入）。オンボーディングで partition を発見できる。
- Bad: end-user↔partition の保存・ルーティングは SaaS の実装が必要（ドキュメントで明示）。
- Neutral: トークンと partition の関係はオープン質問の検証次第で「テナント別 client」を推奨にする可能性。

## Pros and Cons of the Options

### 案2: テナント単位スコープ（推奨）

- Good: partition を一度束ねて以後省略・取り違え事故が減る。multi-tenant で書きやすい。
- Bad: スコープ実装が要る（薄い委譲で可）。

### 案1: 呼び出し毎指定

- Good: 最小・明示的。
- Bad: 毎回 partition を渡す冗長さ・指定漏れリスク。

### 案3: テナント別 client

- Good: partition と認証を完全分離（テナント別トークンに最適）。
- Bad: インスタンス管理コスト（多テナントで多数生成）。

## More Information

- 前提/依存: [ADR-0005][0005]（partition 既定値/per-call）、[ADR-0007][0007]（`TokenProvider`）、
  [authentication][auth] / [gotchas][gotchas]（`request_type=0`）、[glossary][glossary]（Partition=Company DB）。
- 関連: [[0005-public-api-shape]], [[0007-oauth-public-surface]]。

[prd]: ../design/requirements.md
[auth]: ../reference/authentication.md
[gotchas]: ../reference/gotchas.md
[glossary]: ../reference/glossary.md
[0005]: 0005-public-api-shape.md
[0007]: 0007-oauth-public-surface.md
