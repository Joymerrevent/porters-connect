# RV-25 🟡 `partition` 未設定で無言のうちに `partition=0` を送る

- 重要度: 🟡 ／ 観点: フェイルセーフ / 設定検証
- 状態: open

## 概要

`PortersClientOptions.partition` は任意で、未指定なら `options.partition ?? 0` により
**ライブラリが発明した `0`** が全リクエストのクエリに載る。

## 根拠

- `src/client.ts:209` — `buildScope(options.partition ?? 0)`。
- `docs/reference/resource-api/README.md`（Read パラメータ表）— `partition` は**必須（●）**で、
  値は Partition Read で発見するもの。**`0` という値の意味は reference のどこにも無い**。
- `src/types/common.ts:5` — `PartitionId = number`（制約なし）。
- [ADR-0048][adr48] / [ADR-0049][adr49] — `host` は構築時に検証して繋ぐ前に落とす、という先例がある。
- `partition ?? 0` を pin するテストは無い（`grep` 実測）。

## 影響

設定漏れが「**構築時の明確な設定エラー**」ではなく「**実行時の不透明なリソースエラー**」に化ける。
利用者は PORTERS から返る Result Code を見ても、原因が自分の設定漏れだと気づけない。

[ADR-0048][adr48] で `host` について塞いだのと**同じ形の穴**が partition 側に残っている＝
設定検証の方針が片側にしか適用されていない。
正しく設定していれば未発火なので 🟡 だが、**初回セットアップで最も踏みやすい**種類のミス。

## 検出経緯

[2026-08-16-01][run816]。[ADR-0048][adr48] / [ADR-0049][adr49] が `host` を構築時に検証すると決めたので、
**同じ「設定の正しさ」を partition 側も守っているか**を確認したところ、無検証だと分かった。

## 推奨

**`partition` の必須化は誤り** — `tenant(id)` だけを使う構成では client 既定が不要だから。
正しくは「**一度も partition が束ねられていない呼び出し**を `PortersConfigError` で落とす」。
あるいは `0` に意味があるなら [live-verification][lv] に登録して確定させる。
**挙動変更＝要 ADR**（軽い 1 本）。

## 処置

—

[adr48]: ../../adr/0048-access-point-host-validation.md
[adr49]: ../../adr/0049-host-port-roundtrip.md
[lv]: ../../live-verification.md
[run816]: ../2026-08-16-01.md
