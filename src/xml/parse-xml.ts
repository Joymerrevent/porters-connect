// XML parsing and its error routing (ADR-0011). The parser returns raw strings
// (`parseTagValue: false`); all type coercion happens in `decode-field.ts`. The three response
// parsers (`parse-resource-page.ts` / `parse-write-result.ts` / `parse-authentication.ts`) read
// through here.

import { XMLParser } from "fast-xml-parser";

import type { PortersError } from "../errors/index";
import { asString } from "./as-string";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  ignoreDeclaration: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  // asArray() already normalizes a single/missing/repeated <Item> into an array,
  // so isArray is belt-and-suspenders: these mutants are equivalent (no test can
  // observe the difference once asArray() runs).
  // Stryker disable next-line ArrowFunction,ConditionalExpression,StringLiteral: equivalent — asArray() normalizes regardless
  isArray: (name) => name === "Item",
});

/**
 * Parse, routing a parser failure into the caller's own "unparseable" error (RV-54).
 *
 * `fast-xml-parser` throws for two different reasons, and **both mean the same thing to us**:
 * malformed XML, and a handful of tag names it refuses on principle (`prototype` /
 * `constructor` / `__proto__` — prototype-pollution guards). The second is the one that bites:
 * those are perfectly valid XML names, so a tenant whose Option alias is one of them writes
 * fine and then **fails to read back**.
 *
 * Whichever it was, the raw `Error` must not escape: {@link PortersError} is what the
 * error-handling guide tells callers to branch on, and an exception outside that family reaches
 * the top of their application unhandled (ADR-0006 — the same hole RV-36 closed for date
 * conversion). The original is kept on `cause`, so the parser's own message is still readable.
 */
export const parseXml = (
  xml: string,
  unparseable: (cause?: unknown) => PortersError,
): unknown => {
  try {
    return parser.parse(xml);
  } catch (cause) {
    throw unparseable(cause);
  }
};

// fast-xml-parser yields raw strings; coerce an attribute/code node to an int,
// treating a missing node as 0. The explicit `undefined` check keeps the
// fallback observable — `Number("") === 0`, so a `?? "0"` default would be an
// equivalent mutant.
export const toInt = (v: unknown): number => {
  const s = asString(v);
  return s === undefined ? 0 : Number(s);
};

/**
 * Read a Result `<Code>` / `<Error>`. Absent or empty reads as 0 (success), as PORTERS omits the
 * root `<Code>` on a successful Write. Anything else must be a plain number: a node carrying
 * attributes, nested elements or a repeated tag, or text that is not a number, is not a PORTERS
 * answer — reading it as 0 would turn an error into a success (RV-70).
 */
export const toCode = (
  v: unknown,
  unparseable: (cause?: unknown) => PortersError,
): number => {
  if (v === undefined) return 0;
  const s = asString(v);
  if (s === undefined) throw unparseable();
  const t = s.trim();
  if (t === "") return 0;
  if (!/^\d+$/.test(t)) throw unparseable();
  return Number(t);
};
