# RV-31 🟡 System[Reference] を展開して要求しても ID 以外が捨てられる

- 重要度: 🟡 ／ 観点: API 忠実性 / 型安全
- 状態: fixed

## 概要

`System[Reference]` の項目（`Job.P_Client` など）は、PORTERS の Read で
**上位リソースの項目を入れ子で展開して取得できる**。しかしライブラリは
`decodeReference` が **`P_Id` だけを取り出して `number` を返す**ため、
利用者が `field: ["Job.P_Client(Client.P_Id,Client.P_Name)"]` と**明示的に展開を要求しても
`Client.P_Name` は黙って捨てられる**。

## 根拠

- 正典（原記事 [Field Type & Data Type List][fdt]・Field Type 11 / `System[Reference]`）:
  「Read の場合、Read API - Parameter > Read - Field に従って指定することで、
  **上位 Resource の Field を参照することができます**」。
- 正典（[Resource API 概要][rapi]「field の指定」）:
  `field=Job.P_Client(Client.P_Id,Client.P_Name)` ／ **`()` を省くと上位 Resource の ID のみ**出力。
- `src/xml/decode.ts` の `decodeReference` — 入れ子を受け取っても
  `inner["{Tag}.P_Id"] ?? inner.P_Id` を読んで `number` を返すだけで、**他の子要素を見ない**。
- `src/resources/resource.ts` の `defaultFieldList` — `User` 型だけ 4 サブ項目に展開し、
  `System[Reference]` は `()` を付けない（＝既定は ID のみ）。これは [ADR-0020][adr20] の意図した設計。
- 型: `DecodedValue<"System[Reference]"> = number`（`src/xml/decode.ts`）。

## 影響

**既定の挙動は正しい**（`()` 無しで送るので ID のみ返り、`number` と一致する）。
問題は**利用者が明示的に展開を要求したとき**で、リクエストは展開形で送られ、
PORTERS は入れ子を返し、**ライブラリがそれを捨てる**。

利用者から見ると「`Client.P_Name` を要求したのに返ってこない」。エラーにならず、
型（`number`）とも矛盾しないため、**気づく手がかりが無い**。[RV-1][rv1]（field 省略時に
主キーしか返らない）と同系統の「**要求したものが黙って返らない**」失敗で、
あちらが 🔴 だったのは既定経路だったから。本件は明示指定時のみなので 🟡。

回避策はある（`Client` を別途 `client.get(id)` で引く）が、**1 往復増える**うえに
「そうするしかない」と気づく必要がある。

## 検出経緯

2026-08-22。[ADR-0056][adr56] の議論中に stakeholder から
「Read で reference の項目が含まれる場合、参照先の項目は展開されて取得されるか」と問われ、
`decodeReference` と `defaultFieldList` を突き合わせて判明した。
**質問されなければ気づいていない**（既定経路では露出しないため）。

## 推奨

いずれか。**挙動・型のどちらを変えるにせよ ADR が要る**。

- **(a) 展開を型で表現する** — `field` に展開形を指定したときだけ入れ子の値が返るよう、
  `System[Reference]` の読み取り値を「ID または参照先レコード」にする。
  `User` が `UserRef` を返すのと同じ方向で一貫するが、**`field` の内容で戻り型が変わる**ため
  型設計が重い（[ADR-0019][adr19] の「カタログから導出」と噛み合わせる必要がある）。
- **(b) 展開の要求を弾く** — `System[Reference]` に `()` 付きの `field` を渡したら
  送信前に `PortersConfigError`（「参照先の項目は別リソースの Read で取得してください」）。
  既存の送信前ガードの系列に載り、**黙って捨てるのをやめる**のが主眼。
- **(c) 現状維持 ＋ 文書化** — [Read クエリ ガイド][rq]に「`System[Reference]` は ID のみ返る。
  参照先の項目は別途 Read する」と明記する。最小コストだが、**要求が黙って捨てられる事実は残る**。

`User` 型が 4 サブ項目を返している以上、(a) が筋としては自然。ただし
**PORTERS が返せる項目は上位リソースの任意の field** なので、`User` のような固定 4 項目とは
事情が違う（`UserRef` に相当する固定型が作れない）。

## 処置

[ADR-0058][adr58] を **accepted**（**案D**）ののち実装。起票時の推奨 3 案のうち **(a) を採り、
(b) をその内側に置いた**。軸は **PORTERS ができることをライブラリが落とさない**こと —
黙って捨てるのをやめるだけでなく、**要求されたものを返せるようにする**。

- **型付きの `expand` オプション**を追加した。`expand: { P_Client: ["P_Id", "P_Name"] }` と書くと
  `field=Job.P_Client(Client.P_Id,Client.P_Name)` を送り、入れ子の応答を
  **参照先リソースのカタログで decode** して返す。参照先の接頭辞はライブラリが付ける
  （Candidate は `Person` — descriptor が持つ）。
- **戻り型は `expand` を書いたときだけ変わる**。推奨 (a) が重いとされたのは
  「`field` の内容で戻り型が変わる」点だったが、**型が変わる入口を `field` 文字列ではなく
  `expand` という別の引数にした**ことで [ADR-0005][adr5] SD-3（`field` の選択で戻り型を変えない）を
  維持したまま解けた。基底の型は `number | null` のままなので、
  **展開を使わない利用者に narrowing の税がかからない**。
- **raw `field` に書かれた展開は弾く**（推奨 (b)）。ただし単独ではなく `expand` への誘導として。
  `field` は [ADR-0059][adr59] で型付き bare alias になったので、展開文字列は**そもそも型で書けない**。
  このガードはその下の層＝cast 経由に対する多層防御。
- 併せて `decodeReference` を **bare alias 一致**に直した。入れ子の包みタグはリソース名なのに
  中の alias は接頭辞付きで、Candidate（`<Candidate>` に `Person.P_Id`）では
  従来の `{Tag}.P_Id` 照合が外れて `null` に落ちていた。

**カスタム `U_`/`A_` の参照項目は対象外**（カタログに無いので `expand` に載せられない）。
`defineFields` が参照型を宣言できるようになるまで残る穴で、ガイドに明記した（[ADR-0023][adr23]）。
**Recruiter 参照も対象外** — 未実装リソースでカタログが無く、持っていない情報は発明しない。
どちらも従来どおり参照 ID として読める。

要求側の接頭辞（Candidate 参照を `Person.` と書くか）は **[LV-16][lv]** で契約後に確認する。

[adr19]: ../../adr/0019-static-resource-types.md
[adr20]: ../../adr/0020-read-field-default.md
[adr56]: ../../adr/0056-deleted-flag-typing.md
[fdt]: https://hrbcapi.porters.jp/hc/ja/articles/115008017407-Field-Type-Data-Type-List
[rapi]: ../../reference/resource-api/README.md
[rq]: ../../guide/read-query.md
[rv1]: 0001-read-field-default-missing.md
[adr5]: ../../adr/0005-public-api-shape.md
[adr23]: ../../adr/0023-custom-field-declaration-dsl.md
[adr58]: ../../adr/0058-reference-expansion-read.md
[adr59]: ../../adr/0059-read-field-bare-alias.md
[lv]: ../../live-verification.md
