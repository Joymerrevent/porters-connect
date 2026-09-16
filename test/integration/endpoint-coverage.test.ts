// docs/design/endpoint-coverage.md（V1 の「API エンドポイント × 機能」マトリクス）を、
// **reference と実装の両方**へ突き合わせる検査。
//
// なぜ要るか: D1〜D5（ADR-0060）が測ったのは**項目の軸**で、**操作とパラメータの軸**は
// 一度も検査していなかった。項目側は reference ↔ カタログ突合（RV-29）が塞いだので、同じやり方を
// パラメータに当てる。表を人が書くだけだと、実装を変えた日に表のほうが古くなる — 表を検査の
// 入力にすれば、古くなった時点で落ちる。
//
// 何を見るか:
//   1) 表 A（PORTERS が取るもの）が reference の Input Variables と**両方向**で一致する
//   2) 表 B / 表 C（ライブラリが送るもの）が、実際に組み立てた URL のパラメータ集合と一致する
//      — 載せ忘れも、余分な送信も、同じ 1 つの比較で落ちる
//   3) 表 A と表 B / C がずれているセルには必ず根拠（ADR / LV / RV）があり、
//      **ずれていないセルには根拠が無い**（消し忘れた印も落とす）
//   4) 表 D / 表 E（操作）が公開メソッドの有無と一致する
//   5) 表 F / 表 G（認証・ヘッダ）が実際のリクエストと一致する
//
// 実装側は**フェイクサーバー越しに本物のアクセサを呼ぶ**（URL を組み立てる経路をそのまま通す）。
// 期待値はどこにもハードコードせず、表と実リクエストを突き合わせるので、表と実装のどちらを
// 変えても、片方だけでは緑にならない。

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { PortersClient, type TenantScope } from "../../src/client";
import type { StoredTokens, TokenStore } from "../../src/auth/types";
import type { Transport, TransportRequest } from "../../src/http/types";
import { createFakeTransport } from "../fake/index";
import type { FakeRecord, FakeTransport } from "../fake/types";

const MATRIX = "docs/design/endpoint-coverage.md";
const REFERENCE = "docs/usage/reference/resource-api";
const LIVE_VERIFICATION = "docs/live-verification.md";

// --- markdown の表を読む ---------------------------------------------------------------

type Row = Record<string, string>;

// 罫線行（`| --- | :--- |`）。ヘッダの次に 1 行だけ来る。
const RULE_CELL = /^:?-+:?$/;

/**
 * 見出しごとに、その節の**最初の表**を行オブジェクトの配列で返す。
 * キーは見出しの文字列そのもの（`表 A — …`）。
 */
const readTables = (path: string): Map<string, Row[]> => {
  const tables = new Map<string, Row[]>();
  let heading = "";
  let header: string[] | undefined;
  let rows: Row[] = [];

  const flush = (): void => {
    if (header !== undefined && rows.length > 0 && !tables.has(heading)) {
      tables.set(heading, rows);
    }
    header = undefined;
    rows = [];
  };

  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (line.startsWith("#")) {
      flush();
      heading = line.replace(/^#+\s*/, "").trim();
      continue;
    }
    if (!line.trimStart().startsWith("|")) {
      flush();
      continue;
    }
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.every((c) => RULE_CELL.test(c))) continue;
    if (header === undefined) {
      header = cells;
      continue;
    }
    rows.push(Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""])));
  }
  flush();
  return tables;
};

const MATRIX_TABLES = readTables(MATRIX);

/** 表を見出しの接頭辞（`表 A`）で引く。無ければ落とす — 見出しを変えたら気づけるように。 */
const tableOf = (label: string): Row[] => {
  const key = [...MATRIX_TABLES.keys()].find((k) => k.startsWith(label));
  if (key === undefined)
    throw new Error(`${MATRIX} に「${label}」の表がありません`);
  return MATRIX_TABLES.get(key) ?? [];
};

/** セル内の `` `foo` `` をすべて拾う（1 セルに複数並ぶ行がある — Phase の共通パラメータ行）。 */
const codeSpans = (cell: string): string[] =>
  [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? "");

/** 表の 1 セルからエンドポイント名を取る（`` `/v1/candidate` `` -> `/v1/candidate`）。 */
const endpointOf = (row: Row): string =>
  codeSpans(row["エンドポイント"] ?? "")[0] ?? "";

