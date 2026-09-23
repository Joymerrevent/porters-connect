# 契約なしでテストする（`createMockTransport`）

PORTERS に繋がずにテストを書きたいときに読むページです。`createMockTransport` で PORTERS の代わりの応答を返し、
送った内容と失敗の経路まで検証する方法が分かります。契約や権限付与を待っている間、CI、本番でしか出ない失敗を
手元で起こすとき、に効きます。

## まず知ること

- **差し替えるのはトランスポート 1 箇所**です。認証はモックが自動で応答し、XML の変換・スロットル・エラーの型は本物と同じ経路を通ります。
- **モックし忘れは黙って通りません。** 応答を用意していないリクエストは失敗として届きます。
- **送ったリクエストを検証できます。** URL と本文が記録されるので、送信内容のテストが書けます。
- **失敗の経路も起こせます**（Result Code・レート・リクエスト長）。XML を書くのがつらいときはフェイクサーバーがあります。

効くのは 3 つの場面です。

- **CI で回す** — 本番の PORTERS に接続せずに、送信内容と失敗経路まで検証する
- **契約や権限付与を待っている** — [始める前に][prereq]が揃う前に、書き進めておく
- **本番でしか出ない失敗を手元で起こす** — レート制限・リクエスト長・Result Code
  （下記「XML を書くのがつらいとき」のフェイクサーバー）

契約済みで、まず繋ぐところから始めたいなら[入門][start]へ。

## 差し替えるのは「トランスポート」1 箇所

`transport` に `createMockTransport` を渡します。ほかのコードはそのままです。

```ts
import {
  PortersClient,
  createMockTransport,
} from "@joymerrevent/porters-connect";

const porters = new PortersClient({
  hostname: "test.invalid",
  appId: "test",
  appSecret: "test",
  transport: createMockTransport((req) =>
    req.url.includes("/v1/candidate")
      ? `<Candidate Total="1" Count="1" Start="0"><Code>0</Code>` +
        `<Item><Person.P_Id>1</Person.P_Id><Person.P_Name>山田 太郎</Person.P_Name></Item>` +
        `</Candidate>`
      : undefined,
  ),
});
```

差し替えているのは **`fetch` ではなく `Transport`** という、差し替えるために公開している境界です。ライブラリ内部の
HTTP 実装が変わってもテストは壊れません。

**認証は自動で応答します。** `/v1/oauth` と `/v1/token` はモックしなくても通るので、書くのは
「テストしたい API」だけです。自分で扱いたいときは `createMockTransport(handler, { auth: false })`。

## モックし忘れは、黙って通らない

ハンドラが `undefined` を返すと、**空を返さずにエラーになります**。

```ts
// PortersConfigError: createMockTransport: no mock response for GET /v1/job — add a case to your handler
await porters.tenant(1).job.search();
```

「モックし忘れたのに素通りして緑」が、テストのいちばん質の悪い壊れ方だからです。
足りない route は必ず名前で分かります。

## 送ったリクエストを検証する

ハンドラは受け取った `req` をそのまま見られます。**何を送ったか**をテストしたいときは記録します。

```ts
const sent: { method: string; url: string; body?: string }[] = [];

const porters = new PortersClient({
  hostname: "test.invalid",
  appId: "test",
  appSecret: "test",
  transport: createMockTransport((req) => {
    sent.push({ method: req.method, url: req.url, body: req.body });
    return `<Candidate><Item><Id>10003</Id><Code>0</Code></Item></Candidate>`;
  }),
});

await porters.tenant(1).candidate.create({ P_Owner: 5, P_Name: "山田 太郎" });

const last = sent.at(-1);
console.log(new URL(last?.url ?? "").searchParams.get("partition")); // "1"
console.log(last?.body?.includes("山田 太郎")); // true
```

`partition` が正しいか、日時が PORTERS 形式に変換されているか、200 件超が分割されているか —
いずれも**送信内容**を見れば確かめられます。

## 失敗の経路をテストする

文字列の代わりに `{ status, body }` を返せば、HTTP エラーも作れます。

