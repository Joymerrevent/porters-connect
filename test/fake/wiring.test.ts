// Phase 0's reuse check (docs/design/fake-server-plan.md): everything the later phases build the
// wire on has to be reachable *from here* — the library's XML modules, its resource descriptors and
// the shared fixtures. ADR-0043 forbids the fake keeping its own copy of any of them, so this test
// exercises the seams now, while they are cheap to fix.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CANDIDATE_DESCRIPTOR } from "../../src/resources/candidate";
import { ATTACHMENT_FIELD_NAMES } from "../../src/resources/attachment";
import { decoderFor } from "../../src/resources/read-core";
import { buildWriteXml } from "../../src/xml/encode";
import { parseResourcePage, parseWriteResult } from "../../src/xml/parser";
import { ATTACHMENT_DESCRIPTOR, FAKE_RESOURCES } from "./resources";

const fixture = (path: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../fixtures/${path}`, import.meta.url)),
    "utf8",
  );

describe("fake server wiring", () => {
  it("routes on the library's own resource descriptor, not a copy", () => {
    // Same object identity = there is no second catalog that could drift from the resource module.
    expect(FAKE_RESOURCES.get("candidate")?.descriptor).toBe(
      CANDIDATE_DESCRIPTOR,
    );
    expect(CANDIDATE_DESCRIPTOR.prefix).toBe("Person");
    expect(CANDIDATE_DESCRIPTOR.fields.P_Owner).toBe("User");
  });

  it("serves every implemented resource, each keyed on its own primary key", () => {
    expect([...FAKE_RESOURCES.keys()].sort()).toEqual([
      "activity",
      "attachment",
      "candidate",
      "client",
      "contact",
      "contract",
      // masters (read-only)
      "field",
      "job",
      "opportunity",
      "option",
      "partition",
      "process",
      "recruiter",
      "resume",
      "user",
    ]);
    for (const [path, resource] of FAKE_RESOURCES) {
      expect(resource.descriptor.path).toBe(path);
      expect(resource.descriptor.fields[resource.idAlias]).toBe("System[Id]");
    }
    // Only the masters carry a bespoke read handler; only Partition takes no `partition`.
    expect(
      [...FAKE_RESOURCES.values()].filter((r) => r.master !== undefined).length,
    ).toBe(4);
    expect(
      [...FAKE_RESOURCES.values()].filter((r) => r.partitionless).length,
    ).toBe(1);
  });

  it("keeps the hand-written Attachment table in step with the library's field list", () => {
    // Attachment is bespoke in the library too (no catalog to borrow), so the fake types its
    // fields itself — but the *names* come from the library, and this is the alarm if they change.
    expect(Object.keys(ATTACHMENT_DESCRIPTOR.fields)).toEqual(
      ATTACHMENT_FIELD_NAMES,
    );
    expect(
      Object.values(ATTACHMENT_DESCRIPTOR.fields).every(
        (type) => type !== undefined,
      ),
    ).toBe(true);
    // No alias prefix: its tags are bare (`<FileName>`), unlike `<Person.P_Name>`.
    expect(ATTACHMENT_DESCRIPTOR.prefix).toBe("");
  });

  it("reads the shared fixtures and decodes them through the library", () => {
    const page = parseResourcePage(
      fixture("candidate/read-basic.xml"),
      "Candidate",
    );
    expect(page.total).toBe(2);

    const decode = decoderFor(CANDIDATE_DESCRIPTOR.fields);
    const first = decode(page.items[0]);
    expect(first.P_Id).toBe(10001);
    expect(first.P_Name).toBe("山田 太郎");
    expect(first.P_UpdateDate).toBe("2026-01-02T03:04:05Z");
    expect(first.P_Phase).toEqual(["Option.P_PersonPhase_Applied"]);

    const written = parseWriteResult(fixture("candidate/write-result.xml"));
    expect(written).toEqual([{ id: 10001, code: 0 }]);
  });

  it("can build the very XML the fake will have to accept", () => {
    // The Write body the library sends is what phase 1's fake has to parse — proving the encoder is
    // importable here means the fake can round-trip against the real serializer.
    const xml = buildWriteXml({
      resource: CANDIDATE_DESCRIPTOR.name,
      prefix: CANDIDATE_DESCRIPTOR.prefix,
      fields: new Map(Object.entries(CANDIDATE_DESCRIPTOR.fields)),
      items: [{ P_Id: -1, P_Owner: 5, P_Name: "山田 太郎" }],
    });

    expect(xml).toBe(
      "<Candidate><Item><Person.P_Id>-1</Person.P_Id>" +
        "<Person.P_Owner>5</Person.P_Owner>" +
        "<Person.P_Name>山田 太郎</Person.P_Name></Item></Candidate>",
    );
  });
});
