// Parsing a Resource Read response (ADR-0011 / ADR-0051).

import { resourceError } from "../errors/resource-error";
import { PortersError, PortersResourceError } from "../errors/index";
import { asArray } from "./as-array";
import { asRecord } from "./as-record";
import { parseXml, toInt } from "./parse-xml";

/** One `<Item>`: a map of field alias -> raw node (string or nested object). */
export type RawItem = Record<string, unknown>;

export type ResourcePage = {
  total: number;
  count: number;
  start: number;
  items: RawItem[];
};

// 200 でも PORTERS が答えているとは限らない（ADR-0051）。中間装置を疑う先を示す。
const MIDDLEBOX_HINT =
  "A middlebox (proxy, captive portal, SSO login page, WAF notice) may be answering instead of PORTERS. " +
  "Check PORTERS_HOST and the network path from this process to the API.";

/**
 * Parse a Resource Read response.
 *
 * Identifies the envelope *before* reading it (ADR-0051): the root element must be the
 * `resource` we asked for, and it must carry a `<Code>` — the two facts every documented
 * Read response has. An HTTP 200 body that fails either is not PORTERS answering, and
 * returning it as an empty page would be indistinguishable from "no data" (RV-20).
 * Identity comes before value: until the response is known to be ours, its `<Code>` is not
 * ours either.
 *
 * Then reads `<Code>` and, if non-zero, throws the mapped PortersError (ADR-0006) —
 * HTTP 200 + `<Code>≠0` is an error, not data.
 */
export const parseResourcePage = (
  xml: string,
  resource: string,
): ResourcePage => {
  // One factory for both ways a response can be unreadable: the parser refused it, or it
  // parsed into something that is not a PORTERS envelope. Same answer, same error.
  const unparseable = (cause?: unknown): PortersError =>
    new PortersResourceError("unparseable resource response", {
      category: "unknown",
      cause,
    });
  const root = asRecord(parseXml(xml, unparseable));
  const rootKey = root ? Object.keys(root)[0] : undefined;
  // `root` is always a record here and `root[rootKey]` is undefined exactly when
  // rootKey is, so dropping/forcing either guard collapses to the same throw.
  // Stryker disable next-line ConditionalExpression,LogicalOperator: equivalent — both branches converge on the unparseable throw
  const body = root && rootKey ? asRecord(root[rootKey]) : undefined;
  if (!body) {
    throw unparseable();
  }

  // 観測した名前をメッセージに載せる: 何が返ってきたかが分かれば利用者が切り分けられる。
  if (rootKey !== resource) {
    throw new PortersResourceError(
      `resource response root is <${rootKey}>, expected <${resource}>`,
      { category: "unknown", hint: MIDDLEBOX_HINT, context: { resource } },
    );
  }
  // 存在の検査であって値の検査ではない。`<Code/>` は "" として存在扱い（従来どおり 0＝成功）。
  if (body.Code === undefined) {
    throw new PortersResourceError(
      "resource response has no <Code> (not a PORTERS envelope)",
      { category: "unknown", hint: MIDDLEBOX_HINT, context: { resource } },
    );
  }

  const code = toInt(body.Code);
  if (code !== 0) {
    // `rootKey` は同定を通った時点で `resource` と等しい（引数の側を使う＝型も string で済む）。
    throw resourceError(code, `resource returned code ${code}`, { resource });
  }

  return {
    total: toInt(body["@_Total"]),
    count: toInt(body["@_Count"]),
    start: toInt(body["@_Start"]),
    items: asArray(body.Item).map((it) => asRecord(it) ?? {}),
  };
};
