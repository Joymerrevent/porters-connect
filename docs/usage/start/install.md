# インストールと、クライアントの構築

- **前提**: [始める前に — PORTERS 側で用意するもの][s-prereq]（3 つの値が手元にあること）
- **次に読む**: [認証を通して、疎通を確認する][s-auth]

ここでやるのは 2 つだけです。**ライブラリを入れて、受け取った 3 つの値を渡す。**
まだ PORTERS は呼びません（呼ぶには認証が要ります。次のページです）。

## インストール

```sh
npm i @joymerrevent/porters-connect
# pnpm add @joymerrevent/porters-connect
# yarn add @joymerrevent/porters-connect
```

**Node.js 20 以上・ESM 前提**です。型定義（`.d.ts`）は同梱しているので、TypeScript なら
追加の `@types` は要りません。

## クライアントを作成する

渡すのは[前ページ][s-prereq]で受け取った 3 つの値です。**どれもコミットしないでください**
（`.env.example` は値が空の雛形です）。

```ts
import { PortersClient } from "@joymerrevent/porters-connect";

const porters = new PortersClient({
  host: process.env.PORTERS_HOST ?? "",
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
  host: process.env.PORTERS_HOST ?? "",
  appId: process.env.PORTERS_APP_ID ?? "",
  appSecret: process.env.PORTERS_APP_SECRET ?? "",
  scopes: ["partition_r", "candidate_r", "user_r", "option_r"],
});
```

## `host` は**ホスト名だけ**

スキームやパスを混ぜると、**構築した瞬間に `PortersConfigError` で落ちます**。

| 書き方                        | どうなるか              |
| ----------------------------- | ----------------------- |
| `"xxxxx.example.com"`         | ✓                       |
| `"xxxxx.example.com:8443"`    | ✓（ポートは付けてよい） |
| `"https://xxxxx.example.com"` | ✗ 構築時に落ちる        |
| `"xxxxx.example.com/v1"`      | ✗ 構築時に落ちる        |

**黙って別のホストを叩くより、起動時に落ちるほうが安全**だからです。平文の `http` は
`scheme: "http"` を**明示したときだけ**使えて、毎プロセス 1 回警告が出ます
（抑止は専用の環境変数だけ＝**許可と沈黙は分ける**）。

URL の組み立てはライブラリ内の 1 箇所に閉じているので、利用側がエンドポイントを組み立てることは
ありません。

## ここではまだ、何も呼べない

クライアントを作っただけでは PORTERS を呼べません。**2 つ足りない**からです。

- **認証**（トークン）— 次のページで通します
- **どの Partition か** — `porters.tenant(id)` で束ねます（[はじめての読み取り][s-read]）

設定の誤りは**ここまでで**落ちます。契約情報の誤りは**次のページ**で落ちます。
切り分けが要るときはこの順に疑ってください。

## 次に読む

**[認証を通して、疎通を確認する][s-auth]** — 初回の権限付与を済ませて、
「本当に繋がった」ことを確かめます。

[s-auth]: authenticate.md
[s-prereq]: prerequisites.md
[s-read]: first-read.md
