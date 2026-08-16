# RV-21 🟢 既定ポート `:443` 付きの `host` が弾かれる

- 重要度: 🟢 ／ 観点: 設定検証 / 後方互換
- 状態: fixed

## 概要

[ADR-0048][adr48] 機構2 の条件 (b)「`url.host` が入力の小文字化と一致」は、
**既定ポートを書いた `host` を通さない**。`new URL("https://a.test:443").host` はパーサが `:443` を落として
`a.test` を返すため、ラウンドトリップが成立しない。結果、**現在正しく動作している
`PORTERS_HOST=xxxxx.example.com:443` が 0.7.0 で構築時エラーになる**。
ADR-0048 の Decision Drivers「**既存の正しい設定を壊さない**（現在動いている `host:port` は 1 文字も変えずに通る）」と
部分的に衝突する
さらに、検証は `scheme` の設定に関わらず**常に `https://` でパース**するため、弾かれる集合は
「**`scheme` を問わず `:443`**」になる。`scheme: "http"` にとって 443 は既定ポートではなく**意味のある指定**
なのに弾かれる＝利用者には説明できない形（実装の都合が漏れている）

## 根拠

`src/http/access-point.ts:76`（条件 (b)）/ [ADR-0048][adr48] Decision Outcome 2・Decision Drivers /
実装した `validateAccessPoint` の実測 — `:8080` `:3000` `:4010` `:80` は**通る**／`:443` は https でも
`scheme: "http"` でも**弾かれる**（`new URL("https://a.test:443").host === "a.test"`）

## 検出経緯

[ADR-0048][adr48] の実装中（PR #146）。ADR で決まった機構を実装側の判断で緩めるべきではないため、
**ADR どおり実装**したうえで hint（「既定ポート (443) は省く」）・テスト・[ガイド][guide]に既知の制限として明記し、
判断は本 finding に委ねた

## 推奨

decider が選ぶ — (a) **現状維持**（`:443` を省けば通る・hint で誘導済み。仕様を単純に保つ）、
(b) **既定ポートだけ許容**（`url.port` が空で、`url.hostname` ＋ `":443"` が入力の小文字化と一致する場合を通す）、
(c) **既定ポートを持たないスキームでパース**（`porters-check://{host}`）＝**どのポートも落とさない**・
機構2 の性質（列挙に頼らないラウンドトリップ）を保てる。**0.7.0 に載る挙動なので、リリース前に決めるのが望ましい**

## 処置

[ADR-0049][adr49] を **accepted**（**案C**・decider 2026-08-12）ののち**実装**。
`validateAccessPoint` が既定ポートを持たない `porters-check://` でパースするようになり、
**どのポートも落とさない**（`a.test:443` も `a.test:80` も通る）。比較は両側小文字化（非特殊スキームは
host の大小を保つため）、`pathname === ""`、および**空文字の明示チェック**（非特殊スキームは空の authority を
許すため）。通る 11 例・弾く 14 例をテストで pin し、`access-point.ts` の変異スコアは 100%。
hint・`PortersClientOptions.host` の JSDoc・[ガイド][guide]・CHANGELOG から**既定ポートの制限を削除**（残る制限は IDN のみ）。
**0.7.0 の前に入れたので、`:443` が一度壊れて戻る往復は発生しない**。
なお ADR が「`pathname` 条件は案C では実際に効く」としていた点は**実測で誤りと判明**したため、
ADR 本文に訂正を追記し、equivalent 注記は残した（決定そのものは不変）

[adr48]: ../../adr/0048-access-point-host-validation.md
[adr49]: ../../adr/0049-host-port-roundtrip.md
[guide]: ../../guide/error-handling.md
