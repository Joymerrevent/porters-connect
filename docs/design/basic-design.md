# 基本設計書 — @joymerrevent/porters-connect 第1層 v1

- ステータス: draft
- 日付: 2026-06-13
- 位置づけ: [要件定義（PRD）][prd] の要件を、確定済み ADR（[0002][a2]・[0003][a3]・[0004][a4]–[0008][a8]）の決定で具体化した**全体像**。
  各決定の**根拠は ADR**、**API の事実**は [docs/usage/reference][ref]、**SPEC_v1 は素案（superseded）**。本書は合成（重複させず ADR にリンク）。

## 1. アーキテクチャ全体像

3 層の積層設計。本書の対象は **第1層（薄いラッパー）** のみ（第2層 MCP・第3層 配布は将来）。

```text
[利用者の SaaS / スクリプト]
        │
   ┌────▼─────────────────── 第1層 @joymerrevent/porters-connect（本書） ──────────────┐
   │ PortersClient（エントリ）                                                          │
   │   ├─ auth/         取得 tokenProvider・保存 tokenStore・管理 token manager          │
   │   ├─ http/         transport（注入可・既定 fetch）・headers・throttle/retry         │
   │   ├─ xml/          XML パース/シリアライズ（外に XML を漏らさない）                 │
   │   ├─ errors/       PortersError 階層（Auth/Resource/Network/Config）＋ category     │
   │   ├─ fields/       defineFields DSL（標準 P_ 静的型 ＋ カスタム U_/A_ 宣言＋検証）  │
   │   ├─ accessor/     アクセサを組み立てる共通の仕組み（Read・クエリ・展開・一括）    │
   │   ├─ resources/    リソース別アクセサ（candidate.search/get/create/update …）      │
   │   └─ util/         datetime（PORTERS 形式 ⇄ ISO8601）ほか                           │
   └───────────────────────────────────────────────────────────────────────────────────┘
        │ HTTPS（XML）
   [PORTERS Connect API：Authentication API / Resource API]
```

第2層 MCP は本層のアクセサを**そのまま内部呼び出し**できる形にする（ロジック重複なし。[ADR-0005][a5]）。

## 2. モジュール構成（`src/`）とテスト配置

```text
src/
  index.ts            # public export（ここからのみ公開）
  client.ts           # PortersClient・porters.tenant(id) スコープ
  porters/            # PORTERS が決めた値と定義表（上限・Data Type・Field Type・Resource List 等）。何も import しない
  errors/             # PortersError ＋ Auth/Resource/Network/Config・code→category マップ
  util/               # 他のモジュールに依存しない関数と型（datetime：PORTERS 形式 ⇄ ISO8601（UTC）・alias の接頭辞・汎用の型ほか）
  xml/                # parse / serialize（データ型別エンコード）
  http/               # transport（注入 IF・既定 fetch）・headers・throttle・backoff・アクセスポイント
  auth/               # TokenProvider（取得）・既定の code_direct・token manager（管理）・TokenStore・porters.auth
  accessor/           # アクセサを組み立てる共通の仕組み（データ系の data-resource・マスタの master-resource と、共有の読み込み・書き込みの部品）
  resources/          # candidate / job / client / process / resume / attachment …（＋マスタ Read）
  fields/             # defineFields（ビルダー）・テナントの項目を読む道具・実行時検証
```

`src/` のフォルダとファイルは、次のルールで置く。根拠は各 ADR にあり、ここはその要約である。

### フォルダと依存の向き

- **フォルダは責務の境界**。上の一覧のモジュールがそれぞれ 1 つの責務を持つ。
- **層**（[ADR-0097][a97] / [ADR-0098][a98] / [ADR-0101][a101]）：上の一覧の順（`porters` → `errors` → `util` → `xml` →
  `http` → `auth` → `accessor` → `resources` → `fields` → 直下）に下から並ぶ。各モジュールは自分より下の層だけを import する
  （`accessor` と `resources` は `auth` を使わない）。
- `porters/` は PORTERS が決めた値と定義表だけを持ち、判断や検査のコードは置かない。何も import しない。
- 層と向きは eslint の `no-restricted-imports` で止める（テストは対象外）。

### ファイル