// --- 対象 -----------------------------------------------------------------------------

// 共通語彙で Read する 11 エンドポイント（マスタ 4 種 / Phase / Attachment は語彙が違う）。
const COMMON_ENDPOINTS = [
  "/v1/candidate",
  "/v1/job",
  "/v1/client",
  "/v1/recruiter",
  "/v1/contact",
  "/v1/resume",
  "/v1/process",
  "/v1/activity",
  "/v1/contract",
  "/v1/sales",
  "/v1/opportunity",
];

// 表 A / 表 B の列（＝共通 Read パラメータ）。
const COMMON_PARAMS = [
  "partition",
  "count",
  "start",
  "field",
  "condition",
  "keywords",
  "order",
  "itemstate",
];

// reference の「Read パラメータ」表がどのエンドポイントの事実か。共通表は 11 本に効く。
const REFERENCE_SOURCES: {
  endpoints: string[];
  path: string;
  heading: string;
}[] = [
  {
    endpoints: COMMON_ENDPOINTS,
    path: `${REFERENCE}/README.md`,
    heading: "Read パラメータ（共通）",
  },
  ...["partition", "user", "field", "option", "phase", "attachment"].map(
    (name) => ({
      endpoints: [`/v1/${name}`],
      path: `${REFERENCE}/resources/${name}.md`,
      heading: "Read パラメータ",
    }),
  ),
];

/** reference が挙げるパラメータ: エンドポイント -> パラメータ -> `●`（必須）/ `○`（任意）。 */
const referenceParams = (): Map<string, Map<string, string>> => {
  const out = new Map<string, Map<string, string>>();
  for (const source of REFERENCE_SOURCES) {
    const tables = readTables(source.path);
    const key = [...tables.keys()].find((k) => k.startsWith(source.heading));
    if (key === undefined) {
      throw new Error(`${source.path} に「${source.heading}」の表がありません`);
    }
    const params = new Map<string, string>();
    for (const row of tables.get(key) ?? []) {
      const required = (row["必須"] ?? "").includes("●") ? "●" : "○";
      for (const name of codeSpans(row["パラメータ"] ?? "")) {
        params.set(name, required);
      }
    }
    for (const endpoint of source.endpoints) {
      out.set(endpoint, new Map(params));
    }
  }
  return out;
};

const REFERENCE_PARAMS = referenceParams();

// --- 実装を動かす ---------------------------------------------------------------------

type Ctx = { porters: PortersClient; t: TenantScope };

// 呼び出し側が渡せるものを全部渡した Read クエリ。`P_Id` はどのデータ系カタログにもあり、
// System[Id] なので condition（`eq`）にも order にも使える。
const MAXIMAL_READ = {
  field: ["P_Id" as const],
  condition: { P_Id: { eq: 1 } },
  order: [{ P_Id: "asc" as const }],
  keywords: ["x"],
  itemstate: "existing" as const,
  count: 5,
  start: 0,
};

// Phase の alias は接頭辞なし（ADR-0061）なので、同じ内容を `Id` で書く。`keywords` /
// `itemstate` は**入っていない** — Phase - Read が挙げていないので型が受け付けない（ADR-0076）。
// ここに足すと型検査で落ちる＝表 B の 2 セルが「送らない」であることが型でも固定されている。
const MAXIMAL_PHASE_READ = {
  field: ["Id" as const],
  condition: { Id: { eq: 1 } },
  order: [{ Id: "asc" as const }],
  count: 5,
  start: 0,
};

// フェイクが採番する最初の id（reference の Read / Write サンプルと同じ 10001）。
const SEEDED_ID = 10001;

// Write を撃つには対象レコードが要る（`update` は id を指す）。Read 専用のマスタ以外に 1 件ずつ。
const SEED: Record<string, FakeRecord[]> = {
  ...Object.fromEntries<FakeRecord[]>(
    COMMON_ENDPOINTS.map((endpoint) => [endpoint.replace("/v1/", ""), [{}]]),
  ),
  phase: [{ Resource: "5", ResourceId: "20001" }],
  attachment: [
    {
      Resource: "1",
      ResourceId: "10001",
      FileName: "a.txt",
      ContentType: "text/plain",
      Content: "YQ==",
    },
  ],
};

