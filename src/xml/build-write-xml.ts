// A Write request body: every record's `<Item>` inside the resource's root element (ADR-0011).

import type { DataType } from "../porters/data-type";
import { encodeWriteItem } from "./encode-write-item";
import type { WriteItem } from "./write-value";

/** Build a Write request body: `<{Resource}><Item>…</Item>…</{Resource}>`. */
export const buildWriteXml = (config: {
  resource: string;
  prefix: string;
  fields: ReadonlyMap<string, DataType | null>;
  items: WriteItem[];
}): string => {
  const items = config.items
    .map((item) => encodeWriteItem(config.prefix, config.fields, item))
    .join("");
  return `<${config.resource}>${items}</${config.resource}>`;
};
