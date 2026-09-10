---
"@joymerrevent/porters-connect": patch
---

公開 API の全記号のリファレンスを `docs/api/` に用意した（ADR-0068・`1.0.0` 条件の V2）。

TypeDoc + `typedoc-plugin-markdown` で JSDoc から生成した 176 ページをリポジトリに置いてある。
`dist/index.d.ts` の export 節にある 177 記号すべてにページがあり、TypeDoc は entry point から
到達できる記号をすべて出すので、記号を足せばページも増える。

生成漏れは `pnpm check:api` が CI で落とす（一時ディレクトリへ再生成して中身を突き合わせる）。
公開 API を変えると**リファレンスの差分が PR に出る**ので、レビューで「この変更は利用者に何が
見えるか」が読める。

パッケージの中身は変わっていない（ドキュメントのみ）。
