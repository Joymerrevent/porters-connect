# 40. マルチテナント面 `tenant(id)` ＋ per-call `partition` の詳細設計（F-3）

- Status: proposed
- Date: 2026-06-28
- Deciders: jun.shiromoto (Joymerrevent)

> [[0008-multitenancy-partition]]（基本設計・案1 per-call ／ 案2 `tenant(id)` スコープ ／ 案3 テナント別 client）と
> [[0021-master-read-resources]]（`partition(id)` → **`tenant(id)` へ改名**）が約束した**マルチテナント公開面**を実装に落とす
> **詳細設計**。**公開面の骨子（3 つの渡し方・`tenant(id)` 命名）は ADR-0008/0021/0005 で確定済み**で再決定しない。
> 本 ADR は **per-call `partition` の引数形・`tenant(id)` の戻り形と露出範囲・partition 解決の優先順・テナント別トークン
> seam を今開くか・配置・semver** を現行コードに接地して詰める。[[0033-post-mvp-direction]] 案F-3。
> **`proposed`。下記の推奨方針は decider 承認で `accepted` とする（自己 accept しない）。実装は別 PR（ADR 先行 → 実装）。**
>
> **decider に諮る論点**: 軸1（per-call の形＝全メソッド trailing `opts` か / スコープ集約か）と
> 軸4（テナント別トークン seam を今開くか / 案3 に委ねて遅延か）。下記は推奨案。

## Context and Problem Statement

[[0008-multitenancy-partition]] は、1 つの App（App ID/Secret）が複数 partition（Company DB）を相手にする SaaS 向けに、
partition の渡し方を **3 つ**（案1 呼び出し毎指定＋client 既定／案2 テナント単位スコープ `tenant(id)`／案3 テナント別 client）
提供すると決めた（[[0021-master-read-resources]] で `partition(id)` → `tenant(id)` に改名）。**公開シェイプの意図は確定済み**だが、
**実装が未達**。横断監査（2026-06-22・[reviews][rev] RV-10）で次が判明した:

- `partition` は **構築時に固定**され（`PortersClientOptions.partition` → `deps.partition`）、`SearchQuery` / `create` / `update` /
  マスタクエリのいずれにも **per-call の `partition` 引数が無い**。
- それなのに `PortersClientOptions.partition` の JSDoc は当初「overridable per call」と謳い（現在は「not yet supported（planned — ADR-0033）」へ
  暫定訂正済み）、**存在しない機能を主張**していた（フェイルセーフ違反）。
- `porters.tenant(id)` スコープ関数は**未実装**（[basic-design][bd] §36/§82/§92/§117 が公開面として記す）。

現行コードの事実（接地）:

- `PortersClient` は `deps = { requester, host, partition: options.partition ?? 0 }` を全リソース factory に渡す
  （`src/client.ts:128-148`）。**未設定時の既定 partition は `0`**。
- データ系（`createResource`）・Attachment・マスタ User/Field/Option は **`deps.partition` を URL の `partition=` に載せる**
  （`buildReadUrl`/`buildWriteUrl`・`src/resources/resource.ts:141-162`・`attachment.ts`・`user.ts`）。
- **Partition マスタは partition を取らない**（発見専用・`request_type` のみ・`src/resources/partition.ts`）。
- 認証は `TokenProvider.getAccessToken(opts?)`（`opts` は `forceRefresh` のみ・**partition 文脈を受けない**・`src/auth/types.ts`）。
  requester は App トークンを `X-porters-hrbc-oauth-token` に載せるだけで **partition 非依存**（`src/http/requester.ts`）。
- [[0008-multitenancy-partition]] の**未検証の前提**: 「1 つの App トークンで複数 partition を叩けるか（partition でルーティング）」は
  **実機未確認**（記憶になし）。設計は**両対応**（(a) 共有トークン＋partition 切替 / (b) partition 別トークン）にせよ、と定める。

問い: **(a) per-call `partition` をどの形で渡すか**、**(b) `tenant(id)` は何を返し何を露出するか**、
**(c) partition 解決の優先順をどう実装するか**、**(d) テナント別トークンの seam を今開くか（`getAccessToken({partition})`）／案3 に委ねて遅延するか**、
**(e) どこに置くか**、**(f) 後方互換 / semver**。

## Decision Drivers

