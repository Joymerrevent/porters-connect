// Attachment accessor (ADR-0018, bespoke): Read (search / searchAll / get) + Write
// (create / update) for file attachments.
//
// The Read vocabulary is the source's, not the common one (ADR-0081): `resource` (bound by
// `of(name)` — ADR-0080), `requestType` (0 = with the file body, 1 = without — decided by the
// method, ADR-0075), `resourceId` and `id`. There is no `field` and no `condition`: the article
// lists neither, and what they were standing in for now has a parameter of its own. Attachment is unlike the other resources — no alias prefix, fixed
// short field names (Id / Resource / ResourceId / ContentType / FileName / Content), and
// `Content` is the Base64 file body (up to 10MB). It does not fit the data resources' factory (`createDataResource`) but
// reuses the requester, parsers, and `firstWriteResultId`. Turn raw bytes into the Base64
// `content` with `util/base64`.

import { PortersConfigError, PortersResourceError } from "../errors";
import { apiUrl } from "../http/api-url";
import type { AccessPoint } from "../http/access-point";
import { encodeField } from "../xml/encode-field";
import { asString } from "../xml/as-string";
import { appendPaging } from "../accessor/append-paging";
import { paginateOnce } from "../accessor/paginate";
import { runRead } from "../accessor/run-read";
import { assertRecordId } from "../accessor/assert-record-id";
import { recordsById } from "../accessor/read-many";
import type { ResourceName } from "../porters/resource-list";
import { resourceValueFor } from "../accessor/resource-value-for";
import type { Paging } from "../accessor/paging";
import type { PartitionBoundConnectionDeps } from "../accessor/deps";
import { buildWriteUrl } from "../accessor/build-write-url";
import { firstWriteResultId } from "../accessor/first-write-result-id";
import {
  ATTACHMENT_REQUEST_TYPE,
  MAX_ATTACHMENT_CONTENT_CHARS,
} from "../porters/attachment";

// Attachment has no ResourceDescriptor (bespoke accessor — ADR-0018), so its wire name lives
// here: the Read response's root element and the Write error's resource context (ADR-0051).
const ATTACHMENT_RESOURCE = "Attachment";

// `requestType`: the method decides it, never the caller — `get` sends the with-content value,
// `search` / `searchAll` the without-content one (ADR-0075). The values are PORTERS' (porters/attachment.ts).
const WITH_CONTENT = ATTACHMENT_REQUEST_TYPE.withContent;
const WITHOUT_CONTENT = ATTACHMENT_REQUEST_TYPE.withoutContent;

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
   * Narrow to one record's attachments — the id **within the bound resource**
   * (`t.attachment.of("resume")` -> a `Resume.P_Id`). Omit to read the whole resource's
   * attachments.
   */
  resourceId?: number;
};

// resource は of(name) で束ねる（ADR-0080）・write でも同じ値を使う（ADR-0081）。
/**
 * Fields for creating an Attachment. `content` is the Base64 file body; the resource it attaches
 * to comes from `of(name)` and cannot be given here. Checked before sending: `resourceId` is a
 * positive integer, `contentType` and `fileName` are non-empty strings, and `content` is Base64
 * text of about 10MB or less.
 */
export type AttachmentCreate = {
  /** The record's id within the bound resource. */
  resourceId: number;
  contentType: string;
  fileName: string;
  content: string;
};

/**
 * Fields for updating an Attachment. `Resource` / `ResourceId` are not updatable. Give at least one
 * field; each given one is checked as in {@link AttachmentCreate}.
 */
export type AttachmentUpdate = {
  contentType?: string;
  fileName?: string;
  content?: string;
};

// of(resource) で束ねる形は ADR-0080、write 側も同じ値で埋めるのは ADR-0081。
/**
 * Attachments are reached through the resource they belong to:
 *
 * ```ts
 * const files = t.attachment.of("resume");
 * await files.search({ resourceId: 10006 }); // metadata only
 * await files.get(900); // with the file body
 * ```
 *
 * PORTERS requires `resource=` on every Attachment Read, and the same value goes into the
 * `<Resource>` field on write — one binding, both places, exactly like `t.phase.of(...)`.
 */
export type AttachmentAccessor = {
  of(resource: ResourceName): AttachmentResource;
};

export type AttachmentResource = {
  search(query?: AttachmentSearchQuery & Paging): Promise<AttachmentPage>;
  // 本体は get だけが運ぶ（search / searchAll はメタデータのみ）: ADR-0075。
  /**
   * Auto-paginating search: yields every matching attachment (200 per page). Metadata only —
   * the body stays behind {@link AttachmentResource.get}, so walking every attachment
   * in a partition never drags the files along with it.
   */
  searchAll(query?: AttachmentSearchQuery): AsyncIterable<Attachment>;
  /**
   * Read one attachment **with its body** (`content`). This is the only method that carries it:
   * one record at a time is a size PORTERS' own 10MB-per-file limit keeps readable.
   */
  get(id: number): Promise<Attachment | undefined>;
  /** Create an Attachment; resolves to the newly assigned id. */
  create(input: AttachmentCreate): Promise<number>;
  /** Update an Attachment by id; resolves to that id. */
  update(id: number, input: AttachmentUpdate): Promise<number>;
};

