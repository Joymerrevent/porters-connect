# 基本設計書 — @joymerrevent/porters-connect 第1層 v1

- ステータス: draft
- 日付: 2026-06-13
- 位置づけ: [要件定義（PRD）][prd] の要件を、確定済み ADR（[0002][a2]・[0003][a3]・[0004][a4]–[0008][a8]）の決定で具体化した**全体像**。
  各決定の**根拠は ADR**、**API の事実**は [docs/reference][ref]、**SPEC_v1 は素案（superseded）**。本書は合成（重複させず ADR にリンク）。

## 1. アーキテクチャ全体像

3 層の積層設計。本書の対象は **第1層（薄いラッパー）** のみ（第2層 MCP・第3層 配布は将来）。

```text
[利用者の SaaS / スクリプト]
        │
   ┌────▼─────────────────── 第1層 @joymerrevent/porters-connect（本書） ──────────────┐
   │ PortersClient（エントリ）                                                          │
   │   ├─ auth/         TokenProvider（既定=透過 code_direct / 自前）・tokenStore        │
   │   ├─ http/         transport（注入可・既定 fetch）・headers・throttle/retry         │
   │   ├─ xml/          XML パース/シリアライズ（外に XML を漏らさない）                 │
   │   ├─ errors/       PortersError 階層（Auth/Resource/Network/Config）＋ category     │
   │   ├─ fields/       defineFields DSL（標準 P_ 静的型 ＋ カスタム U_/A_ 宣言＋検証）  │
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
  auth/               # TokenProvider・code_direct 既定戦略・TokenStore・authorizationUrl/revoke
  http/               # transport（注入 IF・既定 fetch）・headers・throttle・retry
  xml/                # parse / serialize（データ型別エンコード）
  errors/             # PortersError ＋ Auth/Resource/Network/Config・code→category マップ
  fields/             # defineFields（ビルダー）・標準 P_ 型・実行時検証
  resources/          # candidate / job / client / process / resume / attachment …（＋マスタ Read）
  types/              # 共有型
  util/datetime.ts    # PORTERS 形式 ⇄ ISO8601（UTC）
```

- **UT は co-located**：`src/xml/parser.ts` ↔ `src/xml/parser.test.ts`（vitest 既定の `**/*.test.ts`）。
  ビルド（tsup）は `src/index.ts` の依存グラフからバンドルするため `*.test.ts` は **dist/型に含まれない**。`package.json` は `dist` のみ publish。
- **モック XML フィクスチャ**：再利用する**全パターンの見本帳は集約** `test/fixtures/`（データ型別・リソース別 Read/Write・エラー系。[ADR-0002][a2]：契約が無い間は出典 XML を fixture 化し使い回す）。
  **テスト固有のカスタム（空結果・壊れ XML・特定値などのエッジケース）はテスト内に inline**（大きく/再利用しだしたら `test/fixtures/` へ昇格）。各所 `__fixtures__/` は作らない。

## 3. 公開 API の全体像（[ADR-0005][a5]）

```ts
const porters = new PortersClient({
  host, // 必須（PORTERS_HOST 経由・ハードコード禁止）。代表値 api-hrbc-jp.porterscloud.com は参考
  appId,
  appSecret,
  scopes: ["candidate_r", "candidate_w", "user_r", "option_r"],
  partition, // 既定 partition（マルチテナントは porters.tenant(id) で束ねる・ADR-0040）
  fields: myFields, // defineFields の宣言（任意）
  tokenStore,
  transport, // 任意（注入）
});

const page = await porters.candidate.search({
  field,
  condition,
  order,
  keywords, // フリーワード（Option 型項目は対象外）
  itemstate, // 状態フィルタ。delete API は無く、削除済みは itemstate で Read
  count,
  start,
});
const one = await porters.candidate.get(id);
await porters.candidate.create(input); // P_Id=-1 は内部付与
await porters.candidate.update(id, input); // delete は無い
for await (const c of porters.candidate.searchAll({ condition })) {
  /* 200件刻み自動 */
}

const t = porters.tenant(123); // マルチテナント・スコープ（ADR-0008／改名 ADR-0021／実装 ADR-0040）
```

- アクセサ＝名前空間型付き。返り値は型付きオブジェクト（XML 非露出）。エラーは throw（§6 エラーモデル）。

## 4. リクエストのライフサイクル

