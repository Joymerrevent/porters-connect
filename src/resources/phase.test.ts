import { describe, expect, it } from "vitest";

import { PortersConfigError } from "../errors";
import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
import type { DepartmentRef, FieldValue, UserRef } from "../xml/field-value";
import { PHASE_DESCRIPTOR, createPhaseAccessor } from "./phase";

// The generic Read/Write flow is unit-tested in accessor/data-reader.test.ts and
// accessor/data-writer.test.ts; here we pin what makes Phase
// different (ADR-0061): bare aliases, `Id` as the primary key, the bound `resource`, and
// System[Department].
const USER_FIELDS = [
  "RegisteredBy",
  "UpdatedBy",
  "Owner",
  "JobOwner",
  "ResumeOwner",
];
const DEPARTMENT_FIELDS = [
  "OwnerDepartment",
  "JobOwnerDepartment",
  "ResumeOwnerDepartment",
];

const ALL =
  `<?xml version="1.0"?><Phase Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
  // Bare tags — no `Phase.` prefix anywhere in the response.
  `<Id>10014</Id><Resource>5</Resource><ResourceId>20001</ResourceId><Recent>1</Recent>` +
  `<Date>2026/08/30 03:04:05</Date><RegistrationDate>2026/08/29 01:02:03</RegistrationDate>` +
  `<UpdateDate>2026/08/30 01:02:03</UpdateDate>` +
  `<Memo/>` +
  `<Phase><OptionRoot><Opt_Contacted/></OptionRoot></Phase>` +
  USER_FIELDS.map(
    (f, i) => `<${f}><User><User.P_Id>${i + 1}</User.P_Id></User></${f}>`,
  ).join("") +
  DEPARTMENT_FIELDS.map(
    (f, i) =>
      `<${f}><Department><Department.P_Id>${100 + i}</Department.P_Id>` +
      `<Department.P_Name>部署${i}</Department.P_Name></Department></${f}>`,
  ).join("") +
  `</Item></Phase>`;

const READ_OK = `<?xml version="1.0"?><Phase Total="0" Count="0" Start="0"><Code>0</Code></Phase>`;
const WRITE_OK = `<?xml version="1.0"?><Phase><Item><Id>2001</Id><Code>0</Code></Item></Phase>`;

type Call = { req: TransportRequest; spec?: RequestSpec };

const stub = (body: string, calls: Call[]): Requester => ({
  request: (req, parse, spec) => {
    calls.push({ req, spec });
    return Promise.resolve(parse(body));
  },
});

const phases = (calls: Call[], body: string) =>
  createPhaseAccessor({
    requester: stub(body, calls),
    accessPoint: { hostname: "h.test" },
    partition: 12,
  }).of("client");

describe("createPhaseAccessor — decode catalog", () => {
  it("decodes bare-alias tags by their Data Type", async () => {
    const calls: Call[] = [];
    const p = (await phases(calls, ALL).search()).items[0];
    const rec = p as Record<string, FieldValue | undefined>;

    expect(p.Id).toBe(10014); // System[Id] -> number, read from `<Id>` (no prefix)
    expect(p.Resource).toBe(5);
    expect(p.ResourceId).toBe(20001);
    expect(p.Recent).toBe(1);
    expect(p.Date).toBe("2026-08-30T03:04:05Z"); // DateTime -> ISO
    expect(p.RegistrationDate).toBe("2026-08-29T01:02:03Z");
    expect(p.Memo).toBeNull(); // empty Text -> null
    expect(p.Phase).toEqual(["Opt_Contacted"]); // Option -> array
    USER_FIELDS.forEach((f, i) =>
      expect((rec[f] as UserRef | null)?.P_Id).toBe(i + 1),
    );
    DEPARTMENT_FIELDS.forEach((f, i) => {
      const d = rec[f] as DepartmentRef | null;
      expect(d?.P_Id).toBe(100 + i); // System[Department] -> DepartmentRef (ADR-0061 案3a)
      expect(d?.P_Name).toBe(`部署${i}`);
    });
  });

  it("carries no alias prefix and names its primary key `Id`", () => {
    expect(PHASE_DESCRIPTOR.prefix).toBe("");
    expect(PHASE_DESCRIPTOR.idAlias).toBe("Id");
    // Phase has no custom fields and no Deleted field (docs/usage/reference resources/phase.md).
    expect("P_Deleted" in PHASE_DESCRIPTOR.fields).toBe(false);
  });
});

describe("createPhaseAccessor — the bound resource", () => {
  it("sends `resource=` as its own parameter, with bare aliases everywhere else", async () => {
    const calls: Call[] = [];
    await phases(calls, READ_OK).search({
      field: ["Id", "Date", "Memo"],
      condition: { ResourceId: { eq: 20001 } },
      order: [{ Date: "desc" }],
    });
    const url = decodeURIComponent(calls[0].req.url);

    expect(url).toContain("resource=5"); // Client, from of("client")
    // No `Phase.` anywhere: field / condition / order all use the bare alias.
    expect(url).toContain("field=Id,Date,Memo");
    expect(url).toContain("ResourceId:eq=20001");
    expect(url).toContain("order=Date:desc");
    expect(url).not.toContain("Phase.");
  });

  it("binds a different resource per of() call", async () => {
    const calls: Call[] = [];
    const deps = {
      requester: stub(READ_OK, calls),
      accessPoint: { hostname: "h.test" },
      partition: 12,
    };
    const accessor = createPhaseAccessor(deps);
    await accessor.of("job").search();
    await accessor.of("candidate").search();

    expect(calls[0].req.url).toContain("resource=3"); // Job
    expect(calls[1].req.url).toContain("resource=1"); // Candidate
  });

  it("get(id) addresses the record through `Id`, not `P_Id`", async () => {
    const calls: Call[] = [];
    const one = await phases(calls, READ_OK).get(10014);
    expect(one).toBeUndefined(); // 0-item response
    const url = decodeURIComponent(calls[0].req.url);
    expect(url).toContain("condition=Id:eq=10014");
    // `P_Id` may legitimately appear in the *referenced* User sub-fields
    // (`Owner(User.P_Id,…)`), so pin the condition itself rather than the whole URL.
    expect(url).not.toContain("condition=P_Id");
  });
});

describe("createPhaseAccessor — write", () => {
  it("fills `Resource` and `Id` itself; the caller supplies ResourceId", async () => {
    const calls: Call[] = [];
    const id = await phases(calls, WRITE_OK).create({
      ResourceId: 20001,
      Phase: ["Opt_Contacted"],
      Date: "2026-08-30T03:04:05Z",
    });
    expect(id).toBe(2001);
    const { req, spec } = calls[0];
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://h.test/v1/phase?partition=12");
    expect(req.body).toBe(
      "<Phase><Item>" +
        "<ResourceId>20001</ResourceId>" +
        "<Phase><Opt_Contacted/></Phase>" +
        "<Date>2026/08/30 03:04:05</Date>" +
        "<Id>-1</Id>" +
        // 束ねた値は**最後**に置く。呼び出し側が渡してきたら弾くので順序は本来どうでもよいが、
        // 何かがガードを迂回しても上書きされない側に倒しておく（RV-47）。タグの順序は
        // PORTERS 側で意味を持たない。
        "<Resource>5</Resource>" +
        "</Item></Phase>",
    );
    expect(spec).toEqual({ write: true, idempotent: false });
  });

  it("update targets the given id through `Id`", async () => {
    const calls: Call[] = [];
    await phases(calls, WRITE_OK).update(10014, { Memo: "追記" });
    expect(calls[0].req.body).toBe(
      "<Phase><Item>" +
        "<Memo>追記</Memo>" +
        "<Id>10014</Id>" +
        "<Resource>5</Resource>" +
        "</Item></Phase>",
    );
  });

  // RV-47: 束ねた値は**権威**。忘れられないだけでなく、矛盾させられない。
  // 現実的な経路は「読んだレコードを展開して作り直す」形で、これは型でも実行時でも止める。
  it("束ねた `Resource` を渡したら、送らずに落とす（create）", async () => {
    const calls: Call[] = [];
    let err: unknown;
    try {
      await phases(calls, WRITE_OK).create({
        ResourceId: 20001,
        Resource: 3, // Job。束ねているのは Client（5）
      } as never);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersConfigError);
    expect((err as PortersConfigError).category).toBe("config");
    expect((err as PortersConfigError).message).toContain("Resource");
    expect((err as PortersConfigError).hint).toContain("of(");
    // 送信前に止まる＝間違ったリソースに Phase が付くことはない（Phase に削除 API は無い）。
    expect(calls).toHaveLength(0);
  });

  it("update でも同じ（黙って捨てない）", async () => {
    const calls: Call[] = [];
    let err: unknown;
    try {
      await phases(calls, WRITE_OK).update(10014, { Resource: 3 } as never);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersConfigError);
    expect(calls).toHaveLength(0);
  });

  it("一括でも同じ（1 件でも混じれば送らない）", async () => {
    const calls: Call[] = [];
    let err: unknown;
    try {
      await phases(calls, WRITE_OK).createMany([
        { ResourceId: 20001 },
        { ResourceId: 20002, Resource: 3 },
      ] as never);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersConfigError);
    expect(calls).toHaveLength(0);
  });

  it("`Resource: undefined` は通る（型が許している形と揃える）", async () => {
    const calls: Call[] = [];
    await phases(calls, WRITE_OK).create({
      ResourceId: 20001,
      Resource: undefined,
    });
    // 束ねた値がそのまま乗る。
    expect(calls[0]?.req.body).toContain("<Resource>5</Resource>");
  });

  // ADR-0076: 型からは外したが、**実行時は素通りのまま**にしてある。契約を持つ人が cast で
  // 実機を試せること（＝ LV-25 を確定させる手段）が残っているかを、ここで固定する。
  // 型を締めたついでに実行時まで塞ぐと、この経路が黙って消える。
  it("keywords / itemstate は cast すれば送れる（実行時は素通り・LV-25）", async () => {
    const calls: Call[] = [];
    await phases(calls, READ_OK).search({
      field: ["Id"],
      keywords: ["山田"],
      itemstate: "all",
    } as unknown as Parameters<ReturnType<typeof phases>["search"]>[0]);

    const url = new URL(calls[0]?.req.url ?? "");
    expect(url.searchParams.get("keywords")).toBe("山田");
    expect(url.searchParams.get("itemstate")).toBe("all");
  });

  it("既定の search はそのどちらも載せない", async () => {
    const calls: Call[] = [];
    await phases(calls, READ_OK).search({ field: ["Id"] });

    const url = new URL(calls[0]?.req.url ?? "");
    expect(url.searchParams.has("keywords")).toBe(false);
    expect(url.searchParams.has("itemstate")).toBe(false);
    // 出典が挙げる `resource` は変わらず載る（ADR-0061）。
    expect(url.searchParams.get("resource")).toBe("5");
  });
});

// JS から渡された、表に無い名前は送る前に止める（RV-113）。
it("createPhaseAccessor().of refuses a name missing from the Resource List", () => {
  expect(() =>
    createPhaseAccessor({
      requester: stub("", []),
      accessPoint: { hostname: "h.test" },
      partition: 12,
    }).of("user" as never),
  ).toThrow('phase.of: unknown resource "user"');
});
