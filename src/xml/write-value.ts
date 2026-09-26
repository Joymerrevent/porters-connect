// The values a Write takes (ADR-0011 / ADR-0017 / ADR-0019): what each Data Type is written as,
// and one record to write. Types only — the encoding is `encode-field.ts`.

import type { DataType } from "../porters/data-type";
import type { ImageContentType } from "../porters/image";

// Option を string[] で読み書き対称にするのは ADR-0017。項目ごとの静的 Write 型は
// 基本設計 SD-3 の残課題。
/**
 * A value to write. Scalars cover the string Data Types / Number / Id and the
 * ID-only User / Reference. An **Option** value is an array of selected aliases
 * (`string[]`) — symmetric with the Option read shape; a lone string
 * is tolerated as a 1-element selection (fail-safe). `null` / `undefined` omits the
 * field (leaves it unchanged) — send `""` to clear a string field.
 *
 * Per-field static typing is {@link WriteValueOf}, which narrows this by a field's Data Type.
 */
export type WriteValue =
  string | number | string[] | ImageWriteValue | null | undefined;

// 3 要素を必須にする判断は ADR-0064 論点3。
// VERIFY(live): 画像を「消す」手段は未確認。空の sub-element が消去なのか拒否なのかは
// 書かれておらず、外すと「消えたつもり」になる — docs/live-verification.md (LV-22)。
/**
 * An Image field's write value: the three sub-elements PORTERS' Write format
 * names, with `Content` Base64-encoded. All three are **required** — PORTERS' sample writes the
 * full element and the library has no basis for a partial write; a value is either supplied whole
 * or the field is omitted (`null` / `undefined`, like every other field).
 *
 * The keys are spelled exactly as they read back, so a read value feeds straight back into a write
 * — **once its sub-tags are known to be present**. A read part is `string | null` (null = requested
 * but empty) and there is nothing to write for a null, so that check is the caller's.
 *
 * Size / name-length / MIME are checked **before the request goes out** (the ~15000-char request
 * guard is lifted for an image write, so this is what replaces it).
 *
 * There is no documented way to *clear* an image, and the library adds none: whether PORTERS
 * treats empty sub-elements as "erase" or rejects them is not written down, and guessing wrong
 * would mean thinking a value was cleared when it was not. Sending empty strings is not
 * prevented — it is simply unverified.
 */
export type ImageWriteValue = {
  FileName: string;
  ContentType: ImageContentType;
  Content: string;
};

/** One record to write: field alias (bare, e.g. `P_Name`) -> value. */
export type WriteItem = Record<string, WriteValue>;

// Data Types a user may write. `System[Id]` is library-supplied (`P_Id=-1`/target id) and
// `System[DateTime]` (registration/update) is Write-restricted by PORTERS — both are excluded
// from the static Write input so they cannot be set (ADR-0016 promise, realized in ADR-0019).
// `System[Department]` も除外する: PORTERS は Phase / User でこの型を**読み**に出すだけで、
// 書けるのか・書けるとしてどの形（`Department.P_Id`？）かを公表していない。推測した形を送るより
// **書けないことにしておく**ほうが安全側（ADR-0061 案3a の注意）。
// VERIFY(live): 書けるのか・書けるならどの形かを契約後に確認する — docs/live-verification.md（LV-29）。
export type WritableDataType = Exclude<
  DataType,
  "System[Id]" | "System[DateTime]" | "System[Department]"
>;

// Per-Data-Type write value (mirror of `encodeField`), as a **table rather than a conditional
// chain** — same reason as `DecodedValueOf`: every Data Type appears once, and a new one fails to
// compile here instead of quietly inheriting the trailing `string`. Drives the static Write type
// (ADR-0019).
//
// The three system types are listed for completeness only: they are excluded from `WritableKeys`,
// so reaching them needs a cast — and then they serialize as a scalar, which is what `string` says.
type WriteValueOfType = {
  Number: number;
  User: number;
  "System[Reference]": number;
  Link: number;
  Option: string[];
  Image: ImageWriteValue;
  DateTime: string;
  Date: string;
  Age: string;
  SinglelineText: string;
  MultilineText: string;
  Mail: string;
  Telephone: string;
  URL: string;
  "System[Id]": string;
  "System[DateTime]": string;
  "System[Department]": string;
};

// A field PORTERS gives no Data Type (`null` — ADR-0056) has no write value at all: it is already
// out of `WritableKeys`, and `never` keeps it that way if it is ever reached directly.
export type WriteValueOf<D extends DataType | null> = D extends DataType
  ? WriteValueOfType[D]
  : never;
