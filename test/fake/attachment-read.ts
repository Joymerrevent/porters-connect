// Attachment Read's own Input Variables (ADR-0081). Unlike the 12 data resources, Attachment does
// not take `field` / `condition` / `order` / `keywords` / `itemstate`: the article lists
// `requestType`, `resource`, `resourceId`, `id` and the paging pair, and nothing else.
//
// The fake still stores Attachments in the same record table as everything else, so this file's
// job is a translation: the source's parameters in, the generic `ReadQuery` the store understands
// out. Keeping it here rather than in `query.ts` keeps the common parser common.

import { ATTACHMENT_FIELD_NAMES } from "../../src/resources/attachment";
import type { ParsedCondition, ReadQuery } from "./query";

/** `requestType`: 0 = with the file body, 1 = without. */
const WITH_CONTENT = "0";
const WITHOUT_CONTENT = "1";

/** Read `count` is 1–200 (reference); the library pages by 200. */
const MAX_COUNT = 200;

const CONTENT = "Content";

/**
 * A translated Attachment Read — or the Result Code PORTERS answers when a required Input
 * Variable is missing. `requestType` and `resource` are both 必須 in the article, so a request
 * without them is a caller bug the fake must not paper over.
 */
export type AttachmentReadQuery =
  | { readonly ok: true; readonly query: ReadQuery }
  | { readonly ok: false; readonly code: number; readonly message: string };

/** 100 = パラメータが不正 (result-codes.md). */
const CODE_INVALID_PARAMETER = 100;

const intParam = (url: URL, key: string, fallback: number): number => {
  const raw = url.searchParams.get(key);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const missing = (name: string): AttachmentReadQuery => ({
  ok: false,
  code: CODE_INVALID_PARAMETER,
  message: `attachment read requires ${name}`,
});

export const parseAttachmentReadQuery = (url: URL): AttachmentReadQuery => {
  const params = url.searchParams;
  const requestType = params.get("requestType");
  if (requestType === null) return missing("requestType");
  if (requestType !== WITH_CONTENT && requestType !== WITHOUT_CONTENT) {
    return {
      ok: false,
      code: CODE_INVALID_PARAMETER,
      message: `attachment read: requestType must be 0 or 1, got ${requestType}`,
    };
  }
  const resource = params.get("resource");
  if (resource === null) return missing("resource");

  // Each of the three narrowing parameters is an equality on the field of the same name — which
  // is exactly what the old `condition` form spelled out by hand (ADR-0081).
  const conditions: ParsedCondition[] = [
    { alias: "Resource", op: "eq", value: resource },
  ];
  for (const [key, alias] of [
    ["resourceId", "ResourceId"],
    ["id", "Id"],
  ] as const) {
    const value = params.get(key);
    if (value !== null) conditions.push({ alias, op: "eq", value });
  }

  // The body comes back only for `requestType=0`; a listing is metadata (ADR-0075). There is no
  // `field`, so the selection is the whole record either way.
  const selection = ATTACHMENT_FIELD_NAMES.filter(
    (name) => requestType === WITH_CONTENT || name !== CONTENT,
  ).map((alias) => ({ alias, sub: [] }));

  return {
    ok: true,
    query: {
      partition: params.get("partition"),
      selection,
      conditions,
      order: [],
      keywords: [],
      // Attachment has no delete state, so every stored row reads as alive.
      itemstate: "all",
      count: Math.min(intParam(url, "count", MAX_COUNT), MAX_COUNT),
      start: intParam(url, "start", 0),
    },
  };
};
