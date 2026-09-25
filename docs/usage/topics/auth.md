# 認証とトークン

PORTERS の OAuth は独自仕様で、初回だけは人がブラウザで権限を付与し、以降はライブラリが無人で運用します。
このページを読むと、初回の権限付与をアプリに組み込む方法、トークンをどこに置くか、権限の削除、トークンの
取り方を差し替える方法が分かります。手順を順に追うなら導入の[認証を通して、疎通を確認する][s-auth]から入ってください。

## まず知ること

- **認証は 2 つのフェーズ**です。初回の権限付与は人がブラウザで 1 回（`code`）、以降はライブラリが無人で
  トークンを取り直します（`code_direct`）。順番は飛ばせません。
- **認証コードは発行から 30 秒で失効**します。リダイレクトを受けたハンドラの中でそのまま交換します。
- **トークンは既定でインメモリ**です。プロセスを跨いで共有するなら `tokenStore` を渡します。Refresh Token を
  外に出すので、置き場所の安全性は利用側の責任です。
- **認証のリクエストも API アクセス数に数えられます**（月 15 万は契約条件）。永続化すると取り直しが減ります。
- **トークンの取り方を差し替える**なら `tokenProvider` を渡します（例: トークンを一括で発行する別のサービスから受け取る）。
  キャッシュ・期限の判断・更新・`tokenStore` への保存は、取り方にかかわらずライブラリが受け持ちます。

API の一次情報は [認証 API（OAuth/Token）][auth-ref] を参照してください。

<!-- 根拠: ADR-0007（OAuth 公開 API）・ADR-0034（実装）・ADR-0091（取得と保存を分ける） -->

## 全体像（2 つのフェーズ）

認証は、人が 1 回だけやることと、ライブラリが毎回やることに分かれます。

| フェーズ           | いつ                            | 誰が                 | 方式                                        |
| ------------------ | ------------------------------- | -------------------- | ------------------------------------------- |
| **初回の権限付与** | 対象 Company DB ごとに 1 回だけ | **人間（ブラウザ）** | `response_type=code`                        |
| **以降の運用**     | 毎回のリクエスト                | ライブラリ（自動）   | `response_type=code_direct`（ブラウザ不要） |

`code_direct` を使うには**事前に一度 `code`（ブラウザ）で権限付与済み**である必要があります。
権限付与を済ませれば、あとは `appId` / `appSecret` を渡すだけでトークンの取得・キャッシュ・更新まで
自動で行われます（[認証を通して、疎通を確認する][s-auth]）。

`porters.auth.*` は、この**初回付与の補助**と、**運用中の確認・終了処理**を行うためのメソッド群です。

トークンまわりは「取り方」「置き場所」「管理」の 3 つに分かれていて、利用者が差し替えられるのは前の 2 つです。

| 役割     | 何をするか                                                            | 差し替え方                                  |
| -------- | --------------------------------------------------------------------- | ------------------------------------------- |
| 取り方   | トークンを取る・更新する・権限付与の `code` を交換する                | `tokenProvider`（省略すると `code_direct`） |
| 置き場所 | 取ったトークンを保存し、再起動のときに読み戻す                        | `tokenStore`（省略するとインメモリ）        |
| 管理     | キャッシュ・期限の判断・失効したときの取り直し・同時呼び出しの 1 本化 | 差し替えない（ライブラリが受け持つ）        |

## 初回の権限付与（ブラウザ・人手で 1 回）

ライブラリは**認可 URL の生成**と **`code` の交換**だけを担います。ブラウザでのログイン・承諾、
およびリダイレクト（`?code=` の受け取り）は**利用者側の Web アプリの責務**です。

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
  state: "csrf-token-xyz", // 任意（リダイレクトに引き継がれる。CSRF 対策等）
  // scopes 省略時は client の `scopes` を使う
});
// → このURLへユーザーを誘導する

// 2) リダイレクトで戻ってきた ?code= を交換（code の有効期限は 30 秒）
await porters.auth.exchangeAuthorizationCode(codeFromRedirect);
// 成功すると以後は無人運用（code_direct + 自動更新）になる
```

- `redirectUrl` は**アプリ登録時の Redirect URL** と一致させます（認可 URL と、後述の権限削除 URL の両方で必須）。
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

// いま使っている Access Token と期限を取得。Refresh Token は返しません
const { token, expiresAt } = await porters.auth.getToken();
```