type Probe = {
  endpoint: string;
  /** メソッドの有無を見る対象（アクセサそのもの）。 */
  accessor: (c: Ctx) => object;
  /** 渡せるものを全部渡して Read する。 */
  read: (c: Ctx) => Promise<unknown>;
  /** Write する（Read 専用のマスタには無い）。 */
  write?: (c: Ctx) => Promise<unknown>;
};

const commonProbe = (
  endpoint: string,
  pick: (t: TenantScope) => {
    search: (q: typeof MAXIMAL_READ) => Promise<unknown>;
    update: (id: number, fields: Record<string, never>) => Promise<unknown>;
  },
): Probe => ({
  endpoint,
  accessor: ({ t }) => pick(t),
  read: ({ t }) => pick(t).search(MAXIMAL_READ),
  write: ({ t }) => pick(t).update(SEEDED_ID, {}),
});

const PROBES: Probe[] = [
  {
    endpoint: "/v1/partition",
    accessor: ({ porters }) => porters.partition,
    read: ({ porters }) =>
      porters.partition.search({ requestType: 1, count: 5, start: 0 }),
  },
  {
    endpoint: "/v1/user",
    accessor: ({ t }) => t.user,
    read: ({ t }) =>
      t.user.search({
        requestType: 1,
        userType: -1,
        field: ["P_Id"],
        count: 5,
        start: 0,
      }),
  },
  {
    endpoint: "/v1/field",
    accessor: ({ t }) => t.field,
    read: ({ t }) =>
      t.field.search({
        resource: "candidate",
        active: -1,
        count: 5,
        start: 0,
      }),
  },
  {
    endpoint: "/v1/option",
    accessor: ({ t }) => t.option,
    read: ({ t }) =>
      t.option.search({
        alias: "Option.P_Gender",
        level: -1,
        enabled: -1,
        count: 5,
      }),
  },
  commonProbe("/v1/candidate", (t) => t.candidate),
  commonProbe("/v1/job", (t) => t.job),
  commonProbe("/v1/client", (t) => t.client),
  commonProbe("/v1/recruiter", (t) => t.recruiter),
  commonProbe("/v1/contact", (t) => t.contact),
  commonProbe("/v1/resume", (t) => t.resume),
  commonProbe("/v1/process", (t) => t.process),
  commonProbe("/v1/activity", (t) => t.activity),
  commonProbe("/v1/contract", (t) => t.contract),
  commonProbe("/v1/sales", (t) => t.sales),
  commonProbe("/v1/opportunity", (t) => t.opportunity),
  {
    endpoint: "/v1/phase",
    accessor: ({ t }) => t.phase.of("client"),
    read: ({ t }) => t.phase.of("client").search(MAXIMAL_PHASE_READ),
    write: ({ t }) => t.phase.of("client").update(SEEDED_ID, {}),
  },
  {
    endpoint: "/v1/attachment",
    accessor: ({ t }) => t.attachment,
    read: ({ t }) =>
      t.attachment.search({
        field: ["Id"],
        condition: { "Id:eq": "1" },
        count: 5,
        start: 0,
      }),
    write: ({ t }) => t.attachment.update(SEEDED_ID, {}),
  },
];

/**
 * フェイク越しに本物のクライアントを組み、送ったリクエストを全部残す。
 *
 * `fake` / `tokenStore` を渡せるのは**トークン更新の経路を通すため**だけ（同じフェイクが
 * 発行した Refresh Token でないと更新にならない）。通常の probe は引数なしで使う。
 */
