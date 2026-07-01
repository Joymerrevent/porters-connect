# OAuth 認証（初回権限付与とトークン運用）

PORTERS の OAuth は独自仕様です。**普段の運用はライブラリが透過的に自動化**しますが、
**初回だけは人手によるブラウザでの権限付与**が要ります。本ガイドは公開 API `porters.auth.*` の使い方を
手順順にまとめます。

設計の根拠は [ADR-0007（OAuth 公開 API）][adr-0007] と [ADR-0034（F-1 実装）][adr-0034]、
API の一次情報は [認証 API（OAuth/Token）][auth-ref] を参照してください。

## 全体像（2 つのフェーズ）

| フェーズ           | いつ                            | 誰が                 | 方式                                        |
| ------------------ | ------------------------------- | -------------------- | ------------------------------------------- |
| **初回の権限付与** | 対象 Company DB ごとに 1 回だけ | **人間（ブラウザ）** | `response_type=code`                        |
| **以降の運用**     | 毎回のリクエスト                | ライブラリ（自動）   | `response_type=code_direct`（ブラウザ不要） |

`code_direct` を使うには**事前に一度 `code`（ブラウザ）で権限付与済み**である必要があります。
権限付与を済ませれば、あとは `appId` / `appSecret` を渡すだけでトークンの取得・キャッシュ・更新まで
自動で回ります（[README の「認証」][readme]）。

`porters.auth.*` は、この**初回付与の補助**と、**運用中の確認・終了処理**を行うためのメソッド群です。

## 初回の権限付与（ブラウザ・人手で 1 回）

ライブラリは**認可 URL の生成**と **`code` の交換**だけを担います。ブラウザでのログイン・承諾、
および redirect（`?code=` の受け取り）は**利用者側の Web アプリの責務**です。

```ts
import { PortersClient } from "@joymerrevent/porters-connect";

const porters = new PortersClient({
  host: process.env.PORTERS_HOST!,
  appId: process.env.PORTERS_APP_ID!,
  appSecret: process.env.PORTERS_APP_SECRET!,
  scopes: ["candidate_r", "candidate_w", "user_r", "option_r"],
});

// 1) 認可 URL を生成 → ユーザーのブラウザで開く（ログイン → 権限付与の承諾）
const url = porters.auth.authorizationUrl({
  redirectUrl: "https://app.example.com/porters/callback", // アプリ登録済みの Redirect URL
  state: "csrf-token-xyz", // 任意（redirect に引き継がれる。CSRF 対策等）
  // scopes 省略時は client の `scopes` を使う
});
// → このURLへユーザーを誘導する

// 2) redirect で戻ってきた ?code= を交換（code の有効期限は 30 秒）
await porters.auth.exchangeAuthorizationCode(codeFromRedirect);
// 成功すると以後は透過運用（code_direct + 自動更新）に乗る
```

- `redirectUrl` は**アプリ登録時の Redirect URL** と一致させます（`code`/`remove` で必須）。
- `scopes` は付与したい権限。省略すると client に設定した `scopes` を使います（どちらも空だと
  `PortersConfigError`）。
- `exchangeAuthorizationCode(code)` は**成功時に値を返しません（`Promise<void>`）**。取得したトークンは
  ライブラリ内部に保存され、以後のリソース呼び出しが自動で使います。**失敗時は例外を throw**します
  （下記「エラー」）。

> 自前のブラウザフローを用意しない（手元で 1 回だけ付与する）場合は、生成した URL を直接ブラウザの
> アドレスバーに貼って承諾し、戻ってきた `code` を `exchangeAuthorizationCode` に渡すだけでも構いません。

## 起動時の確認 / トークンの確認

```ts
// 起動時に前もってトークンを用意（取得できなければ即エラー＝fail-fast / ウォームアップ）
await porters.auth.ensureAuthenticated();

// 現在有効な Access Token を取得（デバッグ用）。Refresh Token は返しません
const token = await porters.auth.getToken();
```

どちらも省略可能です（通常はリソース呼び出し時に自動取得されます）。`ensureAuthenticated()` は
「起動直後に認証の不備を検知したい」ときに有効です。

## トークンの永続化（`tokenStore`）

既定（透過ストラテジ）のトークン保存先は**インメモリ**で、プロセス再起動で失われ、複数インスタンス間でも共有されません。サーバ運用では `tokenStore` を注入して Redis / DB / ファイルに永続化できます。

永続化すると、再起動や別インスタンスでも**有効な Refresh Token（約 2 時間）を再利用**でき、毎回 `code_direct` でトークンを取り直さずに済みます（良き API 市民）。`TokenStore` が実装するメソッドは `get` / `set` / `clear` の**3 つ**（すべて非同期）です。

```ts
// get / set / clear の 3 つ（StoredTokens とも型 export 済み）
type TokenStore = {
  get(): Promise<StoredTokens | undefined>; // 無ければ undefined
  set(tokens: StoredTokens): Promise<void>; // 取得・更新のたびに書き込まれる
  clear(): Promise<void>; // auth.clearTokens() から呼ばれる
};

type StoredTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number; // epoch ms（絶対時刻）
  refreshTokenExpiresAt: number; // epoch ms（絶対時刻）
};
```

`StoredTokens` は素直な JSON（`*ExpiresAt` は絶対時刻の epoch ms）なので、そのまま直列化して保存できます。

```ts
import { PortersClient } from "@joymerrevent/porters-connect";
import type { TokenStore, StoredTokens } from "@joymerrevent/porters-connect";

// 任意の KV ストアにバックする例
const tokenStore: TokenStore = {
  get: async () => {
    const json = await kv.get("porters:tokens");
    return json ? (JSON.parse(json) as StoredTokens) : undefined;
  },
  set: async (tokens) => {
    await kv.set("porters:tokens", JSON.stringify(tokens));
  },
  clear: async () => {
    await kv.del("porters:tokens");
  },
};

const porters = new PortersClient({
  host,
  appId,
  appSecret,
  scopes: ["candidate_r"],
  tokenStore, // 省略時はインメモリ
});
```

