# RV-114 🟢 Resource のコード 5 と、Authentication のコード 113 が表に無い

- 重要度: 🟢 ／ 観点: エラーモデル
- 状態: open

## 概要

どちらも `unknown` になる（再試行しないので安全側）。テストは reference の表を機械的に読んでいない。

## 根拠

- `src/errors/resource-error.ts:13` の表と、[result-codes.md][rc]。読んだだけ。

## 影響

🟢。安全側。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- 表に足し、reference の表と突き合わせるテストを足す。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

**一部を実施（2026-09-26・fix/http-auth-low-review・`18c39cd`）。** reference の 2 つの表を読み込み、分類していないコードがちょうど Resource の 5 と Authentication の -1・113 であることを確かめるテストを足した。表に行が足されたときや、分類を決めたときに落ちる。5 と 113 を分類するかは、ADR-0006 の表を変えることになるので、RV-123 とあわせて起票する ADR で決める。状態は open のまま。

[rc]: ../../usage/reference/resource-api/result-codes.md
