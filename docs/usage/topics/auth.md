# 認証とトークン

PORTERS の OAuth は独自仕様で、初回だけは人がブラウザで権限を付与し、以降はライブラリが無人で運用します。
このページを読むと、初回の権限付与をアプリに組み込む方法、トークンをどこに置くか、権限の削除、トークンを
自前で管理する方法が分かります。手順を順に追うなら入門の[認証を通して、疎通を確認する][s-auth]から入ってください。

## まず知ること

- **認証は 2 つのフェーズ**です。初回の権限付与は人がブラウザで 1 回（`code`）、以降はライブラリが無人で
  トークンを取り直します（`code_direct`）。順番は飛ばせません。
- **認証コードは発行から 30 秒で失効**します。リダイレクトを受けたハンドラの中でそのまま交換します。
- **トークンは既定でインメモリ**です。プロセスを跨いで共有するなら `tokenStore` を渡します。Refresh Token を
  外に出すので、置き場所の安全性は利用側の責任です。
- **認証のリクエストも API アクセス数に数えられます**（月 15 万は契約条件）。永続化すると取り直しが減ります。
- **トークンを自前で管理する**なら `TokenProvider` を渡します。そのとき `porters.auth.*` の一部は使えません。

API の一次情報は [認証 API（OAuth/Token）][auth-ref] を参照してください。

<!-- 根拠: ADR-0007（OAuth 公開 API）・ADR-0034（実装） -->

## 全体像（2 つのフェーズ）

認証は、人が 1 回だけやることと、ライブラリが毎回やることに分かれます。

| フェーズ           | いつ                            | 誰が                 | 方式                                        |
| ------------------ | ------------------------------- | -------------------- | ------------------------------------------- |
| **初回の権限付与** | 対象 Company DB ごとに 1 回だけ | **人間（ブラウザ）** | `response_type=code`                        |
| **以降の運用**     | 毎回のリクエスト                | ライブラリ（自動）   | `response_type=code_direct`（ブラウザ不要） |

`code_direct` を使うには**事前に一度 `code`（ブラウザ）で権限付与済み**である必要があります。
権限付与を済ませれば、あとは `appId` / `appSecret` を渡すだけでトークンの取得・キャッシュ・更新まで
自動で回ります（[認証を通して、疎通を確認する][s-auth]）。

`porters.auth.*` は、この**初回付与の補助**と、**運用中の確認・終了処理**を行うためのメソッド群です。

## 初回の権限付与（ブラウザ・人手で 1 回）

ライブラリは**認可 URL の生成**と **`code` の交換**だけを担います。ブラウザでのログイン・承諾、
および redirect（`?code=` の受け取り）は**利用者側の Web アプリの責務**です。

```ts
import { PortersClient } from "@joymerrevent/porters-connect";

const porters = new PortersClient({
  hostname: process.env.PORTERS_HOST!,
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
// 成功すると以後は無人運用（code_direct + 自動更新）になる
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

起動時に認証の不備を早く知りたいとき、または有効なトークンを確かめたいときに使います。

```ts
// 起動時に前もってトークンを用意（取得できなければ、この時点でエラーになる）
await porters.auth.ensureAuthenticated();

// 現在有効な Access Token を取得（デバッグ用）。Refresh Token は返しません
const token = await porters.auth.getToken();
```

どちらも省略可能です（通常はリソース呼び出し時に自動取得されます）。`ensureAuthenticated()` は
「起動直後に認証の不備を検知したい」ときに有効です。

## トークンの永続化（`tokenStore`）

既定の方式（ライブラリがトークンを取得・更新する）では、トークンの保存先は**インメモリ**で、プロセス再起動で失われ、複数インスタンス間でも共有されません。サーバ運用では `tokenStore` を注入して Redis / DB / ファイルに永続化できます。

永続化すると、再起動や別インスタンスでも**有効な Refresh Token（約 2 時間）を再利用**でき、毎回 `code_direct` でトークンを取り直さずに済みます（**認証のリクエストも API アクセス数に数えられます**）。`TokenStore` が実装するメソッドは `get` / `set` / `clear` の**3 つ**（すべて非同期）です。

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
  hostname,
  appId,
  appSecret,
  scopes: ["candidate_r"],
  tokenStore, // 省略時はインメモリ
});
```

