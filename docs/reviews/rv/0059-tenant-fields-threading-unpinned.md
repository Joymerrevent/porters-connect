# RV-59 🟡 `tenant(id, { fields })` の宣言配線を candidate 以外の 10 リソースで pin しておらず、その survivor を「同値」と記録していた

- 重要度: 🟡 ／ 観点: テスト厳密性 / プロセス
- 状態: open

## 概要

`buildScope` が各リソース factory に `customFor("job")` … と宣言を配る 11 行のうち、**candidate の
1 行しかテストが守っていない**。残り 10 行のキー文字列を空にしても（＝そのリソースの宣言が丸ごと
捨てられても）**1414 件すべて緑**のまま。Stryker はこれを survivor 10 件として毎回報告していたが、
前 run のスナップショットはそれを「前回までに equivalent と判断済み」と書いた。**判断した記録は無く、
実測すると同値ではない。**

## 根拠

- `src/client.ts:348-359` — `candidate: createCandidateResource(deps, customFor("candidate"))` から
  `resume: … customFor("resume")` まで 11 行。`customFor(key)` は `scope.fields?.[key] ?? {}` なので、
  キーが違えば **`{}`（宣言なし）に黙って落ちる**。
- Stryker 全体実測（2026-09-21 19:48〜19:50・2650 ミュータント・survived 89）: `client.ts` の survivor
  10 件は **L349〜L359 の `StringLiteral → ""`**（job / client / recruiter / contact / opportunity /
  activity / contract / sales / process / resume）。L348（candidate）は killed。
- 実測（2026-09-21）: `src/client.ts:349` を `customFor("")` に手で変えて `pnpm vitest run` →
  **Test Files 89 passed / Tests 1414 passed**。job の宣言が届かなくても検知されない。
- 実行時に配線を pin しているテストは `src/fields/custom-fields.test.ts:97-121` と
  `src/client.test.ts:555-568` で、**どちらも candidate だけ**。
  `src/fields/custom-fields.test.ts:133-` の「各アクセサへ届く」は**型テストのみ**（文字列の変異は型に現れない）。
- [ADR-0087][adr87] `:203-206` 実施合意事項 3 — 「実行時: `tenant(1, { fields: a })` と
  `tenant(2, { fields: b })` が**それぞれの宣言で decode** すること」。リソースを限定していないが、
  実装 PR は candidate で 1 本書いて終えている。
- [ADR-0015][adr15] `:43` — 「survived は『テストの穴』。`// Stryker disable` は真の同値変異のみ」、
  `:71-78` — 「全 survived を撃破し … 同値変異のみ `// Stryker disable` ＋理由で限定明示 …
  新たな等価変異が出たときのみ追加する」。今回の全体実測では **Ignored（明示済み）42 ／ Survived
  （撃破も明示もされていない）89**。
- [前 run のスナップショット][prev] `:39-40` — 「`client.ts` 10（いずれも前回までに equivalent と
  判断済みの継ぎ目・エラー文字列が主）」。`docs/reviews/` を `client.ts` × `equivalent` で検索しても
  この判断を記録した箇所は無い。

## 影響

🟡。**今日のコードは正しい**（11 行とも正しいキー）。困るのは次に `buildScope` を触ったとき —
そして 0.21.0 は**まさにそこを書き換えた版**（`customFor` をコンストラクタから `buildScope` の
内側へ移した）。そのとき job 以下 10 リソースの 1 行が崩れていても、テストは緑・Stryker は「survivor
10 件＝前回と同じ」に見え、利用者側では `t.job.search()` の `U_` 項目が**型は付いているのに値が
生の文字列か `undefined`** になる（宣言なし＝カタログ外 alias の passthrough）。例外は出ない。

重要度を 🟢 でなく 🟡 にしたのは、**ゲートが「壊れていない」と言っていたのが誤りだった**から。
ミューテーションは [ADR-0015][adr15] でテストの穴を見つける道具と決めた。その survivor を根拠なく
「同値」と記録すると、以後の run は同じ数字を見て「変化なし」と読む（前 run がそうだった）。
穴が無いのではなく、穴を**見なくなっていた**＝この台帳の言葉では fail-open。

## 検出経緯

観点 6 で Stryker の全体を再実測し、前 run と同じ「client.ts 10」を見て、今回は**中身を出した**
（HTML レポート埋め込みの JSON から survivor の行を列挙）。行番号が L349〜359 の文字列変異で、
コメントや hint 文字列ではなく**リソースキー**だった。同値なら `customFor("")` でも挙動が同じはずで、
それはあり得ない（`scope.fields?.[""]` は必ず `undefined`）ので、手で変異させて全件回した。

## 推奨

- (a) **配線を 11 リソースぶん一度に pin する表駆動テスト**を 1 本足す: `defineFields` に 11 リソース
  すべての `U_x` を宣言し、`tenant(1, { fields })` の各アクセサで `search()` → 返る `U_x` が宣言の
  Data Type で decode され（Number なら `number`）、URL の `field` に `U_x` が入ることを 1 リソースずつ
  `expect`。ADR-0087 合意事項 3 の「それぞれの宣言で decode」をリソースの軸にも広げた形。
  **ADR 不要**（テストだけ）。
- (b) 残る survivor 79 件（`decode.ts` 20・`auth-api.ts` 20・`image.ts` 15 …）も、ADR-0015 の規則
  どおり「撃破するか、`// Stryker disable` ＋理由で明示するか」に振り分ける。エラー文字列の変異は
  「文言を pin しない」と決めるなら **その決定を ADR-0015 側に 1 行足す**（規則と実態のどちらかを直す）。
  これは (a) と別 PR でよい。
- (c) スナップショットでは「survivor N 件」を書くとき、**前回と同じ数でも中身が同じとは限らない**
  ことを前提に、少なくとも新規・増減のあったファイルは行を出す（本 run から実施）。

## 処置

—

[adr15]: ../../adr/0015-mutation-testing.md
[adr87]: ../../adr/0087-tenant-scoped-field-declarations.md
[prev]: ../2026-09-21-01.md
