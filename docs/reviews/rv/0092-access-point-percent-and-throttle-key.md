# RV-92 🟢 ホスト名の検査が `%` を含む名前を通し、スロットルの鍵が同じ宛先を別のものとして数える

- 重要度: 🟢 ／ 観点: 設定検証
- 状態: fixed

## 概要

`a%40evil.com`・`xn--` は検査を通るが、URL にすると不正になり、再試行できる通信エラーとして届く。スロットルは `a.test` と `a.test:443` と `a.test.` を別の宛先として数える。

## 根拠

- `src/http/access-point.ts:73`（`assertHostname`）、`src/http/shared-throttle.ts:31`。実測（サブエージェント）。

## 影響

🟢。設定の誤りがまれで、影響は起動時に分かる。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- `%` を含む名前を拒否する。スロットルの鍵を、既定のポートと末尾の `.` を取り除いた形にそろえる。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

**実施（2026-09-26・fix/http-auth-low-review・`dbd129e・2754d33`）。** `%` を含むホスト名を拒否し、送るときの scheme（https）で組み立てられない名前も起動時に止める。スロットルの鍵を `throttleKeyOf`（大小・既定のポート・末尾の `.` をそろえた形）にした。

## 検証

`src/http/access-point.test.ts` の「rejects …, which https cannot address as written」と `throttleKeyOf` の表。
