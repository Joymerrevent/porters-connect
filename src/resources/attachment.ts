// Attachment accessor (ADR-0018, bespoke): Read (search / get) + Write (create / update)
// for file attachments. Attachment is unlike the other resources — no alias prefix, fixed
// short field names (Id / Resource / ResourceId / ContentType / FileName / Content), and
// `Content` is the Base64 file body (up to 10MB). It does not fit the generic factory but
// reuses the requester, parsers, and `firstWriteResultId`. Turn raw bytes into the Base64
// `content` with `util/base64`.

import { PortersConfigError } from "../errors";
import { apiUrl, type AccessPoint } from "../http/access-point";
import { encodeField } from "../xml/encode";
import { parseResourcePage } from "../xml/parser";
import { asString } from "../xml/raw";
import {
  buildWriteUrl,
  firstWriteResultId,
  type ResourceDeps,
} from "./resource";

// A 10MB file is ~13.98M Base64 chars; cap the encoded Content length before send
// (fail-safe — the ~15000-char request guard is bypassed for uploads). docs/reference.
const MAX_CONTENT_CHARS = 14_000_000;

// Attachment has no ResourceDescriptor (bespoke accessor — ADR-0018), so its wire name lives
// here: the Read response's root element and the Write error's resource context (ADR-0051).
const ATTACHMENT_RESOURCE = "Attachment";

/**
 * Every Attachment field name, in wire order. Exported for in-repo dev tooling — the fake server
 * (ADR-0043) builds its Attachment table from this list rather than a copy that could drift.
 * Not re-exported from `src/index.ts`, so it stays out of the published API.
 */
export const ATTACHMENT_FIELD_NAMES = [
  "Id",
  "Resource",
  "ResourceId",
  "ContentType",
  "FileName",
  "Content",
];

// Default for search() when `field` is omitted (ADR-0020): metadata only — exclude the (large,
// up to ~14MB Base64) `Content` so listing attachments doesn't download every file body. Fetch
// `Content` explicitly via `field` or per-record via get(). Mirrors PORTERS' Image default
// (FileName only). `field: []` still opts into the API-native primary-key-only response.
const DEFAULT_FIELDS = [
  "Id",
  "Resource",
  "ResourceId",
  "ContentType",
  "FileName",
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
  /**
   * Output fields. **Omit** to fetch metadata by default (Id / Resource / ResourceId /
   * ContentType / FileName) — the large Base64 `Content` is excluded so listing doesn't download
   * every file body (ADR-0020); request `["Content", …]` or use `get()` for the body. Pass `[]`
   * for the API-native primary-key-only response. A non-empty list is sent verbatim.
   */
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

// Bespoke Read URL (ADR-0018): Attachment has no alias prefix and no Data-Type catalog, so it keeps
// the loose `condition` (`{ "Id:eq": "123" }`) and stays off the typed data-resource builder
// (ADR-0038). itemstate/order/keywords do not apply to Attachment.
const buildAttachmentReadUrl = (
  accessPoint: AccessPoint,
  partition: number,
  q: AttachmentSearchQuery,
): string => {
  const p = new URLSearchParams();
  p.set("partition", String(partition));
  if (q.field && q.field.length > 0) p.set("field", q.field.join(","));
  if (q.condition) {
    const conds = Object.entries(q.condition).map(([k, v]) => `${k}=${v}`);
    if (conds.length > 0) p.set("condition", conds.join(","));
  }
  if (q.count !== undefined) p.set("count", String(q.count));
  if (q.start !== undefined) p.set("start", String(q.start));
  return apiUrl(accessPoint, "attachment", p);
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

export const createAttachmentResource = (
  deps: ResourceDeps,
): AttachmentResource => {
  // `field` omitted -> metadata default (no Content); `[]` -> API-native primary key only;
  // a provided list is sent verbatim (ADR-0020). `async` for the exception contract (ADR-0046).
  const search = async (
    query: AttachmentSearchQuery = {},
  ): Promise<AttachmentPage> =>
    deps.requester.request(
      {
        method: "GET",
        url: buildAttachmentReadUrl(deps.accessPoint, deps.partition, {
          ...query,
          field: query.field ?? DEFAULT_FIELDS,
        }),
        headers: {},
      },
      (body) => {
        const page = parseResourcePage(body, ATTACHMENT_RESOURCE);
        return {
          items: page.items.map(decodeAttachment),
          total: page.total,
          count: page.count,
          start: page.start,
        };
      },
    );

  // VERIFY(live): Attachment has no alias prefix; the `Id:eq` condition and requesting all
  // fields (incl. Content) are taken from the field list, not a live contract.
  // See docs/live-verification.md (LV-3, LV-4).
  const get = async (id: number): Promise<Attachment | undefined> => {
    const page = await search({
      field: ATTACHMENT_FIELD_NAMES,
      condition: { "Id:eq": String(id) },
      count: 1,
    });
    return page.items[0];
  };

  const write = (inner: string, idempotent: boolean): Promise<number> =>
    deps.requester.request(
      {
        method: "POST",
        url: buildWriteUrl(deps.accessPoint, deps.partition, "attachment"),
        headers: {},
        body: `<Attachment><Item>${inner}</Item></Attachment>`,
      },
      (body) => firstWriteResultId(body, "attachment", ATTACHMENT_RESOURCE),
      { write: true, idempotent, unboundedBody: true },
    );

  // create forces Id=-1 (non-idempotent). All fields are required.
  // `async` so the 10MB guard rejects instead of throwing synchronously (ADR-0046) — the guard
  // itself is unchanged, and still runs before anything is sent.
  const create = async (input: AttachmentCreate): Promise<number> => {
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
  const update = async (
    id: number,
    input: AttachmentUpdate,
  ): Promise<number> => {
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
