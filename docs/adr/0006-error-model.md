# 6. エラーモデル（PortersError・category・リトライ可否）

- Status: proposed
- Date: 2026-06-13
- Deciders: （チーム議論中。提案: jun.shiromoto / Claude）

> `proposed`。[ADR-0005][0005] の「throw 型付きエラー」を具体化する。リトライの**機構**は詳細設計、
> 本 ADR は**公開するエラーの型と分類・リトライ可否の方針**を決める。

## Context and Problem Statement

[ADR-0005][0005]（SD-1）で「**型付きエラーを throw**」を決めた。型の中身をどうするか。
PORTERS のエラーは**2 系統**で番号が重複し意味が違う（[resource-api][rapi] / [authentication][auth]）:

- **認証系**: OAuth/Token のレスポンス `<Authentication><Error>code</Error>`（例 `400`=Access Token 期限切れ, `401`=Refresh Token 期限切れ）。
- **リソース系**: Resource API の `<{Resource}><Code>code</Code>`（例 `401`=Access Token 期限切れ, `403`=権限なし, `100`系=入力エラー）。
- ほかに**HTTP/ネットワーク層**（切断・タイムアウト、レート超過は 429 でなく**強制切断**）。

利用者が**自己解決できる**（サポート肩代わり＝公認の条件）よう、エラーは
「**何が・どの系統で・どう直すか・再試行してよいか**」を型で持つ必要がある。

## Decision Drivers

- **自己解決**: `category`・原因コード・対処ヒントで分岐・対応できる（サポート負荷を増やさない）。
- **2 系統の吸収**: 認証系/リソース系/HTTP を 1 つのモデルに正規化（番号衝突を `source` で曖昧さ解消）。
- **リトライ方針と整合**: どれが再試行可能か（[resource-api の Result Code 表][rapi]）。
- **フェイルセーフ**: 未知コードも安全に分類（`unknown`・非リトライ）。決して握り潰さない／常に `PortersError`。
- **薄く**: 過剰なクラス階層を避ける。
- **[ADR-0005][0005] と整合**（`PortersError` の `category`/`code`/`hint`）。

## Considered Options（型の形）

- **案A: 単一 `PortersError` ＋ `category` ＋ `source` フィールド**（当初案）
- **案B: category 別のサブクラス階層**（10 個・`instanceof`）
- **案C: source 別の薄い階層**（基底 ＋ `PortersAuthError` / `PortersResourceError` / `PortersNetworkError`）＋ `category` フィールド（推奨・チーム提案）
- **案D: プレーンな判別 union を throw**（Error を継承しない）

## Decision Outcome

**提案: 案C（source 別の薄い階層 ＋ `category`）**。系統＝クラス（`code` の意味が曖昧にならない・`instanceof` で大別）、`category` は系統横断の対処分岐軸。

```ts
// 基底：すべての PORTERS 由来エラー（まとめて catch 可能）
class PortersError extends Error {
  category: ErrorCategory; // 系統横断の分類（下記）
  code: number | null; // PORTERS の生コード（network は null）
  retryable: boolean; // 再試行してよいか（構築時に算出）
  hint?: string; // 対処ヒント（既定英語）
  httpStatus?: number;
  context?: { resource?: string; operation?: string; partition?: number };
  raw?: { code: number; message: string }; // PORTERS の <Error>/<Code> 原文
  cause?: unknown;
}

// 系統別サブクラス（instanceof で大別。code はその系統のコード空間）
class PortersAuthError extends PortersError {} // OAuth / Token
class PortersResourceError extends PortersError {} // Resource API
class PortersNetworkError extends PortersError {} // 接続/タイムアウト/レート切断

type ErrorCategory =
  | "auth" // 認証情報/トークン/コード（再認証や設定見直しが必要）
  | "permission" // スコープ/データ権限/IP 制限
  | "validation" // 入力・パラメータ・書式・itemstate・version
  | "notFound" // リソース/パーティションが無い
  | "conflict" // 重複・子要素あり・被参照
  | "rateLimit" // レート上限（自前スロットリング超過/強制切断）
  | "transient" // 一時障害・トランザクション（再試行可）
  | "network" // 接続/タイムアウト
  | "server" // PORTERS 内部エラー
  | "unknown"; // 未知（フェイルセーフ）
```

**コード→category→retryable のマッピング（source = 対応サブクラス。[Result Code 表][rapi] / [認証エラー][auth] に接地・代表例）**:

