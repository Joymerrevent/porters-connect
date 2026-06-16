# 17. Option フィールドの読み取り値の表現（複数選択対応）

- Status: proposed
- Date: 2026-06-16
- Deciders: jun.shiromoto (Joymerrevent)

> 議論用に起票（proposed）。決定の反映（`decodeOption` 実装・`FieldValue` 型・テスト）は accepted 後。
> [ADR-0011][0011]（XML エンコード/デコード）・[ADR-0016][0016]（FieldType 粒度）を内部実装レベルで補足する。

## Context and Problem Statement

PORTERS の Option フィールドには**単一選択（Dropdown / Radiobutton）と複数選択（Checkbox）**があり、[ADR-0016][0016] で**どちらも `Option`（Data Type）**として扱う（ライブラリは単一/複数を型で区別しない）。

Read 形式は `<Field><OptionRoot><Alias1/><Alias2/>…</OptionRoot></Field>` で、**複数選択は子 alias が複数**並ぶ。
しかし現状の `decodeOption` は **`keys[0]`（先頭の alias のみ）** を返すため、**複数選択でデータが欠落する（実害）**。
Write（`encodeField`）は既に `string | string[]` を受けて複数 alias を出力でき、**Read だけが非対称**。

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

**提案（議論待ち）: 案A（常に `string[]`、未設定は `null`）**。理由:

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
