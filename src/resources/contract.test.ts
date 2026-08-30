import { describe, expect, it } from "vitest";

import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
import type { FieldValue, UserRef } from "../xml/decode";
import { CONTRACT_DESCRIPTOR, createContractResource } from "./contract";

// The generic Read/Write flow is unit-tested in resource.test.ts; here we pin the
// Contract-specific catalog (each field decodes by its Data Type) and config
// (root name `Contract`, path `contract`, alias prefix `Contract`).
const USER_FIELDS = ["P_RegisteredBy", "P_UpdatedBy"];
const DATETIME_FIELDS = ["P_RegistrationDate", "P_UpdateDate"];
const DATE_FIELDS = [
  "P_StartDate",
  "P_EndDate",
  "P_ContractorStartDate",
  "P_ContractorEndDate",
];
const NUMBER_FIELDS = [
  "P_AdvancePayment",
  "P_ContingentFeeRate",
  "P_ContingentFee",
  "P_ContractorHeadCount",
  "P_ContractorFee",
];
const OPTION_FIELDS = ["P_ContractorType"];

const ALL =
  `<?xml version="1.0"?><Contract Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
  `<Contract.P_Id>42</Contract.P_Id>` +
  `<Contract.P_Client><Client><Client.P_Id>77</Client.P_Id></Client></Contract.P_Client>` +
  USER_FIELDS.map(
    (f, i) =>
      `<Contract.${f}><User><User.P_Id>${i + 1}</User.P_Id></User></Contract.${f}>`,
  ).join("") +
  DATETIME_FIELDS.map(
    (f, i) => `<Contract.${f}>2020/01/0${i + 1} 03:04:05</Contract.${f}>`,
  ).join("") +
  DATE_FIELDS.map(
    (f, i) => `<Contract.${f}>2021/02/0${i + 1}</Contract.${f}>`,
  ).join("") +
  NUMBER_FIELDS.map((f, i) => `<Contract.${f}>${100 + i}</Contract.${f}>`).join(
    "",
  ) +
  OPTION_FIELDS.map(
    (f) =>
      `<Contract.${f}><OptionRoot><Opt_${f}/></OptionRoot></Contract.${f}>`,
  ).join("") +
  `</Item></Contract>`;

const READ_OK = `<?xml version="1.0"?><Contract Total="0" Count="0" Start="0"><Code>0</Code></Contract>`;
const WRITE_OK = `<?xml version="1.0"?><Contract><Item><Id>2001</Id><Code>0</Code></Item></Contract>`;

type Call = { req: TransportRequest; spec?: RequestSpec };

const stub = (body: string, calls: Call[]): Requester => ({
  request: (req, parse, spec) => {
    calls.push({ req, spec });
    return Promise.resolve(parse(body));
  },
});

const resource = (calls: Call[], body: string) =>
  createContractResource({
    requester: stub(body, calls),
    accessPoint: { host: "h.test" },
    partition: 12,
  });

describe("createContractResource — decode catalog", () => {
  it("decodes every catalogued field by its Data Type", async () => {
    const calls: Call[] = [];
    const c = (await resource(calls, ALL).search()).items[0];
    // Closed ReadRecord has no string index (U1); read by-name through a loose view.
    const rec = c as Record<string, FieldValue | undefined>;

    expect(c.P_Id).toBe(42); // Id -> number
    expect(c.P_Client).toBe(77); // System[Reference] -> referenced id
    USER_FIELDS.forEach((f, i) =>
      expect((rec[f] as UserRef | null)?.P_Id).toBe(i + 1),
    ); // User -> nested ref
    DATETIME_FIELDS.forEach((f, i) =>
      expect(rec[f]).toBe(`2020-01-0${i + 1}T03:04:05Z`),
    ); // System[DateTime] -> ISO (...Z)
    DATE_FIELDS.forEach((f, i) => expect(rec[f]).toBe(`2021-02-0${i + 1}`)); // Date -> ISO date
    NUMBER_FIELDS.forEach((f, i) => expect(rec[f]).toBe(100 + i)); // Number (incl. Currency)
    OPTION_FIELDS.forEach((f) => expect(rec[f]).toEqual([`Opt_${f}`])); // Option -> array
  });

  it("types the Currency fields as Number (Field Type ≠ Data Type)", () => {
    // PORTERS' Field Type is `Currency`; its Data Type is `Number`. Recording the Data Type
    // is what keeps the DataType union from growing a value PORTERS never defined.
    const fields = CONTRACT_DESCRIPTOR.fields;
    expect(fields.P_AdvancePayment).toBe("Number");
    expect(fields.P_ContingentFee).toBe("Number");
    expect(fields.P_ContractorFee).toBe("Number");
  });

  it("has no P_Owner — PORTERS does not publish one for Contract", () => {
    // Every other data resource requires an owner on create; Contract has no such field at all.
    expect("P_Owner" in CONTRACT_DESCRIPTOR.fields).toBe(false);
  });
});

describe("createContractResource — config & write", () => {
  it("create POSTs to /v1/contract, requiring only P_Client", async () => {
    const calls: Call[] = [];
    const id = await resource(calls, WRITE_OK).create({
      P_Client: 77,
      P_Name: "基本契約",
      P_ContingentFee: 500000,
    });
    expect(id).toBe(2001); // assigned id from the Write response
    const { req, spec } = calls[0];
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://h.test/v1/contract?partition=12");
    expect(req.body).toBe(
      "<Contract><Item>" +
        "<Contract.P_Client>77</Contract.P_Client>" +
        "<Contract.P_Name>基本契約</Contract.P_Name>" +
        "<Contract.P_ContingentFee>500000</Contract.P_ContingentFee>" +
        "<Contract.P_Id>-1</Contract.P_Id>" +
        "</Item></Contract>",
    );
    expect(spec).toEqual({ write: true, idempotent: false });
  });

  it("get(id) sends a Contract.P_Id condition against /v1/contract", async () => {
    const calls: Call[] = [];
    const one = await resource(calls, READ_OK).get(7);
    expect(one).toBeUndefined(); // 0-item response
    expect(calls[0].req.url).toContain("https://h.test/v1/contract?");
    expect(decodeURIComponent(calls[0].req.url)).toContain(
      "Contract.P_Id:eq=7",
    );
  });
});