type ReadParams = {
  /** `0` = with the file body, `1` = without (source: `requestType`). */
  requestType: typeof WITH_CONTENT | typeof WITHOUT_CONTENT;
  /** The bound resource's numeric Value code. */
  resource: number;
  resourceId?: number;
  id?: number;
  count?: number;
  start?: number;
};

// Bespoke Read URL (ADR-0018 / ADR-0081): Attachment's Input Variables are its own — `requestType`
// and `resource` are required, `resourceId` / `id` narrow the result, and there is no `field` or
// `condition` to build.
//
// VERIFY(live): this is the source's form, which the library has never actually sent (the previous
// shape used `field` / `condition` instead). Whether it is accepted as documented is LV-24 in
// docs/live-verification.md.
const buildAttachmentReadUrl = (
  accessPoint: AccessPoint,
  partition: number,
  p: ReadParams,
): string => {
  const params = new URLSearchParams();
  params.set("partition", String(partition));
  params.set("requestType", p.requestType);
  params.set("resource", String(p.resource));
  if (p.resourceId !== undefined)
    params.set("resourceId", String(p.resourceId));
  if (p.id !== undefined) params.set("id", String(p.id));
  appendPaging(params, p.count, p.start);
  return apiUrl(accessPoint, "attachment", params);
};

// 空なら null（値が無い）。数でなければ、読めない応答として止める。<Id/> を 0 と読むと、無い添付ファイルの
// id として扱ってしまう（RV-135）。
const numOrNull = (field: string, v: unknown): number | null => {
  const s = asString(v)?.trim();
  if (s === undefined || s === "") return null;
  // 安全な整数を超える id は、Number で丸まって別の id になるので読まない。
  if (/^\d+$/.test(s) && Number.isSafeInteger(Number(s))) return Number(s);
  throw new PortersResourceError(
    `attachment response ${field} is not a number (got ${JSON.stringify(s)})`,
    { category: "unknown", context: { resource: ATTACHMENT_RESOURCE } },
  );
};

const decodeAttachment = (item: Record<string, unknown>): Attachment => ({
  id: numOrNull("Id", item.Id),
  resource: numOrNull("Resource", item.Resource),
  resourceId: numOrNull("ResourceId", item.ResourceId),
  contentType: asString(item.ContentType) ?? null,
  fileName: asString(item.FileName) ?? null,
  content: asString(item.Content) ?? null,
});

// Bare `<Tag>value</Tag>` (Attachment has no alias prefix). encodeField escapes the value.
const tag = (name: string, value: string | number): string =>
  `<${name}>${encodeField("SinglelineText", String(value), name)}</${name}>`;

// Reject an over-10MB file before send (the request size guard is bypassed for uploads).
// 文字列のときだけ長さを見る（null などは、続く Base64 の検査が PortersConfigError で止める。RV-140）。
const guardContent = (content: unknown): void => {
  if (
    typeof content === "string" &&
    content.length > MAX_ATTACHMENT_CONTENT_CHARS
  ) {
    throw new PortersConfigError(
      `attachment content is ${content.length} characters, over the ~10MB file limit`,
      { category: "config", hint: "Attachment files must be 10MB or less." },
    );
  }
};

// 書き込む値を送る前に確かめる。型で止まるのは TypeScript の呼び出し側だけで、JS から渡し忘れると
// "undefined" の文字列が送られ、壊れた添付ができていた。削除 API が無いので取り消せない（RV-81）。
const invalidInput = (
  field: string,
  rule: string,
  value: unknown,
): PortersConfigError =>
  new PortersConfigError(
    `attachment ${field} must be ${rule}, got ${typeof value === "string" ? JSON.stringify(value.slice(0, 40)) : String(value)}`,
    {
      category: "config",
      hint: "Pass resourceId (the record the file belongs to), contentType, fileName and content (the file as Base64 — see bytesToBase64).",
    },
  );

// 入力そのものがオブジェクトでなければ、項目を読む前に止める（create(undefined) が TypeError になっていた。RV-140）。
const assertInput = (method: string, input: unknown): void => {
  if (typeof input !== "object" || input === null) {
    throw new PortersConfigError(
      `attachment ${method}: the input must be an object, got ${input === null ? "null" : typeof input}`,
      {
        category: "config",
        hint: "Pass the fields to write, e.g. { resourceId, contentType, fileName, content }.",
      },
    );
  }
};

// JS から文字列などが来ても、Number.isSafeInteger が false を返すので拒否される。
const assertResourceId = (value: number): void => {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw invalidInput("resourceId", "a positive integer", value);
};

const assertText = (field: string, value: unknown): void => {
  if (typeof value !== "string" || value.trim() === "")
    throw invalidInput(field, "a non-empty string", value);
};

