// Every Data Type, written and read back through the real client (ADR-0043 phase 3, last item).
// Read and Write are asymmetric for User / Option / Reference (write-format.md), and the date
// types are normalised ISO <-> PORTERS, so a per-type round-trip is the check that the fake's wire
// shapes and the library's encode/decode actually agree — on both sides, for every type.

import { describe, expect, it } from "vitest";

import { PortersClient } from "../../src/client";
import { defineFields } from "../../src/fields/define-fields";
import type { UserRef } from "../../src/xml/decode";
import { createFakeTransport } from "../fake/index";

// Custom fields cover the Data Types no MVP resource happens to carry (Date / Age / URL / Number).
const fields = defineFields({
  candidate: (f) => ({
    U_score: f.number(),
    U_joinedOn: f.date(),
    U_birthday: f.age(),
    U_site: f.url(),
    U_tags: f.option(),
    U_recruiter: f.user(),
  }),
});

const OWNER = {
  P_Id: 5,
  P_Type: "0",
  P_Name: "採用 花子",
  P_Mail: "hanako@example.com",
};

const setup = () => {
  const fake = createFakeTransport({ users: [OWNER, { P_Id: 7 }] });
  const porters = new PortersClient({
    host: "fake.test",
    appId: "app-id",
    appSecret: "app-secret",
    transport: fake,
    fields,
  });
  return { fake, porters };
};

describe("field type round-trips", () => {
  it("carries every standard Data Type through create -> read", async () => {
    const { porters } = setup();

    const id = await porters.tenant(1).candidate.create({
      P_Owner: 5, // User -> ID in, nested out
      P_Name: "山田 太郎", // SinglelineText
      P_Mail: "taro@example.com", // Mail
      P_Telephone: "03-1234-5678", // Telephone
      P_Phase: ["Option.P_Applied"], // Option
      P_PhaseDate: "2026-01-02T03:04:05Z", // DateTime (ISO <-> PORTERS)
      U_score: 42, // Number
      U_joinedOn: "2026-04-01", // Date
      U_birthday: "1990-05-06", // Age (shares Date's wire format)
      U_site: "https://example.com/taro", // URL
      U_recruiter: 7, // User (declared custom)
    });

    const c = await porters.tenant(1).candidate.get(id);

    expect(c?.P_Id).toBe(id); // System[Id] -> number
    expect(c?.P_Name).toBe("山田 太郎");
    expect(c?.P_Mail).toBe("taro@example.com");
    expect(c?.P_Telephone).toBe("03-1234-5678");
    expect(c?.P_Phase).toEqual(["Option.P_Applied"]);
    expect(c?.P_PhaseDate).toBe("2026-01-02T03:04:05Z");
    expect(c?.U_score).toBe(42);
    expect(c?.U_joinedOn).toBe("2026-04-01");
    expect(c?.U_birthday).toBe("1990-05-06");
    expect(c?.U_site).toBe("https://example.com/taro");
    expect(c?.P_Owner as UserRef).toEqual(OWNER);
    expect((c?.U_recruiter as UserRef).P_Id).toBe(7);
    // System[DateTime] is server-owned: present on read, never written by the caller.
    expect(c?.P_RegistrationDate).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,
    );
  });

  it("round-trips a multi-select Option, including replacing the selection", async () => {
    const { porters } = setup();

    const id = await porters.tenant(1).candidate.create({
      P_Owner: 5,
      U_tags: ["Option.P_Java", "Option.P_TypeScript", "Option.P_Go"],
    });
    expect((await porters.tenant(1).candidate.get(id))?.U_tags).toEqual([
      "Option.P_Java",
      "Option.P_TypeScript",
      "Option.P_Go",
    ]);

    // An update replaces the whole selection (PORTERS writes the set, not a delta).
    await porters.tenant(1).candidate.update(id, { U_tags: ["Option.P_Rust"] });
    expect((await porters.tenant(1).candidate.get(id))?.U_tags).toEqual([
      "Option.P_Rust",
    ]);
  });

  it("round-trips System[Reference] as the referenced record's id", async () => {
    const { porters } = setup();
    const candidateId = await porters.tenant(1).candidate.create({
      P_Owner: 5,
      P_Name: "山田 太郎",
    });

    const resumeId = await porters.tenant(1).resume.create({
      P_Owner: 5,
      P_Candidate: candidateId, // System[Reference] -> ID in, nested id out
      P_Name: "職務経歴書",
    });

    expect((await porters.tenant(1).resume.get(resumeId))?.P_Candidate).toBe(
      candidateId,
    );
  });

  it("distinguishes an unset field (null) from a cleared one", async () => {
    const { porters } = setup();
    const id = await porters.tenant(1).candidate.create({
      P_Owner: 5,
      P_Name: "山田 太郎",
      P_Mail: "taro@example.com",
    });

    // `null` omits the field (leaves it unchanged); `""` clears it.
    await porters.tenant(1).candidate.update(id, { P_Name: null, P_Mail: "" });

    const c = await porters.tenant(1).candidate.get(id);
    expect(c?.P_Name).toBe("山田 太郎"); // untouched
    expect(c?.P_Mail).toBeNull(); // cleared -> empty element -> null
    expect(c?.P_Reading).toBeNull(); // never set
  });

  it("filters on every condition family the query surface exposes", async () => {
    const { porters } = setup();
    await porters.tenant(1).candidate.create({
      P_Owner: 5,
      P_Name: "山田 太郎",
      P_PhaseDate: "2026-01-02T03:04:05Z",
      U_score: 10,
      U_tags: ["Option.P_Java"],
    });
    await porters.tenant(1).candidate.create({
      P_Owner: 7,
      P_Name: "佐藤 次郎",
      P_PhaseDate: "2026-06-01T00:00:00Z",
      U_score: 90,
      U_tags: ["Option.P_Go"],
    });

    const byUser = await porters.tenant(1).candidate.search({
      condition: { P_Owner: { eq: 7 } },
    });
    expect(byUser.items.map((c) => c.P_Name)).toEqual(["佐藤 次郎"]);

    const byNumber = await porters.tenant(1).candidate.search({
      condition: { U_score: { ge: 50 } },
    });
    expect(byNumber.total).toBe(1);

    const byDate = await porters.tenant(1).candidate.search({
      condition: { P_PhaseDate: { lt: "2026-03-01T00:00:00Z" } },
    });
    expect(byDate.items.map((c) => c.P_Name)).toEqual(["山田 太郎"]);

    const byOption = await porters.tenant(1).candidate.search({
      condition: { U_tags: { or: ["Option.P_Java", "Option.P_Rust"] } },
    });
    expect(byOption.items.map((c) => c.P_Name)).toEqual(["山田 太郎"]);
  });
});
