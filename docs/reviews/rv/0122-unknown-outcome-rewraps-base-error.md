# RV-122 🟢 `asUnknownOutcome` が、Resource 以外のエラーをすべて `PortersNetworkError` に作り直す

- 重要度: 🟢 ／ 観点: エラーモデル
- 状態: open

## 概要

利用者が自作した Transport が、再試行できる基底の `PortersError`（例: category server）を投げると、クラスが `PortersNetworkError` に変わる。

## 根拠

- `src/http/requester.ts` の `asUnknownOutcome`。読んだだけ。ライブラリの内部からは到達しない。

## 影響

🟢。自作の Transport のときだけ。

## 検出経緯

2026-09-26 の通信と認証の修正（fix/http-auth-review）を、change-review の手順でレビューし直したときに見つけた。止めどきの規則により、この回では直さずに記録する。

## 推奨

- 元のクラスのまま作り直すか、基底のクラスのときは基底で作り直す。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

—
