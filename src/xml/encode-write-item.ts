// One Write record as its `<Item>…</Item>` element (ADR-0011 / ADR-0041).

import { PortersConfigError } from "../errors/index";
import { qualify } from "../util/alias";
import type { DataType } from "../porters/data-type";
import { assertTagName } from "./assert-tag-name";
import { encodeField } from "./encode-field";
import type { WriteItem } from "./write-value";

// 接頭辞の付いた alias（cast 経由）は拒否する。そのまま書くと `<Person.Person.P_Name>` になり、外してから
// 書くと、キー名で見る書き込みの前の検査（id の上書き・画像の上限）を素通りする（RV-105 と、その再レビュー）。
// 項目の alias に "." は含まれない（接頭辞はライブラリが付ける）。
const assertBareAlias = (alias: string): void => {
  if (!alias.includes(".")) return;
  throw new PortersConfigError(
    `${alias}: a field alias to write must be bare (like "P_Name"), without a prefix`,
    {
      category: "validation",
      hint: "Write each field under its bare alias; the library adds the resource's own prefix.",
      context: { operation: "encode" },
    },
  );
};

// One `<Item>…</Item>` body. An alias without a Data Type is written as Text (`encodeField`).
const encodeItem = (
  prefix: string,
  fields: ReadonlyMap<string, DataType | null>,
  item: WriteItem,
): string => {
  const parts: string[] = [];
  for (const [alias, value] of Object.entries(item)) {
    // null / undefined -> omit (leave unchanged); "" is kept (clears a Text field).
    if (value === null || value === undefined) continue;
    assertBareAlias(alias);
    // 項目 alias も要素名になる（ADR-0085 論点2 (ii)）。型は `WritableKeys<F>` に絞っているが、
    // excess property check はフレッシュなリテラルにしか効かないので、`JSON.parse(...) as …` で
    // 組み立てた入力なら任意のキーが実行時に届く。接頭辞はライブラリの定数で、それ自体が Name なら
    // `{prefix}.{alias}` も Name になる＝検証すべきは呼び出し側の値である alias のほう。
    assertTagName(alias, "field alias", alias);
    const inner = encodeField(fields.get(alias), value, alias);
    const tag = qualify(prefix, alias);
    parts.push(`<${tag}>${inner}</${tag}>`);
  }
  return parts.join("");
};

/**
 * One record as its full `<Item>…</Item>` element. Exposed so the bulk write chunker
 * (accessor/write-many.ts) can measure each record's serialized length when packing a
 * request under the size cap (ADR-0041).
 */
export const encodeWriteItem = (
  prefix: string,
  fields: ReadonlyMap<string, DataType | null>,
  item: WriteItem,
): string => `<Item>${encodeItem(prefix, fields, item)}</Item>`;
