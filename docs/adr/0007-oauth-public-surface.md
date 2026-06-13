# 7. OAuth 認証の公開面（資格情報・code/code_direct・トークン管理・tokenStore）

- Status: proposed
- Date: 2026-06-13
- Deciders: （チーム議論中。提案: jun.shiromoto / Claude）

> `proposed`。基本設計の最後。トークンの**キャッシュ/更新の内部機構**は詳細設計、
> 本 ADR は**利用者から見える認証の形**（資格情報の渡し方・初回権限付与・トークン管理の露出・tokenStore・失効）を決める。

## Context and Problem Statement

PORTERS の OAuth は独自仕様（[authentication][auth]）:

- **初回**は `response_type=code` を**ブラウザ**で叩き、ログイン＋**権限付与の承諾**（人間の操作・Company DB 単位）。これをしないと以降の Resource アクセスはエラー。
- 以降は **`code_direct`（サーバ間・ブラウザ不要、code を XML で返す）** で code 取得 → Token 交換。
- code 有効期限 **30 秒**、Access Token **約30分**、Refresh Token **約2時間**。Resource 呼び出しは `X-porters-hrbc-oauth-token` ヘッダ。`X-P-ConnectAPI-Version: 2`。

本ライブラリはサーバサイド前提。**普段の運用は `code_direct` で自動化**したいが、**初回の権限付与だけは人間のブラウザ操作が必須**。
この二相をどう公開面に落とすか。

## Decision Drivers

- **DX**: 普段は**トークンを意識しない**（自動取得・自動更新）。
- **フェイルセーフ**: 失効 → 自動更新、再認証が要るときは明確なエラー（[ADR-0006][0006] `PortersAuthError`）。
- **良き API 市民**: 無駄なトークン取得をしない（キャッシュ・single-flight）。
- **契約なしで評価**: transport 注入でモック認証もできる。
- **サーバ運用**: 永続トークンストアで再起動・多インスタンスに耐える（Refresh は 2h）。
- **セキュリティ**: secret/token をログ・エラーに漏らさない（[requirements][prd] R-11）。

## Considered Options（トークン管理の露出）

- **案1: 透過的**（初回呼び出しで lazy 自動取得＋失効時 自動更新）＋任意の明示 API（推奨）
- **案2: 明示的**に `connect()/authenticate()` を呼ばせてから使う
- **案3: 利用者がトークンを全部管理**（ライブラリは付与だけ）

## Decision Outcome

**提案: 案1（透過 ＋ 補助 API）**。

### 通常運用（code_direct・自動）

```ts
const porters = new PortersClient({
  host, // 既定 api-hrbc-jp.porterscloud.com
  appId,
  appSecret,
  scopes: ["candidate_r", "candidate_w", "user_r", "option_r"],
  tokenStore: redisTokenStore, // 任意・既定インメモリ
});

// 通常はこれだけ。初回呼び出しで code_direct → token を自動取得し、以後 Refresh も自動。
await porters.candidate.search({ ... });
```

### 初回の権限付与（人間が一度だけ・ブラウザ `code`）

```ts
// 認可 URL を生成（ブラウザで開く → ログイン＆承諾）
const url = porters.auth.authorizationUrl({
  scopes,
  redirectUrl: "https://app.example.com/callback",
  state,
});
// 自前のブラウザフローを作る場合、redirect の ?code= を交換（任意）
await porters.auth.exchangeAuthorizationCode(code);
```

ブラウザ操作・承諾そのものは**ライブラリ外**（人間の手順）。ライブラリは URL 生成と code 交換だけ補助する。

### 失効処理（利用終了）

```ts
await porters.auth.revoke(scopes); // response_type=remove
```

### トークンストア（pluggable・既定インメモリ・非同期）

```ts
interface TokenStore {
  get(): Promise<StoredTokens | undefined>;
  set(tokens: StoredTokens): Promise<void>;
  clear(): Promise<void>;
}
```

永続化すれば再起動・多インスタンスでも Refresh を活かせる（2h 以内なら再ログイン不要）。

### エラーの surface（[ADR-0006][0006]）

- Refresh も失効 → **`PortersAuthError`**（再認証が必要・`category: "auth"`）。
- **初回権限付与が未実施** → Resource が code `403` → `PortersResourceError`（`category: "permission"`）＋ヒント「初回の権限付与（ブラウザ `code`）を実施」。
- secret/token は**ログ・エラー・スナップショットに出さない**。

### 任意の明示 API

- `porters.auth.ensureAuthenticated()`（事前にトークンを用意）/ `porters.auth.getToken()`（デバッグ用）。

## サブ決定（要議論）

- **SD-1 トークン管理**: 透過（lazy 自動取得＋自動更新）（**推奨**）／ 明示 `connect()`。
- **SD-2 `TokenStore`**: 非同期 IF（**推奨**・redis/DB/ファイルに対応。インメモリは即 resolve）／ 同期 IF。
- **SD-3 初回 code グラント**: URL 生成＋code 交換ヘルパーを提供（**推奨**）／ ドキュメントのみ。
- **SD-4 secret の保持**: client 構築時に受け取り内部保持（ログ非出力）（**推奨**）。

### Consequences

- Good: 普段はトークンを意識しない DX。失効は自動回復、再認証要は明確。永続ストアで運用に強い。モック認証で契約なし評価。
- Bad: 初回権限付与（ブラウザ・人間）は自動化できず、必ず手順として残る（ドキュメント必須）。
- Neutral: refresh の single-flight・キャッシュ TTL・再試行は詳細設計。

## Pros and Cons of the Options

### 案1: 透過 ＋ 補助 API（推奨）

- Good: 最小コードで動く・失効を気にしない・補助 API で初回/失効/デバッグも可。
- Bad: 「いつ認証が走るか」が暗黙（明示 API で補える）。

### 案2: 明示 connect()

- Good: 認証タイミングが明確。
- Bad: 毎回ボイラープレート・DX 低下。

### 案3: 利用者がトークン管理

- Good: ライブラリは最小。
- Bad: 独自 OAuth の面倒を利用者に押し付ける＝「簡単」に反する。

## More Information

- 前提/依存: [authentication][auth]（OAuth/Token/ヘッダ/スコープ）、[ADR-0005][0005]（client オプション）、[ADR-0006][0006]（`PortersAuthError`）、[requirements][prd]（R-1/R-11）。
- 後続（詳細設計）: トークンのキャッシュ/Refresh 機構（single-flight・TTL）、リトライ。
- 関連: [[0005-public-api-shape]], [[0006-error-model]]。

[auth]: ../reference/authentication.md
[prd]: ../design/requirements.md
[0005]: 0005-public-api-shape.md
[0006]: 0006-error-model.md
