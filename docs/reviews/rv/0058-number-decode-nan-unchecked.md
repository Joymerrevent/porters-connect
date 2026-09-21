# RV-58 🟢 `Number` の Read が数値でない文字列を `NaN` に黙って変換し、そのまま Write に戻る

- 重要度: 🟢 ／ 観点: API 忠実性 / フェイルセーフ
- 状態: open

## 概要

`decodeField` は `Number`（と `System[Id]`）を `Number(value)` で読むだけで、**数値として読めたか**を
見ない。数値でない文字列が来ると `NaN` が読み取り値になり、例外も警告も出ない。日時型は
[RV-36][rv36] で「書式が違えば `validation`」になったが、**数値型だけがその外**に残っている。
`NaN` を Write に戻すと `String(NaN)` ＝ `<Alias>NaN</Alias>` が PORTERS に届く。

## 根拠

- `src/xml/decode.ts:364-365` — `case "Number": return Number(value);`（`System[Id]` も同じ分岐）。
  数値でない `value` を弾く条件が無い。
- `src/xml/decode.ts:297-318` — `converted()` は **日時型だけ**を書式検証して `validation` にする。
  `src/xml/decode.ts:251` のコメントが「判定は形（スカラか入れ子か）の食い違いだけ」と範囲を限定している。
- `src/xml/encode.ts:154-157` / `:263-272` — `Number` の Write は `scalar(value)` ＝ `escapeXml(String(v))`。
  `NaN` は `"NaN"` になる。
- 出典: [Field Type & Data Type List][fdt] `:16` — Number は「数値。小数は最大 2 桁（Read）」、
  `:29` — Currency も Data Type は Number。数値でない値が来る書式は出典に無い＝来たら**宣言が違うか
  出典に無い書式**のどちらかで、どちらも [RV-36][rv36] の日時と同じ「報告すべき食い違い」。
- [ADR-0006][adr6] `:121` — 「宣言型と実データの食い違いも `validation` で surface（フィールド名付き・
  **silent な誤変換はしない**）」。
- [ADR-0069][adr69] `:26-31` の実測表は「Number / `f.singlelineText()`」（`"123"`＝実害小）は載せているが、
  **逆向き「テキスト / `f.number()`」は載っていない**＝この経路は一度も測られていない。
- 実測（2026-09-21・`decodeField` 直叩き）:

  | 入力                                    | 結果                      |
  | --------------------------------------- | ------------------------- |
  | `decodeField("Number", "abc", "U_x")`   | `NaN`（throw しない）     |
  | `decodeField("Number", "12abc", "U_x")` | `NaN`（throw しない）     |
  | `decodeField("Number", "", "U_x")`      | `null`（空は正しく null） |

## 影響

🟢。**到達には宣言の誤りが要る**（PORTERS が Number 項目に数値以外を返す書式は出典に無い）ので、
[RV-55][rv55] と同じ「正しい経路では起きない」類型。ただし起きたときの倒れ方は RV-36 の
silent `null` より悪い: `NaN` は `typeof === "number"` で `!= null` も通るため、集計に混ざれば
結果が丸ごと `NaN` になり、そのまま `update` に戻せば `"NaN"` を送る（PORTERS 側で Code 103 になる
見込みだが、**読み取り側は最後まで黙っている**）。

この経路が現実に踏まれるのは、[ADR-0087][adr87] が 0.21.0 の動機にした「**別テナントの宣言を当てる**」
場面そのもの（テナント A の `U_score` は Number・B は テキスト）。ADR-0087 の「信じている入力」表は
「実データと形が食い違えば `validation` で surface（RV-36）」と書くが、**Number ⇄ テキストは
「形」（スカラ同士）が同じ**なので RV-36 の網に掛からず、この表の守り方が効かない唯一の組み合わせになる。

## 検出経緯

観点 1 で 0.21.0 の CHANGELOG「Option の項目をテキストで読めば値が `null` になり、例外も警告も出ません」
を実装と突き合わせ（→ [RV-60][rv60]）、その過程で「では RV-36 の後に残っている silent な経路は何か」を
`decodeField` のスカラ分岐で 1 型ずつ追って見つけた。日時は `converted()`・文字列型は変換なし・
残るのは `Number(value)` だけだった。

## 推奨

- (a) `Number` / `System[Id]` の Read で `Number.isFinite()` を通し、外れたら `converted()` と同じ形
  （`PortersResourceError`・`category: "validation"`・alias 付き・hint は Field Read の確認）で投げる。
  RV-36 が日時に入れたのと同じ位置・同じ文言の型で、**新しい判断は含まない**（ADR-0006 の既決を
  数値型に適用するだけ）＝ **ADR 不要**。
- (b) Write 側でも `Number` に `Number.isFinite()` を掛け、`NaN` / `Infinity` を送信前に
  `PortersConfigError`（`validation`）で止める（RV-36 の書き側と同じ非対称の解消）。
- 検証は RV-36 の日時と同じく**敵対的入力で pin**する（`"abc"` / `"12abc"` / `"1e999"`）。
  [ADR-0069][adr69] の実測表に「テキスト / `f.number()`」の行を足す（表が「測っていない組み合わせ」を
  隠していたことへの対処）。
- 出典に無い書式（例: 桁区切り）が実機で来るなら、それは (a) が**見える化**する＝ LV に回す判断材料になる。

## 処置

—

[rv36]: 0036-write-value-validation-partial.md
[rv55]: 0055-time-of-day-decode-hour-unchecked.md
[rv60]: 0060-changelog-stale-silent-null-premise.md
[adr6]: ../../adr/0006-error-model.md
[adr69]: ../../adr/0069-tenant-field-catalog-tooling.md
[adr87]: ../../adr/0087-tenant-scoped-field-declarations.md
[fdt]: ../../usage/reference/resource-api/field-data-types.md
