# 2. 認証を通す

- **前提**: [1. インストールと、最初の 1 回][s1]。ここからは **PORTERS 契約 ＋ Connect API
  オプション契約**が要ります
- **次に読む**: [3. はじめての読み取り][s3]

認証は**2 つのフェーズ**に分かれます。**初回だけ人がブラウザで 1 回**、それ以降は
**ライブラリが無人で**トークンを取り直します。ここを混同すると「無人運用できないのでは」と
思ってしまうので、順に見ます。

## 渡す値は 3 つ

契約時に通知されます。**どれもコミットしないでください**（`.env.example` は値が空の雛形です）。

| 値         | 環境変数             | 何                                   |
| ---------- | -------------------- | ------------------------------------ |
| ホスト名   | `PORTERS_HOST`       | 契約ごとに違う。**ハードコード禁止** |
| App ID     | `PORTERS_APP_ID`     | アプリの識別子                       |
| App Secret | `PORTERS_APP_SECRET` | アプリの秘密鍵                       |

```ts
import { PortersClient } from "@joymerrevent/porters-connect";

const porters = new PortersClient({
  host: process.env.PORTERS_HOST ?? "",
  appId: process.env.PORTERS_APP_ID ?? "",
  appSecret: process.env.PORTERS_APP_SECRET ?? "",
});
```

`host` は**ホスト名だけ**です。`https://` を付けると**構築時に落ちます** — 黙って別のホストを
叩くより安全側に倒すためです（ポートは付けてかまいません）。

## 初回だけ、人がブラウザで 1 回

PORTERS は Company DB ごとに「このアプリに権限を与える」操作を要求します。これは**人の同意**で、
サーバ間だけでは完結しません。ライブラリは URL を組み立てて、返ってきた `code` を交換します。

```ts
// 1) このURLを人がブラウザで開いて同意する
const url = porters.auth.authorizationUrl({
  redirectUrl: "https://your.app/callback", // PORTERS に登録済みのもの
  scopes: ["candidate_r", "candidate_w"],
});

// 2) リダイレクトで返ってきた ?code= を渡す（**発行から 30 秒で失効**するので即座に）
await porters.auth.exchangeAuthorizationCode(codeFromRedirect);
```

**`code` の有効期限は 30 秒**です。人の同意を待ってから交換するのではなく、リダイレクトを
受けたハンドラの中でそのまま交換してください。

## それ以降は、書かなくていい

ここから先、**認証のコードは要りません**。`appId` / `appSecret` があれば、ライブラリが
`code_direct`（サーバ間・ブラウザ不要）でトークンを取り、期限が切れたら取り直します。

```ts
// 認証のことを書かずに、いきなり使える
const page = await porters.tenant(123).candidate.search({ count: 1 });
```

起動時に**認証が通ることだけ確かめたい**なら、明示的に 1 回呼べます。設定ミスを
「最初のリクエストのとき」ではなく「起動のとき」に落とせます。

```ts
await porters.auth.ensureAuthenticated(); // 失敗すれば起動時に落ちる
```

## トークンはどこに置かれるか

既定は**インメモリ**です。プロセスを再起動すると取り直します（`code_direct` なので無人で
取り直せます）。プロセスを跨いで共有したい・起動を速くしたいなら `tokenStore` を渡します。
Refresh Token を外に出すことになるので、置き場所の安全性は利用側の責任です。

書き方と注意点は[認証の手順][authenticate]にあります。

## うまくいかないとき

| 症状                        | たいてい原因                                                      |
| --------------------------- | ----------------------------------------------------------------- |
| 構築した瞬間に落ちる        | `host` に `https://` やパスが入っている                           |
| `PortersAuthError`（403）   | その Company DB の権限付与（初回のブラウザ手順）が済んでいない    |
| `code` を交換すると失敗する | 30 秒を超えた／同じ `code` を 2 回使った                          |
| スコープ不足で読めない      | `authorizationUrl` に渡したスコープに、使うリソースが入っていない |

エラーの型と見分け方は[失敗の扱い][handle-failures]に、認証まわりの細部は
[認証の手順][authenticate]にあります。

## 次に読む

**[3. はじめての読み取り][s3]** — トークンが取れたので、実際にデータを読みます。

[authenticate]: ../howto/authenticate.md
[handle-failures]: ../howto/handle-failures.md
[s1]: install.md
[s3]: first-read.md
