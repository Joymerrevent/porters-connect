// Parsing a Resource Write response (ADR-0011 / ADR-0045).

import { resourceError } from "../errors/resource-error";
import { PortersError, PortersResourceError } from "../errors/index";
import { asArray } from "./as-array";
import { asRecord } from "./as-record";
import { parseXml, toInt } from "./parse-xml";

/** One written record's outcome: the assigned/updated `Id` and its Result `Code`. */
export type WriteResultItem = {
  id: number;
  code: number;
};

/**
 * Parse a Resource Write response. A *successful* one has no root `<Code>` nor
 * Total/Count/Start: each `<Item>` carries its own `<Id>` (assigned on create /
 * echoed on update) and `<Code>` (per-item Result Code). Applying the per-item
 * code policy (throw on `!= 0`) is the accessor's job, since a bulk write mixes
 * successes and failures — see write-format.md. A request rejected as a *whole*
 * answers with a root `<Code>` instead, which is read first and thrown (ADR-0045).
 */
export const parseWriteResult = (xml: string): WriteResultItem[] => {
  const unparseable = (cause?: unknown): PortersError =>
    new PortersResourceError("unparseable write response", {
      category: "unknown",
      cause,
    });
  const root = asRecord(parseXml(xml, unparseable));
  const rootKey = root ? Object.keys(root)[0] : undefined;
  // Same equivalence as parseResourcePage: both guards converge on the throw.
  // Stryker disable next-line ConditionalExpression,LogicalOperator: equivalent — both branches converge on the unparseable throw
  const body = root && rootKey ? asRecord(root[rootKey]) : undefined;
  if (!body) {
    throw unparseable();
  }

  // A request-level failure (too many records, malformed XML, no permission) leaves no `<Item>` to
  // carry the reason, so the Result Code sits at the root — the same place Read puts it. Reading it
  // here is what keeps it from being lost: a single write would otherwise report "no result item"
  // and a bulk write a result-count mismatch, both `unknown` (ADR-0045 / RV-14). A successful
  // response has no root `<Code>`, so `toInt` reads 0 and the success path is untouched.
  // VERIFY(live): that failures answer this way is an assumption — the reference documents only the
  // success shape. See docs/live-verification.md (LV-11).
  const code = toInt(body.Code);
  if (code !== 0) {
    throw resourceError(code, `write returned code ${code}`, {
      resource: rootKey,
      operation: "write",
    });
  }

  return asArray(body.Item).map((it) => {
    const item = asRecord(it) ?? {};
    return { id: toInt(item.Id), code: toInt(item.Code) };
  });
};
