# OAuth 認証（初回権限付与とトークン運用）

PORTERS の OAuth は独自仕様です。**普段の運用はライブラリが透過的に自動化**しますが、
**初回だけは人手によるブラウザでの権限付与**が要ります。本ガイドは公開面 `porters.auth.*` の使い方を
手順順にまとめます。

設計の根拠は [ADR-0007（OAuth 公開面）][adr-0007] と [ADR-0034（F-1 実装）][adr-0034]、
API の一次情報は [認証 API（OAuth/Token）][auth-ref] を参照してください。

## 全体像（2 つのフェーズ）

| フェーズ           | いつ                            | 誰が                 | 方式                          |
| ------------------ | ------------------------------- | -------------------- | ----------------------------- |
| **初回の権限付与** | 対象 Company DB ごとに 1 回だけ | **人間（ブラウザ）** | `response_type=code`          |
| **以降の運用**     | 毎回のリクエスト                | ライブラリ（自動）   | `code_direct`（ブラウザ不要） |

`code_direct` を使うには**事前に一度 `code`（ブラウザ）で権限付与済み**である必要があります。
権限付与を済ませれば、あとは `appId` / `appSecret` を渡すだけでトークンの取得・キャッシュ・更新まで
自動で回ります（[README の「認証」][readme]）。

`porters.auth.*` は、この**初回付与の補助**と、**運用中の確認・終了処理**のための面です。

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

`auth` に独自 `TokenProvider` を渡してトークンを自前管理する場合、ライブラリは資格情報での grant を
代行しません。**credential 依存メソッドは `PortersConfigError` を投げます**。

```ts
const porters = new PortersClient({
  host,
  auth: { getAccessToken: async () => myAccessToken }, // 独自ストラテジ
});

await porters.auth.getToken(); // OK（独自ストラテジに委譲）
await porters.auth.ensureAuthenticated(); // OK（委譲）

porters.auth.authorizationUrl({ redirectUrl }); // PortersConfigError
await porters.auth.exchangeAuthorizationCode(code); // PortersConfigError
porters.auth.revokeUrl({ redirectUrl }); // PortersConfigError
await porters.auth.clearTokens(); // PortersConfigError
```

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

- 設計: [ADR-0007（OAuth 公開面）][adr-0007] / [ADR-0034（F-1 実装）][adr-0034]
- API 事実: [認証 API（OAuth/Token/フロー）][auth-ref]
- 関連ガイド: [エラーハンドリング][error-handling] ／ 透過運用は [README の「認証」][readme]

[adr-0007]: ../adr/0007-oauth-public-surface.md
[adr-0034]: ../adr/0034-oauth-public-surface-impl.md
[auth-ref]: ../reference/authentication-api/README.md
[error-handling]: ./error-handling.md
[readme]: ../../README.md
