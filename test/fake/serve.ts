/*
 * ローカルでフェイク PORTERS サーバーを起動する（ADR-0043 フェーズ5）。
 *
 *   pnpm fake:serve            # 127.0.0.1:4010
 *   PORT=5000 pnpm fake:serve
 *
 * 契約なしで実 HTTP を喋るので、curl でも別プロセス（MCP サーバー等）からでも叩けます。
 * ライブラリからは**設定だけ**で繋げます（ADR-0047・フェーズ6＝アプリ無改造）:
 *
 *   new PortersClient({ host: "127.0.0.1:4010", scheme: "http",
 *     appId: "a", appSecret: "s", partition: 1 });
 *
 * `scheme: "http"` は毎プロセス 1 回警告します（抑止は PORTERS_SUPPRESS_INSECURE_HTTP_WARNING=1）。
 * 設定に触れない場合は transport 差し替え（`createForwardingTransport`）も従来どおり使えます。
 */
import { startFakeServer } from "./http-server";
import { FAKE_RESOURCES } from "./resources";

const port = Number(process.env.PORT ?? 4010);

const server = await startFakeServer({
  port,
  users: [
    { P_Id: 1, P_Name: "API アプリ", P_Mail: "app@example.invalid" },
    { P_Id: 5, P_Name: "採用 花子", P_Mail: "hanako@example.com" },
  ],
  optionTree: [
    {
      alias: "Option.P_PersonPhase",
      name: "候補者フェーズ",
      type: 1,
      children: [
        { alias: "Option.P_PersonPhase_Applied", name: "応募" },
        { alias: "Option.P_PersonPhase_Screening", name: "書類選考" },
      ],
    },
  ],
  seed: {
    candidate: [
      { P_Name: "山田 太郎", P_Owner: "5", P_Mail: "taro@example.com" },
      { P_Name: "佐藤 次郎", P_Owner: "5" },
    ],
  },
});

const routes = [...FAKE_RESOURCES.keys()].map((path) => `/v1/${path}`);

console.log(`fake PORTERS server listening on ${server.url}`);
console.log(`  auth      /v1/oauth (code_direct), /v1/token`);
console.log(`  resources ${routes.join(", ")}`);
console.log(`  seeded    2 candidates, 2 users, 1 option tree`);
console.log(
  `  connect   new PortersClient({ host: "${new URL(server.url).host}", scheme: "http" })`,
);
console.log(
  `  try       curl -s "${server.url}/v1/oauth?app_id=demo&response_type=code_direct"`,
);
console.log(`stop with Ctrl-C`);

const shutdown = (): void => {
  void server.close().then(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
