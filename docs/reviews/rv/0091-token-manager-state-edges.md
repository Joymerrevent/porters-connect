# RV-91 🟢 取り直し中の `clear()` が効かず、保存先の読み込みの失敗を二度と試さない

- 重要度: 🟢 ／ 観点: 認証
- 状態: fixed

## 概要

取り直しの途中で `clear()` を呼んでも、保存先にトークンが戻る。保存先の読み込みが 1 回失敗すると、その後は二度と読まない。

## 根拠

- `src/auth/token-manager.ts`。実測（サブエージェント）で両方を確かめた。

## 影響

🟢。どちらも、まれな時機でだけ起きる。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- 取り直しの結果を書く前に、`clear()` が呼ばれたかを確かめる。読み込みに失敗したら、次の呼び出しでもう一度読む。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

**一部を実施（2026-09-26・fix/http-auth-review・`8499ef4`）。** 保存先の読み込みに失敗したら、次の呼び出しでもう一度読むようにした（RV-75 の修正で読み込みを 1 本の Promise にまとめたとき）。取り直しの途中の `clear()` が効かない件は残っているので、状態は open のまま。

**残りを実施（2026-09-26・fix/http-auth-low-review・`55251e4`）。** 手元を入れ替えた回数を持ち、取り直しの途中で `clear()` が呼ばれていたら、取れたトークンはそのリクエストにだけ使い、手元にも保存先にも戻さない。

## 検証

`src/auth/token-manager.test.ts` の「does not save a token renewed while clear() was called」「does not bring back a token read from the store after clear()」。
