// L1 integration for the remaining data resources (ADR-0043 phase 2). Candidate proved the
// vertical slice; these prove the *generic* path — every one of them goes through the same
// resource factory, so what is worth checking here is that each resource's own descriptor
// (names, prefix, catalog, required-on-create) lines up with what the fake serves.

import { describe, expect, it } from "vitest";

import { PortersClient } from "../../src/client";
import { createFakeTransport } from "../fake/index";

const setup = () => {
  const fake = createFakeTransport({
    users: [{ P_Id: 5, P_Name: "採用 花子" }],
  });
  const porters = new PortersClient({
    host: "fake.test",
    appId: "app-id",
    appSecret: "app-secret",
    transport: fake,
  });
  return { fake, porters };
};

describe("data resources round-trip", () => {
  it("creates and reads a Job (its prefix is Job, and it references Client / Recruiter)", async () => {
    const { porters } = setup();

    const id = await porters.tenant(1).job.create({
      P_Owner: 5,
      P_Client: 20001,
      P_Recruiter: 30001,
      // Job has no `P_Name` — its title field is `P_Position` (docs/reference), and the catalog
      // is what the types enforce.
      P_Position: "TypeScript エンジニア",
    });

    const job = await porters.tenant(1).job.get(id);
    expect(job?.P_Id).toBe(id);
    expect(job?.P_Position).toBe("TypeScript エンジニア");
    // System[Reference] writes an id and reads back the referenced record's id (ID-only).
    expect(job?.P_Client).toBe(20001);
    expect(job?.P_Recruiter).toBe(30001);
  });

  it("creates and updates a Client", async () => {
    const { porters } = setup();

    const id = await porters.tenant(1).client.create({
      P_Owner: 5,
      P_Name: "株式会社ABC",
    });
    await porters
      .tenant(1)
      .client.update(id, { P_Name: "株式会社ABC（旧XYZ）" });

    const client = await porters.tenant(1).client.get(id);
    expect(client?.P_Name).toBe("株式会社ABC（旧XYZ）");
  });

  it("creates a Resume against a Candidate", async () => {
    const { porters } = setup();
    const candidateId = await porters.tenant(1).candidate.create({
      P_Owner: 5,
      P_Name: "山田 太郎",
    });

    const resumeId = await porters.tenant(1).resume.create({
      P_Owner: 5,
      P_Candidate: candidateId,
      P_Name: "職務経歴書",
    });

    const resume = await porters.tenant(1).resume.get(resumeId);
    expect(resume?.P_Candidate).toBe(candidateId);
    expect(resume?.P_Name).toBe("職務経歴書");
  });

  it("creates a Process tying the other resources together", async () => {
    const { porters } = setup();

    const id = await porters.tenant(1).process.create({
      P_Owner: 5,
      P_Client: 20001,
      P_Recruiter: 30001,
      P_Job: 40001,
      P_Candidate: 10001,
      P_Resume: 50001,
    });

    const process = await porters.tenant(1).process.get(id);
    expect(process?.P_Job).toBe(40001);
    expect(process?.P_Candidate).toBe(10001);
  });

  it("keeps each resource in its own table, with its own id sequence", async () => {
    const { fake, porters } = setup();

    const candidateId = await porters.tenant(1).candidate.create({
      P_Owner: 5,
      P_Name: "山田 太郎",
    });
    const clientId = await porters.tenant(1).client.create({
      P_Owner: 5,
      P_Name: "株式会社ABC",
    });

    expect(candidateId).toBe(10001);
    expect(clientId).toBe(10001); // separate table, separate sequence
    expect(fake.control.records("candidate")).toHaveLength(1);
    expect(fake.control.records("client")).toHaveLength(1);
    expect(await porters.tenant(1).candidate.get(clientId)).toBeDefined();
    expect(await porters.tenant(1).job.get(candidateId)).toBeUndefined(); // job table is empty
  });

  it("searches per resource with typed conditions", async () => {
    const { porters } = setup();
    await porters
      .tenant(1)
      .client.create({ P_Owner: 5, P_Name: "株式会社ABC" });
    await porters
      .tenant(1)
      .client.create({ P_Owner: 5, P_Name: "株式会社XYZ" });

    const hits = await porters.tenant(1).client.search({
      condition: { P_Name: { part: "XYZ" } },
    });

    expect(hits.total).toBe(1);
    expect(hits.items[0]?.P_Name).toBe("株式会社XYZ");
  });
});
