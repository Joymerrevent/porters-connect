import { describe, expect, it } from "vitest";

import { PortersConfigError, PortersResourceError } from "../errors";
import type { Requester, RequestSpec } from "../http/requester";
import type { TransportRequest } from "../http/types";
import { createAttachmentResource } from "./attachment";

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
    host: "h.test",
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
