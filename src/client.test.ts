import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { PortersClient } from "./client";
import type { Transport } from "./http/types";
import type { UserRef } from "./xml/decode";

const candidateXml = readFileSync(
  fileURLToPath(
    new URL("../test/fixtures/candidate/read-basic.xml", import.meta.url),
  ),
  "utf8",
);

const mockClient = (): PortersClient => {
  const transport: Transport = {
    send: () => Promise.resolve({ status: 200, body: candidateXml }),
  };
  return new PortersClient({
    host: "example.test",
    partition: 999,
    transport,
    auth: { getAccessToken: () => Promise.resolve("TKN") },
  });
};

describe("PortersClient + candidate (E2E, mock transport)", () => {
  it("returns typed Candidate[] decoded from mock XML", async () => {
    const page = await mockClient().candidate.search({
      field: ["P_Id", "P_Name"],
      count: 200,
    });

    expect(page.total).toBe(2);
    expect(page.items).toHaveLength(2);

    const first = page.items[0];
    expect(first?.P_Id).toBe(10001); // Id -> number
    expect(first?.P_Name).toBe("山田 太郎"); // Text -> string
    expect(first?.P_UpdateDate).toBe("2026-01-02T03:04:05Z"); // DateTime -> ISO
    expect((first?.P_Owner as UserRef | null)?.P_Name).toBe("採用 花子"); // User -> nested
    expect(first?.P_Phase).toBe("P_PersonPhase_Applied"); // Option -> end alias

    // empty value -> null
    expect(page.items[1]?.P_Mail).toBeNull();
  });

  it("get(id) returns a single candidate", async () => {
    const c = await mockClient().candidate.get(10001);
    expect(c?.P_Id).toBe(10001);
  });
});
