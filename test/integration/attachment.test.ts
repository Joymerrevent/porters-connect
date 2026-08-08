// L1 integration for Attachment (ADR-0043 phase 2). Attachment is the odd one out — no alias
// prefix, no Data-Type catalog, and a Base64 body that is exempt from the ~15000-char request cap
// (ADR-0018) — so it is the case most likely to break silently.

import { describe, expect, it } from "vitest";

import { PortersClient } from "../../src/client";
import { bytesToBase64 } from "../../src/util/base64";
import { createFakeTransport } from "../fake/index";

const setup = () => {
  const fake = createFakeTransport();
  const porters = new PortersClient({
    host: "fake.test",
    appId: "app-id",
    appSecret: "app-secret",
    partition: 1,
    transport: fake,
  });
  return { fake, porters };
};

const CONTENT = bytesToBase64(new TextEncoder().encode("hello, PORTERS"));

const attach = (
  porters: PortersClient,
  overrides: Partial<Parameters<PortersClient["attachment"]["create"]>[0]> = {},
): Promise<number> =>
  porters.attachment.create({
    resource: 3,
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
    const found = await porters.attachment.get(id);

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

    const page = await porters.attachment.search();

    expect(page.total).toBe(1);
    expect(page.items[0]?.fileName).toBe("memo.txt");
    // ADR-0020: listing must not download every file body.
    expect(page.items[0]?.content).toBeNull();
  });

  it("updates only the fields it sends", async () => {
    const { porters } = setup();
    const id = await attach(porters);

    await porters.attachment.update(id, { fileName: "renamed.txt" });

    const found = await porters.attachment.get(id);
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

    expect((await porters.attachment.get(id))?.content).toBe(big);
  });

  it("keeps its own id sequence, separate from the data resources", async () => {
    const { fake, porters } = setup();
    await porters.candidate.create({ P_Owner: 5, P_Name: "山田 太郎" });

    const id = await attach(porters);

    expect(id).toBe(10001);
    expect(fake.control.records("attachment")).toHaveLength(1);
    expect(fake.control.records("attachment")[0]?.Id).toBe("10001");
  });
});
