# インストールと、クライアントの構築

- **前提**: [始める前に — PORTERS 側で用意するもの][s-prereq]（3 つの値が手元にあること）
- **次に読む**: [認証を通して、疎通を確認する][s-auth]

このページでは、ライブラリを入れて、受け取った 3 つの値からクライアントを作ります。まだ PORTERS は呼びません
（呼ぶには認証が要ります。次のページです）。終わると、設定の誤りは構築の時点で落ちる状態になり、認証に進めます。

## インストール

npm・pnpm・yarn のどれでも入ります。

```sh
npm i @joymerrevent/porters-connect
# pnpm add @joymerrevent/porters-connect
# yarn add @joymerrevent/porters-connect
```

**Node.js 22.12 以上**が要ります。型定義は同梱しているので、TypeScript なら追加の
`@types` は要りません。GAS（Google Apps Script）や Cloudflare Workers については PORTERS 側が
「期待どおり応答しないことがある」としており（[運用上の落とし穴][gotchas]）、対象にしていません。

### CJS から `require` する

ESM（`import`）で書いているなら、この節は読み飛ばして構いません。

パッケージに入っている実行ファイルは **ESM の 1 つだけ**です。CJS からも、同じファイルを `require` で読みます。

```js
const { PortersClient } = require("@joymerrevent/porters-connect");
```

Node が `require()` で ESM を読めるのは **22.12 以降**です（対応する Node.js の下限が 22.12 なのはそのためです。
22.0〜22.11 では `ERR_REQUIRE_ESM` で落ちます）。

**CJS 用の別ファイルは用意していません。** ファイルが 2 つあると ESM 側と CJS 側で**別のクラス**が読まれ、
`catch (e) { if (e instanceof PortersError) … }` が `false` になって、**捕まえるつもりのエラーが
`catch` を通り抜けます**<!-- 根拠: ADR-0082 -->。ファイルが 1 つなら、どちらから読んでも同じクラスです。

## クライアントを作成する

渡すのは[前ページ][s-prereq]で受け取った 3 つの値です。**どれもコミットしないでください**
（`.env.example` は値が空の雛形です）。

```ts
import { PortersClient } from "@joymerrevent/porters-connect";

const porters = new PortersClient({
  hostname: process.env.PORTERS_HOST ?? "",
  appId: process.env.PORTERS_APP_ID ?? "",
  appSecret: process.env.PORTERS_APP_SECRET ?? "",
});
```

初回の権限付与を自分のアプリから行うなら、**付与したいスコープ**もここで渡せます
（次のページで使います）。

この設定オブジェクトの型は **`PortersClientOptions`** という名前で export しています。設定を
関数や別ファイルに切り出すときに使えます。

```ts
const withScopes = new PortersClient({
  hostname: process.env.PORTERS_HOST ?? "",
  appId: process.env.PORTERS_APP_ID ?? "",
  appSecret: process.env.PORTERS_APP_SECRET ?? "",
  scopes: ["partition_r", "candidate_r", "user_r", "option_r"],
});
```

## `hostname` は**サーバー名だけ**

契約で渡されるのは**サーバー名**です（PORTERS の記事も「該当のサーバー名を入れてください」と
書いています）。スキーム・パス・**ポート**を混ぜると、**構築した瞬間に `PortersConfigError` で
落ちます**。

| 書き方                                  | どうなるか           |
| --------------------------------------- | -------------------- |
| `hostname: "xxxxx.example.com"`         | ✓                    |
| `hostname: "127.0.0.1", port: 4010`     | ✓（ポートは別項目）  |
| `hostname: "xxxxx.example.com:8443"`    | ✗ ポートは `port` へ |
| `hostname: "https://xxxxx.example.com"` | ✗ 構築時に落ちる     |
| `hostname: "xxxxx.example.com/v1"`      | ✗ 構築時に落ちる     |

**`port` は普段要りません。** PORTERS は名前と https で届くので、使うのはローカルの
フェイクサーバーやプロキシに向けるときだけです。

構築時に落とすのは、**気づかないまま別のホストに接続するより、起動時に止まるほうが安全**だからです。
平文の `http` は `scheme: "http"` を**明示したときだけ**使えて、毎プロセス 1 回警告が出ます
（警告を止めるには専用の環境変数が要ります。`http` を許可する設定と、警告を止める設定は別です）。

URL はライブラリが組み立てるので、利用側がエンドポイントの URL を書くことはありません。

## ここではまだ、何も呼べない

クライアントを作っただけでは PORTERS を呼べません。**2 つ足りない**からです。

- **認証**（トークン）— 次のページで通します
- **どの Partition か** — `porters.tenant(id)` で指定します（[はじめての読み取り][s-read]）

設定の誤りは**ここまでで**落ちます。契約情報の誤りは**次のページ**で落ちます。
原因を探すときは、この順に確かめてください。

## 次に読む

**[認証を通して、疎通を確認する][s-auth]** — 初回の権限付与を済ませて、
「本当に繋がった」ことを確かめます。

[gotchas]: ../reference/gotchas.md
[s-auth]: authenticate.md
[s-prereq]: prerequisites.md
[s-read]: first-read.md
