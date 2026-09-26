# RV-119 🟢 実装と合わないコメントが 4 か所ある

- 重要度: 🟢 ／ 観点: ドキュメント
- 状態: open

## 概要

本体の無い節や、すでにある機能を「将来の作業」と書いたコメントが残っている。

## 根拠

- `src/accessor/apply-image.ts:44`（本体の無い「Write-side guards」の節。実体は `guard-image-write.ts`）。
- `src/accessor/build-read-params.ts` の import の上の、`append-read-query` 用のコメントの重複。
- `src/xml/decode-field.ts:69`（「Richer reference reading is future work」。[ADR-0058][adr58] ですでにある）。
- `src/xml/write-value.ts:16`（「Per-field static typing … is future work」。同じファイルに `WriteValueOf` がある）。

## 影響

🟢。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- コメントを今の実装に合わせる。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

—

[adr58]: ../../adr/0058-reference-expansion-read.md
