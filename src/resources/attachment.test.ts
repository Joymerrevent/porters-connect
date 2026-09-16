import { describe, expect, it } from "vitest";

import { PortersConfigError, PortersResourceError } from "../errors";
import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
import {
  createAttachmentResource,
  type AttachmentSearchQuery,
  type AttachmentWalkQuery,
} from "./attachment";

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

const resource = (calls: Call[], body: string) =>
  createAttachmentResource({
    requester: stub(body, calls),
    accessPoint: { hostname: "h.test" },
    partition: 12,
  });

describe("createAttachmentResource — decode", () => {
  it("decodes the fixed fields (ids -> number, rest -> string)", async () => {
    const calls: Call[] = [];
    const a = (await resource(calls, READ_OK).search()).items[0];
    expect(calls[0].req.method).toBe("GET");
    expect(a.id).toBe(11111);
    expect(a.resource).toBe(17);
    expect(a.resourceId).toBe(10001);
    expect(a.contentType).toBe("application/pdf");
    expect(a.fileName).toBe("cv.pdf");
    expect(a.content).toBe("QUJD"); // Base64
  });

  it("maps an absent field to null", async () => {
    const calls: Call[] = [];
    const body = `<Attachment Total="1" Count="1" Start="0"><Code>0</Code><Item><Id>5</Id></Item></Attachment>`;
    const a = (await resource(calls, body).search()).items[0];
    expect(a.id).toBe(5);
    expect(a.resource).toBeNull();
    expect(a.content).toBeNull();
  });
});

