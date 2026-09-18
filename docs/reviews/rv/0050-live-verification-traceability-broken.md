# RV-50 🟡 LV と `VERIFY(live)` の対応が双方向で崩れ、未登録の仮定が残っている

- 重要度: 🟡 ／ 観点: プロセス / フェイルセーフ
- 状態: open

## 概要

[live-verification][lv] は「該当箇所に `VERIFY(live)` コメントを置いてあり、grep で**双方向に
対応付けできます**」と宣言し、[roadmap][rm] の `1.0.0` 条件 **V4** もその 1:1 対応を測り方に
採っている。実測するとその対応は**両方向で崩れて**いて、**LV に登録されていない未確認の仮定が
コード中に 2 件ある**。検査する仕組みも無い。

## 根拠

`grep -rn "VERIFY(live)" src test` と [live-verification][lv] のサマリー表を突き合わせた実測。

**(1) LV → コード が無い（3 件）**。いずれも LV 本文が「コード箇所」を名指しているのに、
その場所に `VERIFY(live)` が無い:

| LV    | 本文が名指すコード箇所                                                                        | 実測                                                            |
| ----- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| LV-13 | `src/client.ts`（`tenant` / `buildScope`）・`src/resources/resource.ts`                       | マーカー無し                                                    |
| LV-18 | `src/resources/user.ts`（`DEFAULT_FIELDS`）・`src/resources/read-core.ts`（`readFieldEntry`） | マーカー無し（`user.ts` の 2 件は LV-17 と `code_direct` の話） |
| LV-23 | `src/http/throttle.ts`（`createThrottleRegistry` / `sharedThrottleFor`）                      | マーカー無し                                                    |

**(2) コード → LV が無い（2 件・こちらが重い）**。`VERIFY(live)` を置き
`docs/live-verification.md` を参照しているのに、**対応する LV エントリが表に無い**:

- `src/resources/activity.ts:46` — 「`P_EventParticipants` は複数人を持てる `User` 項目。Read 応答が
  入れ子の `<User>` を繰り返すか（繰り返すならどう返るか）は未確認。decoder は先頭を採る」
- `src/resources/sales.ts:16` — 「the exact conditions are doc-only until a contract environment
  confirms them」

**(3) 検査が無い**。`grep -rn "LV-\|live-verification\|VERIFY" scripts/*.mjs` のヒットは
`check-doc-links.test.mjs` のテスト用文字列だけ。`pnpm check:index` は ADR 索引と findings 索引を
突き合わせるが、**LV ↔ コードは対象外**。

## 影響

**(2) が本体**。LV 台帳の存在理由は「契約が取れたときに確認すべき仮定を 1 件も落とさないこと」で、
表に載っていない仮定は**確認されないまま通過する**。しかも
[roadmap][rm] の **V5（全エントリが「状態: 確定」）は `1.0.0` のブロッカー**なので、
V5 が緑になった時点で「ライブ検証は終わった」と判断されるが、
Activity の複数人 `User` と Sales の条件は**誰も見ていない**。
`P_EventParticipants` は decoder が先頭だけ採る（＝2 人目以降を黙って捨てる）仮定なので、
外れたときの倒れ方は「値が静かに欠ける」＝ ATS のデータとしては気づきにくい形。

(1) は逆向きで実害は小さい（LV 本文がコード箇所を書いているので、契約後に辿る道はある）。
効かないのは「コードを触った人が、そこにライブ仮定が乗っていると気づく」方向。
`throttle.ts` の共有キー（LV-23）や `user.ts` の `DEFAULT_FIELDS`（LV-18）は
**今後も編集されうる場所**なので、マーカーが無いと仮定ごと書き換わりうる。

(3) があるため、(1)(2) はどちらも**放置すれば静かに増える**。V1/V2 は 188 件の自動検査で
守られているのに、V4 の測り方だけが人手の grep に留まっている＝
このプロジェクト自身の「人の記憶でなく仕組みで守る」から外れている。🟡 は
「`1.0.0` のゲート 2 本（V4・V5）の妥当性が今すでに崩れている」ことを理由に置いた。

## 検出経緯

下調べで [live-verification][lv] を読み、V4 の測り方が「grep の結果が 1:1」と書いてあったので
**そのまま実行して確かめた**（宣言されている検査は実行して確かめる）。(1) は表の 25 件と
grep のヒットを引き算して出た。(2) は逆に、grep のヒットのうち LV 番号を書いていないものを
1 件ずつ本文に当たって見つけた — `field-type.ts` / `image.ts` / `expand.ts` などは
番号が無くても本文で LV-12 / LV-20 / LV-16 を指しているが、`activity.ts` と `sales.ts` は
**指す先が無かった**。

## 推奨

1. **(2) を LV に登録する**（まず実体を揃える）。Activity の複数人 `User` 応答形と Sales の
   条件は、それぞれ LV-26 / LV-27 として起票し、コード側のコメントに番号を入れる。
   Activity の方は「外れたとき値が静かに欠ける」ので、確認方法に**2 人以上を入れた
   レコードを読む**手順まで書く。
2. **(1) にマーカーを置く**（`client.ts` / `user.ts` / `read-core.ts` / `throttle.ts`）。
   本文の「コード箇所」と一致させる。
3. **(3) を検査にする**（本命・仕組み側）。`scripts/check-live-verification.mjs` を足し、
   `pnpm check` に載せる。見るのは 2 つ:
   - `src`/`test` の `VERIFY(live)` コメントが**必ず `LV-N` を 1 つ以上含む**こと
     （番号を書かせれば (2) は構造的に起きない）。
   - 表の各 LV が、**少なくとも 1 箇所からマーカーで参照されている**こと。
     ただし `解消` / `確定` のエントリはコード側のマーカーが消えるのが正しいので、
     **`未確認` のものだけを対象にする**。
4. **V4 の文言を検査に合わせる**。上記が入れば V4 は機械的に評価できる条件になる
   （現状は実行すると false）。

挙動変更は無いので ADR は不要。ただし 3 を入れるなら「何を検査するか」は
[ADR-0053][adr53]（索引の検査）と同じ性質なので、既存 ADR への追記が素直。

## 処置

—

[adr53]: ../../adr/0053-adr-index-split.md
[lv]: ../../live-verification.md
[rm]: ../../roadmap.md
