// L1 integration for Attachment (ADR-0043 phase 2). Attachment is the odd one out — no alias
// prefix, no Data-Type catalog, and a Base64 body that is exempt from the ~15000-char request cap
// (ADR-0018) — so it is the case most likely to break silently.

import { describe, expect, it } from "vitest";

import type { TenantScope } from "../../src/index";
import { PortersClient } from "../../src/porters-client";
import { bytesToBase64 } from "../../src/util/base64";
import { createFakeTransport } from "../fake/index";

const setup = () => {
  const fake = createFakeTransport();
  const porters = new PortersClient({
    hostname: "fake.test",
    appId: "app-id",
    appSecret: "app-secret",
    transport: fake,
  });
  return { fake, porters };
};

const CONTENT = bytesToBase64(new TextEncoder().encode("hello, PORTERS"));

// Attachments hang off the resource they belong to, so every call goes through `of(name)`
// (ADR-0080 / ADR-0081). Job (3) here, matching the `resourceId` below.
const files = (porters: PortersClient) =>
  porters.tenant(1).attachment.of("job");

const attach = (
  porters: PortersClient,
  overrides: Partial<
    Parameters<ReturnType<TenantScope["attachment"]["of"]>["create"]>[0]
  > = {},
): Promise<number> =>
  files(porters).create({
    resourceId: 10001,
    contentType: "text/plain",
    fileName: "memo.txt",
    content: CONTENT,
    ...overrides,
  });

describe("attachment round-trip", () => {
  it("creates and reads back every field, prefix-less", async () => {
    const { porters } = setup();

    const id = await attach(porters);
    const found = await files(porters).get(id);

    expect(found).toEqual({
      id,
      resource: 3,
      resourceId: 10001,
      contentType: "text/plain",
      fileName: "memo.txt",
      content: CONTENT,
    });
  });

  it("leaves the file body out of a default search (metadata only)", async () => {
    const { porters } = setup();
    await attach(porters);

    const page = await files(porters).search();

    expect(page.total).toBe(1);
    expect(page.items[0]?.fileName).toBe("memo.txt");
    // ADR-0075: a listing must not download every file body — `requestType=1`.
    expect(page.items[0]?.content).toBeNull();
  });

  it("updates only the fields it sends", async () => {
    const { porters } = setup();
    const id = await attach(porters);

    await files(porters).update(id, { fileName: "renamed.txt" });

    const found = await files(porters).get(id);
    expect(found?.fileName).toBe("renamed.txt");
    expect(found?.contentType).toBe("text/plain"); // untouched
    expect(found?.content).toBe(CONTENT); // untouched
  });

  it("accepts a body far past the ~15000-char request cap", async () => {
    const { porters } = setup();
    // A ~600KB upload: the request-length guard is bypassed for uploads on both sides (the library
    // sends it with `unboundedBody`, and the fake honours the same exemption).
    const big = bytesToBase64(new Uint8Array(600_000));

    const id = await attach(porters, { content: big });

    expect((await files(porters).get(id))?.content).toBe(big);
  });

  // ADR-0080 / ADR-0081: `resource=` は必須で、束ねた値が効いていなければ他リソースの添付まで
  // 見えてしまう。「絞れているつもり」が一番危ないので、越境しないことを明示的に見る。
  it("of(name) narrows the listing to that resource's attachments", async () => {
    const { porters } = setup();
    await attach(porters); // job / 10001

    const mine = await files(porters).search();
    const other = await porters.tenant(1).attachment.of("candidate").search();

    expect(mine.total).toBe(1);
    expect(other.total).toBe(0);
  });

  it("resourceId narrows the listing to one record", async () => {
    const { porters } = setup();
    await attach(porters); // resourceId 10001
    await attach(porters, { resourceId: 20002, fileName: "other.txt" });

    const one = await files(porters).search({ resourceId: 20002 });

    expect(one.total).toBe(1);
    expect(one.items[0]?.fileName).toBe("other.txt");
  });

  it("keeps its own id sequence, separate from the data resources", async () => {
    const { fake, porters } = setup();
    await porters
      .tenant(1)
      .candidate.create({ P_Owner: 5, P_Name: "山田 太郎" });

    const id = await attach(porters);

    expect(id).toBe(10001);
    expect(fake.control.records("attachment")).toHaveLength(1);
    expect(fake.control.records("attachment")[0]?.Id).toBe("10001");
  });
});