describe("createAttachmentResource — write", () => {
  it("create POSTs bare-tag XML, bypasses the size guard, returns the id", async () => {
    const calls: Call[] = [];
    const id = await resource(calls, WRITE_OK).create({
      resource: 17,
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

  it("update sends only the target id + provided fields, idempotently", async () => {
    const calls: Call[] = [];
    const id = await resource(calls, WRITE_OK).update(22222, {
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

  it("maps a non-zero per-Item Code to a PortersResourceError", async () => {
    const calls: Call[] = [];
    const body = `<Attachment><Item><Id>0</Id><Code>403</Code></Item></Attachment>`;
    let err: unknown;
    try {
      await resource(calls, body).create({
        resource: 17,
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

  it("update can replace contentType + content (re-upload)", async () => {
    const calls: Call[] = [];
    await resource(calls, WRITE_OK).update(22222, {
      contentType: "image/png",
      content: "QkFTRTY0",
    });
    expect(calls[0].req.body).toBe(
      "<Attachment><Item><Id>22222</Id>" +
        "<ContentType>image/png</ContentType>" +
        "<Content>QkFTRTY0</Content></Item></Attachment>",
    );
  });

  it("get(id) requests all fields with an Id condition against /v1/attachment", async () => {
    const calls: Call[] = [];
    const one = await resource(calls, READ_EMPTY).get(7);
    expect(one).toBeUndefined();
    const url = decodeURIComponent(calls[0].req.url);
    expect(url).toContain("https://h.test/v1/attachment?");
    expect(url).toContain("Id:eq=7");
    expect(url).toContain(
      "field=Id,Resource,ResourceId,ContentType,FileName,Content",
    );
  });

  it("search() passes loose condition / count / start through (no prefix)", async () => {
    const calls: Call[] = [];
    await resource(calls, READ_EMPTY).search({
      condition: { "Id:eq": "3" },
      count: 5,
      start: 10,
    });
    const url = decodeURIComponent(calls[0].req.url);
    expect(url).toContain("condition=Id:eq=3");
    expect(url).toContain("count=5");
    expect(url).toContain("start=10");
  });
});

describe("createAttachmentResource — default field (ADR-0020)", () => {
  // Exact field param via URL parsing — `ContentType` contains the substring "Content",
  // so a naive `toContain`/`not.toContain` can't tell metadata from the body field.
  const fieldOf = (url: string): string | null =>
    new URL(url).searchParams.get("field");

  it("search() defaults to metadata fields, excluding the large Content body", async () => {
    const calls: Call[] = [];
    await resource(calls, READ_EMPTY).search();
    expect(fieldOf(calls[0].req.url)).toBe(
      "Id,Resource,ResourceId,ContentType,FileName",
    );
  });

  it("field: [] opts into the API-native primary-key-only response", async () => {
    const calls: Call[] = [];
    await resource(calls, READ_EMPTY).search({ field: [] });
    expect(fieldOf(calls[0].req.url)).toBeNull();
  });

  it("a provided metadata field list is sent verbatim", async () => {
    const calls: Call[] = [];
    await resource(calls, READ_EMPTY).search({ field: ["Id", "FileName"] });
    expect(fieldOf(calls[0].req.url)).toBe("Id,FileName");
  });

  // ADR-0075: 一覧は本体を運ばない。型では `Content` を並べられないので、ここに来るのは cast
  // した呼び出しだけ。それでも止める — 200 件ぶんの本体は V8 の文字列上限を越え、再送しても
  // 直らない `RangeError` になるため。
  it("cast して Content を頼んでも search は送らずに落とす", async () => {
    const calls: Call[] = [];
    let err: unknown;
    try {
      await resource(calls, READ_EMPTY).search({
        field: ["Id", "Content"],
      } as unknown as AttachmentSearchQuery);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersConfigError);
    expect((err as PortersConfigError).category).toBe("config");
    expect((err as PortersConfigError).message).toContain("Content");
    // どちらの入口で落ちたかがメッセージで分かること。
    expect((err as PortersConfigError).message).toContain("search");
    expect((err as PortersConfigError).hint).toContain("get(id)");
    // 送信前に止まる＝リクエストは 1 本も出ていない。
    expect(calls).toHaveLength(0);
  });

  it("searchAll も同じ理由で止める（走査の入口だけ緩い、を作らない）", async () => {
    const calls: Call[] = [];
    let err: unknown;
    try {
      const walk = resource(calls, READ_EMPTY).searchAll({
        field: ["Content"],
      } as unknown as AttachmentWalkQuery);
      for await (const _ of walk) break;
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersConfigError);
    expect((err as PortersConfigError).message).toContain("searchAll");
    expect(calls).toHaveLength(0);
  });

  it("空の condition は condition= を載せない（空文字を送らない）", async () => {
    const calls: Call[] = [];
    await resource(calls, READ_EMPTY).search({ condition: {} });
    expect(new URL(calls[0]?.req.url ?? "").searchParams.has("condition")).toBe(
      false,
    );
  });

  it("複数の condition はカンマで繋ぐ（AND 指定）", async () => {
    const calls: Call[] = [];
    await resource(calls, READ_EMPTY).search({
      condition: { "Resource:eq": "17", "ResourceId:eq": "10001" },
    });
    expect(new URL(calls[0]?.req.url ?? "").searchParams.get("condition")).toBe(
      "Resource:eq=17,ResourceId:eq=10001",
    );
  });

  it("searchAll は 200 件ずつ歩き、返った件数だけ start を進める", async () => {
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
    const walker = createAttachmentResource({
      requester: {
        request: (req, parse, spec) => {
          calls.push({ req, spec });
          return Promise.resolve(parse(bodies[calls.length - 1] ?? ""));
        },
      },
      accessPoint: { hostname: "h.test" },
      partition: 12,
    });

    const seen: (number | null)[] = [];
    for await (const a of walker.searchAll()) seen.push(a.id);

    expect(seen).toEqual([1, 2, 3]);
    expect(calls).toHaveLength(2);
    const first = new URL(calls[0]?.req.url ?? "").searchParams;
    const second = new URL(calls[1]?.req.url ?? "").searchParams;
    expect(first.get("count")).toBe("200");
    expect(first.get("start")).toBe("0");
    expect(second.get("start")).toBe("2");
    // 走査でも既定はメタデータだけ（本体は get の担当）。
    expect(fieldOf(calls[0]?.req.url ?? "")).toBe(
      "Id,Resource,ResourceId,ContentType,FileName",
    );
  });

  it("get は本体まで取る（唯一の経路）", async () => {
    const calls: Call[] = [];
    await resource(calls, READ_OK).get(900);
    expect(fieldOf(calls[0].req.url)).toBe(
      "Id,Resource,ResourceId,ContentType,FileName,Content",
    );
    expect(new URL(calls[0].req.url).searchParams.get("condition")).toBe(
      "Id:eq=900",
    );
  });
});

describe("createAttachmentResource — 10MB guard", () => {
  it("rejects content over the ~10MB limit before sending", async () => {
    const calls: Call[] = [];
    let err: unknown;
    try {
      await resource(calls, WRITE_OK).create({
        resource: 17,
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
    const id = await resource(calls, WRITE_OK).create({
      resource: 17,
      resourceId: 1,
      contentType: "image/png",
      fileName: "ok.png",
      content: "A".repeat(14_000_000), // == limit is allowed
    });
    expect(id).toBe(22222);
    expect(calls).toHaveLength(1);
  });
});