- **1 ファイル 1 責務**・ファイル名は **kebab-case**（[ADR-0013][a13]。大文字小文字を区別しない FS での import 事故を避ける）。
- **1 ファイルに主な export は 1 つ**。ファイル名はその名前を kebab-case にしたもの（[ADR-0097][a97] / [ADR-0101][a101]）。
  factory の `create` は付けても付けなくてもよい（`createTokenManager` → `token-manager.ts` でも `create-token-manager.ts` でもよい）。
  その export の引数・戻り値・設定にだけ使う型は、同じファイルに置いてよい（例: `createDataReader` と `DataReadConfig`）。
- **まとめてよいのは次の例外だけ**。例外のファイルは役割を表す名前にする（[ADR-0101][a101]）。
  - 対になる関数（変換と逆変換のように、片方を直すともう片方も直すもの。例: `util/alias.ts` の `qualify` / `bareAlias`）
  - 一緒に使う型の集まり（1 つの概念を複数の型で表すもの。例: 検索クエリの `Condition` / `Order` / `SearchQuery`）
  - PORTERS が決めた値の表（`porters/` の中。[ADR-0098][a98]）
- **フォルダ名と重なる語は付けない**（`accessor/` の中に `-accessor` を付けない。[ADR-0097][a97]）。
- **`index.ts` はバレル**（`export *` / `export type *` の再 export だけ）。宣言は名前の付いたファイルに置き、
  モジュールの中で公開するかどうかは、そのファイルの `export` の有無で決める（[ADR-0013][a13]）。
- **パッケージの公開 API は `src/index.ts` の明示 export だけ**。モジュールをまたいで見えても npm に出さない記号があるので、
  ここだけはバレルにせず選んで export する。
- どのモジュールにも属さない型だけの部品は `util/types.ts` に置く。

### テスト

- **UT は co-located**：実装の隣に 1 対 1 で置く（`src/xml/parser.ts` ↔ `src/xml/parser.test.ts`。vitest 既定の `**/*.test.ts`）。
  型だけのファイル（実行されるコードを持たないもの）には置かない。
  ビルド（tsup）は `src/index.ts` の依存グラフからバンドルするため `*.test.ts` は **dist/型に含まれない**。`package.json` は `dist` のみ publish。
- **モック XML フィクスチャ**：再利用する**全パターンの見本帳は集約** `test/fixtures/`（データ型別・リソース別 Read/Write・エラー系。[ADR-0002][a2]：契約が無い間は出典 XML を fixture 化し使い回す）。
  **テスト固有のカスタム（空結果・壊れ XML・特定値などのエッジケース）はテスト内に inline**（大きく/再利用しだしたら `test/fixtures/` へ昇格）。各所 `__fixtures__/` は作らない。

## 3. 公開 API の全体像（[ADR-0005][a5]）

```ts
const porters = new PortersClient({
  hostname, // 必須（PORTERS_HOST 経由・ハードコード禁止）。サーバー名のみ（ADR-0078）
  port, // 任意。ローカルのフェイク等でのみ。PORTERS には要らない（ADR-0078）
  scheme: "https", // 既定。"http" はローカルのフェイク等でのみ・毎プロセス警告（ADR-0047）
  appId,
  appSecret,
  scopes: ["candidate_r", "candidate_w", "user_r", "option_r"],
  tokenStore, // 任意（注入）
  transport, // 任意（注入・既定は createFetchTransport）
});
// partition は tenant(id) だけで束ねる（ADR-0055）。その partition のカスタム項目の宣言も
// ここで渡す（ADR-0087・任意）— カスタム項目は partition ごとのものなので client には置かない
const t = porters.tenant(1, { fields: myFields });

const page = await t.candidate.search({
  field: ["P_Id", "P_Name"],
  condition: { P_Name: { part: "山田" } },
  order: [{ P_Id: "desc" }],
  keywords: ["山田"], // フリーワード（Option 型項目は対象外）
  itemstate: "existing", // 状態フィルタ。delete API は無く、削除済みは itemstate で Read
  count: 200,
  start: 0,
});
const one = await t.candidate.get(id);
await t.candidate.create({ P_Owner: 5, P_Name: "山田 太郎" }); // P_Id=-1 は内部付与
await t.candidate.update(id, { P_Name: "山田 花子" }); // delete は無い
for await (const c of t.candidate.searchAll({
  condition: { P_Owner: { eq: 5 } },
})) {
  /* 200件刻み自動 */
}

// PORTERS が `resource=` を URL で要求するものは of() で 1 回束ねる（ADR-0080 / ADR-0081）
await t.phase.of("client").search({ condition: { ResourceId: { eq: 20001 } } });
await t.field.of("candidate").search({ active: 1 });
await t.attachment.of("resume").get(id); // 添付の本体は get だけ（ADR-0075）
```

