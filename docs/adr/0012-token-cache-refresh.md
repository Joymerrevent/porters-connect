# 12. トークンのキャッシュ／更新機構（既定ストラテジ内部）

- Status: proposed
- Date: 2026-06-14
- Deciders: jun.shiromoto (Joymerrevent)

> [ADR-0007][0007] が認証 seam（既定＝透過 `code_direct`＋キャッシュ＋Refresh）と `TokenStore`（pluggable・既定
> インメモリ）を確定し、**single-flight・TTL・再試行は詳細設計に委譲**。本 ADR はその内部機構。`proposed`。

## Context and Problem Statement

[token][token] の通り Access Token ≒ **30 分**（1,800,000 ms）/ Refresh ≒ **2 時間**（7,200,000 ms）。
既定ストラテジ（透過）が、**いつ更新するか（失効検出）**・**並行呼び出しの制御**・**キャッシュのキー付け**を
どう実装するかを決める。失効分類は [ADR-0006][0006]（resource 401=期限切れ/402=無効、auth 400=期限切れ → 自動回復）。

## Decision Drivers

- **DX**: 普段トークンを意識しない（自動取得・自動更新）。
- **良き API 市民**: 無駄なトークン取得をしない（キャッシュ・stampede 抑止）。
- **フェイルセーフ**: 失効→自動回復、再認証が要るときは明確に `PortersAuthError`（[ADR-0006][0006]）。
- **サーバ運用**: 永続 `TokenStore` で再起動・多インスタンスに耐える（Refresh 2h 以内）。
- **[ADR-0008][0008] と整合**: キャッシュのキー付けを App 単位／partition 単位のどちらにもできる。

## Considered Options

- 失効検出: 案1 **リアクティブのみ**（401/402 受信→refresh→1 回再試行）／ 案2 **プロアクティブのみ**（TTL で事前 refresh）／ 案3 **ハイブリッド**（事前＋事後フォールバック）
- 並行制御: **single-flight**（共有 in-flight promise で同時取得/更新を 1 本化）
- キャッシュキー: App 単位（PoC）／ partition 単位（[ADR-0008][0008] の検証次第）

## Decision Outcome

**提案（推奨）: 案3 ハイブリッド**。

- **事前（proactive）**: `AccessTokenExpiresIn` から安全マージン（例: 60 秒）を引いた期限内に refresh。
- **事後（reactive）**: resource `401`/`402`（・auth `400`）受信時に refresh して**1 回だけ**自動再試行（[ADR-0006][0006] の自動回復）。
- **single-flight**: 初回 `code_direct`→Token 交換、および Refresh を**共有 in-flight promise で 1 本化**（並行呼び出しの stampede／無駄打ち防止）。
- **キャッシュキー**: PoC は **App 単位**（単一 partition）。**partition 単位**は [ADR-0008][0008] の「1 App トークンで複数 partition」検証後に確定。
- **Refresh も失効** → `PortersAuthError`（再認証が必要・`category: "auth"`）。secret/token はログ・エラーに出さない（[requirements][prd] R-11）。

### Consequences

- Good: 失効による失敗呼び出しを避ける DX。stampede なし。永続ストアで運用堅牢。
- Bad: 期限判定はサーバ時刻に依存（マージンと事後フォールバックで吸収）。
- Neutral: partition キー付けはマルチテナント検証待ち（[ADR-0008][0008] のオープン質問）。

## Pros and Cons of the Options

### 案3: ハイブリッド（推奨）

- Good: 事前で失敗呼び出しを避け、事後でクロックずれ・想定外失効にも耐える。
- Bad: 実装がやや増える（マージン＋再試行＋single-flight）。

### 案1: リアクティブのみ

- Good: 単純・常に正しい（実失効でだけ更新）。
- Bad: 約 30 分ごとに必ず 1 回は失効エラーの往復が出る（無駄打ち・遅延）。

### 案2: プロアクティブのみ

- Good: 失敗呼び出しを避けられる。
- Bad: クロックずれ・サーバ側早期失効を取りこぼす（事後フォールバックが無いと脆い）。

## More Information

- 前提/依存: [ADR-0007][0007]（認証 seam・TokenStore）、[ADR-0006][0006]（401/402/400 の自動回復）、[ADR-0008][0008]（partition キー付け）、[token][token] / [oauth][oauth]、[requirements][prd]（R-1/R-11）。
- 後続: 分散実行時の協調（多インスタンスでの single-flight）は MVP 以降で必要なら。
- 関連: [[0007-oauth-public-surface]], [[0006-error-model]], [[0008-multitenancy-partition]]。

[prd]: ../design/requirements.md
[token]: ../reference/authentication-api/token.md
[oauth]: ../reference/authentication-api/oauth.md
[0006]: 0006-error-model.md
[0007]: 0007-oauth-public-surface.md
[0008]: 0008-multitenancy-partition.md
