# レビュー記録（reviews）

`/project-review` スキル（`.claude/skills/project-review/`）が生成・更新するレビュー成果物です。

- [findings.md][findings] — 指摘台帳の**索引**（ID / 重要度 / 観点 / 状態 / 概要）。ここから各指摘へ辿ります。
- [`rv/`][rv] — 指摘の**本体**。**1 件 1 ファイル**（`NNNN-kebab-title.md`・`NNNN` は RV-N の 4 桁ゼロ埋め）で、
  ID 不変・ファイルは消さず「状態」と「処置」を更新します（[ADR-0052][adr52]）。
- `YYYY-MM-DD-NN.md` — 各回のスナップショット（その時点の写真）。`NN` はその日の run 連番（2 桁ゼロ埋め・`01` 始まり）。同日に複数回回しても追記せず連番で別ファイルにする。

思想は [docs/live-verification.md][lv] と同じ（処置・履歴が追えること＝フェイルセーフ）。
台帳の項目と実コードの対応は `RV-N`（findings）/ `LV-N`（live-verification）で双方向に辿れます。

**索引と本体のズレは `pnpm check:index` が検出し、CI で落とします**（[ADR-0052][adr52] / [ADR-0053][adr53]）。
状態を変えたら**両方**を直してください。

[findings]: findings.md
[lv]: ../live-verification.md
[rv]: rv
[adr52]: ../adr/0052-findings-register-layout.md
[adr53]: ../adr/0053-adr-index-split.md
