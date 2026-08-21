# RV-25 🟡 `partition` 未設定で無言のうちに `partition=0` を送る

- 重要度: 🟡 ／ 観点: フェイルセーフ / 設定検証
- 状態: fixed

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

[ADR-0055][adr55] を **accepted**（**案F**）ののち実装。**`PortersClient` から `partition` を外し**、
partition スコープのリソースは **`porters.tenant(id)` 経由でのみ**取得する形にした。
client 直下に残るのは partition を取らないもの（`auth`・`partition` マスタ・`tenant` 自身）だけ。

起票時の推奨は案A（送信前ガード）だったが、議論で decider から
「`PortersClient` に `partition` を積むのをやめては」という案が出て案F を採った。
**不正な状態そのものが消える**のが決め手 — 案A は「未設定を許して使われた瞬間に落とす」だが、
案F では**未設定という状態が型として存在しない**。`ResourceDeps.partition` は `number` のままで、
`undefined` の分岐もガードもそのテストも要らない。

破壊的変更（semver は 0.x のため minor だが CHANGELOG では破壊的変更として扱う）。
移行は `partition: N` を渡していた箇所を `const t = porters.tenant(N)` に置き換えるだけ。

## 検証

- **公開型から消えたことをビルド成果物で確認**。`dist/index.d.ts` の `PortersClient` に残るのは
  `auth` / `partition`（マスタ）/ `tenant` / `host` のみで、`PortersClientOptions` に `partition` は無い。
- **client 直下にスコープアクセサが生えていないことを型テストで pin**（`src/client.test.ts`）。
  `auth`・`partition` マスタ・`tenant` が残ることも同時に固定した。
  「client 既定 partition で送る」を確かめていた旧テストは、**仕様自体が無くなった**ので置き換えた。
- **誤った partition は依然として渡せる**ことも維持（`tenant(999)` → サーバーが 404）。
  ライブラリが値を捏造しないことが主題で、間違った値を弾くことではない（[ADR-0055][adr55] 合意事項 6）。
- 608 tests 緑・カバレッジ 100/98.87/100/100。`pnpm sandbox` が最後まで通ることも確認。
- README・ガイド 6 本・examples を新しい形へ揃え、**コード例が型検査を通ること**を
  一時ファイルで確認した（[RV-24][rv24] と同じ方法）。

[adr55]: ../../adr/0055-partition-binding-guard.md
[rv24]: 0024-define-fields-undocumented.md
[adr48]: ../../adr/0048-access-point-host-validation.md
[adr49]: ../../adr/0049-host-port-roundtrip.md
[lv]: ../../live-verification.md
[run816]: ../2026-08-16-01.md
