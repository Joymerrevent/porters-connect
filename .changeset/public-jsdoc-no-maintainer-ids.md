---
"@joymerrevent/porters-connect": patch
---

公開 API の JSDoc（IDE のホバーと `docs/usage/api` に出る説明文）から、**ADR 番号やレビュー指摘番号
（RV / LV）などの保守者向けの識別子を取り除きました**。利用者には意味を持たない情報で、根拠は
`//` の実装コメントへ移しています。エラーの `message` / `hint` には元々含まれていません。

- 型・メソッドの意味や挙動は変わりません（説明文だけの変更）。
- `pnpm check:api` が、生成した API リファレンスにこれらの識別子が混ざっていないかも検査する
  ようになりました（日本語の混入検査と同じ仕組み）。`pnpm check:dts` は同じ検査を配布する型定義
  `dist/index.d.ts` に当てます（export されていない型の JSDoc は API リファレンスに出ないため）。
