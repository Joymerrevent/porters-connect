# RV-123 🟢 送った後の `create` が、再試行しない「結果の分からない」失敗のとき、hint が付かない

- 重要度: 🟢 ／ 観点: エラーモデル
- 状態: fixed

## 概要

Code 1000（server）や、200 で本文が読めない応答（unknown）は、登録まで進んだかが分からないが、再試行しない失敗なので「登録された可能性あり」の hint が付かない。

## 根拠

- `src/http/requester.ts` の `recoveryFor`。実測（再レビュー・2026-09-26）。ADR-0103 は対象を「再試行できる失敗」に絞っているので、範囲どおり。

## 影響

🟢。自動では再送しない（安全側）。利用者が気づく手がかりが弱いだけ。

## 検出経緯

2026-09-26 の通信と認証の修正（fix/http-auth-review）を、change-review の手順でレビューし直したときに見つけた。止めどきの規則により、この回では直さずに記録する。

## 推奨

- 送った後の `create` の失敗のうち、PORTERS が状態を返していないものにも同じ hint を付けるかを決める。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

**実施（2026-09-27・feat/adr-0106-unknown-outcome-and-codes・`f851f92`）。** ADR-0106 案1A で、送った `create` が `server` / `unknown` の失敗（PORTERS の Code がある、または 2xx で本文が読めない）で終わったときも、「登録された可能性あり」の hint を付ける。再試行しないエラーの hint は残して後ろに続ける。

## 検証

`src/http/requester.test.ts` の「reports an unknown outcome for a sent create that fails without saying it was not processed」「keeps a non-retryable error's hint and appends the outcome hint」。
