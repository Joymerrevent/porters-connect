# 40. マルチテナント面 `tenant(id)` スコープの詳細設計（F-3）

- Status: proposed
- Date: 2026-06-28
- Deciders: jun.shiromoto (Joymerrevent)

> [[0008-multitenancy-partition]]（基本設計・案1 per-call ／ 案2 `tenant(id)` スコープ ／ 案3 テナント別 client）と
> [[0021-master-read-resources]]（`partition(id)` → **`tenant(id)` へ改名**）が約束した**マルチテナント公開面**を実装に落とす
> **詳細設計**。**公開面の骨子（3 つの渡し方・`tenant(id)` 命名）は ADR-0008/0021/0005 で確定済み**で再決定しない。
> 本 ADR は **partition の渡し方（per-call 引数 か `tenant(id)` スコープ集約 か）・`tenant(id)` の戻り形と露出範囲・
> partition 解決・テナント別トークン seam を今開くか・配置・semver** を現行コードに接地して詰める。[[0033-post-mvp-direction]] 案F-3。
> **`proposed`。実装は別 PR（ADR 先行 → 実装）。自己 accept しない。**
>
> **decider 決定（2026-06-29）**: 軸1＝**案1c**（per-call 引数を設けず `tenant(id)` スコープ＋client 既定の 2 層に集約）、
> 軸4＝**案4a**（テナント別トークン seam は遅延・案3 と scope で両対応）。下記 Decision Outcome に反映済み。**status を `accepted` へ
> 進める最終承認待ち**（accepted ADR は以後書き換えないため、確定面を decider が最終確認する）。

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
- **ADR-0008/0021/0005・basic-design と整合**: partition 解決（[bd][bd] §92）と `tenant(id)` 命名（[[0021-master-read-resources]] 軸1）に一致させる。案1c 採用で解決は **scope ／ client 既定の 2 層**へ単純化（basic-design の「per-call 引数」記述は「per-call＝tenant スコープ経由」へ reframe）。
- **非破壊**: 既存の単件呼び出し（`candidate.search(q)` 等）を壊さない。**追加のみ**で出す。
- **未検証前提に依存しない**（[[0002-ground-design-in-live-api-docs]]）: 「App トークンで複数 partition」可否（[[0008-multitenancy-partition]] オープン質問）に**結論を賭けない**設計にする。
- **既存資産の再利用**: リソース factory は既に `deps.partition` 駆動。partition 解決を**factory の内側**に寄せ、重複を作らない。
- **MCP が薄く乗る**（[[0005-public-api-shape]]）: `tenant(id)` の戻りもメソッドをそのまま tool から呼べる素直な面に保つ。

## Considered Options

### 軸1: per-call `partition` の引数形

- **案1c: per-call 引数を設けず `tenant(id)` スコープ＋client 既定の 2 層に集約（採用）** — 「呼び出し毎の partition 選択」は `porters.tenant(p).candidate.search(q)` で達成。公開面が最小（全アクセサの signature を増やさない）。解決層が 2 つ＝優先順という分岐を持たず**フェイルセーフ**。境界（`tenant(123)`）で partition を明示し、ハンドルが運ぶ（DB トランザクションハンドル／スコープ付きロガーと同型の「境界で明示・下流で持ち回り」）。リクエストスコープのマルチテナント SaaS で主流（GitHub Apps の installation client／Twilio subaccount／Mongo `db().collection()` と同じ idiom）。代償は ADR-0005/basic-design の「per-call **引数**で上書き可」を「per-call ＝ tenant スコープ経由」へ**改める** doc reframe のみ（能力の喪失ではない）。
- **案1a: 全アクセサに trailing `opts?: { partition? }`** — `search(query?, opts?)` / `get(id, opts?)` / `create(input, opts?)` 等（マスタ・Attachment も同様）。ADR-0008 案1（呼び出し毎指定）を字義どおり満たすが、全アクセサ × 各メソッドに optional 引数が増え（context を引き回す匂い）、解決が 3 層（`call ?? scope ?? 既定`）に。partition が**同一フロー内で 1 呼び出しごとに変わる**用途では有利だが、その場合も `tenant(p)` をループで作れば安く等価。
- **案1b: read は `SearchQuery.partition` ／ write は trailing `opts`** — read だけクエリ内に partition を置く。`partition?request_type` を持つ PORTERS の素朴な形に近いが、read/write で**非対称**。`SearchQuery` に tenancy 関心が混ざる。

