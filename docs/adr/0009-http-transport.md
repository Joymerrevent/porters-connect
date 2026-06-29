# 9. HTTP トランスポート（既定 fetch・注入可能 seam の裏側）

- Status: accepted
- Date: 2026-06-14
- Deciders: jun.shiromoto (Joymerrevent)

> [ADR-0005][0005] で「transport は注入可能・既定は fetch ベース」と外形を確定済み。本 ADR は
> **既定実装を何で作るか**（fetch / ky / …）の詳細設計。案1（fetch）で `accepted`（2026-06-14）。
> 切替の影響は `src/http` の `Transport` インターフェース 1 点に閉じる（下記 Consequences）。

## Context and Problem Statement

[ADR-0005][0005] は HTTP 層を `Transport` インターフェースで注入可能にし（モック動作＝契約なし評価・R-12）、
既定は fetch ベースとした。その**既定実装**を標準 `fetch` で書くか、`ky` 等のライブラリに乗せるかを決める。

PORTERS 固有の制約（[gotchas][gotchas] / [resource-api][rapi] / [headers][headers]）:

- **エラーは HTTP 200 のまま本文 `<Code>`/`<Error>` で返る**（成功は HTTP200 かつ `<Code>0`）。
- **レート超過は 429 でなく強制切断**（`Retry-After` も無い）。
- 独自ヘッダ（`X-porters-hrbc-oauth-token` / `X-P-ConnectAPI-Version: 2`）、Token は urlencoded。

## Decision Drivers

- **薄く・依存ゼロ**（[CLAUDE.md] 規約・フェイルセーフ）。
- **Node 18+ / ESM**（[requirements][prd] R-14）。標準 fetch が利用可能。
- **テスト容易**（Transport 注入でモック・契約不要）。
- **リトライ/スロットルは自前**（PORTERS のエラーは HTTP ステータスに出ないため、ライブラリの汎用リトライは使えない）。

## Considered Options

- 案1: 標準 `fetch`（グローバル）
- 案2: `ky`（fetch ラッパー・リトライ/フック内蔵）
- 案3: `undici` を直接
- 案4: `axios`

## Decision Outcome

**提案（推奨）: 案1 標準 `fetch`**。

決め手: PORTERS は **HTTP 200＋本文 `<Code>` でエラーを返す**ため、`ky`/`axios` の「HTTP ステータス基準の
自動リトライ・`throwHttpErrors`」は**そもそも発火せず**、リトライ要否の判定は parsed `<Code>`/系統の層で
**自前実装が不可避**（→ [リトライ/スロットリング ADR][0010]）。ならば依存を増やす旨味が小さく、
標準 `fetch` が最も薄い。タイムアウトは `AbortController`、本体は `Transport`（scaffold 済み）の裏に閉じる。

### Consequences

- Good: 依存ゼロ・Node 標準・モック容易。公開 API に HTTP 実装が漏れない。
- Good: **切替の影響は `src/http`（`Transport` インターフェース）1 点に閉じる**。既定 fetch 実装は
  別ファイル（例 `http/fetch-transport.ts`）に置き、resources/auth/xml と[リトライ/スロットル][0010]は
  **`Transport` の上位**に積む＝実装非依存。`fetch → ky → undici` の差し替えは「新実装＋既定配線の 1 箇所」だけ。
  `Transport` は素の HTTP（`body: string`）に保ち、XML 直列化・認証ヘッダ付与は上位に置く。
- Good: **企業プロキシ等は `Transport` 注入で吸収**。Node のグローバル fetch は `HTTP(S)_PROXY` を自動では
  読まないが、利用者が undici `ProxyAgent` ベースの transport を差し込める（seam の存在理由の一つ）。
- Bad: タイムアウト/中断/リトライは自前（`AbortController` / `AbortSignal.timeout()`・[ADR-0010][0010]）。
- Neutral: グローバル `fetch` は Node 18 で `ExperimentalWarning`（本リポジトリの実行は Node 22＝警告なし・安定）。
  `engines: >=18` のため Node 18 利用者には警告が出るが機能は正常。
- Neutral: ストリーミングや HTTP/2 が要るなら将来 undici 直も seam の裏で差し替え可能。

## Pros and Cons of the Options

### 案1: 標準 fetch（推奨）

- Good: 依存ゼロ・Node18+ 標準・ESM 親和・モック容易。
- Bad: リトライ/タイムアウトのユーティリティは自前。

### 案2: ky

- Good: 人間工学・タイムアウト/フックが手軽。
- Bad: 依存増。**HTTP200+`<Code>` エラーには自動リトライが効かず**、結局自前リトライが要る＝旨味が薄い。

### 案3: undici 直

- Good: 高機能・高速。
- Bad: 低レベル・記述量増。v1 には過剰。

### 案4: axios

- Good: 普及・機能豊富。
- Bad: 重い依存・CJS 寄り。HTTP ステータス前提の機能が PORTERS と噛み合わない。

## More Information

- 前提/依存: [ADR-0005][0005]（transport seam）、[headers][headers]、[gotchas][gotchas]（429 無し・強制切断）、[requirements][prd]（R-12/R-14）。
- 後続: [リトライ/スロットリング機構 ADR][0010]。
- 関連: [[0005-public-api-shape]]。

[prd]: ../design/requirements.md
[rapi]: ../reference/resource-api/README.md
[headers]: ../reference/authentication-api/headers.md
[gotchas]: ../reference/gotchas.md
[0005]: 0005-public-api-shape.md
[0010]: 0010-retry-throttle.md
