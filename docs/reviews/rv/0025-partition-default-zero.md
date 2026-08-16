# RV-25 🟡 `partition` 未設定で無言のうちに `partition=0` を送る

- 重要度: 🟡 ／ 観点: フェイルセーフ / 設定検証
- 状態: open

## 概要

`PortersClientOptions.partition` は任意で、未指定なら `options.partition ?? 0` で
**ライブラリが発明した `0`** が全リクエストのクエリに載る。`partition` は Read / Write 共通の**必須パラメータ**で、
値は Partition Read で発見するもの＝ **`0` という値の意味は reference のどこにも無い**。
結果、設定漏れは「構築時の明確な設定エラー」ではなく「実行時の不透明なリソースエラー」に化ける。
[ADR-0048][adr48]（`host` を構築時に検証して繋ぐ前に落とす）で塞いだのと**同じ形の穴**が partition 側に残っている

## 根拠

`src/client.ts:209`（`buildScope(options.partition ?? 0)`）/
`docs/reference/resource-api/README.md`（Read パラメータ表：`partition` は必須 ●）/
`src/types/common.ts:5`（`PartitionId = number` ＝ 制約なし）/ [ADR-0048][adr48]・[ADR-0049][adr49]（設定検証の先例）。
`partition ?? 0` を pin するテストは無い（`grep` 実測）

## 推奨

`partition` の**必須化は誤り**（`tenant(id)` だけを使う構成では client 既定が不要）。
「**一度も partition が束ねられていない呼び出し**を `PortersConfigError` で落とす」か、
`0` に意味があるなら LV に登録して確定させる。**挙動変更＝要 ADR**（軽い 1 本）

## 処置

—

[adr48]: ../../adr/0048-access-point-host-validation.md
[adr49]: ../../adr/0049-host-port-roundtrip.md
