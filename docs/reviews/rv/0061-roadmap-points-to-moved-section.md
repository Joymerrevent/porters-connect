# RV-61 🟢 roadmap が reference README の「再取得の手順」を案内しているが、その節は CONTRIBUTING へ移っている

- 重要度: 🟢 ／ 観点: ドキュメント / プロセス
- 状態: fixed

## 概要

`docs/roadmap.md` は出典再取得の手順として「[reference README] の『再取得の手順』」を指すが、
その節は #365（0.21.0）で **`CONTRIBUTING.md`「PORTERS ヘルプセンターの再取得」へ移動**し、
reference README には HTML コメントで「CONTRIBUTING にある」と残るだけになった。リンク先の
ファイルは実在するので `check:links`（アンカー実在検査を含む）は通る。

## 根拠

- `docs/roadmap.md:60-61` — 「reference への反映 … は済んでいる（`[reference README][ref-readme]` の
  『再取得の手順』）」。`:737` — `[ref-readme]: usage/reference/README.md`（アンカー無し）。
- `docs/usage/reference/README.md:13-14` — `<!-- 再取得の手順（…）は CONTRIBUTING.md「PORTERS
ヘルプセンターの再取得」にある。利用者向けのこのページには置かない。 -->`。本文から節は消えている。
- `CONTRIBUTING.md:58` — `### PORTERS ヘルプセンターの再取得（\`docs/usage/reference\` の更新）`。
- `git log 566d330..HEAD -- CONTRIBUTING.md` — 移動は `aa5aa97`（#365）。同 PR の変更ファイルに
  `docs/roadmap.md` は無い。
- [RV-39][rv39] でアンカーの実在は検査するようになったが、このリンクは**ファイル単位**で、
  節名は地の文に書かれている（`「再取得の手順」`）ので検査の対象外。

## 影響

🟢。困るのは**次に出典を再取得する人**（2026-09-20 の再取得は差分 4＋5 記事を拾った実績のある
運用で、roadmap がその入口）。roadmap → reference README と辿ると手順が無く、HTML コメントを
ソースで読んで初めて CONTRIBUTING に着く。GitHub の表示ではコメントが消えるので、**表示だけ読む
人には行き止まり**に見える。1 語の修正で直る。

同じ PR で reference README から**利用者向け文書の外**へ出した情報がほかにも無いか（`gen-resources.mjs`
を使わない理由・差分の取り方）は本 run で確認し、CONTRIBUTING に揃って移っている。roadmap の
この 1 か所だけが古い案内のまま。

## 検出経緯

観点 7 で roadmap の V5 節を読み、「再取得の手順」を reference README に探して見つからず、
HTML コメントで移動先を知った。#365 の変更ファイル一覧に roadmap が無いことで「移動時の洗い漏れ」と
特定した。[breaking change の作法][sweep]（ts スニペットは検査が拾う・地の文は手で洗う）と同じ
類型で、今回は「文書の移動」に対する洗いが `docs/usage/` の外まで及ばなかった。

## 推奨

- (a) `docs/roadmap.md:61` を「[CONTRIBUTING][contributing] の『PORTERS ヘルプセンターの再取得』」に
  直す（参照定義を 1 つ足す）。**ADR 不要**。
- (b) 仕組み化するなら、`check:links` に「地の文の `「…」` が同じ行のリンク先の見出しに実在するか」を
  足す手はあるが、誤検出（引用符の別用途）が多く見合わない。今回は (a) だけでよい。

## 処置

**実施（案 (a)・2026-09-21）。** `docs/roadmap.md` の案内を「手順は [CONTRIBUTING] の『PORTERS ヘルプセンターの
再取得』」に直し、参照定義 `[contributing]` を足した。案 (b)（検査の追加）は見送り（誤検出が見合わない）。

## 検証

- `grep -n '再取得の手順' docs/roadmap.md` — 0 件。`grep -n 'PORTERS ヘルプセンターの再取得' docs/roadmap.md CONTRIBUTING.md`
  — 両方に 1 件ずつ（案内と見出し）。`pnpm check:links` 緑。

[rv39]: 0039-link-check-ignores-anchors.md
[sweep]: ../../../CLAUDE.md
[contributing]: ../../../CONTRIBUTING.md