const createProbeClient = (
  options: { fake?: FakeTransport; tokenStore?: TokenStore } = {},
) => {
  const fake =
    options.fake ?? createFakeTransport({ users: [{ P_Id: 5 }], seed: SEED });
  const sent: TransportRequest[] = [];
  const transport: Transport = {
    send: (request) => {
      sent.push(request);
      return fake.send(request);
    },
  };
  // 既定のストア: 発行されたトークンを控えておく（更新の検査が本物の Refresh Token を要る）。
  let saved: StoredTokens | undefined;
  const recordingStore: TokenStore = {
    get: () => Promise.resolve(saved),
    set: (tokens) => {
      saved = tokens;
      return Promise.resolve();
    },
    clear: () => {
      saved = undefined;
      return Promise.resolve();
    },
  };
  const porters = new PortersClient({
    host: "fake.test",
    appId: "app-id",
    appSecret: "app-secret",
    scopes: ["candidate_r"],
    transport,
    tokenStore: options.tokenStore ?? recordingStore,
  });
  const ctx: Ctx = { porters, t: porters.tenant(1) };

  /** `run` を実行し、`path` に対して最後に送ったリクエストを返す。 */
  const capture = async (
    path: string,
    run: () => Promise<unknown>,
  ): Promise<TransportRequest> => {
    const from = sent.length;
    await run();
    const hits = sent
      .slice(from)
      .filter((r) => new URL(r.url).pathname === path);
    // 空振り（1 件も送らずに緑）を先に潰す。
    expect(hits.length, `${path} へのリクエストが無い`).toBeGreaterThan(0);
    return hits[hits.length - 1];
  };

  const params = async (
    path: string,
    run: () => Promise<unknown>,
  ): Promise<string[]> => {
    const request = await capture(path, run);
    return [...new URL(request.url).searchParams.keys()].sort();
  };

  return {
    ctx,
    capture,
    params,
    sent,
    fake,
    /** 直近に保存されたトークン（既定ストアを使ったときだけ入る）。 */
    get saved(): StoredTokens | undefined {
      return saved;
    },
  };
};

/** POST 本文（form-urlencoded）のキー。Token API は URL ではなく本文で値を渡す。 */
const bodyKeys = (request: TransportRequest): string[] =>
  [...new URLSearchParams(request.body ?? "").keys()].sort();

const hasMethod = (accessor: object, name: string): boolean =>
  typeof (accessor as Record<string, unknown>)[name] === "function";

// --- 表の読み方（セルの文法） -----------------------------------------------------------

const SENDS = "送る";
const HAS = "あり";
const REASON = /(ADR-\d{4}|LV-\d+|RV-\d+)/;
const MARKER = /[⚠⛔]/;

const sends = (cell: string): boolean => cell.startsWith(SENDS);
const reasonOf = (cell: string): string | undefined => REASON.exec(cell)?.[1];

// =========================================================================================

describe("V1 マトリクス: 表そのものが読めている（前提の自己チェック）", () => {
  it("表 A〜G がすべてある", () => {
    for (const label of [
      "表 A",
      "表 B",
      "表 C",
      "表 D",
      "表 E",
      "表 F",
      "表 G",
    ]) {
      expect(tableOf(label).length).toBeGreaterThan(0);
    }
  });

  it("表 A と表 B が同じ 17 エンドポイントを同じ順で並べている", () => {
    const a = tableOf("表 A").map(endpointOf);
    const b = tableOf("表 B").map(endpointOf);
    expect(a).toHaveLength(17);
    expect(b).toEqual(a);
  });

  it("表 A のエンドポイントに、実際に叩ける probe が 1 対 1 である", () => {
    // 表に足したのに叩いていない／叩いているのに表に無い、のどちらも落とす。
    expect(tableOf("表 A").map(endpointOf).sort()).toEqual(
      PROBES.map((p) => p.endpoint).sort(),
    );
  });

  it("reference の Read パラメータ表を読めている", () => {
    for (const [endpoint, params] of REFERENCE_PARAMS) {
      expect(
        params.size,
        `${endpoint} の reference パラメータが少なすぎる`,
      ).toBeGreaterThanOrEqual(3);
      expect(params.get("partition") ?? "—").toBe(
        endpoint === "/v1/partition" ? "—" : "●",
      );
    }
  });
});

describe("V1 マトリクス: 表 A ↔ reference（PORTERS が取るもの）", () => {
  // 表 A（共通 8 列）＋ 表 C（固有）を合わせたものが、reference の Input Variables と一致するか。
  const matrixSide = (): Map<string, Map<string, string>> => {
    const out = new Map<string, Map<string, string>>();
    for (const row of tableOf("表 A")) {
      const params = new Map<string, string>();
      for (const name of COMMON_PARAMS) {
        const cell = row[name] ?? "";
        if (cell === "●" || cell === "○") params.set(name, cell);
      }
      out.set(endpointOf(row), params);
    }
    for (const row of tableOf("表 C")) {
      const endpoint = endpointOf(row);
      const name = codeSpans(row["パラメータ"] ?? "")[0] ?? "";
      const mark = row["PORTERS"] ?? "";
      out.get(endpoint)?.set(name, mark);
    }
    return out;
  };

  const MATRIX_SIDE = matrixSide();

  it.each([...REFERENCE_PARAMS.keys()])(
    "%s のパラメータが reference と両方向で一致する",
    (endpoint) => {
      const asText = (params: Map<string, string> | undefined): string[] =>
        [...(params ?? new Map<string, string>())]
          .map(([name, mark]) => `${name} ${mark}`)
          .sort();
      expect(asText(MATRIX_SIDE.get(endpoint))).toEqual(
        asText(REFERENCE_PARAMS.get(endpoint)),
      );
    },
  );
});