- アクセサ＝名前空間型付き。返り値は型付きオブジェクト（XML 非露出）。エラーは throw（§6 エラーモデル）。
- **partition を取るアクセサは `tenant(id)` の下にしか生えない**（[ADR-0055][a55]）。未束縛のまま
  呼ぶという状態を型で存在させない＝ガードではなく設計で防ぐ。

## 4. リクエストのライフサイクル

```text
accessor 呼び出し
  → 入力検証（fields/クエリ。不正は PortersConfigError を同期 throw）
  → partition 解決（tenant(id) スコープの 1 層のみ・ADR-0040 / ADR-0055）
  → トークン取得（token manager：キャッシュ・期限の判断・失効時の取り直し。取得は tokenProvider、既定は code_direct）
  → リクエスト組み立て（Read=クエリ / Write=XML、サイズ ~15000字 ガード）
  → transport 送信（自前スロットリングで分散、retryable は指数バックオフ）
  → レスポンス XML をパース → 型付きオブジェクトへ
  → フィールド検証（宣言と突き合わせ。未知/不一致は安全側へ）
  → 成功: 型付き結果 ／ 失敗: PortersError(category/code/retryable/hint)
```

## 5. ドメイン／型モデル（[ADR-0004][a4]）

- **標準 `P_` = 同梱の静的型**（[docs/usage/reference][ref] から生成可）。**カスタム `U_`/`A_` = 利用者が宣言（builder）→ 型導出＋実行時検証**。
- Read/Write で表現が非対称（Option/参照/User/Link/Image）。**値エンコードの詳細は XML パース/シリアライズ ADR（詳細設計）**。
- 未宣言/未知項目はクラッシュさせず安全側（§6 エラーモデル）。

## 6. エラーモデルとフェイルセーフ（[ADR-0006][a6]）

- 基底 `PortersError` ＋ 系統別 **`PortersAuthError` / `PortersResourceError` / `PortersNetworkError` / `PortersConfigError`**（`instanceof`）。
- 横断軸 `category`（auth/permission/validation/notFound/conflict/rateLimit/transient/network/server/config/unknown）＋ `retryable` ＋ `hint`。
- トークン期限切れは内部で自動回復。設定ミスは同期 throw（Config）。未知は `unknown`・非リトライ。**握り潰さない**。

## 7. 認証 & マルチテナント（[ADR-0007][a7] / [ADR-0008][a8]）

- **認証の差し替え口**：取得（`tokenProvider`・`{ acquire, refresh?, exchange? }`・既定は `code_direct`）と保存（`tokenStore`・既定はインメモリ）を
  別々に受け、キャッシュ・期限の判断・更新・同時呼び出しの 1 本化はクライアントが受け持つ（[ADR-0091][a91]）。`connect()` は不要（任意 `ensureAuthenticated()`）。
- **初回権限付与**（ブラウザ `code`・人間）は前提手順。補助 `authorizationUrl()` / `exchangeAuthorizationCode()` / `revoke()`。
- **マルチテナント**：partition は **`porters.tenant(id)` スコープ**（旧称 `partition(id)`・改名 ADR-0021・実装 ADR-0040 案1c）で束ね、未束ねの呼び出しは **client 既定 partition**。完全分離は**テナント別 client**。per-call 引数は設けない（解決は scope ／ client 既定の 2 層）。認証は**両対応**（共有トークン＋partition 切替＝scope／partition 別トークン＝テナント別 client）。
- **オンボーディング補助（L1 が提供）**：`authorizationUrl()` で初回権限付与に誘導し、`Partition Read` / `User Read`（`request_type=0`）でログイン中 partition を**発見**できる。
- **end-user ↔ partition のマッピングは利用側（SaaS）の責務**。発見した partition の保存・ルーティングは SaaS。L1 は持たない。