- **薄く・堅く**（[requirements][prd] / `CLAUDE.md`）: partition は各 Read/Write の **URL パラメータ**にすぎない＝薄い委譲で足りる。L1 に end-user↔partition マッピング（業務ロジック）を入れない。
- **フェイルセーフ / least surprise**: 存在しない・**未検証**の機能を型に出さない。RV-10 の JSDoc 偽宣言を**実装で解消**する。
- **ADR-0008/0021/0005・basic-design と整合**: per-call / scope / client 既定の **3 層解決**（[bd][bd] §92）と `tenant(id)` 命名（[[0021-master-read-resources]] 軸1）に一致させる。
- **非破壊**: 既存の単件呼び出し（`candidate.search(q)` 等）を壊さない。**追加のみ**で出す。
- **未検証前提に依存しない**（[[0002-ground-design-in-live-api-docs]]）: 「App トークンで複数 partition」可否（[[0008-multitenancy-partition]] オープン質問）に**結論を賭けない**設計にする。
- **既存資産の再利用**: リソース factory は既に `deps.partition` 駆動。partition 解決を**factory の内側**に寄せ、重複を作らない。
- **MCP が薄く乗る**（[[0005-public-api-shape]]）: `tenant(id)` の戻りもメソッドをそのまま tool から呼べる素直な面に保つ。

## Considered Options

### 軸1: per-call `partition` の引数形

- **案1a: 全アクセサに trailing `opts?: { partition? }`（推奨）** — `search(query?, opts?)` / `searchAll(query?, opts?)` /
  `get(id, opts?)` / `create(input, opts?)` / `update(id, input, opts?)`（マスタ・Attachment も同様）。`SearchQuery` や Write 入力（フィールドマップ）を
  **汚さず**、routing 関心を分離。ADR-0008 案1（呼び出し毎指定）と ADR-0005/basic-design「per-call で上書き可」を**字義どおり**満たし、RV-10 を完全クローズ。`tenant(id)` は本引数を**毎回事前充填する糖衣**になる。
- **案1b: read は `SearchQuery.partition` ／ write は trailing `opts`** — read だけクエリ内に partition を置く。`partition?request_type` を持つ PORTERS の素朴な形に近いが、read/write で**非対称**。`SearchQuery` に tenancy 関心が混ざる。
- **案1c: per-call 引数を設けず `tenant(id)` スコープ＋client 既定の 2 層に集約** — 「呼び出し毎の partition 選択」は `porters.tenant(p).candidate.search(q)` で達成。公開面が最小。ただし ADR-0005/basic-design の「per-call **引数**で上書き可」という字義を**満たさず**、その記述を「per-call ＝ tenant スコープ経由」へ**改める**必要（basic-design / JSDoc の reframe・decider 判断）。

### 軸2: `tenant(id)` の戻り形と露出範囲

- **案2a: partition 束ねの scoped facade（推奨）** — `porters.tenant(123)` は **partition を 123 に固定した**リソースアクセサ群
  （`candidate` / `job` / `client` / `process` / `resume` / `attachment` / `user` / `field` / `option`）を返す。**除外**: `auth`（App 単位・partition 非依存）／`partition` マスタ（発見専用・partition を取らない）／`tenant` 自身（**ネスト不可**）。
- **案2b: client 面を丸ごと複製** — `auth` 等まで含めて複製。`tenant(id).auth` 等は誤解（auth は App 単位）。露出過多・最小驚き違反。

### 軸3: partition 解決の優先順と実装

- **解決順 = `callPartition ?? scopePartition ?? clientDefault(?? 0)`**。実装は **factory 内の `deps.partition` を基準**にし、
  - `tenant(id)`：`deps` の `partition` を `id` に差し替えて**同じ factory を再実行**（scopePartition を束ねる＝既存コードの再利用・分岐ゼロ）。
  - per-call（案1a 採用時）：各メソッドの URL 組み立てで `opts?.partition ?? deps.partition` を使う（resolution を 1 箇所に集約）。
  - Partition マスタは partition を取らないため**対象外**（解決に関与しない）。

### 軸4: テナント別トークン（認証 seam を今開くか）