`getToken()` は、リソースの呼び出しに使うのと同じトークンを返します（期限の 60 秒前を過ぎていれば、取り直してから返します）。
`expiresAt` は 1970-01-01 からのミリ秒で、取り方が期限を返さなかったときは `undefined` です。
別のプロセスへトークンを渡すとき（中央のサービスが、各アプリの `tokenProvider` の `acquire` に答えるときなど）は、
この値をそのまま `accessToken` として返せます。

どちらも省略可能です（通常はリソース呼び出し時に自動取得されます）。`ensureAuthenticated()` は
「起動直後に認証の不備を検知したい」ときに有効です。

## トークンの永続化（`tokenStore`）

トークンの保存先は、既定で**インメモリ**です。プロセス再起動で失われ、複数インスタンス間でも共有されません。サーバ運用では `tokenStore` を渡して Redis / DB / ファイルに永続化できます。

永続化すると、再起動や別インスタンスでも**有効な Refresh Token（約 2 時間）を再利用**でき、毎回 `code_direct` でトークンを取り直さずに済みます（**認証のリクエストも API アクセス数に数えられます**）。`TokenStore` が実装するメソッドは `get` / `set` / `clear` の**3 つ**（すべて非同期）です。

```ts
// get / set / clear の 3 つ（StoredTokens の型も export しています）
type TokenStore = {
  get(): Promise<StoredTokens | undefined>; // 無ければ undefined
  set(tokens: StoredTokens): Promise<void>; // 取得・更新のたびに書き込まれる
  clear(): Promise<void>; // auth.clearTokens() から呼ばれる
};

type StoredTokens = {
  accessToken: { token: string; expiresAt?: number }; // expiresAt は 1970-01-01 からのミリ秒（絶対時刻）
  refreshToken?: { token: string; expiresAt?: number }; // 無い取り方もある
};
```

`StoredTokens` はふつうの JSON（`expiresAt` は 1970-01-01 からのミリ秒で表した絶対時刻）なので、そのまま直列化して保存できます。
読み戻した値がこの形でなければ、ライブラリは「保存されていない」として扱い、トークンを取り直します。

```ts
import { PortersClient } from "@joymerrevent/porters-connect";
import type { TokenStore, StoredTokens } from "@joymerrevent/porters-connect";

// 任意の KV ストアに保存する例
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

- `tokenStore` は、**どの取り方でも使われます**（後述の `tokenProvider` を渡したときも）。
- 既定の取り方では、PORTERS が Refresh Token を受け付けないとき（期限切れ・無効。同じ `tokenStore` を使う別のプロセスが
  先に更新した場合など）は、`code_direct` で取り直します。
- 複数プロセスで同時に refresh する際の協調（ストアレベルのロック等）や、PORTERS の Refresh Token ローテーション挙動は実機で未確認です<!-- 根拠: ADR-0012 -->。

## 利用終了（権限の削除）

PORTERS にはサーバ間で完結する権限削除 API がなく、**権限削除（`response_type=remove`）もブラウザでの承諾が必要**です。
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

## トークンの取り方を差し替える（`tokenProvider`）

`PortersClient` の `tokenProvider` に、トークンの取り方を渡せます。たとえば、App Secret を持つ別のサービスが
トークンを一括で発行し、アプリはそこから受け取る構成です。渡すのは**取り方だけ**で、キャッシュ・期限の判断・
失効したときの取り直し・同時呼び出しの 1 本化・`tokenStore` への保存は、ライブラリが受け持ちます。

**取るのに要るものは、渡す関数の側で持ってください。** ライブラリが渡すのは、`refresh` への今のトークンと、
`exchange` への `code` だけです。構築オプションの `appId` / `appSecret` は渡しません。発行するサービスの URL や
そのサービスへの認証情報は、関数の外の変数（環境変数など）から参照します。App Secret を持つのが発行する
サービスだけなら、アプリに App Secret を置く必要はありません。

```ts
// acquire は必須。refresh と exchange は、使うときだけ
type TokenProvider = {
  acquire(): Promise<StoredTokens>; // 最初の取得
  refresh?(current: StoredTokens): Promise<StoredTokens>; // 更新
  exchange?(code: string): Promise<StoredTokens>; // 権限付与の code をトークンに交換
};
```

```ts
import { PortersClient } from "@joymerrevent/porters-connect";

