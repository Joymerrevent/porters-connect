// Attachment accessor (ADR-0018, bespoke): Read (search / get) + Write (create / update)
// for file attachments. Attachment is unlike the other resources — no alias prefix, fixed
// short field names (Id / Resource / ResourceId / ContentType / FileName / Content), and
// `Content` is the Base64 file body (up to 10MB). It does not fit the generic factory but
// reuses the requester, parsers, and `firstWriteResultId`. Turn raw bytes into the Base64
// `content` with `util/base64`.

import { PortersConfigError } from "../errors";
import type { Requester } from "../http/requester";
import { encodeField } from "../xml/encode";
import { parseResourcePage } from "../xml/parser";
import { asString } from "../xml/raw";
import { buildReadUrl, buildWriteUrl, firstWriteResultId } from "./resource";

// A 10MB file is ~13.98M Base64 chars; cap the encoded Content length before send
// (fail-safe — the ~15000-char request guard is bypassed for uploads). docs/reference.
const MAX_CONTENT_CHARS = 14_000_000;

const ALL_FIELDS = [
  "Id",
  "Resource",
  "ResourceId",
  "ContentType",
  "FileName",
  "Content",
];

/** A decoded Attachment. A field is `null` unless it was returned (see `field`). */
export type Attachment = {
  id: number | null;
  /** Related resource type code (see the PORTERS Resource List). */
  resource: number | null;
  /** Related record id. */
  resourceId: number | null;
  contentType: string | null;
  fileName: string | null;
  /** Base64 file body. */
  content: string | null;
};

export type AttachmentPage = {
  items: Attachment[];
  total: number;
  count: number;
  start: number;
};

export type AttachmentSearchQuery = {
  field?: string[];
  condition?: Record<string, string>;
  count?: number;
  start?: number;
};

/** Fields for creating an Attachment. `content` is the Base64 file body. */
export type AttachmentCreate = {
  resource: number;
  resourceId: number;
  contentType: string;
  fileName: string;
  content: string;
};

/** Fields for updating an Attachment. `Resource` / `ResourceId` are not updatable. */
export type AttachmentUpdate = {
  contentType?: string;
  fileName?: string;
  content?: string;
};

export type AttachmentResource = {
  search(query?: AttachmentSearchQuery): Promise<AttachmentPage>;
  get(id: number): Promise<Attachment | undefined>;
  /** Create an Attachment; resolves to the newly assigned id. */
  create(input: AttachmentCreate): Promise<number>;
  /** Update an Attachment by id; resolves to that id. */
  update(id: number, input: AttachmentUpdate): Promise<number>;
};

const numOrNull = (v: unknown): number | null => {
  const s = asString(v);
  return s === undefined ? null : Number(s);
};

const decodeAttachment = (item: Record<string, unknown>): Attachment => ({
  id: numOrNull(item.Id),
  resource: numOrNull(item.Resource),
  resourceId: numOrNull(item.ResourceId),
  contentType: asString(item.ContentType) ?? null,
  fileName: asString(item.FileName) ?? null,
  content: asString(item.Content) ?? null,
});

// Bare `<Tag>value</Tag>` (Attachment has no alias prefix). encodeField escapes the value.
const tag = (name: string, value: string | number): string =>
  `<${name}>${encodeField("SinglelineText", String(value))}</${name}>`;

// Reject an over-10MB file before send (the request size guard is bypassed for uploads).
const guardContent = (content: string | undefined): void => {
  if (content !== undefined && content.length > MAX_CONTENT_CHARS) {
    throw new PortersConfigError(
      `attachment content is ${content.length} characters, over the ~10MB file limit`,
      { category: "config", hint: "Attachment files must be 10MB or less." },
    );
  }
};

export const createAttachmentResource = (deps: {
  requester: Requester;
  host: string;
  partition: number;
}): AttachmentResource => {
  const search = (query: AttachmentSearchQuery = {}): Promise<AttachmentPage> =>
    deps.requester.request(
      {
        method: "GET",
        url: buildReadUrl(deps.host, deps.partition, "attachment", query),
        headers: {},
      },
      (body) => {
        const page = parseResourcePage(body);
        return {
          items: page.items.map(decodeAttachment),
          total: page.total,
          count: page.count,
          start: page.start,
        };
      },
    );

  const get = async (id: number): Promise<Attachment | undefined> => {
    const page = await search({
      field: ALL_FIELDS,
      condition: { "Id:eq": String(id) },
      count: 1,
    });
    return page.items[0];
  };

  const write = (inner: string, idempotent: boolean): Promise<number> =>
    deps.requester.request(
      {
        method: "POST",
        url: buildWriteUrl(deps.host, deps.partition, "attachment"),
        headers: {},
        body: `<Attachment><Item>${inner}</Item></Attachment>`,
      },
      (body) => firstWriteResultId(body, "attachment", "Attachment"),
      { write: true, idempotent, unboundedBody: true },
    );

  // create forces Id=-1 (non-idempotent). All fields are required.
  const create = (input: AttachmentCreate): Promise<number> => {
    guardContent(input.content);
    const inner =
      tag("Id", -1) +
      tag("Resource", input.resource) +
      tag("ResourceId", input.resourceId) +
      tag("ContentType", input.contentType) +
      tag("FileName", input.fileName) +
      tag("Content", input.content);
    return write(inner, false);
  };

  // update targets the id (idempotent). Resource / ResourceId can't change; only the
  // provided fields are sent.
  const update = (id: number, input: AttachmentUpdate): Promise<number> => {
    guardContent(input.content);
    let inner = tag("Id", id);
    if (input.contentType !== undefined) {
      inner += tag("ContentType", input.contentType);
    }
    if (input.fileName !== undefined) inner += tag("FileName", input.fileName);
    if (input.content !== undefined) inner += tag("Content", input.content);
    return write(inner, true);
  };

  return { search, get, create, update };
};
