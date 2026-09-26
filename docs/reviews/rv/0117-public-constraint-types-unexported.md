# RV-117 🟢 公開の型の制約に使う `FieldCatalog` / `EmptyCatalog` / `DataType` を export していない

- 重要度: 🟢 ／ 観点: 型安全 / DX
- 状態: open

## 概要

利用者がリソースの型を自分で書くときに使う制約の型が、パッケージから取れない。`src/index.ts` のコメントが、別の export の上に置かれている。

## 根拠

- typedoc の notExported の警告（58 件。[ADR-0068][adr68] 決定 4 で既知として扱っている）。`src/index.ts:171` のコメントの位置。

## 影響

🟢。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- 利用者に効く制約の型を export するかを決める。コメントを正しい位置に移す。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

—

[adr68]: ../../adr/0068-api-reference-tooling.md
