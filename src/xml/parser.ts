// XML parsing + error routing (ADR-0011). The parser returns raw strings
// (`parseTagValue: false`); all type coercion happens in `decode.ts`.

import { XMLParser } from "fast-xml-parser";

import { resourceError } from "../errors/classify";
import { PortersResourceError } from "../errors/index";
import { asArray, asRecord, asString } from "./raw";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  ignoreDeclaration: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => name === "Item",
});

/** One `<Item>`: a map of field alias -> raw node (string or nested object). */
export type RawItem = Record<string, unknown>;

export type ResourcePage = {
  total: number;
  count: number;
  start: number;
  items: RawItem[];
};

/**
 * Parse a Resource Read response. Reads `<Code>` first and, if non-zero, throws
 * the mapped PortersError (ADR-0006) — HTTP 200 + `<Code>≠0` is an error, not
 * data.
 */
export const parseResourcePage = (xml: string): ResourcePage => {
  const root = asRecord(parser.parse(xml) as unknown);
  const rootKey = root ? Object.keys(root)[0] : undefined;
  const body = root && rootKey ? asRecord(root[rootKey]) : undefined;
  if (!body) {
    throw new PortersResourceError("unparseable resource response", {
      category: "unknown",
    });
  }

  const code = Number(asString(body.Code) ?? "0");
  if (code !== 0) {
    throw resourceError(code, `resource returned code ${code}`, {
      resource: rootKey,
    });
  }

  return {
    total: Number(asString(body["@_Total"]) ?? "0"),
    count: Number(asString(body["@_Count"]) ?? "0"),
    start: Number(asString(body["@_Start"]) ?? "0"),
    items: asArray(body.Item).map((it) => asRecord(it) ?? {}),
  };
};
