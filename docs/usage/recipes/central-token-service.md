# 中央のサービスからトークンを受け取る（`tokenProvider`）

PORTERS のトークンを 1 か所で取り、複数のアプリ（やプロセス）に配りたいときに読むページです。App Secret を
中央のサービスだけに置き、各アプリは `tokenProvider` で中央からトークンを受け取る仕組みを組みます。読み終えると、
アプリに App Secret を持たせずに PORTERS を呼べます。

## 使う機能

この用途で使うライブラリの機能と、それぞれの役割です。

| 機能                         | どこで   | 何に使うか                                                               |
| ---------------------------- | -------- | ------------------------------------------------------------------------ |
| 既定の取り方 ＋ `tokenStore` | 中央     | `code_direct` でトークンを取り、DB に保存する                            |
| `porters.auth.getToken()`    | 中央     | いま使っている Access Token と期限（`{ token, expiresAt? }`）を取り出す  |
| `tokenProvider`（`acquire`） | 各アプリ | 中央からトークンを受け取る。キャッシュと期限の判断はライブラリが受け持つ |

## 全体像

```text
[中央のサービス]  PortersClient（appId / appSecret ＋ tokenStore）
      │  GET /porters-token  → { token, expiresAt }
      ▼
[各アプリ]  PortersClient（hostname ＋ tokenProvider）
      │  X-porters-hrbc-oauth-token: token
      ▼
   PORTERS
```

- App Secret を持つのは中央だけです。各アプリは `hostname` と、中央を呼ぶための情報だけを持ちます。
- PORTERS へトークンを取りに行くのも中央だけです。各アプリが何台あっても、認証のリクエストは中央の分だけで済みます。

## 組み立て

次の順に組みます。中央のサービス → 各アプリ、の 2 段です。

### 1. 中央のサービス

中央は、ふつうのクライアント（既定の取り方）を 1 つ持ち、トークンを返す口を公開します。クライアントとトークンの
保存先は、[トークンを DB に保存する][token-store-db]の 4 つのファイル（`db.ts` / `schema.ts` / `token-store.ts` /
`porters.ts`）をそのまま使い、トークンを返す `token-service.ts` を足します（コード例の 1 行目がファイル名です）。

```text
db.ts / schema.ts / token-store.ts / porters.ts   … 「トークンを DB に保存する」の手順 0〜3
token-service.ts                                   … アプリにトークンを返す（ここで足す）
```

```ts
// ファイル: token-service.ts
import { porters } from "./porters";

// アプリからの問い合わせに答える（Web 標準の Request / Response で書いた例）
export const handleTokenRequest = async (
  request: Request,
): Promise<Response> => {
  // 中央とアプリの間の認証は利用側で決める。例では共有の秘密を Bearer で受ける
  if (
    request.headers.get("authorization") !==
    `Bearer ${process.env.TOKEN_SERVICE_SECRET}`
  ) {
    return new Response(null, { status: 401 });
  }
  const issued = await porters.auth.getToken(); // { token, expiresAt? }
  return Response.json(issued, { headers: { "cache-control": "no-store" } });
};
```

- `getToken()` は、リソースの呼び出しに使うのと同じトークンを返します。期限の 60 秒前を過ぎていれば、
  取り直してから返します。Refresh Token は返しません。
- 初回の権限付与（ブラウザでの `code` の付与）も中央で済ませます（[認証とトークン][auth]）。

### 2. 各アプリ

アプリは中央とは別のプロジェクトです。`tokenProvider` の `acquire` で中央を呼び、受け取った値をそのまま
`accessToken` として返します。`appId` / `appSecret` は渡しません。

```ts
// ファイル: app/porters.ts
import { PortersClient, type IssuedToken } from "@joymerrevent/porters-connect";

export const porters = new PortersClient({
  hostname: process.env.PORTERS_HOST ?? "",
  tokenProvider: {
    acquire: async () => {
      const res = await fetch("https://token.internal.example/porters-token", {
        headers: {
          authorization: `Bearer ${process.env.TOKEN_SERVICE_SECRET}`,
        },
      });
      if (!res.ok) throw new Error(`token service answered ${res.status}`);
      const issued = (await res.json()) as IssuedToken;
      return { accessToken: issued };
    },
  },
});
```

あとは、ふつうのクライアントと同じように `porters.tenant(id)` から読み書きします。

- **`refresh` は渡しません。** 期限が近づくと、ライブラリはもう一度 `acquire` を呼びます。中央はそのとき
  期限の近いトークンを取り直して返すので、アプリ側で更新の手段を持つ必要はありません。
- **期限を返すので、期限切れで失敗してから取り直すことはありません。** 期限（`expiresAt`）の 60 秒前を過ぎると、
  次のリクエストの前に `acquire` を呼びます。
- 中央が形の違う値（空のトークンなど）を返すと、PORTERS へ送る前に `PortersConfigError` になります。
- 中央に届かないときは、`acquire` が投げた例外がそのまま呼び出し側に届きます（ライブラリは繰り返しません）。

## 知っておくこと

- **PORTERS がトークンを失効させたとき**（権限の削除など）、アプリのリクエストは 401 を受けて 1 回だけ `acquire` を
  呼び直します。ただ、中央はそのトークンがまだ期限内なら同じものを返すので、アプリの側では回復しません。
  中央が気づくのは、中央自身のリクエストが 401 を受けたときか、中央で `porters.auth.clearTokens()` を呼んだときです。
- **1 分あたりの上限（Read 2000 / Write 500）は、全アプリの合計で数えられます。** 内蔵スロットリングはプロセスごとなので、
  アプリが複数あるなら、合計が上限に収まるように `throttle` を渡して協調させます（[上限とレート][limits]）。
- 月あたりのアクセス数も、全アプリの合計です。

## ライブラリの外（利用側の責務）

この用途で自分で用意するものです。ライブラリは持ちません。

- 中央のサービスの公開と、中央とアプリの間の認証（例の共有の秘密、mTLS、社内ネットワークに閉じる、など）
- トークンを返す口の保護（ログに残さない、キャッシュさせない、TLS で運ぶ）
- 中央が止まったときの扱い（アプリは新しいトークンを受け取れず、手元のトークンの期限の 60 秒前からリクエストがエラーになる）

## 関連

- 主題: [認証とトークン][auth]（`tokenProvider` の型と `getToken()`）／[上限とレート][limits]
- クライアント: [auth][cl-auth]（`getToken()` ほか 6 メソッド）
- 実践例: [トークンを DB に保存する][token-store-db]（中央の `tokenStore`）／[複数テナント][multi-tenant]
- ほかの目的から探す: [目次][index]

[auth]: ../topics/auth.md
[limits]: ../topics/limits.md
[cl-auth]: ../client/auth.md
[token-store-db]: token-store-db.md
[multi-tenant]: multi-tenant.md
[index]: ../index.md
