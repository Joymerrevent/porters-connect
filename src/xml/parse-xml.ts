// XML parsing and its error routing (ADR-0011). The parser returns raw strings
// (`parseTagValue: false`); all type coercion happens in `decode-field.ts`. The three response
// parsers (`parse-resource-page.ts` / `parse-write-result.ts` / `parse-authentication.ts`) read
// through here.

import { XMLParser } from "fast-xml-parser";

import type { PortersError } from "../errors/index";
import { asString } from "./as-string";

const parser = new XMLParser({
  // 属性はルート要素のもの（Read の Total / Count / Start）だけを読む。ほかの要素の属性を読むと、Option の
  // 選択肢や Item に「@_x」が値として混ざり、属性付きの Image の子要素が値を失う（RV-87）。jPath はルート
  // 要素だけがピリオドを含まない（下の要素のパスは「Candidate.Item…」になる）。
  ignoreAttributes: (_name, jPath) => String(jPath).includes("."),
  attributeNamePrefix: "@_",
  ignoreDeclaration: true,
  parseTagValue: false,
  parseAttributeValue: false,
  // 値の前後の空白と改行を残す（複数行テキストを読んで書き戻すと、データが変わるため。RV-83）。
  // 整形された応答の要素と要素の間の空白は、読んだあとに dropLayoutText で取り除く。
  trimValues: false,
  // 数値文字参照（&#12354; / &#x41; / &#13;）をデコードする（RV-83）。
  htmlEntities: true,
  // asArray() already normalizes a single/missing/repeated <Item> into an array,
  // so isArray is belt-and-suspenders: these mutants are equivalent (no test can
  // observe the difference once asArray() runs).
  // Stryker disable next-line ArrowFunction,ConditionalExpression,StringLiteral: equivalent — asArray() normalizes regardless
  isArray: (name) => name === "Item",
});

// 子要素を持つ要素の中の、空白だけのテキスト（整形された応答の改行と字下げ）を取り除く。値を持つ要素
// （子要素の無い要素）の中身は文字列のまま残る — 空白を含めて、それが値。
const dropLayoutText = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(dropLayoutText);
  // 読み込みの結果に null は出ないが、万一来ても Object.entries で TypeError にならないよう先に返す。
  // Stryker disable next-line ConditionalExpression: equivalent — the parser never yields null
  if (node === null || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "#text" && String(value).trim() === "") continue;
    out[key] = dropLayoutText(value);
  }
  return out;
};

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
  let parsed: unknown;
  try {
    parsed = parser.parse(xml);
  } catch (cause) {
    throw unparseable(cause);
  }
  return dropLayoutText(parsed);
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
