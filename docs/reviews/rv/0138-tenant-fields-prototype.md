# RV-138 🟢 tenant() の宣言の検査が、prototype 経由の宣言を見ない

- 重要度: 🟢 ／ 観点: フェイルセーフ
- 状態: open

## 概要

検査は `Object.entries` で自分のプロパティだけを見るが、読み書きは `scope.fields?.[key]` で prototype もたどる。`tenant(1, { fields: Object.create({ job: { U_x: "Bogus" } }) })` が受理される。

## 根拠

- `src/fields/assert-declared-catalogs.ts` と `src/porters-client.ts`。受理は実測、その先の読み書きは未検証（再レビュー・2026-09-26）。

## 影響

🟢。意図してこう書く利用者はまずいない。

## 検出経緯

2026-09-26 のカスタム項目の宣言と添付ファイルの修正（fix/fields-attachment-review）を、change-review の手順でレビューし直したときに見つけた。止めどきの規則により、この回では直さずに記録する。

## 推奨

- 読む側も自分のプロパティだけを見るか、検査で prototype を持つ宣言を拒否する。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

—
