# 24. テスト/評価用の公開モックトランスポート（`createMockTransport`）— R-17/R-12

- Status: proposed
- Date: 2026-06-18
- Deciders: jun.shiromoto (Joymerrevent)

> [requirements][prd] R-17（評価用サンドボックス）の実装面を確定する。注入可能な Transport の seam は
> [ADR-0005][0005]（公開 API・R-12）／[ADR-0009][0009]（HTTP トランスポート）で決定済み。本 ADR は
> その seam に挿す**公開モック実装**の API 形と公開面を詳細設計し、評価のための代替手段（ネットワーク層
> モック・フェイクサーバー）との棲み分けを決める。

## Context and Problem Statement

[requirements][prd] R-17 は「契約前評価を狙った、すぐ動く offline サンプル（モック前提）」を求め、これは
北極星（デファクト＝第一想起）の**評価可能性レバー**（契約なしで試せる）に直結する。

ここには**性質の異なる 2 つのニーズ**が混在する:

- **N1 ライブラリ/サンプルの評価・SDK 自身の単体テスト**: 自己完結した 1 ファイルで search/create 等を
  契約なしで動かす。DI（注入）が効く文脈。
- **N2 利用者が「自分のアプリのコード」をオフライン評価**: できれば**アプリの組み立てを変えずに**、
  本番に近い形で動かしたい。

現状：`examples/offline-sandbox.ts` が**素の `Transport` を手書き**して N1 をオフライン実行できる
（動作確認済み）。だが再利用可能な公開ヘルパーが無く boilerplate（特に OAuth `/v1/oauth`＋`/v1/token`）を
毎回書く必要があり、R-17 が「サンプル 1 本」に留まっている。

重要な前提: **本ライブラリの安定した公開契約は注入 seam `Transport`**（[ADR-0005][0005]・`src/index.ts` で公開）
であり、**`fetch` はその裏の既定実装にすぎない**（[ADR-0009][0009]）。評価手段をどの層に接地するかで、
内部変更（将来トランスポートを差し替える等）への頑健性が変わる。

問い: **N1 をどの公開ヘルパーで satisfy するか。N2（アプリ無改変・高忠実）はどの手段に委ね、コアの
「薄く・堅く」をどう守るか。**

## Decision Drivers

- **評価可能性**（R-12/R-17）: 契約なしで動く。
- **DX「簡単」**: 認証等の定型を消し、リソース XML を書くだけ。
- **頑健性（内部非結合）**: 評価手段は**公開契約（seam）に接地**し、内部実装（`fetch`）に結合しない。
- **薄く・堅く**: 依存ゼロ・最小面。重い常駐物をコアに持ち込まない。
- **フェイルセーフ**: 未モックは黙って空応答にせず明示する。
- **既存 seam と整合**: `createFetchTransport` と対になる `create*Transport` 命名・契約型 `Transport`。

## Considered Options

- **案1: 公開モックトランスポート `createMockTransport`**（seam 注入・ハンドラ核＋認証自動応答）（推奨）
- **案2: ネットワーク層モック（MSW / nock）を公式の軸にする**（`fetch` を傍受）
- **案3: ローカル フェイクサーバー**（PORTERS を模す HTTP サーバーに `host` を向ける）
- **案4: 現状維持**（利用者が素の `Transport` を手書き）

## Decision Outcome

**採用: 案1（`createMockTransport`）を N1 の公開ヘルパーとして今提供。案3（フェイクサーバー）は N2 向けの
follow-up（コアと分離した別パッケージ）。案2 は公式の軸にしない（理由は下記）。**

- **D1 API 形 = ハンドラ核**: `createMockTransport(handler, options?)`。`handler(req: TransportRequest)` が
  応答を返す。最も薄く・柔軟（ルートマップ等は利用者側で容易に組める）。`Transport` 契約型を返すので
  `new PortersClient({ transport })` にそのまま挿さる。
- **D2 認証を自動応答**（既定 `auth: true`）: `/v1/oauth`（code_direct）と `/v1/token` を既定の有効なデモ
  トークン XML で応答する。**利用者はリソース XML だけ書けばよい**（boilerplate 消去）。`auth: false` で素通し。
- **D3 応答コアの型と未モック時**: `MockReply = string | { status?: number; body: string }`。文字列は `200`。
  ハンドラが `undefined` を返し（かつ認証エンドポイントでもない）場合は、**`PortersConfigError` を method+url
  付きで throw**（フェイルセーフ：未モック箇所を黙殺しない）。
