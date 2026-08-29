---
"@joymerrevent/porters-connect": minor
---

Read の `field` を接頭辞なしの型付き alias で受けるようにしました（ADR-0059）。

`condition` / `order` と同じ素の alias（`P_Name`）で書き、接頭辞はライブラリが付けます。
綴り間違い（`P_Nmae`）・接頭辞付き（`Person.P_Name`）・展開文字列は**コンパイルエラー**になります。
未宣言のカスタム項目は `U_` / `A_` の命名規則で通ります。

**破壊的変更**: 既存の `field: ["Person.P_Name"]` は型エラーになります。移行は接頭辞を消すだけです
（`field: ["P_Name"]`）。実行時は接頭辞付きが来ても剥がして受けるので、cast 経由の古い形も壊れません。

併せて、明示指定した `field` も既定 field と同じ組み立てを通るようになりました。
User 型の項目を明示しても 4 サブ項目に展開されるので、型が約束する `UserRef` が実際に返ります。
