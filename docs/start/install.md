# 1. インストールと、最初の 1 回

- **前提**: Node.js 20 以上。**PORTERS の契約はまだ要りません**
- **次に読む**: [2. 認証を通す][s2]

入門は 5 ページあります。上から順に読む想定です。まずは**契約もネットワークも無しで動かして**、
このライブラリが何を返すのかを見ます。

## インストール

```sh
npm i @joymerrevent/porters-connect
# pnpm add @joymerrevent/porters-connect
# yarn add @joymerrevent/porters-connect
```

Node.js 20 以上・ESM 前提です。型定義（`.d.ts`）は同梱しているので、TypeScript なら
追加の `@types` は要りません。

## 契約なしで動かしてみる

PORTERS の代わりに XML を返す関数を渡せば、**全機能をオフラインで**動かせます。
認証（`/v1/oauth` と `/v1/token`）は自動で応答するので、モックするのは欲しい API だけです。

```ts
import {
  PortersClient,
  createMockTransport,
} from "@joymerrevent/porters-connect";

const porters = new PortersClient({
  host: "sandbox.invalid", // 実在しなくてよい（このコードは外に出ません）
  appId: "demo",
  appSecret: "demo",
  transport: createMockTransport(
    (req) =>
      req.url.includes("/v1/candidate")
        ? `<Candidate Total="1" Count="1" Start="0"><Code>0</Code>` +
          `<Item>` +
          `<Person.P_Id>10001</Person.P_Id>` +
          `<Person.P_Name>山田 太郎</Person.P_Name>` +
          `<Person.P_UpdateDate>2026/09/11 12:00:00</Person.P_UpdateDate>` +
          `</Item></Candidate>`
        : undefined, // モックしていない要求は**明示エラー**になる（黙って空を返さない）
  ),
});

const page = await porters.tenant(1).candidate.search({
  field: ["P_Id", "P_Name", "P_UpdateDate"],
});

console.log(page.total); // 1
console.log(page.items[0]?.P_Name); // "山田 太郎"
console.log(page.items[0]?.P_UpdateDate); // "2026-09-11T12:00:00Z"
```

## いま何が起きたか

短いですが、このライブラリの性格がほぼ出ています。

- **XML は外に漏れません。** PORTERS の応答は XML ですが、返るのは型の付いたオブジェクトです。
  `page.items[0]?.P_Name` は `string | null` で、`P_Nmae` と書けばコンパイルが通りません。
- **`Person.` を書いていません。** wire 上の項目名は `Person.P_Name` ですが、書くのは
  `P_Name` だけです（接頭辞はライブラリが付けます）。理由は [alias と Data Type][aliases] に
  あります — **Candidate の接頭辞は `Person`** で、覚えられないからです。
- **日時が ISO 8601 になっています。** PORTERS は `2026/09/11 12:00:00`（UTC）で返しますが、
  受け取るのは `"2026-09-11T12:00:00Z"` です（[日時は UTC][datetime]）。
- **`tenant(1)`** が出てきました。PORTERS のデータは Partition（Company DB）に分かれていて、
  ほぼすべての操作がどの Partition かを要求します（[Partition とテナント][partition]）。

モックしていない要求が来たら、`createMockTransport` は**空を返さずにエラーにします**。
「モックし忘れたのに素通りして緑」は、このライブラリがいちばん避けたい壊れ方だからです。

## 契約があるなら

`transport` を渡さなければ、本物の PORTERS を叩きます。必要なのは 3 つの値
（ホスト名・App ID・App Secret）で、いずれも契約時に通知されます。次のページで扱います。

## もっと本物に近づけたいとき

このリポジトリには、**HTTP で応答するフェイクサーバー**も入っています（`pnpm fake:serve`）。
レート制限・リクエスト長・Result Code まで再現するので、「本番でしか出ない失敗」を手元で
起こせます。ただし**リポジトリを clone したときの開発用**で、npm で入れたパッケージには
含まれません。使い方は[フェイクサーバー手順書][fake]にあります。

## 次に読む

**[2. 認証を通す][s2]** — 契約情報を渡して、本物のトークンを取るところまで。

[aliases]: ../concepts/aliases.md
[datetime]: ../concepts/datetime.md
[fake]: ../fake-server-runbook.md
[partition]: ../concepts/partition.md
[s2]: authenticate.md
