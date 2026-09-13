# 認証を通して、疎通を確認する

- **前提**: [インストールと、クライアントの構築][s-install]
- **次に読む**: [はじめての読み取り][s-read]

認証は**2 つのフェーズ**に分かれます。**初回だけ人がブラウザで 1 回**、それ以降は
**ライブラリが無人で**トークンを取り直します。ここを混同すると「無人運用できないのでは」と
思ってしまうので、順に見ます。

| フェーズ           | いつ                            | 誰が                 | 方式                          |
| ------------------ | ------------------------------- | -------------------- | ----------------------------- |
| **初回の権限付与** | 対象 Company DB ごとに 1 回だけ | **人間（ブラウザ）** | `code`                        |
| **以降の運用**     | 毎回のリクエスト                | ライブラリ（自動）   | `code_direct`（ブラウザ不要） |

**`code_direct` を使うには、先に `code` で権限付与を済ませておく必要があります。** 順番は
飛ばせません。

## 初回だけ、人がブラウザで 1 回

PORTERS は Company DB ごとに「このアプリに権限を与える」操作を要求します。これは**人の同意**で、
サーバ間だけでは完結しません。ライブラリは**認可 URL の組み立て**と **`code` の交換**を担い、
ブラウザでのログイン・承諾は利用側の責務です。

```ts
// 1) このURLを人がブラウザで開いて同意する
const url = porters.auth.authorizationUrl({
  redirectUrl: "https://your.app/callback", // PORTERS に登録済みのもの
  scopes: ["partition_r", "candidate_r", "user_r", "option_r"],
  state: "csrf-token-xyz", // 任意（redirect に引き継がれる）
});

// 2) リダイレクトで返ってきた ?code= を渡す（**発行から 30 秒で失効**するので即座に）
await porters.auth.exchangeAuthorizationCode(codeFromRedirect);
```

- `redirectUrl` は**アプリ登録時に決めた値**と一致させます。
- `scopes` を省略すると、クライアントに渡した `scopes` を使います（どちらも空なら
  `PortersConfigError`）。
- **`code` の有効期限は 30 秒**です。人の同意を待ってから交換するのではなく、リダイレクトを
  受けたハンドラの中でそのまま交換してください。

### 自前のコールバックがまだ無いなら

最初は**手元で 1 回**済ませてかまいません。`redirectUrl` は登録済みの値を渡し、
戻り先のページが 404 でも**アドレスバーの `?code=` は読めます**。

1. 生成した URL を控える（`console.log(url)`）
2. **PORTERS にログインしていない状態**のブラウザで、その URL を開く
3. ログイン → 権限付与の確認画面で**承諾**
4. Redirect URL に `?code=...` が付いて戻るので、**その値をすぐ** `exchangeAuthorizationCode`
   に渡す（30 秒）

交換用のスクリプトを先に用意して、`code` を貼ったら即実行できるようにしておくと確実です。
Company DB が複数あるなら、**Company DB ごとに**この手順を繰り返します。

## それ以降は、書かなくていい

ここから先、**認証のコードは要りません**。`appId` / `appSecret` があれば、ライブラリが
`code_direct`（サーバ間・ブラウザ不要）でトークンを取り、期限が切れたら取り直します。

```ts
// 認証のことを書かずに、いきなり使える
const page = await porters.tenant(123).candidate.search({ count: 1 });
```

## 繋がったことを確かめる

**ここが入門の折り返し点**です。次の 2 行が通れば、契約・設定・権限付与のすべてが揃っています。

```ts
await porters.auth.ensureAuthenticated(); // 通らなければ、この行で落ちる

const partitions = await porters.partition.search();
for (const p of partitions.items) console.log(p.P_Id, p.P_Name);
```

返ってくるのは**このアプリがアクセスを許された Company DB の一覧**です。つまりこの出力は、
トークンが取れたことと、**権限付与が実際に効いていること**の両方の証拠になります。
**ここに出た `P_Id` が、次のページで `tenant(id)` に渡す値**です。

`ensureAuthenticated()` は省略できます（最初のリクエストで自動的に取得されます）。それでも
起動時に呼ぶ価値があるのは、設定ミスを「最初のリクエストのとき」ではなく**起動のとき**に
落とせるからです。

## トークンはどこに置かれるか

既定は**インメモリ**です。プロセスを再起動すると取り直します（`code_direct` なので無人で
取り直せます）。プロセスを跨いで共有したい・起動を速くしたいなら `tokenStore` を渡します。
Refresh Token を外に出すことになるので、置き場所の安全性は利用側の責任です。

書き方と注意点は[認証の手順][authenticate]にあります。

## うまくいかないとき

| 症状                        | たいてい原因                                                      |
| --------------------------- | ----------------------------------------------------------------- |
| 構築した瞬間に落ちる        | `host` に `https://` やパスが入っている（[前ページ][s-install]）  |
| `PortersAuthError`（403）   | その Company DB の権限付与（初回のブラウザ手順）が済んでいない    |
| `code` を交換すると失敗する | 30 秒を超えた／同じ `code` を 2 回使った                          |
| 一覧が空で返る              | 権限付与した Company DB が無い／`partition_r` を付与していない    |
| スコープ不足で読めない      | `authorizationUrl` に渡したスコープに、使うリソースが入っていない |

エラーの型と見分け方は[失敗の扱い][handle-failures]に、認証まわりの細部は
[認証の手順][authenticate]にあります。

## 次に読む

**[はじめての読み取り][s-read]** — 繋がったので、実際にデータを読みます。

[authenticate]: ../howto/authenticate.md
[handle-failures]: ../howto/handle-failures.md
[s-install]: install.md
[s-read]: first-read.md