const porters = new PortersClient({
  hostname,
  tokenProvider: {
    acquire: async () => {
      const t = await myTokenService.issue();
      return { accessToken: { token: t.token, expiresAt: t.expiresAt } };
    },
  },
  tokenStore, // 省略時はインメモリ
});
```

- **`acquire`**: トークンを最初から取ります。期限（`expiresAt`）が分かれば一緒に返してください。ライブラリは
  期限の 60 秒前に取り直します。期限を返さなければ、PORTERS がトークンの失効（401 / 402）を返したときに 1 回だけ取り直します。
- **`refresh`**: 更新の手段があるときに渡します。ライブラリは、`refreshToken` が無いか、その期限内なら `refresh` を、
  期限が切れていれば `acquire` を呼びます。渡さなければ、いつも `acquire` で取り直します。
- **`exchange`**: `porters.auth.exchangeAuthorizationCode(code)` を使うときに渡します。権限付与のリダイレクトで
  戻ってきた `code` を、App Secret を持つサービスに送って交換してもらう、といった使い方です。
  **`code` は発行から 30 秒で失効する**ので、`exchange` の中で時間のかかる処理をしないでください。
- 取れないときは、`acquire` などが例外を投げてください。ライブラリは繰り返さず、そのまま呼び出し側に届けます
  （`retryable` が `true` の `PortersError` を投げたときだけは、通常の再試行の対象になります）。
  空のトークンや形の違う値を返すと `PortersConfigError` になります。
- `tokenProvider` を渡すと `appId` / `appSecret` は要りません（`authorizationUrl` / `revokeUrl` を使うなら `appId` だけ要ります）。

```ts
// 更新と code の交換も別のサービスに任せる例
const porters = new PortersClient({
  hostname,
  appId, // authorizationUrl / revokeUrl で使う
  tokenProvider: {
    acquire: async () => {
      const t = await myTokenService.issue();
      return { accessToken: { token: t.token, expiresAt: t.expiresAt } };
    },
    refresh: async (current) => {
      const t = await myTokenService.refresh(current.refreshToken?.token ?? "");
      return {
        accessToken: { token: t.token, expiresAt: t.expiresAt },
        refreshToken: { token: t.refreshToken },
      };
    },
    exchange: async (code) => {
      const t = await myTokenService.exchange(code);
      return {
        accessToken: { token: t.token, expiresAt: t.expiresAt },
        refreshToken: { token: t.refreshToken },
      };
    },
  },
});
```

`porters.auth.*` の 6 メソッドは、`tokenProvider` を渡しても動きます。`exchangeAuthorizationCode` だけは
`exchange` が要り、無ければ `PortersConfigError` になります。一覧は [auth][cl-auth] にあります。

## エラー

`exchangeAuthorizationCode` など非同期メソッドは、失敗を**戻り値ではなく throw**で表します
（[エラーと再試行][error-handling]）。

- Token エンドポイントがエラーを返す／`code` が失効（30 秒）→ `PortersAuthError`（`category: "auth"`）
- ネットワーク不達・切断 → `PortersNetworkError`
- `appId` / `appSecret` / `scopes` 不足、`tokenProvider` の形の誤り・`exchange` の無い `tokenProvider` での `exchangeAuthorizationCode` → `PortersConfigError`（`category: "config"`）

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
- ガイド: [エラーと再試行][error-handling]（`PortersAuthError` と `category`）／[上限とレート][limits]（アクセス数の数え方）／
  [Partition とテナントスコープ][tenant]（権限付与は Company DB ごと）
- クライアント: [auth][cl-auth]（6 メソッドの一覧）／[PortersClient][cl-client]（`tokenStore` / `tokenProvider` / `scopes` オプション）
- リソース: [Partition][r-partition]（アクセスできる Company DB の一覧）／[User][r-user]（`current()` は誰か）
- 実践例: [複数テナント][multi-tenant]（認証を分けるか）／[トークンを DB に保存する][token-store-db]（`tokenStore` を ORM で組む）／
  [中央のサービスからトークンを受け取る][central-token-service]（`tokenProvider` と `getToken()`）
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
[token-store-db]: ../recipes/token-store-db.md
[central-token-service]: ../recipes/central-token-service.md
[cl-auth]: ../client/auth.md
[cl-client]: ../client/client.md