- **案4a: client の `TokenProvider` を共有し、テナント別トークンは案3 に委ねる（遅延・推奨）** — `tenant(id)` は client と**同じトークンプロバイダ**を使う
  ＝**(a) 共有トークン＋partition ルーティング**を実装。**(b) partition 別トークン**が要る利用者は **案3 テナント別 `PortersClient`**（partition ＋ `auth`/`tokenStore` を分離・**既存機能・実装不要**）を使う。`GetAccessTokenOptions` に `partition` は**今は足さない**。理由: 「App トークンで複数 partition」可否が[未検証][lv]で、seam を今 hard-wire すると未確定前提に依存する。両対応は「共有＝scope / 分離＝案3」で**既に満たせる**。
- **案4b: `GetAccessTokenOptions.partition` を足し requester から解決済み partition を渡す（seam を今開く）** — 既定プロバイダは無視（App 単位）、カスタムが partition 単位にトークンをキー付け可能に。ADR-0008 の「`getAccessToken({partition})`」に字義一致するが、**requester パイプラインに partition を貫通**させる改修が要り、未検証前提に設計を寄せる。partition 別キャッシュキー（[bd][bd] §143）も巻き込む。

### 軸5: 配置

- **`PortersClient` に `tenant(id)` メソッドを追加**（`src/client.ts`）。リソース factory は不変のまま `deps.partition` 差し替えで再束ね。
  per-call（案1a）採用時のみ各 factory のメソッド signature に trailing `opts` を足し、`opts?.partition ?? deps.partition` の 1 行解決を入れる。
  型は `TenantScope<C>`（露出するアクセサのみ）を新設。[[0013-coding-conventions-class-vs-function]]（factory・arrow・type）に従う。

### 軸6: 後方互換 / semver

- `tenant(id)` ＋（案1a なら）trailing `opts` は **純粋な追加**。既存呼び出しは不変。既定 partition `0` の挙動も不変。よって**非破壊 → semver minor**（`0.4.0` → `0.5.0`）。JSDoc の「not yet supported（planned）」を**実機能へ差し替え**（RV-10 クローズ）。

### 軸7: テスト

- `tenant(id)` が各リソースの URL に `partition=<id>` を載せること（data／attachment／user/field/option）。per-call（案1a）が client 既定を上書きすること・解決順（call > scope > 既定）。Partition マスタが scope の影響を受けない（除外）こと・`tenant` がネストしないこと。型テスト（露出アクセサ・除外アクセサが型に出ない）。mock transport（[[0024-mock-transport]]）結線。[[0014-test-coverage-policy]] perFile 100 / branch ≥90。

## Decision Outcome

> **`proposed`。** 下記は推奨方針（decider 承認で `accepted`・反映は accept 後）。

推奨採用: **案1a ／ 案2a ／ 軸3 の解決順 ／ 案4a（auth seam は遅延） ／ 軸5 配置 ／ 非破壊 minor ／ 軸7 テスト**。サブ決定:

- **SD-1 per-call = 案1a**。全アクセサに trailing `opts?: { partition?: PartitionId }`。`SearchQuery`・Write 入力は不変（routing と query を分離）。
- **SD-2 `tenant(id)` = 案2a**。`TenantScope<C>` は `candidate/job/client/process/resume/attachment/user/field/option` を partition 束ねで露出。`auth`・`partition` マスタ・`tenant` は**出さない**。
- **SD-3 解決順 = `call ?? scope ?? clientDefault`**。`tenant(id)` は `deps.partition` を差し替えて factory 再実行、per-call は各メソッドで `opts?.partition ?? deps.partition`。**Partition マスタは対象外**。
- **SD-4 auth = 案4a**。`tenant(id)` は client のトークンプロバイダを共有（共有トークン＋partition ルーティング）。partition 別トークンは**案3 テナント別 client**（既存・実装不要）。`GetAccessTokenOptions.partition` は今回**足さない**。「App トークンで複数 partition」可否は [live-verification][lv] 追跡（[[0008-multitenancy-partition]] オープン質問）。
- **SD-5 配置 = `client.ts` に `tenant(id)`**＋`TenantScope<C>` 型。factory は `deps.partition` 差し替えで再利用。per-call は各 factory に 1 行解決を追加。
- **SD-6 semver = minor**（非破壊・`0.4.0`→`0.5.0`）。`PortersClientOptions.partition` の JSDoc を実機能へ更新し RV-10 をクローズ。
- **SD-7 docs**。guide（マルチテナント：`tenant(id)` / per-call / 案3 テナント別 client の使い分け・end-user↔partition は SaaS 責務）＋ JSDoc、CHANGELOG（minor・追加機能）。**反映は accept 後**（[ADR 運用][adr]）。
- **SD-8 テスト = 軸7**。