### 軸2: `tenant(id)` の戻り形と露出範囲

- **案2a: partition 束ねの scoped facade（推奨）** — `porters.tenant(123)` は **partition を 123 に固定した**リソースアクセサ群
  （`candidate` / `job` / `client` / `process` / `resume` / `attachment` / `user` / `field` / `option`）を返す。**除外**: `auth`（App 単位・partition 非依存）／`partition` マスタ（発見専用・partition を取らない）／`tenant` 自身（**ネスト不可**）。
- **案2b: client 面を丸ごと複製** — `auth` 等まで含めて複製。`tenant(id).auth` 等は誤解（auth は App 単位）。露出過多・最小驚き違反。

### 軸3: partition 解決と実装

- **解決 = `scopePartition ?? clientDefault(?? 0)`（案1c 採用で 2 層）**。実装は **factory 内の `deps.partition` を基準**にし、
  - `tenant(id)`：`deps` の `partition` を `id` に差し替えて**同じ factory を再実行**（scope を束ねる＝既存コードの再利用・分岐ゼロ・メソッド signature 不変）。
  - 単件呼び出し（`porters.candidate.*`）：client 既定 `deps.partition`（未設定なら `0`）。
  - Partition マスタは partition を取らないため**対象外**（解決に関与しない）。
  - （案1a を採れば `opts?.partition ?? deps.partition` の per-call 層が加わり 3 層になる。案1c では持たない。）

### 軸4: テナント別トークン（認証 seam を今開くか）

- **案4a: client の `TokenProvider` を共有し、テナント別トークンは案3 に委ねる（遅延・推奨）** — `tenant(id)` は client と**同じトークンプロバイダ**を使う
  ＝**(a) 共有トークン＋partition ルーティング**を実装。**(b) partition 別トークン**が要る利用者は **案3 テナント別 `PortersClient`**（partition ＋ `auth`/`tokenStore` を分離・**既存機能・実装不要**）を使う。`GetAccessTokenOptions` に `partition` は**今は足さない**。理由: 「App トークンで複数 partition」可否が[未検証][lv]で、seam を今 hard-wire すると未確定前提に依存する。両対応は「共有＝scope / 分離＝案3」で**既に満たせる**。
- **案4b: `GetAccessTokenOptions.partition` を足し requester から解決済み partition を渡す（seam を今開く）** — 既定プロバイダは無視（App 単位）、カスタムが partition 単位にトークンをキー付け可能に。ADR-0008 の「`getAccessToken({partition})`」に字義一致するが、**requester パイプラインに partition を貫通**させる改修が要り、未検証前提に設計を寄せる。partition 別キャッシュキー（[bd][bd] §143）も巻き込む。

### 軸5: 配置

- **`PortersClient` に `tenant(id)` メソッドを追加**（`src/client.ts`）。リソース factory は**完全に不変**で、`deps.partition` を `id` に差し替えて再束ねるだけ（案1c のためメソッド signature の改修は不要）。
  型は `TenantScope<C>`（露出するアクセサのみ）を新設。[[0013-coding-conventions-class-vs-function]]（factory・arrow・type）に従う。

### 軸6: 後方互換 / semver

- `tenant(id)` は **純粋な追加**。既存呼び出しは不変。既定 partition `0` の挙動も不変。よって**非破壊 → semver minor**（`0.4.0` → `0.5.0`）。`PortersClientOptions.partition` の JSDoc の「not yet supported（planned）」を **`tenant(id)` 経由のルーティングを案内する記述へ差し替え**（RV-10 クローズ）。

### 軸7: テスト

- `tenant(id)` が各リソースの URL に `partition=<id>` を載せること（data／attachment／user/field/option）。`tenant(id)` が client 既定を上書きすること（解決＝scope > 既定）。Partition マスタが scope の影響を受けない（除外）こと・`tenant` がネストしないこと。型テスト（露出アクセサが型に出る・除外アクセサ（`auth`/`partition`/`tenant`）が `TenantScope` に出ない）。mock transport（[[0024-mock-transport]]）結線。[[0014-test-coverage-policy]] perFile 100 / branch ≥90。

## Decision Outcome

> **decider 決定（2026-06-29）に基づく確定方針（status を `accepted` へ進める最終承認待ち）。** 反映（basic-design/JSDoc/CHANGELOG・実装）は accept 後。