| source   | code                                            | category   | retryable                  |
| -------- | ----------------------------------------------- | ---------- | -------------------------- |
| resource | 9                                               | transient  | ✅                         |
| resource | 302                                             | transient  | ✅                         |
| resource | 401 / 402                                       | auth       | 内部で自動回復（後述）     |
| resource | 6 / 400 / 403 / 406 / 601                       | permission | ❌                         |
| resource | 7 / 404                                         | notFound   | ❌                         |
| resource | 301 / 303 / 304                                 | conflict   | ❌                         |
| resource | 8 / 100–116 / 124 / 126 / 127 / 133 / 146 / 500 | validation | ❌                         |
| resource | 1000                                            | server     | ❌                         |
| auth     | 400                                             | auth       | 内部で自動回復             |
| auth     | 401 / 107 / 103 / 106 / 117 / 109 / 114         | auth       | ❌（再認証）               |
| auth     | 104 / 105                                       | auth       | ❌（設定: app_id/secret）  |
| auth     | 100 / 101 / 102 / 110 / 112                     | validation | ❌（認証リクエストの不備） |
| auth     | 111 / 115 / 116 / 402                           | permission | ❌                         |
| auth     | 108                                             | server     | ❌                         |
| http     | —（切断/タイムアウト）                          | network    | ✅（バックオフ）           |
| http     | レート超過                                      | rateLimit  | ✅（待機後）               |
| 任意     | 上記以外                                        | unknown    | ❌                         |

**トークン期限切れの自動回復**: resource `401`/`402`・auth `400`（Access Token 期限切れ）は
ライブラリが内部で Refresh して**自動再試行**（[OAuth の ADR] で詳細）。**再認証が本当に必要なときだけ**
（Refresh も失効＝auth `401` 等）`category: "auth"` を throw する。

**フェイルセーフ**: 未知コード/パース不能は必ず `PortersError`（`category: "unknown"`・`retryable: false`）で返し、
生エラーや握り潰しをしない。`hint` と `context` で自己解決を促す。

## サブ決定（要議論）

- **SD-A 型の形 → source 別の薄い階層**（基底 ＋ Auth/Resource/Network）。系統＝`instanceof`、横断＝`category`。
- **SD-B `category` を残すか**: 残す（**推奨**・permission/validation/transient は系統横断で対処分岐に有用）／ 階層のみ（`code` を詳細に）。
- **SD-C category の粒度**: 10 個（**推奨**）／ より少なく（`notFound`/`conflict`/`server` を寄せる）。
- **SD-D retryable の持ち方**: フィールド（**推奨**・構築時算出）／ 外部関数。

### Consequences

- Good: 1 つの型で 2 系統＋HTTP を分岐できる。`hint`/`context`/`code` で自己解決＝サポート肩代わり。リトライ方針が型に乗る。
- Bad: コード→category の対応表をコード内に保持・保守する必要（[reference][rapi] と同期）。
- Neutral: リトライ**機構**（バックオフ実装）と OAuth 自動回復は別 ADR。

## Pros and Cons of the Options

### 案C: source 別の薄い階層（推奨）

- Good: `instanceof PortersAuthError / PortersResourceError / PortersNetworkError` で大別。`code` が系統内で一意（曖昧さ無し）。基底 `PortersError` で一括 catch も可。クラスは 4 つだけ＝薄い。`category` で横断分岐も。
- Bad: 公開クラスが 4 つ。系統（クラス）と `category`（フィールド）の二軸を保つ。

### 案A: 単一クラス + source フィールド

- Good: クラス 1 つ。
- Bad: `code` の意味が `source` 次第で曖昧。`instanceof` で系統を大別できない。

### 案B: category 別のサブクラス階層

- Good: category ごとに `instanceof`。
- Bad: 公開クラスが 10＝重い・薄さに反する。系統情報が薄れる。

### 案D: Error を継承しない union

- Good: 構造が純粋。
- Bad: JS 慣習（`instanceof Error`・stack）に反し DX/相互運用が悪い。

## More Information

- 前提/依存: [ADR-0005][0005]（throw・`PortersError`）、[resource-api][rapi]（Result Code）、[authentication][auth]（認証エラー）。
- 後続: リトライ/スロットリング機構（詳細設計）、OAuth の ADR（トークン自動回復）。
- 関連: [[0005-public-api-shape]]。

[0005]: 0005-public-api-shape.md
[rapi]: ../reference/resource-api.md
[auth]: ../reference/authentication.md