### Consequences

- Good: F-3（[ADR-0033][adr33] 案F-3）を充足し、RV-10 を**実装で**クローズ。partition の 3 層解決（per-call / scope / client 既定）が basic-design と一致。非破壊で minor 出荷。未検証前提（App トークン×複数 partition）に**結論を賭けない**（両対応を維持）。
- Bad: 案1a は全アクセサの signature に trailing `opts` が増える（薄さとのトレードオフ・ただし optional で非破壊）。`TenantScope<C>` 型の追加保守。
- Neutral: テナント別トークンの seam（案4b）は**将来 follow-up**（[[0008-multitenancy-partition]] オープン質問の実機検証後）。partition 単位キャッシュキー（[bd][bd] §143）も同検証に従属。Partition マスタは partition 非依存のまま。

## Pros and Cons of the Options

### 軸1（per-call の形）

- **案1a**: Good=ADR-0008 案1／ADR-0005 を字義どおり満たす・RV-10 完全クローズ・query を汚さない・`tenant(id)` が糖衣に。Bad=signature がやや増える。
- **案1b**: Good=read は PORTERS の URL 形に近い。Bad=read/write 非対称・`SearchQuery` に tenancy 混入。
- **案1c**: Good=公開面が最小・`tenant(id)` で実質 per-call。Bad=「per-call **引数**」の字義を満たさず basic-design/JSDoc の reframe が要る。

### 軸2（`tenant(id)` の露出）

- **案2a**: Good=partition 依存アクセサだけ束ね・auth/discovery/ネストを正しく除外。Bad=`TenantScope` 型を別に持つ。
- **案2b**: Good=実装単純（丸ごと複製）。Bad=`tenant(id).auth` 等が誤解・露出過多。

### 軸4（auth seam）

- **案4a**: Good=薄い・未検証前提に賭けない・両対応を既存（scope/案3）で満たす。Bad=partition 別トークンは案3（別 client）必須＝多テナントでインスタンス増。
- **案4b**: Good=ADR-0008 の `getAccessToken({partition})` に字義一致・1 プロバイダで partition 別トークン。Bad=requester に partition 貫通＋キャッシュキー改修・未検証前提に設計を寄せる。

## More Information

- 実装する公開面の正: [[0008-multitenancy-partition]]（案1/2/3・両対応）／[[0021-master-read-resources]] 軸1（`partition(id)`→`tenant(id)` 改名）／[[0005-public-api-shape]]（per-call で上書き可・`partition` 既定）。
- 接地（コード）: `src/client.ts`（`deps.partition`）／`src/resources/resource.ts`（`buildReadUrl`/`buildWriteUrl`）／`attachment.ts`・`user.ts`・`field`・`option`（partition 利用）／`partition.ts`（partition 非送信）／`src/auth/types.ts`（`GetAccessTokenOptions`）／`src/http/requester.ts`（auth header）。
- 内部前提: [[0013-coding-conventions-class-vs-function]]（factory・arrow・type）／[[0006-error-model]]（設定ミスは `PortersConfigError`）／[[0009-http-transport]]（transport seam）／[[0012-token-cache-refresh]]（トークンキャッシュ）／[[0024-mock-transport]]（テスト）。
- 責務分離: Partition マスタ（[[0022-master-read-query-surface]]）は partition 非依存で本 ADR 対象外。
- 位置づけ: [[0033-post-mvp-direction]] 案F-3。横断監査の証拠は [reviews][rev]（RV-10）。要件は [R-4][prd]（マルチテナント面）。基本設計は [bd][bd] §7/§92/§117。
- 不確実性 → [live-verification][lv]: 「App トークンで複数 partition を partition ルーティングで叩けるか」（[[0008-multitenancy-partition]] オープン質問）。accept 後に LV エントリ追加を検討（案4b の前提）。
- 後続/対象外: 実装は別 PR（ADR 先行 → 実装の順・[[0033-post-mvp-direction]] 案F の進め方）。一括書き込み（F-4）は本 ADR 対象外。

[prd]: ../design/requirements.md
[bd]: ../design/basic-design.md
[rev]: ../reviews/2026-06-22-03.md
[lv]: ../live-verification.md
[adr]: README.md
[adr33]: 0033-post-mvp-direction.md
