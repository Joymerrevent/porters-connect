// XML の Name として妥当かを判定する（ADR-0085）。
//
// なぜ util に置くか: **呼び出し側の値が要素名になる境界が 2 つある**（Option の選択肢 alias と
// Write の項目 alias）。どちらも `xml/encode.ts` から呼ぶが、判定そのものは XML の仕様であって
// PORTERS の業務ルールではないので、エラーの組み立てと切り離してここに置く。
// `util/` は依存ゼロの葉（alias / base64 / datetime と同じ）＝ここも import しない。
//
// なぜ「弾く」しかないか: 要素名はエスケープできない。実体参照は文字データの表記なので、
// `<&lt;foo/>` は要素名が `&lt;foo` という意味にはならず、単に不正な XML になる。
// 本文の位置（PCDATA）は `escapeXml` で無害化できるが、名前の位置は検証するしかない。

// XML 1.0 (Fifth Edition) の NameStartChar / NameChar をそのまま写したもの。
// <https://www.w3.org/TR/xml/#NT-Name>
//
// 範囲は**出典の順に並べてある**（読み合わせできるように）。狭めていない＝
// PORTERS の alias が何文字目に何を使えるかは出典に書かれていないので、
// XML が許すものはすべて許す（ADR-0085 案A／案B・案C を退けた理由）。
const NAME_START_CHAR =
  ":A-Z_a-z" +
  "\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF" +
  "\\u0370-\\u037D\\u037F-\\u1FFF" +
  "\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF" +
  "\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD" +
  "\\u{10000}-\\u{EFFFF}";

const NAME_CHAR =
  NAME_START_CHAR + "\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040";

// `u` フラグが要る: `\u{10000}-\u{EFFFF}` はコードポイントの範囲で、外すと範囲の順序が壊れて
// **構文エラーで RegExp が作れない**。だからこのフラグを消す変異はモジュールの読み込み自体を
// 落とす＝どのテストが殺したかを帰属できない（静的ミュータント）。実害としては全テストが
// 落ちるので見逃しようがない。
// Stryker disable next-line StringLiteral: フラグを外すと RegExp の構築が SyntaxError になり、
// モジュールが読めなくなる。殺したテストを帰属できないだけで、変更すれば必ず全体が落ちる。
//
// no-misleading-character-class は `NAME_CHAR` に含まれる結合文字の範囲
// （`\u0300-\u036F` ＝ 濁点・アクセント）を「クラスに結合文字が混ざっている」と警告する。
// ここでは**出典どおり意図して入れている**し、文字そのものではなくエスケープで書いているので
// 誤記の余地は無い。緩めるのはこの 1 行だけにする（リポジトリ全体の設定は変えない）。
// eslint-disable-next-line no-misleading-character-class
const XML_NAME = new RegExp(`^[${NAME_START_CHAR}][${NAME_CHAR}]*$`, "u");

/**
 * XML の要素名として書ける文字列か（XML 1.0 の `Name` production）。
 *
 * **保証するのは「要素名として書ける形をしている」ことだけ**で、その名前が PORTERS に
 * 実在するかは別物（ADR-0085「信じている入力」）。実在しない alias は PORTERS が
 * Result Code で拒否する。
 */
export const isXmlName = (value: string): boolean => XML_NAME.test(value);
