# テストを書きたい（契約なし）

PORTERS の契約が無くても、**このライブラリを通るコードはすべてテストできます**。
公開ヘルパー `createMockTransport` に、PORTERS の代わりの XML を返させるだけです。

## 差し替えるのは「トランスポート」1 箇所

```ts
import {
  PortersClient,
  createMockTransport,
} from "@joymerrevent/porters-connect";

const porters = new PortersClient({
  host: "test.invalid",
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

差し替えているのは **`fetch` ではなく `Transport`** という公開の継ぎ目です。ライブラリ内部の
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

const transport = createMockTransport((req) => {
  sent.push({ method: req.method, url: req.url, body: req.body });
  return `<Candidate><Item><Id>10003</Id><Code>0</Code></Item></Candidate>`;
});

// … クライアントを作って create を呼んだあと
const last = sent.at(-1);
console.log(new URL(last?.url ?? "").searchParams.get("partition")); // "1"
console.log(last?.body?.includes("山田 太郎")); // true
```

`partition` が正しいか、日時が PORTERS 形式に変換されているか、200 件超が分割されているか —
いずれも**送信内容**を見れば確かめられます。

## 失敗の経路をテストする

文字列の代わりに `{ status, body }` を返せば、HTTP エラーも作れます。

```ts
const failing = createMockTransport(() => ({
  status: 401,
  body: `<Candidate><Code>402</Code></Candidate>`,
}));
```

`PortersError` の系統と `category` の対応は[失敗の扱い][handle-failures]にあります。

## テストの形（vitest の例）

<!-- doccheck: skip テストフレームワークの import はドキュメント検査の解決対象外 -->

```ts
import { describe, expect, it } from "vitest";
import {
  PortersClient,
  createMockTransport,
} from "@joymerrevent/porters-connect";

const clientWith = (xml: string) =>
  new PortersClient({
    host: "test.invalid",
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

## 関連

- 手順: [失敗の扱い][handle-failures]（エラーの型と category）／[カスタム項目][custom-fields]（宣言した項目のテスト）
- 入門: [1. インストールと、最初の 1 回][install]（最初の 1 本も同じ仕組み）
- 開発者向け: [フェイクサーバー手順書][fake]

[custom-fields]: custom-fields.md
[fake]: ../../fake-server-runbook.md
[handle-failures]: handle-failures.md
[install]: ../start/install.md
