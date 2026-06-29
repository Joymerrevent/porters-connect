# 16. 内部 FieldType の粒度（PORTERS の Field Type か Data Type か）

- Status: accepted
- Date: 2026-06-15
- Deciders: jun.shiromoto (Joymerrevent)

> 議論の結果 **案B（Data Type 整合）で accepted**（2026-06-15）。コードへの反映（FieldType 拡張・
> 各カタログの型ラベル更新・テスト）は本 ADR を受けて別 PR で行う。
> [ADR-0004][0004]（型モデル）・[ADR-0011][0011]（XML エンコード/デコード）を内部実装レベルで補足する。

## Context and Problem Statement

`src/xml/decode.ts` の内部 `FieldType`（decode/encode を駆動する型）の粒度が場当たり的で、PORTERS の型体系と一貫していない。

PORTERS のフィールド型は 2 段ある（[field-data-types][fdt]）:

- **Field Type**: 項目の種別。SinglelineText / MultilineText / Number / **Currency** / Date / **Age** / URL / Mail / Telephone / Option[Checkbox/Radiobutton/Dropdown] / System / DateTime / Reference / User / Image / Link。
- **Data Type**: 値のワイヤー表現＝PORTERS が正規化した「値の形」。**Currency の Data Type は `Number`**、**Option 3 種の Data Type は単一の `Option`**、**Age の Data Type は `Age`**、それ以外は概ね Field Type と同名。

現状の lib 型は**どちらとも一致しない過剰な潰し**になっている：文字列系（Singleline/Multiline/Mail/Telephone/URL）を全部 `Text`、Currency を `Number`、Option 3 種を `Option`。直近で `Age` だけ独立させた（#19）ため基準がさらに曖昧。

問い: **内部 FieldType を PORTERS の「Field Type」と「Data Type」のどちらに整合させるか（型の粒度の基準をどこに置くか）？**

## Decision Drivers

- **忠実性**: PORTERS の型体系を素直に写し、独自の粒度を発明しない。
- **型安全・将来の検証余地**: 型別の振る舞い（Mail 形式検証・Telephone 正規化・Currency 整形）の足場。[ADR-0004][0004] の宣言 DSL とも整合。
- **薄く・堅く**: 振る舞いが同一の型を無闇に増やさない（decode/encode の重複・テスト面積）。
- **一貫性**: 場当たりの潰しをやめ、単一基準で説明できる。
- **値表現の不変性**: 利用者が受け取る値（文字列／数値／ISO 日付…）は粒度に依らず同じ。FieldType は現状**内部のみ**で公開していない。
- **round-trip 正当性**（Read/Write 非対称の詳細は [ADR-0011][0011] の範囲）。

## Considered Options

- **案A: PORTERS Field Type に整合** — Currency≠Number、Option 3 種を区別、Singleline≠Multiline、Mail/Telephone/URL/Age も独立。最も細かい。
- **案B: PORTERS Data Type に整合** — PORTERS 自身の値表現に合わせる。Currency→`Number`・Option 3 種→`Option` に潰れるが、Singleline/Multiline/Mail/Telephone/URL/Age は Data Type として独立。
- **案C: 振る舞い（ワイヤー処理）粒度** — decode/encode が同一の型を統合（文字列系→`Text`、数値系→`Number`、Age→`Date`…）。現状に近く最小だが PORTERS 型から最も乖離し、**Age を Date に戻す**ことになる。

## Decision Outcome

**採用: 案B（PORTERS Data Type に整合）**。理由:

- Data Type は **PORTERS 自身が定義する「値の形」** であり、独自の粒度を発明せず忠実。
- `Age` は Data Type として独立 → #19 の対応と整合（案C なら Age を Date に戻すことになり矛盾）。
- `Mail`/`Telephone`/`URL`/`SinglelineText`/`MultilineText` を独立型に（将来の検証・正規化の足場）。decode/encode 実装は文字列系で共有しつつ、**型ラベルは Data Type に一致**させる。
- `Currency`→`Number`（PORTERS 自身が Currency の Data Type を Number と定義）、Option 3 種→`Option`（Data Type は単一）。**PORTERS がしない区別は発明しない**。
- 利用者が受け取る値は不変。FieldType は内部のまま。

> **本 ADR は粒度の基準のみを決める。** 複数選択 Option（Checkbox）の read が先頭 alias のみ返す**実害**は、
> どの案でも独立に修正すべき別件（Option の Data Type が単一でも、read は全 alias を返すべき）。
> 値エンコード/デコードの詳細は [ADR-0011][0011] の範囲。

### Consequences

- Good: PORTERS の型体系に忠実・単一基準で説明可能。Age の独立が正当化される。型別検証の足場ができる。
- Bad: 文字列系の型が増える（Singleline/Multiline/Mail/Telephone/URL）。decode/encode は共有でもカタログ・テストの記述量が増える。
- Neutral: 利用者向けの値は不変。将来 FieldType を公開するなら本決定がその点にも効く（→ 公開 API の ADR と連携）。

## Pros and Cons of the Options

### 案A: Field Type 整合

- Good: ドキュメント上の Field Type と 1:1・最も説明的。Currency / Option 種別まで型に出る。
- Bad: Currency と Number は値表現が同一（PORTERS も Data Type=Number）＝振る舞い無差の型が増える。Option 3 種の区別は read の複数選択以外に実益が薄い。型数が最多。

### 案B: Data Type 整合

- Good: PORTERS 自身の値表現に忠実・独自粒度を発明しない。Age 独立と整合。型別検証の足場。
- Bad: 文字列系 Data Type（5 種）が独立して増える（実装は共有可だが面積増）。

### 案C: 振る舞い粒度（現状寄り）

- Good: 型・実装が最小。
- Bad: PORTERS 型から最も乖離。Age を Date に戻す＝#19 と矛盾。場当たり感が残り忠実性の要求に反する。

## More Information

- 補足対象: [ADR-0004][0004]（型モデル）・[ADR-0011][0011]（XML エンコード/デコード）。
- 関連実装: `src/xml/decode.ts` の `FieldType`、各 `src/resources/*.ts` のカタログ。
- 別件（本 ADR と独立に対応）: 複数選択 Option の read 全 alias 返却（実害修正）。
- 現状の差異棚卸し（2026-06-15）: Mail/Telephone→Text、Currency→Number、Singleline/Multiline→Text、Option 3 種→Option、Age は #19 で独立済み。
- 実装時の確定（2026-06-17）: 案B を **System 系にもリテラル一致**で適用した。内部 `FieldType`
  は Data Type 文字列をそのまま使い、`Id`→`System[Id]`・`Reference`→`System[Reference]` に改名、
  FT-12 `DateTime` とシステムタイムスタンプ `System[DateTime]`（登録日/更新日・Write 不可）を
  **別ラベルに分離**（ワイヤー形式は同一で decode/encode は共有）。`System[…]` 修飾はライフサイクル
  （自動採番・Write 制限）を表し値の形ではないため、Write 制限は本型ではなく入力型側（SD-3）で担保する。
  これで非 System 系と同じ「Data Type に一致」基準を System 系にも一貫適用できた。
  - 併せて**型名も実態に合わせて `FieldType` → `DataType` に改名**した（保持するのは Field Type ではなく
    Data Type であり、名前が決定に追従していなかったため）。内部専用で公開 API は不変。本 ADR の表題は
    起票時の問い（「FieldType の粒度を Field Type/Data Type どちらに合わせるか」）を歴史的経緯として残す。

[fdt]: ../reference/resource-api/field-data-types.md
[0004]: 0004-field-type-model.md
[0011]: 0011-xml-parse-serialize.md
