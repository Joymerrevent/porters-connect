# 24. テスト/評価用の公開モックトランスポート（`createMockTransport`）— R-17/R-12

- Status: proposed
- Date: 2026-06-18
- Deciders: jun.shiromoto (Joymerrevent)

> [requirements][prd] R-17（評価用サンドボックス）の実装面を確定する。注入可能な Transport の seam は
> [ADR-0005][0005]（公開 API・R-12）／[ADR-0009][0009]（HTTP トランスポート）で決定済み。本 ADR は
> その seam に挿す**公開モック実装**の API 形と公開面を詳細設計する。

## Context and Problem Statement

[requirements][prd] R-17 は「契約前評価を狙った、すぐ動く offline サンプル（モック前提）」を求め、これは
北極星（デファクト＝第一想起）の**評価可能性レバー**（契約なしで試せる）に直結する。

現状：`examples/offline-sandbox.ts` が**素の `Transport` を手書き**して search/get/create/attachment を
オフライン実行できる（動作確認済み）。だが、

- 利用者が**自分のコードを契約なしでテスト/評価**するには、毎回この Transport を手書きする必要がある
  （特に OAuth `/v1/oauth`＋`/v1/token` の定型 XML 応答が boilerplate）。
- 再利用可能な公開ヘルパーが無く、R-17 が「サンプル 1 本」に留まり「評価レバーの土台」になっていない。

問い: **注入 seam（`Transport`）に挿せる公開モック実装を、どの API 形・どの公開面で提供し、
認証 boilerplate をどう消すか？薄く・堅く・フェイルセーフに。**

## Decision Drivers

- **評価可能性**（R-12/R-17）: 契約なしで利用者が自分のコードを動かせる。
- **DX「簡単」**: 認証等の定型を消し、リソース XML を書くだけで動く。
- **薄く・堅く**: 依存ゼロ・最小面。XML 生成器やモックストアは持ち込まない。
- **フェイルセーフ**: 未モックのリクエストは黙って空応答にせず、何が未モックか明示する。
- **既存 seam と整合**: `createFetchTransport` と対になる `create*Transport` 命名・契約型 `Transport` を返す。

## Considered Options

API 形:

- **案1: ハンドラ関数核**＋認証自動応答 `createMockTransport((req) => xml)`（推奨）
- **案2: 宣言的ルートマップ** `createMockTransport({ candidate: { read, write }, ... })`
- **案3: 現状維持**（利用者が素の `Transport` を手書き）

公開面:

- **置き場A: メインエントリ**（`@joymerrevent/porters-connect` から `createMockTransport`）
- **置き場B: サブパス** `@joymerrevent/porters-connect/testing`

## Decision Outcome

**採用: 案1（ハンドラ関数核＋認証自動応答）＋ 置き場A（メインエントリ）**。

- **D1 API 形 = ハンドラ核**: `createMockTransport(handler, options?)`。`handler(req: TransportRequest)` が
  応答を返す。最も薄く・柔軟（ルートマップ等は利用者側で容易に組める）。`Transport` 契約型を返すので
  `new PortersClient({ transport })` にそのまま挿さる。
- **D2 認証を自動応答**（既定 `auth: true`）: `/v1/oauth`（code_direct）と `/v1/token` を本ヘルパーが
  既定の有効なデモ トークン XML で応答する。**利用者はリソース XML だけ書けばよい**（boilerplate 消去）。
  `auth: false` で素通し（認証も自前でモックしたい上級者向け）。
- **D3 応答コアの型と未モック時**: `MockReply = string | { status?: number; body: string }`。文字列は
  `200` として扱う。ハンドラが `undefined` を返し（かつ認証エンドポイントでもない）場合は、
  **`PortersConfigError` を method+url 付きで throw**（フェイルセーフ：未モック箇所を黙殺せず明示）。
- **D4 置き場 = メインエントリ**: `createFetchTransport` と同じ公開面に置く。R-17 は**評価**レバーで
  テスト専用ではないため eval-facing な本体 API に同居が低摩擦。小さく tree-shakeable で本番バンドルに
  漏れない。サーフェスが育てば将来 `/testing` サブパスへ分離可（置き場B は exports マップ＋複数エントリ
  ビルドが要るので現時点は採らない）。
- **D5 薄く保つ**: XML/フィクスチャ生成器は同梱しない（利用者は [docs/reference][ref] の XML 例を文字列で
  渡す）。モック トークンストアも作らない（既定インメモリで足りる）。
- **付随**: `examples/offline-sandbox.ts` を本ヘルパーで書き換え、R-16 カスタム項目と型付きエラー catch も
  実演。ヘルパーのユニットテストと README クイックスタートを更新。

### Consequences

- Good: 契約なしで利用者が自分のコードを最小記述（リソース XML のみ）でテスト/評価できる。認証 boilerplate
  消去。未モックは明示エラー。既存 seam と命名・型が整合。サンドボックスが土台化。
- Bad: 公開サーフェスに `createMockTransport`＋型が増える（小・tree-shakeable）。
- Neutral: フィクスチャ生成・`/testing` サブパス分離は将来課題。

## Pros and Cons of the Options

### 案1: ハンドラ核＋認証自動応答

- Good: 最小・最大柔軟。認証定型を消せる。素の `Transport` 手書きの上位互換。
- Bad: ルートマップのような宣言的な見た目ではない（が利用者側で容易に組める）。

### 案2: 宣言的ルートマップ

- Good: 宣言的で読みやすい。
- Bad: メソッド/条件分岐・動的応答の表現力が落ち、面が厚くなる。案1 の上に薄く乗せられるので核にしない。

### 案3: 現状維持（素の Transport 手書き）

- Good: 追加ゼロ。
- Bad: 利用者が毎回 boilerplate を書く。評価レバーが弱く R-17 の狙いに届かない。

## More Information

- 前提/接地対象: [requirements][prd] R-12（注入トランスポート）/R-17（評価サンドボックス）、
  [ADR-0005][0005]（公開 API seam）、[ADR-0009][0009]（HTTP トランスポート）、[ADR-0006][0006]（`PortersConfigError`）。
- 関連実装: `src/http/mock-transport.ts`（新規）、`src/http/index.ts`（barrel）、`src/index.ts`（公開 export）、
  `examples/offline-sandbox.ts`（書き換え）。
- follow-up（本 ADR スコープ外）: XML/フィクスチャ生成ヘルパー、`/testing` サブパス分離、宣言的ルートマップの薄い糖衣。

[prd]: ../design/requirements.md
[ref]: ../reference/README.md
[0005]: 0005-public-api-shape.md
[0006]: 0006-error-model.md
[0009]: 0009-http-transport.md
