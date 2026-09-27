# RV-127 🟢 文字列の id が拒否されるようになったことが、changeset に書かれていない

- 重要度: 🟢 ／ 観点: ドキュメント
- 状態: fixed

## 概要

JS から `get("10001")` のように文字列の id を渡すと、以前は送れていたが、今は `PortersConfigError` になる。拒否すること自体は妥当。

## 根拠

- `src/accessor/assert-record-id.ts`。実測（再レビュー・2026-09-26）。

## 影響

🟢。型で止まる（JS から呼んだときだけ）。

## 検出経緯

2026-09-26 の読み書きの共通の仕組みの修正（fix/accessor-review）を、change-review の手順でレビューし直したときに見つけた。止めどきの規則により、この回では直さずに記録する。

## 推奨

- リリースのときの CHANGELOG で「文字列の id も不可」と書く。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

**実施（2026-09-26・fix/accessor-review・`（この PR の changeset）`）。** changeset に「JavaScript から文字列の id を渡した場合も同じ」と書いた。

## 検証

`.changeset/accessor-review-fixes.md` を読んで確かめた。
