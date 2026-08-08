// L1 integration for the master reads (ADR-0043 phase 3 / ADR-0021/0022). These four have their
// own query vocabulary — no `condition`, no `get(id)`, only User takes `field` — and `request_type`
// means different things depending on the OAuth method. The fake authenticates like `code_direct`,
// which is the library's default, so that is the behaviour these tests pin.

import { describe, expect, it } from "vitest";

import { PortersClient } from "../../src/client";
import { createFakeTransport } from "../fake/index";
import type { FakeTransportOptions } from "../fake/types";

const USERS = [
  { P_Id: 1, P_Name: "API アプリ", P_Mail: "app@example.invalid" },
  { P_Id: 5, P_Type: "0", P_Name: "採用 花子", P_Mail: "hanako@example.com" },
  { P_Id: 9, P_Type: "1", P_Name: "管理 太郎", P_Mail: "admin@example.com" },
];

const setup = (options: FakeTransportOptions = {}) => {
  const fake = createFakeTransport({ users: USERS, ...options });
  const porters = new PortersClient({
    host: "fake.test",
    appId: "app-id",
    appSecret: "app-secret",
    partition: 1,
    transport: fake,
  });
  return { fake, porters };
};

describe("partition master", () => {
  it("lists the accessible partitions without sending a partition", async () => {
    const { porters } = setup({ partitions: [1, 42] });

    const page = await porters.partition.search();

    expect(page.total).toBe(2);
    expect(page.items.map((p) => p.P_Id)).toEqual([1, 42]);
    expect(page.items[0]?.P_CompanyId).toBe("fake-company-1");
  });

  it("refuses the login partition under code_direct (Result Code 403)", async () => {
    const { porters } = setup();

    // request_type=0 needs the browser `code` grant; the library's default auth is code_direct.
    await expect(
      porters.partition.search({ requestType: 0 }),
    ).rejects.toMatchObject({ category: "permission", code: 403 });
  });

  it("pages with searchAll", async () => {
    const { porters } = setup({ partitions: [1, 2, 3] });

    const seen = [];
    for await (const p of porters.partition.searchAll()) seen.push(p.P_Id);

    expect(seen).toEqual([1, 2, 3]);
  });
});

describe("user master", () => {
  it("lists users", async () => {
    const { porters } = setup();

    const page = await porters.user.search();

    expect(page.items.map((u) => u.P_Name)).toEqual([
      "API アプリ",
      "採用 花子",
      "管理 太郎",
    ]);
    expect(page.items[1]?.P_Mail).toBe("hanako@example.com");
  });

  it("current() self-identifies as the App's own user", async () => {
    const { porters } = setup({ currentUserId: 5 });

    const me = await porters.user.current();

    expect(me?.P_Id).toBe(5);
    expect(me?.P_Name).toBe("採用 花子");
  });

  it("filters by user type", async () => {
    const { porters } = setup();

    // user_type 0 = system admins (P_Type=1), 1 = standard users (P_Type=0).
    const admins = await porters.user.search({ userType: 0 });
    expect(admins.items.map((u) => u.P_Id)).toEqual([9]);

    const standard = await porters.user.search({ userType: 1 });
    expect(standard.items.map((u) => u.P_Id)).toEqual([1, 5]);
  });

  it("sees the users a write referenced, even undeclared ones", async () => {
    const { porters } = setup({ users: [] });
    await porters.candidate.create({ P_Owner: 77, P_Name: "山田 太郎" });

    const page = await porters.user.search();

    expect(page.items.map((u) => u.P_Id)).toContain(77);
  });
});

describe("field master", () => {
  it("introspects a resource's catalog", async () => {
    const { porters } = setup();

    const page = await porters.field.search({ resource: "candidate" });

    const byAlias = new Map(page.items.map((f) => [f.P_Alias, f]));
    expect(byAlias.get("Person.P_Name")?.P_Type).toBe(1); // SinglelineText
    expect(byAlias.get("Person.P_Owner")?.P_Type).toBe(17); // User
    expect(byAlias.get("Person.P_PhaseDate")?.P_Type).toBe(12); // DateTime
    // Option-typed fields point at their option group (nested, no OptionRoot wrapper).
    expect(byAlias.get("Person.P_Phase")?.P_ReferTo).toEqual([
      "Option.P_Phase",
    ]);
  });

  it("reads a different resource's catalog", async () => {
    const { porters } = setup();

    const page = await porters.field.search({ resource: "job" });

    expect(page.items.map((f) => f.P_Alias)).toContain("Job.P_Position");
    expect(page.items.every((f) => f.P_ResourceType === 3)).toBe(true);
  });

  it("pages with searchAll", async () => {
    const { porters } = setup();

    const aliases = [];
    for await (const f of porters.field.searchAll({ resource: "client" })) {
      aliases.push(f.P_Alias);
    }

    expect(aliases).toContain("Client.P_Name");
  });
});

describe("option master", () => {
  const TREE = [
    {
      alias: "Option.P_Area",
      name: "エリア",
      children: [
        { alias: "Option.P_Tokyo", name: "東京" },
        {
          alias: "Option.P_Kansai",
          name: "関西",
          children: [{ alias: "Option.P_Osaka", name: "大阪" }],
        },
      ],
    },
  ];

  it("flattens the recursive tree depth-first, keeping the parent linkage", async () => {
    const { porters } = setup({ optionTree: TREE });

    const options = await porters.option.search();

    expect(options.map((o) => o.P_Alias)).toEqual([
      "Option.P_Area",
      "Option.P_Tokyo",
      "Option.P_Kansai",
      "Option.P_Osaka",
    ]);
    const byAlias = new Map(options.map((o) => [o.P_Alias, o]));
    expect(byAlias.get("Option.P_Area")?.P_ParentId).toBe(0); // a root
    expect(byAlias.get("Option.P_Osaka")?.P_ParentId).toBe(
      byAlias.get("Option.P_Kansai")?.P_Id,
    );
    expect(byAlias.get("Option.P_Tokyo")?.P_Name).toBe("東京");
  });

  it("reads a subtree by alias, and limits the depth with level", async () => {
    const { porters } = setup({ optionTree: TREE });

    const subtree = await porters.option.search({ alias: "Option.P_Kansai" });
    expect(subtree.map((o) => o.P_Alias)).toEqual([
      "Option.P_Kansai",
      "Option.P_Osaka",
    ]);

    const shallow = await porters.option.search({
      alias: "Option.P_Area",
      level: 1,
    });
    expect(shallow.map((o) => o.P_Alias)).toEqual([
      "Option.P_Area",
      "Option.P_Tokyo",
      "Option.P_Kansai",
    ]);
  });

  it("serves the aliases a write used when no tree is seeded", async () => {
    const { porters } = setup();
    await porters.candidate.create({
      P_Owner: 5,
      P_Phase: ["Option.P_Applied"],
    });

    const options = await porters.option.search();

    expect(options.map((o) => o.P_Alias)).toEqual(["Option.P_Applied"]);
  });
});

describe("masters are read-only", () => {
  it("has no Write route, because PORTERS has none", async () => {
    const { fake } = setup();

    await expect(
      fake.send({
        method: "POST",
        url: "https://fake.test/v1/user?partition=1",
        headers: {},
        body: "<User><Item><User.P_Id>-1</User.P_Id></Item></User>",
      }),
    ).rejects.toMatchObject({ name: "PortersConfigError" });
  });
});
