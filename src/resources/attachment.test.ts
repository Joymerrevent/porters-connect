import { describe, expect, it } from "vitest";

import { PortersConfigError, PortersResourceError } from "../errors";
import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
import { createAttachmentAccessor } from "./attachment";

const READ_OK =
  `<?xml version="1.0"?><Attachment Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
  `<Id>11111</Id><Resource>17</Resource><ResourceId>10001</ResourceId>` +
  `<ContentType>application/pdf</ContentType><FileName>cv.pdf</FileName><Content>QUJD</Content>` +
  `</Item></Attachment>`;
const READ_EMPTY = `<?xml version="1.0"?><Attachment Total="0" Count="0" Start="0"><Code>0</Code></Attachment>`;
const WRITE_OK = `<?xml version="1.0"?><Attachment><Item><Id>22222</Id><Code>0</Code></Item></Attachment>`;

type Call = { req: TransportRequest; spec?: RequestSpec };

const stub = (body: string, calls: Call[]): Requester => ({
  request: (req, parse, spec) => {
    calls.push({ req, spec });
    return Promise.resolve(parse(body));
  },
});

// The accessor bound to Resume (17) — the resource attachments most obviously hang off.
const files = (calls: Call[], body: string) =>
  createAttachmentAccessor({
    requester: stub(body, calls),
    accessPoint: { hostname: "h.test" },
    partition: 12,
  }).of("resume");

const paramsOf = (calls: Call[], i = 0): URLSearchParams =>
  new URL(calls[i]?.req.url ?? "").searchParams;

describe("createAttachmentAccessor — decode", () => {
  it("decodes the fixed fields (ids -> number, rest -> string)", async () => {
    const calls: Call[] = [];
    const a = (await files(calls, READ_OK).get(11111)) ?? undefined;
    expect(calls[0].req.method).toBe("GET");
    expect(a?.id).toBe(11111);
    expect(a?.resource).toBe(17);
    expect(a?.resourceId).toBe(10001);
    expect(a?.contentType).toBe("application/pdf");
    expect(a?.fileName).toBe("cv.pdf");
    expect(a?.content).toBe("QUJD"); // Base64
  });

  it("maps an absent field to null", async () => {
    const calls: Call[] = [];
    const body = `<Attachment Total="1" Count="1" Start="0"><Code>0</Code><Item><Id>5</Id></Item></Attachment>`;
    const a = (await files(calls, body).search()).items[0];
    expect(a.id).toBe(5);
    expect(a.resource).toBeNull();
    expect(a.content).toBeNull();
  });
});

// ADR-0081: Attachment Read takes its own Input Variables — `requestType` / `resource` /
// `resourceId` / `id` — and neither `field` nor `condition` exists. ADR-0080 binds `resource`.
describe("createAttachmentAccessor — Read parameters (ADR-0080 / ADR-0081)", () => {
  it("of(name) sends the bound resource's number on every Read", async () => {
    const calls: Call[] = [];
    const accessor = createAttachmentAccessor({
      requester: stub(READ_EMPTY, calls),
      accessPoint: { hostname: "h.test" },
      partition: 12,
    });

    await accessor.of("resume").search();
    await accessor.of("candidate").search();

    expect(paramsOf(calls, 0).get("resource")).toBe("17");
    expect(paramsOf(calls, 1).get("resource")).toBe("1");
  });

  it("search is a listing: requestType=1, no id", async () => {
    const calls: Call[] = [];
    await files(calls, READ_EMPTY).search();
    const params = paramsOf(calls);
    expect(params.get("partition")).toBe("12");
    expect(params.get("requestType")).toBe("1");
    expect(params.has("id")).toBe(false);
    expect(params.has("resourceId")).toBe(false);
    // 出典に無いパラメータは送らない（送ると Read 全体が落ちうる）。
    expect(params.has("field")).toBe(false);
    expect(params.has("condition")).toBe(false);
  });

  it("search narrows to one record with resourceId, and pages", async () => {
    const calls: Call[] = [];
    await files(calls, READ_EMPTY).search({
      resourceId: 10001,
      count: 5,
      start: 10,
    });
    const params = paramsOf(calls);
    expect(params.get("resourceId")).toBe("10001");
    expect(params.get("count")).toBe("5");
    expect(params.get("start")).toBe("10");
  });

  it("get is the only Read with the body: requestType=0 for one id", async () => {
    const calls: Call[] = [];
    const one = await files(calls, READ_EMPTY).get(7);
    expect(one).toBeUndefined();
    const params = paramsOf(calls);
    expect(params.get("requestType")).toBe("0");
    expect(params.get("id")).toBe("7");
    expect(params.get("resource")).toBe("17");
    expect(params.has("resourceId")).toBe(false);
  });

  it("searchAll walks 200 at a time and carries resourceId on every page", async () => {
    // 1 ページ目は 200 件のうち 2 件（Total=3）、2 ページ目で残り 1 件。
    const page = (ids: number[], total: number, start: number): string =>
      `<?xml version="1.0"?><Attachment Total="${total}" Count="${ids.length}" Start="${start}">` +
      `<Code>0</Code>` +
      ids
        .map((id) => `<Item><Id>${id}</Id><FileName>f${id}</FileName></Item>`)
        .join("") +
      `</Attachment>`;
    const bodies = [page([1, 2], 3, 0), page([3], 3, 2)];
    const calls: Call[] = [];
    const walker = createAttachmentAccessor({
      requester: {
        request: (req, parse, spec) => {
          calls.push({ req, spec });
          return Promise.resolve(parse(bodies[calls.length - 1] ?? ""));
        },
      },
      accessPoint: { hostname: "h.test" },
      partition: 12,
    }).of("resume");

    const seen: (number | null)[] = [];
    for await (const a of walker.searchAll({ resourceId: 10001 }))
      seen.push(a.id);

    expect(seen).toEqual([1, 2, 3]);
    expect(calls).toHaveLength(2);
    expect(paramsOf(calls, 0).get("count")).toBe("200");
    expect(paramsOf(calls, 0).get("start")).toBe("0");
    expect(paramsOf(calls, 1).get("start")).toBe("2");
    for (const i of [0, 1]) {
      // 走査でも本体は運ばない（本体は get の担当 — ADR-0075）。
      expect(paramsOf(calls, i).get("requestType")).toBe("1");
      expect(paramsOf(calls, i).get("resourceId")).toBe("10001");
    }
  });

  it("searchAll without a resourceId reads the whole resource", async () => {
    const calls: Call[] = [];
    for await (const _ of files(calls, READ_EMPTY).searchAll()) break;
    expect(paramsOf(calls).has("resourceId")).toBe(false);
  });

  // RV-32: the query is read once, before the first page, so mutating it mid-walk cannot change
  // a later page.
  it("searchAll reads its query once", async () => {
    const calls: Call[] = [];
    const body = (ids: number[], total: number, start: number): string =>
      `<?xml version="1.0"?><Attachment Total="${total}" Count="${ids.length}" Start="${start}">` +
      `<Code>0</Code>` +
      ids.map((id) => `<Item><Id>${id}</Id></Item>`).join("") +
      `</Attachment>`;
    const bodies = [body([1], 2, 0), body([2], 2, 1)];
    const walker = createAttachmentAccessor({
      requester: {
        request: (req, parse, spec) => {
          calls.push({ req, spec });
          return Promise.resolve(parse(bodies[calls.length - 1] ?? ""));
        },
      },
      accessPoint: { hostname: "h.test" },
      partition: 12,
    }).of("resume");

    const query = { resourceId: 10001 };
    for await (const _ of walker.searchAll(query)) {
      query.resourceId = 99999;
    }

    expect(paramsOf(calls, 1).get("resourceId")).toBe("10001");
  });
});

describe("createAttachmentAccessor — write", () => {
  it("create POSTs bare-tag XML with the bound Resource, bypasses the size guard", async () => {
    const calls: Call[] = [];
    const id = await files(calls, WRITE_OK).create({
      resourceId: 10001,
      contentType: "application/msword",
      fileName: "履歴書.doc",
      content: "SGVsbG8=",
    });
    expect(id).toBe(22222);
    const { req, spec } = calls[0];
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://h.test/v1/attachment?partition=12");
    expect(req.body).toBe(
      "<Attachment><Item>" +
        "<Id>-1</Id>" +
        "<Resource>17</Resource>" +
        "<ResourceId>10001</ResourceId>" +
        "<ContentType>application/msword</ContentType>" +
        "<FileName>履歴書.doc</FileName>" +
        "<Content>SGVsbG8=</Content>" +
        "</Item></Attachment>",
    );
    expect(spec).toEqual({
      write: true,
      idempotent: false,
      unboundedBody: true,
    });
  });

  it("create fills Resource from the binding, not from a fixed value", async () => {
    const calls: Call[] = [];
    await createAttachmentAccessor({
      requester: stub(WRITE_OK, calls),
      accessPoint: { hostname: "h.test" },
      partition: 12,
    })
      .of("candidate")
      .create({
        resourceId: 1,
        contentType: "image/png",
        fileName: "f.png",
        content: "QQ==",
      });
    expect(calls[0].req.body).toContain("<Resource>1</Resource>");
  });

  it("update sends only the target id + provided fields, idempotently", async () => {
    const calls: Call[] = [];
    const id = await files(calls, WRITE_OK).update(22222, {
      fileName: "renamed.doc",
    });
    expect(id).toBe(22222);
    expect(calls[0].req.body).toBe(
      "<Attachment><Item><Id>22222</Id><FileName>renamed.doc</FileName></Item></Attachment>",
    );
    expect(calls[0].spec).toEqual({
      write: true,
      idempotent: true,
      unboundedBody: true,
    });
  });

  it("update can replace contentType + content (re-upload)", async () => {
    const calls: Call[] = [];
    await files(calls, WRITE_OK).update(22222, {
      contentType: "image/png",
      content: "QkFTRTY0",
    });
    expect(calls[0].req.body).toBe(
      "<Attachment><Item><Id>22222</Id>" +
        "<ContentType>image/png</ContentType>" +
        "<Content>QkFTRTY0</Content></Item></Attachment>",
    );
  });

  it("maps a non-zero per-Item Code to a PortersResourceError", async () => {
    const calls: Call[] = [];
    const body = `<Attachment><Item><Id>0</Id><Code>403</Code></Item></Attachment>`;
    let err: unknown;
    try {
      await files(calls, body).create({
        resourceId: 1,
        contentType: "image/png",
        fileName: "f.png",
        content: "QQ==",
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersResourceError);
    expect((err as PortersResourceError).code).toBe(403);
    expect((err as PortersResourceError).message).toBe(
      "attachment write returned code 403",
    );
    expect((err as PortersResourceError).context?.resource).toBe("Attachment");
  });
});

describe("createAttachmentAccessor — 10MB guard", () => {
  it("rejects content over the ~10MB limit before sending", async () => {
    const calls: Call[] = [];
    let err: unknown;
    try {
      await files(calls, WRITE_OK).create({
        resourceId: 1,
        contentType: "image/png",
        fileName: "big.png",
        content: "A".repeat(14_000_001), // > 14,000,000 chars
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersConfigError);
    expect((err as PortersConfigError).category).toBe("config");
    expect((err as PortersConfigError).message).toContain("14000001");
    expect((err as PortersConfigError).hint).toContain("10MB");
    expect(calls).toHaveLength(0); // never sent
  });

  it("allows content exactly at the limit through", async () => {
    const calls: Call[] = [];
    const id = await files(calls, WRITE_OK).create({
      resourceId: 1,
      contentType: "image/png",
      fileName: "ok.png",
      content: "A".repeat(14_000_000), // == limit is allowed
    });
    expect(id).toBe(22222);
    expect(calls).toHaveLength(1);
  });

  it("guards an update's content too", async () => {
    const calls: Call[] = [];
    let err: unknown;
    try {
      await files(calls, WRITE_OK).update(1, {
        content: "A".repeat(14_000_001),
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersConfigError);
    expect(calls).toHaveLength(0);
  });
});

describe("attachment — search はページ送りを受け、searchAll は受けない（ADR-0099）", () => {
  it("search takes paging next to the query; searchAll takes the query only", () => {
    const typeOnly = (f: ReturnType<typeof files>) => {
      void f.search({ resourceId: 1, count: 5, start: 0 });
      void f.searchAll({ resourceId: 1 });
      // @ts-expect-error — searchAll decides count / start itself
      void f.searchAll({ resourceId: 1, count: 5 });
    };
    expect(typeOnly).toBeTypeOf("function");
  });
});

// RV-67 / RV-74。添付ファイルでも、書き込みの Id -1 は新規作成を意味する。get と update の id は送る前に確かめる。
describe("createAttachmentAccessor — the id get / update receive", () => {
  it("update(-1) rejects before sending anything", async () => {
    const calls: Call[] = [];
    await expect(
      files(calls, WRITE_OK).update(-1, { fileName: "x.txt" }),
    ).rejects.toThrow(
      "Attachment.update: id must be a positive integer, got -1",
    );
    expect(calls).toHaveLength(0);
  });

  it("get(0) rejects before sending anything", async () => {
    const calls: Call[] = [];
    await expect(files(calls, READ_OK).get(0)).rejects.toThrow(
      "Attachment.get: id must be a positive integer, got 0",
    );
    expect(calls).toHaveLength(0);
  });
});

// RV-73。添付ファイルの get も、返ってきた添付が頼んだ id のものかを確かめる（id の指定が効くかは LV-24）。
describe("createAttachmentAccessor — get checks the attachment it got back", () => {
  it("rejects an attachment with another id, rather than handing over its body", async () => {
    const calls: Call[] = [];
    await expect(files(calls, READ_OK).get(900)).rejects.toThrow(
      "Attachment: get received a record that was not requested",
    );
  });
});

// RV-81。書き込む値を送る前に確かめる（JS から渡し忘れると "undefined" の文字列が送られていた）。
describe("createAttachmentAccessor — the values create / update send", () => {
  const good = {
    resourceId: 10001,
    contentType: "text/plain",
    fileName: "a.txt",
    content: "aGk=",
  };

  it.each([
    [
      { resourceId: undefined },
      "attachment resourceId must be a positive integer, got undefined",
    ],
    [
      { resourceId: Number.NaN },
      "attachment resourceId must be a positive integer, got NaN",
    ],
    [
      { resourceId: 0 },
      "attachment resourceId must be a positive integer, got 0",
    ],
    [
      { resourceId: 1.5 },
      "attachment resourceId must be a positive integer, got 1.5",
    ],
    [
      { contentType: undefined },
      "attachment contentType must be a non-empty string, got undefined",
    ],
    [
      { contentType: "  " },
      'attachment contentType must be a non-empty string, got "  "',
    ],
    [
      { fileName: undefined },
      "attachment fileName must be a non-empty string, got undefined",
    ],
    [
      { content: undefined },
      "attachment content must be Base64 text, got undefined",
    ],
    [
      { content: "hello world!" },
      'attachment content must be Base64 text, got "hello world!"',
    ],
  ])("create refuses %j before sending anything", async (override, message) => {
    const calls: Call[] = [];
    let err: unknown;
    try {
      await files(calls, WRITE_OK).create({ ...good, ...override } as never);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersConfigError);
    expect((err as PortersConfigError).message).toBe(message);
    expect((err as PortersConfigError).category).toBe("config");
    expect((err as PortersConfigError).hint).toContain("bytesToBase64");
    expect(calls).toHaveLength(0);
  });

  it("create accepts Base64 with line breaks, and an empty file", async () => {
    const calls: Call[] = [];
    await files(calls, WRITE_OK).create({ ...good, content: "aGVs\r\nbG8=" });
    await files(calls, WRITE_OK).create({ ...good, content: "" });
    expect(calls).toHaveLength(2);
  });

  it("shows only the start of a long value", async () => {
    const calls: Call[] = [];
    await expect(
      files(calls, WRITE_OK).create({ ...good, content: "!".repeat(100) }),
    ).rejects.toThrow(`got ${JSON.stringify("!".repeat(40))}`);
  });

  it("update checks only the fields it was given", async () => {
    const calls: Call[] = [];
    await expect(
      files(calls, WRITE_OK).update(22222, { fileName: "" }),
    ).rejects.toThrow("attachment fileName must be a non-empty string");
    await expect(
      files(calls, WRITE_OK).update(22222, { contentType: "" }),
    ).rejects.toThrow("attachment contentType must be a non-empty string");
    await expect(
      files(calls, WRITE_OK).update(22222, { content: "%%%" }),
    ).rejects.toThrow("attachment content must be Base64 text");
    expect(calls).toHaveLength(0);
    await files(calls, WRITE_OK).update(22222, { fileName: "b.txt" });
    expect(calls).toHaveLength(1);
  });
});
