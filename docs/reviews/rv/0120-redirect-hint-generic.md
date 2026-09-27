# RV-120 🟢 3xx の応答のエラーの hint が一般的で、リダイレクトだと分からない

- 重要度: 🟢 ／ 観点: エラーモデル / DX
- 状態: fixed

## 概要

リダイレクトを追いかけなくなった（RV-76）ので 3xx はエラーとして届くが、hint は「httpStatus を見て」という一般の文で、よくある原因（http から https への転送、ホスト名の誤り）に触れていない。転送先（Location）も利用者には見えない。

## 根拠

- `src/errors/http-status-error.ts`（3xx は `unknown`）。実測（再レビュー・2026-09-26）: 301 / 302 / 303 / 307 / 308 はどれも基底の `PortersError`・`category: "unknown"` で届いた。

## 影響

🟢。エラーにはなる（黙っては通らない）。

## 検出経緯

2026-09-26 の通信と認証の修正（fix/http-auth-review）を、change-review の手順でレビューし直したときに見つけた。止めどきの規則により、この回では直さずに記録する。

## 推奨

- 3xx 専用の hint（scheme とホスト名を確かめる）を足す。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

**実施（2026-09-26・fix/http-auth-low-review・`3551aeb・358130b`）。** 3xx 専用の hint（リダイレクトを追いかけないこと、`scheme` とアドレスを確かめること）を足し、利用者向け文書の status の表に 3xx を足した。転送先（Location）は見せていない（Transport の応答が header を持たないため）。

## 検証

`src/errors/http-status-error.test.ts` の「says a … is a redirect the library does not follow」。
