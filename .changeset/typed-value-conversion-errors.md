---
"@joymerrevent/porters-connect": minor
---

宣言型と実データの食い違いを `validation` で surface するようにした（RV-36）。**破壊的変更を含む。**

[ADR-0006][adr6] / [ADR-0011][adr11] は「型不一致はクラッシュさせず `validation` で surface
（フィールド名付き・**silent な誤変換はしない**）」と決めていたが、実装が従っていなかった。

**変わったこと 2 つ。**

1. **形の食い違いが `null` ではなくエラーになる**（破壊的）。実物が Option の項目を
   `f.singlelineText()` と宣言していた場合、これまでは読み取りが黙って `null` を返し、
   「その項目は空だった」と区別が付かなかった。いまは
   `PortersResourceError`（`category: "validation"`）でフィールド名つきに失敗する。
2. **日時の変換失敗が `PortersError` になる**。以前は素の `RangeError` が飛び、
   ガイドが勧める `instanceof PortersError` の分岐から漏れていた。引き金でクラスを分けた —
   読み（応答が引き金）は `PortersResourceError`、書き・`condition`（渡した値が引き金）は
   `PortersConfigError`。`category` はどちらも `validation`。

判定は**形の食い違いだけ**に絞ってある。PORTERS は値型をスカラ・複合型を入れ子で送るので、
スカラが来るべき所に入れ子（またはその逆）は Data Type が違うことしか意味しない。それより細かい
違い（入れ子の中の想定外のタグ・`P_Id` の欠落）は**許容して `null`** のままで、弾くと偽の警報に
なるため。`Link` は形そのものが判別子なので検査しない。

**書き込みに値検証は足していない。** 日時だけ検査するのは、日時だけが**変換される**からで、
他の型は変換が無いため素通しする（`Number` に `"abc"` を渡しても PORTERS が弾く）。
手前で厳しくするとサーバーが受け付ける値を落としてしまう。

宣言のずれを**事前に**知りたい場合は `verifyFields`（ADR-0069）を使う。

[adr6]: https://github.com/Joymerrevent/porters-connect/blob/main/docs/adr/0006-error-model.md
[adr11]: https://github.com/Joymerrevent/porters-connect/blob/main/docs/adr/0011-xml-parse-serialize.md
