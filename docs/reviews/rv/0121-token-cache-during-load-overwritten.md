# RV-121 🟢 保存先の読み込み中に `cache()` を呼ぶと、新しいトークンが読み込んだ古い値で上書きされる

- 重要度: 🟢 ／ 観点: 認証
- 状態: fixed

## 概要

`load()` は `await store.get()` の前に「手元が空か」を見ているので、読み込みの間に `cache()` で入れたトークンを、読み込んだ古い値で上書きする。

## 根拠

- `src/auth/token-manager.ts` の `load`。実測（再レビュー・2026-09-26）: `cache(NEW)` の後も OLD が使われ続けた（保存先は NEW）。

## 影響

🟢。読み込みの最中に `exchangeAuthorizationCode` が終わる、まれな時機でだけ起きる。

## 検出経緯

2026-09-26 の通信と認証の修正（fix/http-auth-review）を、change-review の手順でレビューし直したときに見つけた。止めどきの規則により、この回では直さずに記録する。

## 推奨

- 読み込んだ値を受け取ってから、手元が空のときだけ入れる（`const v = …; if (cached === undefined) cached = v;`）。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

**実施（2026-09-26・fix/http-auth-low-review・`55251e4`）。** 読み込んだ値を受け取った後で手元が空かを見て、読み込みの間に `cache()` / `clear()` で入れ替わっていたら、読み込んだ値で上書きしない。

## 検証

`src/auth/token-manager.test.ts` の「keeps a token cached while the store was being read」「keeps a token cached while a renewal was running」。
