# RV-72 🟡 `getMany` が、途中で切れた応答や id の重複した応答を「存在しない」として返す

- 重要度: 🟡 ／ 観点: API 忠実性 / フェイルセーフ
- 状態: fixed

## 概要

`getMany` は応答の件数が `Total` より少なくても、同じ id が 2 件返っても、足りない id を `undefined`（存在しない）として返す。

## 根拠

- `src/accessor/read-many.ts:81` は `total > chunk.length` だけを見ていて、Item が `Total` より少ない場合と、id の重複を見ていない。
- [ADR-0095][adr95] の「突き合わせ」の意図（頼んでいない id が返ったら止める）と対になる確かめが無い。
- 実測（サブエージェント・2026-09-26）: `Total=2` で Item 1 件の応答では、2 件目が `undefined` になった。同じ id が 2 件返ると、頼んだ別の id が `undefined` になった。

## 影響

🟡。「存在しない」と「読めなかった」が区別できず、存在するレコードを無いものとして扱う。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- Item の数が `Total` と合わないときと、応答の id が重複したときは、頼んでいない id が返ったときと同じエラーにする。

## 処置

**実施（2026-09-26・fix/accessor-review・`f7fe10c`）。** `src/accessor/read-many.ts` の `recordsById` が、応答のレコード数が `Total` と合わないときと、同じ id が 2 件あるときに止める。

## 検証

`src/accessor/read-many.test.ts` の「a page that does not add up (RV-72)」。

[adr95]: ../../adr/0095-get-many-by-ids.md