採用: **案1c ／ 案2a ／ 軸3 の 2 層解決 ／ 案4a（auth seam は遅延） ／ 軸5 配置 ／ 非破壊 minor ／ 軸7 テスト**。サブ決定:

- **SD-1 partition の渡し方 = 案1c**。per-call の引数は**設けない**。partition は **`tenant(id)` スコープ ＋ client 既定**の 2 経路で決まる。単一テナント＝コンストラクタ `partition`＋`porters.candidate.*`、マルチテナント＝`porters.tenant(p).candidate.*`。アクセサの signature は不変。
- **SD-2 `tenant(id)` = 案2a**。`TenantScope<C>` は `candidate/job/client/process/resume/attachment/user/field/option` を partition 束ねで露出。`auth`・`partition` マスタ・`tenant` は**出さない**（partition 非依存・発見専用・ネスト不可）。
- **SD-3 解決 = `scope ?? clientDefault(?? 0)`（2 層）**。`tenant(id)` は `deps.partition` を `id` に差し替えて factory 再実行。単件呼び出しは client 既定。**Partition マスタは対象外**。
- **SD-4 auth = 案4a**。`tenant(id)` は client のトークンプロバイダを共有（共有トークン＋partition ルーティング）。partition 別トークンは**案3 テナント別 client**（既存・実装不要）。`GetAccessTokenOptions.partition` は今回**足さない**。「App トークンで複数 partition」可否は [live-verification][lv] 追跡（[[0008-multitenancy-partition]] オープン質問）。
- **SD-5 配置 = `client.ts` に `tenant(id)`**＋`TenantScope<C>` 型。リソース factory は**不変**（`deps.partition` 差し替えで再利用）。
- **SD-6 semver = minor**（非破壊・`0.4.0`→`0.5.0`）。`PortersClientOptions.partition` の JSDoc を `tenant(id)` 経由ルーティングの案内へ更新し RV-10 をクローズ。
- **SD-7 docs**。basic-design の reframe（§60「per-call で上書き可」→「マルチテナントは `tenant(id)` スコープ」・§92 の解決を 2 層へ）、guide（マルチテナント：`tenant(id)` スコープ／単一テナント既定／案3 テナント別 client の使い分け・end-user↔partition は SaaS 責務）＋ JSDoc、CHANGELOG（minor・追加機能）。roadmap の F-3 表記（「＋ per-call partition」）も更新。**反映は accept 後**（[ADR 運用][adr]）。
- **SD-8 テスト = 軸7**。

### Consequences

- Good: F-3（[ADR-0033][adr33] 案F-3）を充足し、RV-10 を**実装で**クローズ。公開面が最小（アクセサ signature 不変）で解決が 2 層＝分岐が少なくフェイルセーフ。リクエストスコープのマルチテナント SaaS で主流の idiom（GitHub Apps installation client 等）。非破壊で minor 出荷。未検証前提（App トークン×複数 partition）に**結論を賭けない**（両対応を維持）。
- Bad: ADR-0005/basic-design の「per-call **引数**で上書き可」を「per-call＝`tenant(id)` スコープ経由」へ reframe する doc 編集が要る（能力の喪失ではない）。partition が 1 呼び出しごとに変わる用途は `tenant(p)` をその都度作る（安価だが per-call 引数よりは明示的に再束ね）。`TenantScope<C>` 型の追加保守。
- Neutral: テナント別トークンの seam（案4b）は**将来 follow-up**（[[0008-multitenancy-partition]] オープン質問の実機検証後）。partition 単位キャッシュキー（[bd][bd] §143）も同検証に従属。Partition マスタは partition 非依存のまま。

## Pros and Cons of the Options

### 軸1（partition の渡し方）

- **案1c（採用）**: Good=公開面が最小（signature 不変）・解決 2 層で分岐が少なくフェイルセーフ・`tenant(id)` で実質 per-call・リクエストスコープ SaaS の主流 idiom・context 引き回しの匂いを断つ。Bad=「per-call **引数**」の字義を満たさず basic-design/JSDoc の reframe が要る・partition が呼び出し毎に変わる用途は `tenant(p)` を都度生成。
- **案1a**: Good=ADR-0008 案1／ADR-0005 を字義どおり満たす・呼び出し毎に変わる用途で局所的。Bad=全アクセサ × 各メソッドに optional 引数・解決 3 層・context 引き回しの匂い。
- **案1b**: Good=read は PORTERS の URL 形に近い。Bad=read/write 非対称・`SearchQuery` に tenancy 混入。

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