- `tokenStore` が効くのは**既定ストラテジのときだけ**です。独自 `TokenProvider`（後述の「カスタム認証ストラテジ使用時」）を渡した場合は、永続化も自前の責務になります（`tokenStore` は使われません）。
- 複数プロセスで同時に refresh する際の協調（ストアレベルのロック等）や、PORTERS の Refresh Token ローテーション挙動は契約環境での検証事項です（[ADR-0012][adr-0012]）。

## 利用終了（権限の削除）

PORTERS にはサーバ間で完結する権限削除 API がなく、**`remove` もブラウザでの承諾が必要**です。
そのため削除は 2 段階に分けています。

```ts
// 1) 削除用のブラウザ URL を生成 → ユーザーを誘導（ログイン → 削除承諾でサーバ側の権限を削除）
const url = porters.auth.revokeUrl({
  redirectUrl: "https://app.example.com/porters/revoked",
  scopes: ["candidate_r", "candidate_w"], // 省略時は client の scopes
});

// 2) ライブラリが保持するトークン（キャッシュ＋ TokenStore）をローカルで破棄
await porters.auth.clearTokens();
```

- `revokeUrl()` は**サーバ側**の権限削除（ブラウザ手順）。
- `clearTokens()` は**ローカル**のトークン破棄のみ（サーバ側の権限は消しません）。

## カスタム認証ストラテジ使用時

`auth` に独自 `TokenProvider` を渡すと、トークンの取得・更新を**自前で管理**できます（既定の透過ストラテジを置き換え）。`TokenProvider` が実装するメソッドは `getAccessToken` の**1 つだけ**です。

```ts
// 実装するのは getAccessToken の 1 つだけ（opts は GetAccessTokenOptions として型 export 済み）
type TokenProvider = {
  getAccessToken(opts?: { forceRefresh?: boolean }): Promise<string>;
};
```

- **返り値**: その時点で有効な Access Token（文字列）。リソース呼び出しのたびに呼ばれます。
- **`opts.forceRefresh`**: ライブラリが `401`/`402`（トークン失効）を受けた直後に `true` で再呼び出しします。`true` のときは**キャッシュを使わず新しいトークンを取り直して**ください。
- 再認証が必要で取得できないときは `PortersAuthError` を throw します（ライブラリはループせず表面化）。

```ts
import type { TokenProvider } from "@joymerrevent/porters-connect";

// キャッシュし、forceRefresh のときだけ取り直す実装例
let cached: string | undefined;
const auth: TokenProvider = {
  getAccessToken: async (opts) => {
    if (opts?.forceRefresh || cached === undefined) {
      cached = await fetchMyAccessToken(); // 自前のトークン取得
    }
    return cached;
  },
};

// トークンは自前供給なので appId / appSecret は不要
const porters = new PortersClient({ host, auth });
```

> 最小実装は `{ getAccessToken: async () => token }` の 1 行でも構いません（キャッシュや `forceRefresh` を気にしない場合）。

独自ストラテジのとき、`porters.auth.*` で**動くのは provider に委譲する `getToken` と `ensureAuthenticated` の 2 つだけ**です。
残る 4 つ（`authorizationUrl` / `exchangeAuthorizationCode` / `revokeUrl` / `clearTokens`）は、初回付与やトークン破棄をライブラリが代行する前提のもので、自前管理に置き換えると代行できないため **`PortersConfigError`** になります。

| メソッド                                    | 既定ストラテジ | カスタムストラテジ   |
| ------------------------------------------- | -------------- | -------------------- |
| `authorizationUrl` / `revokeUrl`            | ○              | `PortersConfigError` |
| `exchangeAuthorizationCode` / `clearTokens` | ○              | `PortersConfigError` |
| `ensureAuthenticated` / `getToken`          | ○              | ○（委譲）            |

## エラー

`exchangeAuthorizationCode` など非同期メソッドは、失敗を**戻り値ではなく throw**で表します
（[エラーハンドリング ガイド][error-handling]）。

- Token エンドポイントがエラーを返す／`code` が失効（30 秒）→ `PortersAuthError`（`category: "auth"`）
- ネットワーク不達・切断 → `PortersNetworkError`
- `appId` / `appSecret` / `scopes` 不足、カスタムストラテジでの誤用 → `PortersConfigError`（`category: "config"`）

```ts
import {
  PortersAuthError,
  PortersConfigError,
} from "@joymerrevent/porters-connect";

try {
  await porters.auth.exchangeAuthorizationCode(code);
} catch (e) {
  if (e instanceof PortersAuthError) {
    // code 失効など → 認可 URL からやり直す
  } else if (e instanceof PortersConfigError) {
    // 設定・使い方の誤り（早期に検知）
  }
}
```

## 参考

- 設計: [ADR-0007（OAuth 公開 API）][adr-0007] / [ADR-0034（F-1 実装）][adr-0034] / [ADR-0012（トークンのキャッシュ/更新）][adr-0012]
- API 事実: [認証 API（OAuth/Token/フロー）][auth-ref]
- 関連ガイド: [エラーハンドリング][error-handling] ／ 透過運用は [README の「認証」][readme]

[adr-0007]: ../adr/0007-oauth-public-surface.md
[adr-0034]: ../adr/0034-oauth-public-surface-impl.md
[adr-0012]: ../adr/0012-token-cache-refresh.md
[auth-ref]: ../reference/authentication-api/README.md
[error-handling]: ./error-handling.md
[readme]: ../../README.md
