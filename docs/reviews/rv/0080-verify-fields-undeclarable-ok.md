# RV-80 🟡 宣言できない項目（Reference 型など）を宣言しても、`verifyFields` が `ok: true` を返す

- 重要度: 🟡 ／ 観点: フェイルセーフ / API 忠実性
- 状態: open

## 概要

テナント側で宣言できない型（Reference・System 系）の項目を宣言していても、`verifyFields` はどの問題の区分にも入れず、`ok: true` を返す。

## 根拠

- `src/fields/verify-fields.ts:144`: 宣言できない項目に載っていれば `missing` にしないだけで、ほかの区分にも入れない。
- [ADR-0069][adr69] の区分の表に、この場合の決めが無い。`verify-fields.test.ts` は「Declaring one of these is a mistake」と書きながら `ok` を確かめていない。
- 実測（2026-09-26）: Field Read が Reference 型（`P_Type` 16）の `U_ref` を返すテナントで、`U_ref` を `f.number()` と宣言すると、`ok: true`・`missing` 0・`typeMismatch` 0 だった。

## 影響

🟡。Reference 型は値を持たないので、読むと常に `null` になる。起動時の `assertFieldsMatch` も通るため、気づく手段が無い。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- **要 ADR**（ADR-0104 で起票）。ADR-0069 の区分を改めるため。案: 宣言できない理由が「Data Type が無い」「宣言の対象外」の項目を宣言していたら、`typeMismatch` と同じく `ok` を倒す。

## 処置

—

[adr69]: ../../adr/0069-tenant-field-catalog-tooling.md