- `tokenStore` が使われるのは**既定の方式のときだけ**です。独自 `TokenProvider`（後述の「トークンを自前で管理するとき」）を渡した場合は、永続化も自前の責務になります（`tokenStore` は使われません）。
- 複数プロセスで同時に refresh する際の協調（ストアレベルのロック等）や、PORTERS の Refresh Token ローテーション挙動は契約環境での検証事項です<!-- 根拠: ADR-0012 -->。

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

## トークンを自前で管理するとき

`auth` に独自 `TokenProvider` を渡すと、トークンの取得・更新を**自前で管理**できます（既定の方式を置き換え）。`TokenProvider` が実装するメソッドは `getAccessToken` の**1 つだけ**です。

```ts
// 実装するのは getAccessToken の 1 つだけ（opts は GetAccessTokenOptions として型 export 済み）
type TokenProvider = {
  getAccessToken(opts?: { forceRefresh?: boolean }): Promise<string>;
};
```

- **返り値**: その時点で有効な Access Token（文字列）。リソース呼び出しのたびに呼ばれます。
- **`opts.forceRefresh`**: ライブラリが `401`/`402`（トークン失効）を受けた直後に `true` で再呼び出しします。`true` のときは**キャッシュを使わず新しいトークンを取り直して**ください。
- 再認証が必要で取得できないときは `PortersAuthError` を throw します（ライブラリは繰り返さず、エラーとして返します）。

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
const porters = new PortersClient({ hostname, auth });
```

> 最小実装は `{ getAccessToken: async () => token }` の 1 行でも構いません（キャッシュや `forceRefresh` を気にしない場合）。

自前管理のとき、`porters.auth.*` で**動くのは provider に委譲する `getToken` と `ensureAuthenticated` の 2 つだけ**です。
残る 4 つ（`authorizationUrl` / `exchangeAuthorizationCode` / `revokeUrl` / `clearTokens`）は、初回付与やトークン破棄をライブラリが代行する前提のもので、自前管理に置き換えると代行できないため **`PortersConfigError`** になります。

| メソッド                                    | 既定の方式 | 自前管理             |
| ------------------------------------------- | ---------- | -------------------- |
| `authorizationUrl` / `revokeUrl`            | ○          | `PortersConfigError` |
| `exchangeAuthorizationCode` / `clearTokens` | ○          | `PortersConfigError` |
| `ensureAuthenticated` / `getToken`          | ○          | ○（委譲）            |

## エラー

`exchangeAuthorizationCode` など非同期メソッドは、失敗を**戻り値ではなく throw**で表します
（[エラーと再試行][error-handling]）。

- Token エンドポイントがエラーを返す／`code` が失効（30 秒）→ `PortersAuthError`（`category: "auth"`）
- ネットワーク不達・切断 → `PortersNetworkError`
- `appId` / `appSecret` / `scopes` 不足、自前管理のときの誤用 → `PortersConfigError`（`category: "config"`）

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

## 関連

- 導入: [認証を通して、疎通を確認する][s-auth]（手元で 1 回済ませる手順・うまくいかないとき）
- 主題: [エラーと再試行][error-handling]（`PortersAuthError` と `category`）／[上限とレート][limits]（アクセス数の数え方）／
  [Partition とテナントスコープ][tenant]（権限付与は Company DB ごと）
- リソース別: [Partition][r-partition]（アクセスできる Company DB の一覧）／[User][r-user]（`current()` は誰か）
- 実践例: [複数テナント][multi-tenant]（認証を分けるか）
- リファレンス: [認証 API（OAuth/Token/フロー）][auth-ref]
- ほかの目的から探す: [目次][index]

<!-- 根拠:
- 設計: ADR-0007（OAuth 公開 API） / ADR-0034（F-1 実装） / ADR-0012（トークンのキャッシュ/更新）
-->

[auth-ref]: ../reference/authentication-api/README.md
[error-handling]: ./errors.md
[s-auth]: ../start/authenticate.md
[index]: ../index.md
[limits]: limits.md
[tenant]: tenant.md
[r-partition]: ../resources/partition.md
[r-user]: ../resources/user.md
[multi-tenant]: ../recipes/multi-tenant.md
