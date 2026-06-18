/*
 * 評価用サンドボックス（R-17 / ADR-0024）— 契約なし・完全オフラインで全機能を試せる。
 *
 *   pnpm sandbox
 *
 * 公開ヘルパー `createMockTransport` にモック XML を返させるだけで、型付き search / get /
 * create を実際に動かせます（OAuth/トークンは自動応答）。実利用では `transport` を渡さず
 * （既定の fetch）、host/appId/appSecret を設定するだけです。import 元はこのリポジトリ内の
 * 都合で `../src` ですが、配布版では `@joymerrevent/porters-connect` から import します。
 */
import {
  PortersClient,
  PortersError,
  bytesToBase64,
  createMockTransport,
  defineFields,
} from "../src/index";

// R-16: テナント固有のカスタム項目を宣言（U_/A_）→ 型付き＋宣言した Data Type で decode/encode。
const fields = defineFields({
  candidate: (f) => ({ U_score: f.number(), U_tags: f.option() }),
});

const porters = new PortersClient({
  host: "sandbox.invalid", // 実利用では契約時のホスト（PORTERS_HOST）
  appId: "demo",
  appSecret: "demo",
  partition: 1,
  fields,
  // ↓ これを外せば本物の fetch で動く。認証（/v1/oauth, /v1/token）は自動応答される。
  transport: createMockTransport((req) => {
    if (req.url.includes("/v1/candidate")) {
      if (req.method === "POST") {
        // 採番された Id を返す（新規 Write）
        return `<Candidate><Item><Id>10003</Id><Code>0</Code></Item></Candidate>`;
      }
      return (
        `<Candidate Total="2" Count="2" Start="0"><Code>0</Code>` +
        `<Item>` +
        `<Person.P_Id>10001</Person.P_Id>` +
        `<Person.P_Name>山田 太郎</Person.P_Name>` +
        `<Person.P_Mail>taro@example.com</Person.P_Mail>` +
        `<Person.P_RegistrationDate>2026/01/02 03:04:05</Person.P_RegistrationDate>` +
        `<Person.P_Owner><User><User.P_Id>5</User.P_Id><User.P_Name>採用 花子</User.P_Name></User></Person.P_Owner>` +
        `<Person.P_Phase><OptionRoot><Option.P_PersonPhase_Applied/></OptionRoot></Person.P_Phase>` +
        // R-16: 宣言したカスタム項目も型付きで返る（U_score=Number, U_tags=Option）
        `<Person.U_score>87</Person.U_score>` +
        `<Person.U_tags><OptionRoot><Option.U_Tag_VIP/></OptionRoot></Person.U_tags>` +
        `</Item>` +
        `<Item><Person.P_Id>10002</Person.P_Id><Person.P_Name>鈴木 一郎</Person.P_Name></Item>` +
        `</Candidate>`
      );
    }
    if (req.url.includes("/v1/attachment")) {
      return `<Attachment><Item><Id>900</Id><Code>0</Code></Item></Attachment>`;
    }
    // 未モックのリクエストは createMockTransport が明示エラーにする（フェイルセーフ）。
    return undefined;
  }),
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
    score: c.U_score, // R-16: number | null（宣言したカスタム項目）
    tags: c.U_tags, // R-16: string[] | null
  });
}

// 2) 取得
const one = await porters.candidate.get(10001);
console.log("■ get(10001):", one?.P_Name, "/ score:", one?.U_score);

// 3) 作成（採番された id が返る。P_Id は自動。カスタム項目も型付きで書ける）
const newId = await porters.candidate.create({
  P_Owner: 5, // User 項目は id
  P_Name: "新規 太郎",
  P_Reading: "しんき たろう",
  U_score: 50, // R-16
  U_tags: ["Option.U_Tag_New"], // R-16（Option は alias 配列）
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

// 5) 型付きエラー：未モックの job を呼ぶと、判別可能な PortersError が飛ぶ
//    （createMockTransport のフェイルセーフ＝未モック箇所を黙殺せず明示）
try {
  await porters.job.search();
} catch (e) {
  if (e instanceof PortersError) {
    console.log("■ typed error:", e.category, "-", e.message);
  } else {
    throw e;
  }
}

console.log("\n✅ すべて契約なし・オフラインで動作しました。");
