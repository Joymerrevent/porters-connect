---
"@joymerrevent/porters-connect": patch
---

利用者向けドキュメント（`docs/usage/` と README）の本文から、**ADR 番号やレビュー指摘番号
（RV / LV）などの保守者向けの識別子と、設計文書へのリンクを取り除きました**。利用者には意味を
持たない情報で、出典は Markdown の HTML コメントに移しています（GitHub の表示には出ません）。

- 説明の内容は変わりません。文末の `（ADR-0059）` のような表記が消え、設計文書に委ねていた
  数か所は本文に書き足しています。
- PORTERS ヘルプセンターの再取得手順（保守者向け）は `docs/usage/reference/README.md` から
  `CONTRIBUTING.md` へ移しました。
- `pnpm check:usage`（`pnpm check` に含まれます）が、利用者向けドキュメントへの再混入を検査します。