describe("V1 マトリクス: 表 B / 表 C ↔ 実装（ライブラリが送るもの）", () => {
  // 表が「送る」と言うパラメータの集合。表 B（共通列）＋ 表 C（固有）。
  const expectedParams = (endpoint: string): string[] => {
    const row = tableOf("表 B").find((r) => endpointOf(r) === endpoint) ?? {};
    const names = COMMON_PARAMS.filter((name) => sends(row[name] ?? ""));
    for (const extra of tableOf("表 C")) {
      if (endpointOf(extra) !== endpoint) continue;
      if (!sends(extra["ライブラリ"] ?? "")) continue;
      names.push(codeSpans(extra["パラメータ"] ?? "")[0] ?? "");
    }
    return names.sort();
  };

  it.each(PROBES)(
    "$endpoint の Read が組み立てる URL が表どおり（過不足なし）",
    async (probe) => {
      const { ctx, params } = createProbeClient();
      const actual = await params(probe.endpoint, () => probe.read(ctx));
      expect(actual).toEqual(expectedParams(probe.endpoint));
    },
  );
});

describe("V1 マトリクス: 表 A と表 B / C のずれには根拠がある", () => {
  type Cell = {
    endpoint: string;
    param: string;
    cell: string;
    listed: boolean;
  };

  const cells = (): Cell[] => {
    const out: Cell[] = [];
    for (const row of tableOf("表 B")) {
      const endpoint = endpointOf(row);
      const reference = REFERENCE_PARAMS.get(endpoint);
      for (const param of COMMON_PARAMS) {
        out.push({
          endpoint,
          param,
          cell: row[param] ?? "",
          listed: reference?.has(param) ?? false,
        });
      }
    }
    for (const row of tableOf("表 C")) {
      const param = codeSpans(row["パラメータ"] ?? "")[0] ?? "";
      out.push({
        endpoint: endpointOf(row),
        param,
        cell: row["ライブラリ"] ?? "",
        listed: (row["PORTERS"] ?? "").length > 0,
      });
    }
    return out;
  };

  const CELLS = cells();

  it("食い違うセルにだけ根拠（ADR / LV / RV）が付いている", () => {
    // ずれているのに根拠が無い＝未決のまま出荷している。ずれていないのに根拠が残っている＝
    // 直したのに印を消し忘れている。どちらも同じ 1 つの比較で落とす。
    const wrong = CELLS.filter(
      (c) => MARKER.test(c.cell) !== (c.listed !== sends(c.cell)),
    ).map((c) => `${c.endpoint} ${c.param}: ${c.cell}`);
    expect(wrong).toEqual([]);
  });

  it("印が付いたセルは根拠の番号を持つ", () => {
    const missing = CELLS.filter(
      (c) => MARKER.test(c.cell) && reasonOf(c.cell) === undefined,
    ).map((c) => `${c.endpoint} ${c.param}: ${c.cell}`);
    expect(missing).toEqual([]);
  });
});

