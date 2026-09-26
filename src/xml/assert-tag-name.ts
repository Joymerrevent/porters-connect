// The one check a caller-supplied string passes before it becomes an XML element name (ADR-0085).

import { PortersConfigError } from "../errors/index";
import { isXmlName } from "../util/xml-name";

/**
 * The one place a caller-supplied string is allowed to become an **element name** (ADR-0085).
 *
 * Two boundaries reach it — an Option's selected alias and a Write item's field alias — and both
 * are checked the same way: valid XML `Name`, or the write is refused before it is sent.
 *
 * **Escaping cannot do this job.** `escapeXml` (in `encode-field.ts`) neutralises the *content* position, but a
 * name has no escape: `&lt;` is not an element called `<`, it is invalid XML. So the only safe
 * handling of a name that is not a `Name` is to refuse it — which is why this throws rather than
 * sanitising (ADR-0085 案D を棄却した理由).
 *
 * `PortersConfigError` + `category: "validation"` because the value came from the caller, not
 * PORTERS (ADR-0006). Every caller is `async`, so this arrives as a rejection (ADR-0046).
 */
export const assertTagName = (
  name: string,
  kind: string,
  alias: string,
): void => {
  if (isXmlName(name)) return;
  throw new PortersConfigError(
    `${alias}: ${kind} ${JSON.stringify(name)} is not a valid XML element name`,
    {
      category: "validation",
      // PORTERS writes this value as a tag (`<FieldAlias><OptionAlias/></FieldAlias>`), so an
      // arbitrary string cannot be sent. Say that, and say where a real one comes from.
      hint: "PORTERS writes it as an XML element name, so it must be a valid XML Name (letters, digits, `_`, `-`, `.`, no spaces or markup). Option aliases come from the Option master (`t.option`) or the field's option list in the reference.",
      context: { operation: "encode" },
    },
  );
};
