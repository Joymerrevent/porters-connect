# 17. Option フィールドの読み取り値の表現（複数選択対応）

- Status: accepted
- Date: 2026-06-16
- Deciders: jun.shiromoto (Joymerrevent)

> 議論の結果 **案A（常に `string[]`）で accepted**（2026-06-16）。**PORTERS が Read / Write とも Option を
> 「alias の集合」で表す（スカラー形なし）**ことが決め手。コードへの反映（`decodeOption` 実装・`FieldValue` 型・
> テスト）は別 PR で行う。[ADR-0011][0011]（XML エンコード/デコード）・[ADR-0016][0016]（FieldType 粒度）を補足する。

## Context and Problem Statement

PORTERS の Option フィールドには**単一選択（Dropdown / Radiobutton）と複数選択（Checkbox）** があり、[ADR-0016][0016] で**どちらも `Option`（Data Type）** として扱う（ライブラリは単一/複数を型で区別しない）。

**PORTERS は Read / Write とも Option を「選択 alias の集合」として表す**（リファレンスで確認）:

- Read: `<Field><OptionRoot><OptionAlias>…</OptionAlias>…</OptionRoot></Field>` — `OptionRoot` 配下に選択 alias が 1 個以上並ぶ。
- Write: `<FieldAlias><OptionAlias1/><OptionAlias2/>…</FieldAlias>` — 出典原文「複数指定する場合は、Field Alias タグの間に Option Alias タグを複数指定します」（東京＋神奈川の例）。

つまり**スカラー形は存在せず**、単一選択（Dropdown/Radiobutton）は要素数が最大 1 の集合にすぎない（子要素の数が 0/1/多 と違うだけ）。
しかし現状の `decodeOption` は **`keys[0]`（先頭の alias のみ）** を返すため、**複数選択でデータが欠落する（実害）**＝
PORTERS の表現ではなくこちらが潰している artifact。Write（`encodeField`）は既に `string | string[]` 対応で、**Read だけが非対称**。

問い: **Option の読み取り値をどの形で返すか？**（`FieldValue` 型にも影響する）

## Decision Drivers

- **ロスレス**: 複数選択を欠落させない（実害の解消）。
- **予測可能な型**: consumer が分岐に悩まない一貫した形。
- **Write との対称性**: `encodeField` は `string | string[]` を受ける。read-modify-write が自然。
- **既存規約との一貫性**: 未設定 / 空は `null`（他の型と同じ）。
- **薄く・堅く**: 単一/複数の区別をライブラリが持たない（ADR-0016）前提で素直に。

## Considered Options

- **案A: 常に `string[]`** — 選択ありは配列（単一選択も 1 要素配列）、未設定は `null`。`FieldValue` に `string[]` を追加。
- **案B: スカラー or 配列** — 1 個なら `string`、複数なら `string[]`、未設定 `null`。直感的だが型が `string | string[] | null` で consumer が `typeof` 分岐。
- **案C: 現状（先頭の alias のみ `string`）** — 複数選択でデータ欠落。却下。

## Decision Outcome

**採用: 案A（常に `string[]`、未設定は `null`）**。理由:

- **PORTERS 自身が Read / Write とも「alias の集合」で表す**（スカラー形なし）→ `string[]` がそのまま忠実な写像。案B は PORTERS に無い「スカラー」を発明することになる。
- **ロスレス**（実害解消）。複数選択も全 alias を返す。
- 型が `string[] | null` で**予測可能**（`typeof` 分岐が不要）。
- **Write と対称**（`encodeField` は `string[]` を受ける）→ read-modify-write が自然。
- 未設定 / 空は `null` で**既存の empty→null 規約と一貫**。
- 単一選択が 1 要素配列になる冗長さはあるが、曖昧さ・データ欠落より軽微。

`FieldValue` に `string[]` を追加（`string | number | string[] | UserRef | null`）。利用者向けの実質的な変化は
**単一選択 Option read（`string` → 1 要素 `string[]`）のみ**（v0 のため許容）。encode は変更不要（既に `string[]` 対応）。

### Consequences

- Good: 複数選択ロスレス・型が一貫・Write と対称・round-trip が自然。
- Bad: 単一選択 Option read が `string` → `string[]`（1 要素配列）に変わる。`FieldValue` が広がる。
- Neutral: encode は変更不要。

## Pros and Cons of the Options

### 案A: 常に配列

- Good: 一貫・ロスレス・Write 対称・型が単純（`string[] | null`）。
- Bad: 単一選択が 1 要素配列＝やや冗長。

### 案B: スカラー or 配列

- Good: 単一は素の `string` で直感的。
- Bad: 型が `string | string[] | null`＝consumer が毎回 `typeof` 分岐。判別が値依存で脆い。

### 案C: 現状（先頭のみ）

- Bad: 複数選択でデータ欠落（実害）。却下。

## More Information

- 補足対象: [ADR-0011][0011]（decode/encode）・[ADR-0016][0016]（Option を単一 Data Type に）。
- 関連実装: `src/xml/decode.ts` の `decodeOption` / `FieldValue`、`encode.ts` の Option エンコード（変更不要）。
- 決定後の反映: `decodeOption` 実装・`FieldValue` 型・テスト（mutation 100% 維持）。

[0011]: 0011-xml-parse-serialize.md
[0016]: 0016-field-type-granularity.md