describe("V1 マトリクス: 根拠として挙げた番号が実在する", () => {
  const adrFiles = readdirSync("docs/adr");
  const rvFiles = readdirSync("docs/reviews/rv");
  const liveVerification = readFileSync(LIVE_VERIFICATION, "utf8");
  const text = readFileSync(MATRIX, "utf8");

  const ids = (pattern: RegExp): string[] => [
    ...new Set([...text.matchAll(pattern)].map((m) => m[0])),
  ];

  it("ADR-NNNN に対応するファイルがある", () => {
    const ids4 = ids(/ADR-\d{4}/g);
    expect(ids4.length).toBeGreaterThan(0);
    const missing = ids4.filter(
      (id) => !adrFiles.some((f) => f.startsWith(`${id.slice(4)}-`)),
    );
    expect(missing).toEqual([]);
  });

  it("LV-N に対応するエントリがある", () => {
    const found = ids(/LV-\d+/g);
    expect(found.length).toBeGreaterThan(0);
    const missing = found.filter(
      (id) => !liveVerification.includes(`## ${id} `),
    );
    expect(missing).toEqual([]);
  });

  it("RV-N に対応するエントリがある", () => {
    const found = ids(/RV-\d+/g);
    expect(found.length).toBeGreaterThan(0);
    const missing = found.filter((id) => {
      const number = id.slice(3).padStart(4, "0");
      return !rvFiles.some((f) => f.startsWith(`${number}-`));
    });
    expect(missing).toEqual([]);
  });
});

describe("V1 マトリクス: 表 D ↔ 実装（Read の操作）", () => {
  it.each(PROBES)(
    "$endpoint の search / searchAll / get が表どおり",
    (probe) => {
      const { ctx } = createProbeClient();
      const row = tableOf("表 D").find((r) => endpointOf(r) === probe.endpoint);
      expect(row).toBeDefined();
      const accessor = probe.accessor(ctx);
      for (const method of ["search", "searchAll", "get"]) {
        expect(hasMethod(accessor, method), `${probe.endpoint} ${method}`).toBe(
          (row?.[method] ?? "").startsWith(HAS),
        );
      }
    },
  );
});

describe("V1 マトリクス: 表 E ↔ 実装（Write）", () => {
  const WRITE_PROBES = PROBES.filter((p) => p.write !== undefined);

  it("表 E が Write を持つエンドポイントを過不足なく並べている", () => {
    expect(tableOf("表 E").map(endpointOf).sort()).toEqual(
      WRITE_PROBES.map((p) => p.endpoint).sort(),
    );
  });

  it.each(WRITE_PROBES)(
    "$endpoint の Write URL が partition だけを載せる",
    async (probe) => {
      const { ctx, params } = createProbeClient();
      const row = tableOf("表 E").find((r) => endpointOf(r) === probe.endpoint);
      const actual = await params(
        probe.endpoint,
        () => probe.write?.(ctx) ?? Promise.resolve(),
      );
      expect(actual).toEqual(
        COMMON_PARAMS.filter((name) => sends(row?.[name] ?? "")),
      );
    },
  );

  it.each(WRITE_PROBES)(
    "$endpoint の create / update / 一括が表どおり",
    (probe) => {
      const { ctx } = createProbeClient();
      const row = tableOf("表 E").find((r) => endpointOf(r) === probe.endpoint);
      const accessor = probe.accessor(ctx);
      expect(hasMethod(accessor, "create")).toBe(
        (row?.["create"] ?? "").startsWith(HAS),
      );
      expect(hasMethod(accessor, "update")).toBe(
        (row?.["update"] ?? "").startsWith(HAS),
      );
      // 一括は 2 つで 1 つの機能（ADR-0041）。表の 1 セルが両方の有無を言う。
      const bulk = (row?.["createMany / updateMany"] ?? "").startsWith(HAS);
      expect(hasMethod(accessor, "createMany")).toBe(bulk);
      expect(hasMethod(accessor, "updateMany")).toBe(bulk);
    },
  );
});

