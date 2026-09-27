# RV-132 🟢 整形されて空白だけを含む空の入れ子要素が、null ではなくエラーになる

- 重要度: 🟢 ／ 観点: API 忠実性
- 状態: fixed

## 概要

`<P_Owner>\n  </P_Owner>` のように、空白だけを含む空の入れ子要素（User・Option・Reference）は、以前は null だったが、値の空白を残すようにしてから「a nested record ではない」エラーになる。

## 根拠

- `src/xml/parse-xml.ts`（`trimValues: false`）と `src/xml/decode-field.ts`。実測（再レビュー・2026-09-26）。PORTERS がこの形で返すかは確かめていない。

## 影響

🟢。エラーになる方向なので安全側。

## 検出経緯

2026-09-26 の応答の読み方と書き込みの値の修正（fix/xml-review）を、change-review の手順でレビューし直したときに見つけた。止めどきの規則により、この回では直さずに記録する。

## 推奨

- 入れ子の Data Type で値が空白だけの文字列なら null として読む。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

**実施（2026-09-26・fix/xml-review・`0a712e4`）。** 起票した #451 の中で直っていた（RV-83 の再レビューで、テキスト以外の型の空白だけの値を空として読むようにした）。

## 検証

`src/xml/decode-field.test.ts` の「reads a whitespace-only … as empty」（2026-09-27 に足した）。
