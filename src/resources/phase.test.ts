import { describe, expect, it } from "vitest";

import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
import type { DepartmentRef, FieldValue, UserRef } from "../xml/decode";
import { PHASE_DESCRIPTOR, createPhaseAccessor } from "./phase";

// The generic Read/Write flow is unit-tested in resource.test.ts; here we pin what makes Phase
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
    accessPoint: { host: "h.test" },
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
    // Phase has no custom fields and no Deleted field (docs/reference resources/phase.md).
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
      accessPoint: { host: "h.test" },
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
        // The binding comes first and cannot be shadowed by the caller.
        "<Resource>5</Resource>" +
        "<ResourceId>20001</ResourceId>" +
        "<Phase><Opt_Contacted/></Phase>" +
        "<Date>2026/08/30 03:04:05</Date>" +
        "<Id>-1</Id>" +
        "</Item></Phase>",
    );
    expect(spec).toEqual({ write: true, idempotent: false });
  });

  it("update targets the given id through `Id`", async () => {
    const calls: Call[] = [];
    await phases(calls, WRITE_OK).update(10014, { Memo: "追記" });
    expect(calls[0].req.body).toBe(
      "<Phase><Item>" +
        "<Resource>5</Resource>" +
        "<Memo>追記</Memo>" +
        "<Id>10014</Id>" +
        "</Item></Phase>",
    );
  });
});