describe("V1 マトリクス: 表 F ↔ 実装（Authentication API）", () => {
  const paramsOfUrl = (url: string): string[] =>
    [...new URL(url).searchParams.keys()].sort();

  /** 表 F の 1 行（`種別` 列で引く）が挙げるパラメータ。 */
  const expected = (kind: string): string[] => {
    const row = tableOf("表 F").find(
      (r) => codeSpans(r["種別"] ?? "")[0] === kind,
    );
    expect(row, `表 F に ${kind} の行がありません`).toBeDefined();
    return codeSpans(row?.["パラメータ"] ?? "").sort();
  };

  it("表 F が 5 つの呼び出しを並べている", () => {
    expect(tableOf("表 F")).toHaveLength(5);
  });

  it("code 付与の URL が表どおり", () => {
    const { ctx } = createProbeClient();
    const url = ctx.porters.auth.authorizationUrl({
      redirectUrl: "https://example.test/callback",
      state: "s1",
    });
    expect(paramsOfUrl(url)).toEqual(expected("code"));
  });

  it("利用終了（remove）の URL が表どおり", () => {
    const { ctx } = createProbeClient();
    const url = ctx.porters.auth.revokeUrl({
      redirectUrl: "https://example.test/callback",
      state: "s1",
    });
    expect(paramsOfUrl(url)).toEqual(expected("remove"));
  });

  it("code_direct と Token 交換（oauth_code）が表どおり", async () => {
    const { ctx, capture } = createProbeClient();
    const oauth = await capture("/v1/oauth", () =>
      ctx.porters.auth.ensureAuthenticated(),
    );
    expect(paramsOfUrl(oauth.url)).toEqual(expected("code_direct"));

    const { ctx: next, capture: captureNext } = createProbeClient();
    const token = await captureNext("/v1/token", () =>
      next.porters.auth.ensureAuthenticated(),
    );
    // Token は URL ではなく POST の本文に載る（App Secret を URL に置かない）。
    expect(bodyKeys(token)).toEqual(expected("oauth_code"));
  });

  it("Access Token が切れたときの更新（refresh_token）が表どおり", async () => {
    // 更新経路は「Access Token だけ切れていて Refresh Token は生きている」状態でしか通らない。
    // 1 つ目のクライアントで本物のトークンを発行させ（フェイクが覚えている Refresh Token が要る）、
    // 2 つ目のクライアントには **Access Token だけ失効させた同じトークン**を持つストアを渡す。
    const first = createProbeClient();
    await first.ctx.porters.auth.ensureAuthenticated();
    const issued = first.saved;
    expect(issued).toBeDefined();

    const expiredAccess: TokenStore = {
      get: () =>
        Promise.resolve(
          issued === undefined
            ? undefined
            : { ...issued, accessTokenExpiresAt: 0 },
        ),
      set: () => Promise.resolve(),
      clear: () => Promise.resolve(),
    };
    const second = createProbeClient({
      fake: first.fake,
      tokenStore: expiredAccess,
    });
    const token = await second.capture("/v1/token", () =>
      second.ctx.porters.auth.ensureAuthenticated(),
    );
    expect(bodyKeys(token)).toEqual(expected("refresh_token"));
    // 更新なので code_direct は踏まない（踏んでいたら「更新」ではない）。
    expect(second.sent.map((r) => new URL(r.url).pathname)).not.toContain(
      "/v1/oauth",
    );
  });
});

describe("V1 マトリクス: 表 G ↔ 実装（HTTP ヘッダ）", () => {
  const headerRow = (name: string): Row => {
    const row = tableOf("表 G").find(
      (r) => codeSpans(r["ヘッダ"] ?? "")[0] === name,
    );
    expect(row, `表 G に ${name} の行がありません`).toBeDefined();
    return row ?? {};
  };

  it("Resource API の呼び出しに認証トークンと API バージョンが載る", async () => {
    const { ctx, capture } = createProbeClient();
    const request = await capture("/v1/candidate", () =>
      ctx.t.candidate.search({ field: ["P_Id"] }),
    );
    expect(headerRow("X-porters-hrbc-oauth-token")["ライブラリ"]).toContain(
      SENDS,
    );
    expect(request.headers["X-porters-hrbc-oauth-token"]).toBeDefined();

    // 既定バージョンは表のセルに書いてある値（ADR-0042）。表を書き換えたら落ちる。
    const version = codeSpans(
      headerRow("X-P-ConnectAPI-Version")["ライブラリ"] ?? "",
    )[0];
    expect(request.headers["X-P-ConnectAPI-Version"]).toBe(version);
  });

  it("Write と Token の Content-Type が表どおり", async () => {
    const { ctx, capture } = createProbeClient();
    // Token は最初の認証で 1 回だけ飛ぶので、Write より先に捕まえる。
    const token = await capture("/v1/token", () =>
      ctx.porters.auth.ensureAuthenticated(),
    );
    const write = await capture("/v1/client", () =>
      ctx.t.client.update(SEEDED_ID, {}),
    );
    const types = codeSpans(headerRow("Content-Type")["ライブラリ"] ?? "");
    expect(types).toHaveLength(2);
    expect(write.headers["Content-Type"]).toBe(types[0]);
    expect(token.headers["Content-Type"]).toBe(types[1]);
  });
});