## 8. 横断方針

- **上限内に自制する／フェイルセーフ**：自前スロットリング（1 分 Read2000/Write500）、retryable のみ指数バックオフ、リクエスト ~15000 字ガード。
  - ※ 数値は理解のための目安。**正典は [docs/usage/reference][ref]**（サイズは将来 16KB 化を検討中＝追従する）。
- **日時**：ISO 8601（UTC, `...Z`）に正規化。業務 TZ 変換はしない（[PRD R-10][prd]）。
- **機密情報**：App ID/Secret/トークンをログ・エラーに出さない。ホストは `PORTERS_HOST` 経由でハードコード禁止。
  - **アクセスポイント**：URL 組立は 1 関数（`http/access-point.ts`）に集約。scheme の既定は `https`、`http` は明示時のみで毎プロセス 1 回警告し、
    抑止は専用 env のみ（許可と沈黙は別・[ADR-0047][a47]）。
- **バージョン**：`X-P-ConnectAPI-Version: 2` を既定送信。対応バージョンを README/コードに明記。
- **言語**：公開サーフェスは英語、内部コメントは日本語可（CLAUDE.md）。

## 9. 詳細設計（ADR で確定 ／ 実装・MVP へ）

**確定（実装はこれらに従う）**：

- HTTP トランスポート＝既定 `fetch`（[ADR-0009][a9]）。切替影響は `Transport` seam 1 点。
- XML パース/シリアライズの内部＝型駆動デコーダ・パーサは素の文字列・Read/Write 非対称（[ADR-0011][a11]）。
- リトライ/スロットリングの機構＝token-bucket＋指数バックオフ・**冪等性ガード**（[ADR-0010][a10]）。
- トークンのキャッシュ/更新＝ハイブリッド（遅延オンデマンド＋事後）＋ in-process single-flight（[ADR-0012][a12]）。

**実装フェーズ／MVP で詰める**：

- Attachment のファイル本体（Base64/バイナリ）のエンコードと送受信形式（[ADR-0003][a3]／[ADR-0011][a11] 後続）。
- 全 Write エンコードの型別網羅・Image/Link/Reference・Option 複数（[ADR-0011][a11] 後続）。
- 多インスタンスの refresh 協調・partition 単位キャッシュキー（[ADR-0012][a12]／[ADR-0008][a8] 検証後）。

## 関連

- 要件: [requirements.md][prd]
- 決定（基本設計）: [ADR 一覧][adr]（[0003][a3] Attachment MVP / [0004][a4] 型モデル / [0005][a5] 公開API / [0006][a6] エラー / [0007][a7] OAuth / [0008][a8] マルチテナント）
- 決定（詳細設計）: [0009][a9] HTTP / [0010][a10] リトライ・スロットル / [0011][a11] XML / [0012][a12] トークン更新
- API 事実: [docs/usage/reference][ref]

[prd]: requirements.md
[adr]: ../adr/README.md
[ref]: ../usage/reference/README.md
[a2]: ../adr/0002-ground-design-in-live-api-docs.md
[a3]: ../adr/0003-add-attachment-to-mvp.md
[a4]: ../adr/0004-field-type-model.md
[a5]: ../adr/0005-public-api-shape.md
[a6]: ../adr/0006-error-model.md
[a7]: ../adr/0007-oauth-public-surface.md
[a8]: ../adr/0008-multitenancy-partition.md
[a55]: ../adr/0055-partition-binding-guard.md
[a9]: ../adr/0009-http-transport.md
[a10]: ../adr/0010-retry-throttle.md
[a11]: ../adr/0011-xml-parse-serialize.md
[a12]: ../adr/0012-token-cache-refresh.md
[a13]: ../adr/0013-coding-conventions-class-vs-function.md
[a47]: ../adr/0047-access-point-scheme.md
[a91]: ../adr/0091-token-provider-and-store.md
[a97]: ../adr/0097-src-module-layout.md
[a98]: ../adr/0098-porters-rules-folder.md
[a101]: ../adr/0101-accessor-layer-and-file-names.md