```ts
const porters = new PortersClient({
  hostname: "test.invalid",
  appId: "test",
  appSecret: "test",
  transport: createMockTransport(() => ({
    status: 401,
    body: `<Candidate><Code>402</Code></Candidate>`,
  })),
});

try {
  await porters.tenant(1).candidate.search();
} catch (err) {
  if (err instanceof PortersError) {
    console.log(err.constructor.name); // "PortersResourceError"
    console.log(err.category, err.code, err.httpStatus); // "auth" 402 401
  }
}
```

`PortersError` の系統と `category` の対応は[エラーと再試行][handle-failures]にあります。

## テストの形（vitest の例）

1 つのテストの全体を vitest で書くと、こうなります。

<!-- doccheck: skip テストフレームワークの import はドキュメント検査の解決対象外 -->

```ts
import { describe, expect, it } from "vitest";
import {
  PortersClient,
  createMockTransport,
} from "@joymerrevent/porters-connect";

const clientWith = (xml: string) =>
  new PortersClient({
    hostname: "test.invalid",
    appId: "t",
    appSecret: "t",
    transport: createMockTransport((req) =>
      req.url.includes("/v1/candidate") ? xml : undefined,
    ),
  });

describe("候補者の取得", () => {
  it("名前を返す", async () => {
    const porters = clientWith(
      `<Candidate Total="1" Count="1" Start="0"><Code>0</Code>` +
        `<Item><Person.P_Id>1</Person.P_Id><Person.P_Name>山田 太郎</Person.P_Name></Item>` +
        `</Candidate>`,
    );
    const page = await porters
      .tenant(1)
      .candidate.search({ field: ["P_Name"] });
    expect(page.items[0]?.P_Name).toBe("山田 太郎");
  });
});
```

## XML を書くのがつらいとき

応答 XML は**テストしたい項目だけ**書けば足ります。要求していない項目は `null` で返るので、
レコード全体を再現する必要はありません。

それでも足りない場合 — レート制限・リクエスト長・Result Code まで**本物のように**振る舞わせたい
ときは、このリポジトリに **HTTP で応答するフェイクサーバー**があります（`pnpm fake:serve`）。
ただし**リポジトリを clone したときの開発用**で、npm で入れたパッケージには含まれません
（配布物は `dist` と `CHANGELOG.md` だけです）。使い方は[フェイクサーバー手順書][fake]にあります。

### 向き先を env で切り替える

ローカルのフェイクは `http` で動きます。`scheme: "http"` は**明示したときだけ**有効で、
平文になるので毎プロセス 1 回警告が出ます（警告を止めるには専用の環境変数が要ります。`http` を許可する設定と、警告を止める設定は別です）。

**ライブラリは `hostname` / `port` / `scheme` を環境変数から読みません**（設定の出所を明示にするため）。
env で本番とローカルを切り替えたいときは、アプリ側で渡してください。

```ts
const forLocal = new PortersClient({
  hostname: process.env.PORTERS_HOST ?? "",
  // ポートは `hostname` に書けません（書くと構築時にエラーになります）。env も 1 本ずつ分けます
  port: process.env.PORTERS_PORT ? Number(process.env.PORTERS_PORT) : undefined,
  scheme: process.env.PORTERS_SCHEME === "http" ? "http" : undefined,
  appId: process.env.PORTERS_APP_ID ?? "",
  appSecret: process.env.PORTERS_APP_SECRET ?? "",
});
```

```sh
PORTERS_HOST=127.0.0.1 PORTERS_PORT=4010 PORTERS_SCHEME=http node app.js  # ローカルのフェイクへ
PORTERS_HOST=xxxxx.example.com node app.js                                # 本番（未設定なら https・既定ポート）
```

**本番側に `PORTERS_PORT` は要りません。** PORTERS が契約時に通知するのは**サーバー名だけ**で、
ポートはどの記事にも出てきません（[アクセスポイントの書式][access-point]）。

## 関連

- 導入: [始める前に][prereq]（契約済みなら、繋ぐのが先）
- 主題: [エラーと再試行][handle-failures]（エラーの型と category）／[カスタム項目][custom-fields]（宣言した項目のテスト）
- 開発者向け: [フェイクサーバー手順書][fake]
- ほかの目的から探す: [目次][index]

[custom-fields]: custom-fields.md
[fake]: ../../fake-server-runbook.md
[handle-failures]: errors.md
[access-point]: errors.md#アクセスポイントの書式
[prereq]: ../start/prerequisites.md
[start]: ../index.md
[index]: ../index.md