```text
accessor 呼び出し
  → 入力検証（fields/クエリ。不正は PortersConfigError を同期 throw）
  → partition 解決（tenant スコープ / client 既定の 2 層・ADR-0040）
  → トークン取得（TokenProvider：既定は code_direct＋キャッシュ、失効時 Refresh）
  → リクエスト組み立て（Read=クエリ / Write=XML、サイズ ~15000字 ガード）
  → transport 送信（自前スロットリングで分散、retryable は指数バックオフ）
  → レスポンス XML をパース → 型付きオブジェクトへ
  → フィールド検証（宣言と突き合わせ。未知/不一致は安全側へ）
  → 成功: 型付き結果 ／ 失敗: PortersError(category/code/retryable/hint)
```

## 5. ドメイン／型モデル（[ADR-0004][a4]）

- **標準 `P_` = 同梱の静的型**（[docs/reference][ref] から生成可）。**カスタム `U_`/`A_` = 利用者が宣言（builder）→ 型導出＋実行時検証**。
- Read/Write で表現が非対称（Option/参照/User/Link/Image）。**値エンコードの詳細は XML パース/シリアライズ ADR（詳細設計）**。
- 未宣言/未知項目はクラッシュさせず安全側（§6 エラーモデル）。

## 6. エラーモデルとフェイルセーフ（[ADR-0006][a6]）

- 基底 `PortersError` ＋ 系統別 **`PortersAuthError` / `PortersResourceError` / `PortersNetworkError` / `PortersConfigError`**（`instanceof`）。
- 横断軸 `category`（auth/permission/validation/notFound/conflict/rateLimit/transient/network/server/config/unknown）＋ `retryable` ＋ `hint`。
- トークン期限切れは内部で自動回復。設定ミスは同期 throw（Config）。未知は `unknown`・非リトライ。**握り潰さない**。

## 7. 認証 & マルチテナント（[ADR-0007][a7] / [ADR-0008][a8]）

- **認証ストラテジ seam**：既定＝透過（`code_direct`＋キャッシュ＋Refresh）／自前 `TokenProvider`。`connect()` は不要（任意 `ensureAuthenticated()`）。
- **初回権限付与**（ブラウザ `code`・人間）は前提手順。補助 `authorizationUrl()` / `exchangeAuthorizationCode()` / `revoke()`。
- **マルチテナント**：partition は **`porters.tenant(id)` スコープ**（旧称 `partition(id)`・改名 ADR-0021・実装 ADR-0040 案1c）で束ね、未束ねの呼び出しは **client 既定 partition**。完全分離は**テナント別 client**。per-call 引数は設けない（解決は scope ／ client 既定の 2 層）。認証は**両対応**（共有トークン＋partition 切替＝scope／partition 別トークン＝テナント別 client）。
- **オンボーディング補助（L1 が提供）**：`authorizationUrl()` で初回権限付与に誘導し、`Partition Read` / `User Read`（`request_type=0`）でログイン中 partition を**発見**できる。
- **end-user ↔ partition のマッピングは利用側（SaaS）の責務**。発見した partition の保存・ルーティングは SaaS。L1 は持たない。

## 8. 横断方針

- **良き API 市民／フェイルセーフ**：自前スロットリング（1 分 Read2000/Write500）、retryable のみ指数バックオフ、リクエスト ~15000 字ガード。
  - ※ 数値は理解のための目安。**正典は [docs/reference][ref]**（サイズは将来 16KB 化を検討中＝追従する）。
- **日時**：ISO 8601（UTC, `...Z`）に正規化。業務 TZ 変換はしない（[PRD R-10][prd]）。
- **秘匿情報**：App ID/Secret/トークンをログ・エラーに出さない。ホストは `PORTERS_HOST` 経由でハードコード禁止。
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
- API 事実: [docs/reference][ref]

[prd]: requirements.md
[adr]: ../adr/README.md
[ref]: ../reference/README.md
[a2]: ../adr/0002-ground-design-in-live-api-docs.md
[a3]: ../adr/0003-add-attachment-to-mvp.md
[a4]: ../adr/0004-field-type-model.md
[a5]: ../adr/0005-public-api-shape.md
[a6]: ../adr/0006-error-model.md
[a7]: ../adr/0007-oauth-public-surface.md
[a8]: ../adr/0008-multitenancy-partition.md
[a9]: ../adr/0009-http-transport.md
[a10]: ../adr/0010-retry-throttle.md
[a11]: ../adr/0011-xml-parse-serialize.md
[a12]: ../adr/0012-token-cache-refresh.md