// Base64 として成り立つ形か（4 文字単位で、= は末尾の埋めだけ）。文字の種類だけ見ると、生のテキスト
// "hello" や "a" が通って壊れた添付ができる。除く空白は改行・タブ・半角スペースだけ（全角空白などは
// 送る値に残るので、読み飛ばしてから判定しない）。0 バイトのファイルは空文字になるので受ける。
// 形は「長さが 4 の倍数」と「= が末尾の 2 文字まで」に分けて見る。4 文字の繰り返しを 1 つの正規表現で
// 書くと、上限の 1,400 万文字でバックトラックがスタックを使い切る。
const assertBase64 = (value: unknown): void => {
  const text =
    typeof value === "string" ? value.replace(/[\r\n\t ]/g, "") : undefined;
  if (
    text === undefined ||
    text.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(text)
  )
    throw invalidInput("content", "Base64 text", value);
};

export const createAttachmentAccessor = (
  deps: PartitionBoundConnectionDeps,
): AttachmentAccessor => ({
  of: (resourceName) => {
    // One binding, two places PORTERS wants it: `resource=` on every Read and the `<Resource>`
    // field on write (ADR-0080). Neither can be forgotten, and neither can be contradicted —
    // the write input has no `resource` at all.
    const resource = resourceValueFor("attachment", resourceName);

    const read = (params: ReadParams): Promise<AttachmentPage> =>
      runRead(
        deps.requester,
        ATTACHMENT_RESOURCE,
        buildAttachmentReadUrl(deps.accessPoint, deps.partition, params),
        decodeAttachment,
      );

    // A listing never carries bodies (ADR-0075): `requestType=1`. `async` for the exception
    // contract (ADR-0046).
    // 絞り込みの resourceId も、正の整数かを送る前に確かめる（RV-130）。
    const search = async (
      query: AttachmentSearchQuery & Paging = {},
    ): Promise<AttachmentPage> => {
      // JS から null が来ても、空のクエリとして読む（以前の { ...null } と同じ）。
      const q = query ?? {};
      if (q.resourceId !== undefined) assertResourceId(q.resourceId);
      return read({ ...q, requestType: WITHOUT_CONTENT, resource });
    };

    // Offset walk over the same Read. The query is read once, before the first page, so mutating
    // the object mid-iteration cannot change a later page (RV-32).
    const searchAll = (
      query: AttachmentSearchQuery = {},
    ): AsyncIterable<Attachment> =>
      paginateOnce(() => {
        const resourceId = (query ?? {}).resourceId;
        if (resourceId !== undefined) assertResourceId(resourceId);
        return (count, start) =>
          read({
            requestType: WITHOUT_CONTENT,
            resource,
            resourceId,
            count,
            start,
          });
      });

    // The only path that carries the body: `requestType=0` for one `id`. One record at a time is
    // a size PORTERS' own 10MB-per-file limit keeps readable (ADR-0075).
    const get = async (id: number): Promise<Attachment | undefined> => {
      assertRecordId(id, "get", ATTACHMENT_RESOURCE);
      const page = await read({ requestType: WITH_CONTENT, resource, id });
      // 返ってきた添付が頼んだ id のものかを確かめる。id の指定が効くかは実機で未確認（LV-24・RV-73）。
      return recordsById(
        page,
        [id],
        (a) => a.id,
        ATTACHMENT_RESOURCE,
        "get",
      ).get(id);
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

    // create forces Id=-1 (non-idempotent) and fills `Resource` from the binding.
    // `async` so the 10MB guard rejects instead of throwing synchronously (ADR-0046).
    const create = async (input: AttachmentCreate): Promise<number> => {
      assertInput("create", input);
      assertResourceId(input.resourceId);
      assertText("contentType", input.contentType);
      assertText("fileName", input.fileName);
      // 大きさを先に見る（上限を超える文字列に正規表現をかけない）。
      guardContent(input.content);
      assertBase64(input.content);
      const inner =
        tag("Id", -1) +
        tag("Resource", resource) +
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
      assertRecordId(id, "update", ATTACHMENT_RESOURCE);
      assertInput("update", input);
      // 変える項目が 1 つも無い update は、id だけを送って成功として返っていた（RV-136）。
      if (
        input.contentType === undefined &&
        input.fileName === undefined &&
        input.content === undefined
      ) {
        throw new PortersConfigError(
          "attachment update: give at least one of contentType, fileName, content",
          {
            category: "config",
            hint: "Pass the fields to change. Resource and resourceId cannot be changed.",
          },
        );
      }
      if (input.contentType !== undefined)
        assertText("contentType", input.contentType);
      if (input.fileName !== undefined) assertText("fileName", input.fileName);
      guardContent(input.content);
      if (input.content !== undefined) assertBase64(input.content);
      let inner = tag("Id", id);
      if (input.contentType !== undefined) {
        inner += tag("ContentType", input.contentType);
      }
      if (input.fileName !== undefined)
        inner += tag("FileName", input.fileName);
      if (input.content !== undefined) inner += tag("Content", input.content);
      return write(inner, true);
    };

    return { search, searchAll, get, create, update };
  },
});
