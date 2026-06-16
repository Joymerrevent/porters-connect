/*
 * 評価用サンドボックス（R-17）— 契約なし・完全オフラインで全機能を試せる。
 *
 *   pnpm sandbox
 *
 * PORTERS の契約（ホスト/App ID/Secret）が無くても、注入可能な Transport（R-12）に
 * モック XML を返させることで、型付き search / get / create を実際に動かせます。
 * 実利用では `transport` を渡さず（既定の fetch）、host/appId/appSecret を設定するだけです。
 * import 元はこのリポジトリ内の都合で `../src` ですが、配布版では
 * `@joymerrevent/porters-connect` から import します。
 */
import { PortersClient, bytesToBase64 } from "../src/index";
import type { Transport, TransportResponse } from "../src/index";

const xml = (body: string): Promise<TransportResponse> =>
  Promise.resolve({ status: 200, body });

// モック PORTERS：OAuth/Token と各リソースに定型 XML を返す（契約不要）。
const mockTransport: Transport = {
  send: (req) => {
    const { method, url } = req;

    if (url.includes("/v1/oauth")) {
      return xml(
        `<Authentication><Code>demo-code</Code><Error>0</Error></Authentication>`,
      );
    }
    if (url.includes("/v1/token")) {
      return xml(
        `<Authentication><AccessToken>demo-token</AccessToken>` +
          `<AccessTokenExpiresIn>1800000</AccessTokenExpiresIn>` +
          `<RefreshToken>demo-refresh</RefreshToken>` +
          `<RefreshTokenExpiresIn>7200000</RefreshTokenExpiresIn><Error>0</Error></Authentication>`,
      );
    }
    if (url.includes("/v1/candidate")) {
      if (method === "POST") {
        // 採番された Id を返す（新規 Write）
        return xml(
          `<Candidate><Item><Id>10003</Id><Code>0</Code></Item></Candidate>`,
        );
      }
      return xml(
        `<Candidate Total="2" Count="2" Start="0"><Code>0</Code>` +
          `<Item>` +
          `<Person.P_Id>10001</Person.P_Id>` +
          `<Person.P_Name>山田 太郎</Person.P_Name>` +
          `<Person.P_Mail>taro@example.com</Person.P_Mail>` +
          `<Person.P_RegistrationDate>2026/01/02 03:04:05</Person.P_RegistrationDate>` +
          `<Person.P_Owner><User><User.P_Id>5</User.P_Id><User.P_Name>採用 花子</User.P_Name></User></Person.P_Owner>` +
          `<Person.P_Phase><OptionRoot><P_PersonPhase_Applied/></OptionRoot></Person.P_Phase>` +
          `</Item>` +
          `<Item><Person.P_Id>10002</Person.P_Id><Person.P_Name>鈴木 一郎</Person.P_Name></Item>` +
          `</Candidate>`,
      );
    }
    if (url.includes("/v1/attachment")) {
      return xml(
        `<Attachment><Item><Id>900</Id><Code>0</Code></Item></Attachment>`,
      );
    }
    return xml(`<Error>0</Error>`);
  },
};

const porters = new PortersClient({
  host: "sandbox.invalid", // 実利用では契約時のホスト（PORTERS_HOST）
  appId: "demo",
  appSecret: "demo",
  partition: 1,
  transport: mockTransport, // ← これを外せば本物の fetch で動く
});

// 1) 検索：型付きオブジェクトが返る（XML は外に出ない）
const page = await porters.candidate.search({
  condition: { "Person.P_Name:part": "山田" },
});
console.log("■ search:", page.total, "件");
for (const c of page.items) {
  console.log("  -", {
    id: c.P_Id, // number
    name: c.P_Name, // string | null
    registered: c.P_RegistrationDate, // ISO 8601 (UTC)
    phase: c.P_Phase, // string[]（Option）
    owner: c.P_Owner, // { P_Id, P_Name, ... }（User）
  });
}

// 2) 取得
const one = await porters.candidate.get(10001);
console.log("■ get(10001):", one?.P_Name, "/", one?.P_Mail);

// 3) 作成（採番された id が返る。P_Id は自動）
const newId = await porters.candidate.create({
  P_Owner: 5, // User 項目は id
  P_Name: "新規 太郎",
  P_Reading: "しんき たろう",
});
console.log("■ create -> id:", newId);

// 4) 添付ファイル（Content は Base64。バイト列の変換ヘルパー同梱）
const attachmentId = await porters.attachment.create({
  resource: 1,
  resourceId: 10001,
  contentType: "text/plain",
  fileName: "memo.txt",
  content: bytesToBase64(new TextEncoder().encode("hello porters")),
});
console.log("■ attachment.create -> id:", attachmentId);

console.log("\n✅ すべて契約なし・オフラインで動作しました。");
