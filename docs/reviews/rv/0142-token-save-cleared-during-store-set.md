# RV-142 🟢 取り直したトークンを保存先に書いている間に clear() が走ると、保存先にトークンが戻る

- 重要度: 🟢 ／ 観点: 認証
- 状態: fixed

## 概要

取り直しは世代の比較を通った後に `store.set` を待つ。その間に `clear()` が保存先を消しても、`set` が後から終わると、消したはずのトークンが保存先に残る。

## 根拠

- `src/auth/token-manager.ts` の `save`。`set` の中で await してから書く保存先を想定した人工的な再現（再レビュー・2026-09-26）。実際の保存先で起きるかは確かめていない。RV-91 の修正より前からある。

## 影響

🟢。保存先の書き込みと `clear()` が重なる、まれな時機でだけ起きる。

## 検出経緯

2026-09-26 の通信と認証の Low の修正（fix/http-auth-low-review）を、change-review の手順でレビューし直したときに見つけた。止めどきの規則により、この回では直さずに記録する。

## 推奨

- `clear()` が保存先への書き込みの完了を待ってから消すか、書き込みの後にもう一度世代を確かめて消す。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

**実施（2026-09-27・fix/review-followup-low・`ffddf11` → `fd7ef1e`）。** 保存先への書き込みを待つ間に手元が入れ替わっていたら（`clear()` や後の `cache()`）、保存先を今の手元に合わせ直す（手元が空なら消し、あれば書き直す）。最初は「手元が空のときだけ消す」にしたが、書き込みが追い越されると（NEW → OLD の順に終わる）手元と保存先が食い違うとミューテーションで分かり、`fd7ef1e` で合わせ直す形にした。さらに、`clear()` の後に届いた古い書き込みを最初の読み込みが生き返らせると再レビューで分かり、`8f191bd` で `cache()` / `clear()` が走った後は保存先を読まないようにした。合わせ直しは、手元が変わらなくなるまで繰り返す（合わせ直しの最中の `clear()` に追い越されないように。`598d2de`）。

## 検証

`src/auth/token-manager.test.ts` の「does not leave a token in the store when clear() ran while it was being written」「keeps a token cached after the clear(), even when an earlier write finishes late」「does not bring a cleared token back through the first store read」「keeps reconciling the store until the local state stops changing」。
