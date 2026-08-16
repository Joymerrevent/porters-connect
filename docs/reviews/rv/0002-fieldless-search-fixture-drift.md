# RV-2 🟡 field 無し search の fixture が本番と乖離

- 重要度: 🟡 ／ 観点: テスト厳密性
- 状態: fixed

## 概要

`field` を省略した `search()` のテストが、**全項目を返す `ALL` fixture** を使って full decode を検証していた。
本番は `P_Id` のみ返す（[RV-1][rv1]）ので、**あり得ない応答を前提にしたテスト**になっており、
RV-1 の罠をテストが隠していた。

## 根拠

- `src/resources/candidate.test.ts:27-41` — 全項目を持つ `ALL` fixture の定義。
- 同 `:65` — `field` 無し `search()` に対してその fixture を返し、full decode を検証している。
- 同 `:103-109` — `get(7)` のテストは **0 件応答のみ**で、送信された `field` を検証していない。
- 対比: 本番挙動の出典は [RV-1][rv1] の根拠（`115010010367` の記事）。

## 影響

**テストが緑であることが品質の証拠にならなくなる**のが問題。RV-1 は 🔴 の実用ブロッカーだったが、
テストは通っていた。カバレッジ 100% でも「あり得ない応答」を前提にすれば穴は残る＝
**カバレッジではなく fixture の忠実性が効く**という典型例。単体では 🟡 だが、
RV-1 の発見が遅れた原因そのものなので、修正は RV-1 と同時に行う必要があった。

## 検出経緯

初回クロスレビュー（[2026-06-17-01][run1] Run 1）。RV-1 を起票した直後に
「ではなぜテストが通っているのか」を確認して判明した。

## 推奨

fixture を「`field` 省略時は `P_Id` のみ」という現実形に直し、
RV-1 の修正（既定 field 注入）を **pin するテスト**を追加する。

## 処置

RV-1 の修正（[ADR-0020][adr20]）で `field` 省略時に既定 field を送るようになったため、
**`ALL` fixture は「全項目を要求した応答」として現実と整合**するようになった（非現実的でなくなった）。
そのうえで既定 field 送信を pin するテストを追加した。

## 検証

- 既定 field 送信を pin: `src/resources/resource.test.ts:134-158` /
  `src/resources/candidate.test.ts:83-92` / `src/resources/attachment.test.ts:146`。
- 検証は `decodeURIComponent` で復号してから行う＝**URL エンコードの実態と一致**した比較になっている。
- Stryker の equivalent-mutant 抑制コメントには根拠が付いている（[2026-06-17-01][run1] Run 2 で確認）。

[adr20]: ../../adr/0020-read-field-default.md
[rv1]: 0001-read-field-default-missing.md
[run1]: ../2026-06-17-01.md