- **D4 公開面 = メインエントリ**: `createFetchTransport` と同じ公開面に置く。小さく tree-shakeable。
  `/testing` サブパス分離は将来。
- **D5 薄く保つ**: XML/フィクスチャ生成器・モックトークンストアは持たない（既定インメモリ・[docs/reference][ref]
  の XML 例で足りる）。
- **D6 案2（MSW/nock）は公式の軸にしない**: これらは**`fetch`（内部実装）に結合**するため、将来トランスポートを
  差し替えると利用者のモックが壊れる（頑健性ドライバに反する）。本ライブラリの安定契約は seam なので、公式手段は
  seam を狙う案1 とする。MSW/nock は「標準 fetch を使うので結果的に動く」事実として README に**言及**するに留める。
- **D7 案3（フェイクサーバー）は N2 の follow-up**: 「アプリ無改変・高忠実」は seam 注入では満たせず（組み立て
  差し替えが要る）、フェイクサーバー（`host` を向けるだけ）が適任。ただし実 HTTP サーバー＋本ライブラリが
  URL を `https://` で組む点（localhost で http 許可 or TLS バイパス）への対応が要り重いので、**コアと分離した
  別パッケージ/別ツール**（例 `@joymerrevent/porters-mock-server`）として別 ADR で設計する。
- **付随**: `examples/offline-sandbox.ts` を `createMockTransport` で書き換え、R-16 カスタム項目と型付きエラー
  catch も実演。ヘルパーのユニットテストと README クイックスタートを更新。

### Consequences

- Good: N1（契約なし評価・SDK 単体テスト・自己完結サンプル）を最小記述で satisfy。認証 boilerplate 消去。
  **公開 seam に接地＝内部（fetch）変更に強い**。未モックは明示エラー。命名・型が既存と整合。
- Bad: 公開サーフェスに `createMockTransport`＋型が増える（小・tree-shakeable）。N2（アプリ無改変評価）は
  本 ADR では未充足＝フェイクサーバー follow-up 待ち。
- Neutral: MSW/nock は非公式（動くが推奨の軸にしない）。フィクスチャ生成・`/testing` 分離は将来。

## Pros and Cons of the Options

### 案1: 公開モックトランスポート（seam 注入）

- Good: 公開契約（seam）に接地＝内部変更に強い。最小・最大柔軟。認証定型を消せる。SDK 自身のテスト・自己完結
  サンプル・DI 利用者に有用。素の `Transport` 手書きの上位互換。
- Bad: N2 では `new PortersClient` の組み立て差し替えが要る（侵襲的）。

### 案2: ネットワーク層モック（MSW/nock）

- Good: 利用者のアプリ無改変で fetch を傍受できる。エコシステムが成熟。
- Bad: **`fetch`＝内部実装に結合**し、トランスポート差し替えで壊れる。nock の fetch/undici 対応はバージョン依存。
  公式の軸にすると安定契約（seam）でなく実装詳細に評価を縛る。→ 言及に留める。

### 案3: ローカル フェイクサーバー

- Good: **アプリ無改変**（`host` を向けるだけ）・高忠実（実 HTTP/XML/認証）・他言語でも使える。N2 に最適。
- Bad: 実装/保守が重い。`https://` 固定への対応（http 許可 or TLS）が要る。コアの「薄く」に対し大きい。
  → 別パッケージの follow-up。

### 案4: 現状維持（素の Transport 手書き）

- Good: 追加ゼロ。
- Bad: 毎回 boilerplate。評価レバーが弱く R-17 の狙いに届かない。

## More Information

- 前提/接地対象: [requirements][prd] R-12（注入トランスポート）/R-17（評価サンドボックス）、
  [ADR-0005][0005]（公開 API seam）、[ADR-0009][0009]（HTTP トランスポート＝既定 fetch）、
  [ADR-0006][0006]（`PortersConfigError`）。
- 関連実装: `src/http/mock-transport.ts`（新規）、`src/http/index.ts`（barrel）、`src/index.ts`（公開 export）、
  `examples/offline-sandbox.ts`（書き換え）。
- follow-up（本 ADR スコープ外）: **ローカル フェイクサーバー（N2・別パッケージ・別 ADR）**、
  XML/フィクスチャ生成ヘルパー、`/testing` サブパス分離、宣言的ルートマップの薄い糖衣。

[prd]: ../design/requirements.md
[ref]: ../reference/README.md
[0005]: 0005-public-api-shape.md
[0006]: 0006-error-model.md
[0009]: 0009-http-transport.md
