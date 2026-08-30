// L1 integration for reference expansion (ADR-0058 / RV-31): a Read that asks for the fields of a
// referenced record gets them back, decoded by the *referenced* resource's Data Types.
//
// Worth doing end-to-end rather than at the unit seam, because the failure this fixes lived in the
// gap between the two halves — the request said "give me the client's name", the response carried
// it, and decode threw it away. Here the whole round-trip is real: the fake writes the referenced
// records into its own store and serves them nested, exactly as the reference documents.

import { describe, expect, it } from "vitest";

import { PortersClient } from "../../src/client";
import { PortersConfigError } from "../../src/errors";
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
  return porters.tenant(1);
};

describe("expand — reading the referenced record (ADR-0058)", () => {
  it("returns the referenced record's fields, not just its id", async () => {
    const t = setup();
    const clientId = await t.client.create({
      P_Owner: 5,
      P_Name: "株式会社ABC",
    });
    const jobId = await t.job.create({
      P_Owner: 5,
      P_Client: clientId,
      P_Recruiter: 30001,
      P_Position: "TypeScript エンジニア",
    });

    const page = await t.job.search({
      condition: { P_Id: { eq: jobId } },
      expand: { P_Client: ["P_Id", "P_Name"] },
    });

    expect(page.items[0]?.P_Client).toEqual({
      P_Id: clientId,
      P_Name: "株式会社ABC",
    });
    // The job's own fields are untouched by the expansion.
    expect(page.items[0]?.P_Position).toBe("TypeScript エンジニア");
  });

  it("still reads as the referenced id when nothing was expanded (RV-31 の既定経路)", async () => {
    const t = setup();
    const clientId = await t.client.create({
      P_Owner: 5,
      P_Name: "株式会社ABC",
    });
    const jobId = await t.job.create({
      P_Owner: 5,
      P_Client: clientId,
      P_Recruiter: 30001,
    });

    const job = await t.job.get(jobId);
    expect(job?.P_Client).toBe(clientId);
  });

  it("uses the referenced resource's alias prefix, not its name (Candidate は Person)", async () => {
    // The one case where the two differ — and the reason the prefix travels on the descriptor
    // instead of being derived from the resource name. VERIFY(live): LV-16.
    const t = setup();
    const candidateId = await t.candidate.create({
      P_Owner: 5,
      P_Name: "山田 太郎",
      P_Mail: "yamada@example.test",
    });
    const resumeId = await t.resume.create({
      P_Owner: 5,
      P_Candidate: candidateId,
    });

    const resume = await t.resume.get(resumeId, {
      expand: { P_Candidate: ["P_Id", "P_Name", "P_Mail"] },
    });
    expect(resume?.P_Candidate).toEqual({
      P_Id: candidateId,
      P_Name: "山田 太郎",
      P_Mail: "yamada@example.test",
    });
  });

  it("decodes the expanded values by the referenced catalog's Data Types", async () => {
    const t = setup();
    const candidateId = await t.candidate.create({
      P_Owner: 5,
      P_Name: "山田",
    });
    const resumeId = await t.resume.create({
      P_Owner: 5,
      P_Candidate: candidateId,
    });

    const resume = await t.resume.get(resumeId, {
      // P_RegistrationDate is System[DateTime] on Candidate: the fake stores PORTERS wire format,
      // and the value comes back as ISO 8601 because the *referenced* catalog said so.
      expand: { P_Candidate: ["P_RegistrationDate"] },
    });
    const registered = (resume?.P_Candidate as { P_RegistrationDate?: unknown })
      .P_RegistrationDate;
    expect(registered).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it("expands more than one reference in the same read", async () => {
    const t = setup();
    const clientId = await t.client.create({
      P_Owner: 5,
      P_Name: "株式会社ABC",
    });
    const candidateId = await t.candidate.create({
      P_Owner: 5,
      P_Name: "山田 太郎",
    });
    const jobId = await t.job.create({
      P_Owner: 5,
      P_Client: clientId,
      P_Recruiter: 30001,
    });
    const resumeId = await t.resume.create({
      P_Owner: 5,
      P_Candidate: candidateId,
    });
    const processId = await t.process.create({
      P_Owner: 5,
      P_Client: clientId,
      P_Recruiter: 30001,
      P_Job: jobId,
      P_Candidate: candidateId,
      P_Resume: resumeId,
    });

    const p = await t.process.get(processId, {
      expand: { P_Client: ["P_Name"], P_Candidate: ["P_Name"] },
    });
    expect(p?.P_Client).toEqual({ P_Name: "株式会社ABC" });
    expect(p?.P_Candidate).toEqual({ P_Name: "山田 太郎" });
    // Un-expanded references in the same record keep their ids — expanding one costs the others
    // nothing, in the type and at runtime.
    expect(p?.P_Job).toBe(jobId);
    expect(p?.P_Recruiter).toBe(30001);
  });

  it("rejects an expansion hand-written into field, pointing at expand", async () => {
    const t = setup();
    await expect(
      t.job.search({
        // Only reachable through a cast: `field` takes bare aliases (ADR-0059).
        field: [
          "Job.P_Client(Client.P_Id,Client.P_Name)",
        ] as unknown as undefined,
      }),
    ).rejects.toBeInstanceOf(PortersConfigError);
  });
});
