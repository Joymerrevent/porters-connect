# RV-29 🟢 reference ↔ カタログの突合が自動化されていない

- 重要度: 🟢 ／ 観点: テスト厳密性 / プロセス
- 状態: fixed

## 概要

フェイクサーバーは `src` の descriptor を直接使うため**実装 ↔ フェイクのドリフトは構造的に起きない**が、
**reference（`docs/reference/.../resources/*.md`）↔ カタログ**を突き合わせる仕組みが無い。

## 根拠

- `test/fake/resources.ts:12-20` — descriptor を `src` から import（＝実装とフェイクは同一ソース）。
- [RV-23][rv23] — Candidate の標準 4 項目欠落は**人手レビューで初めて検出**された。
- reference の各表は**機械抽出された Markdown** なのでパース可能。

## 影響

[RV-23][rv23] が **0.1.0 から 12 版・563 テストをすべて素通りしてきた**のが実績。
つまり**人の目だけが防波堤**になっている。

守られている境界（実装 ↔ フェイク）と、誰も見ていない境界（reference ↔ カタログ）が
同居しているため、**前者が構造で守られているぶん後者の穴が見えにくい**。
今後リソースを増やすほど取りこぼしの機会は増える（未実装 7 リソースを足す計画がある）。
現時点の実害は [RV-23][rv23] に計上済みなので本 finding 自体は 🟢。

## 検出経緯

[2026-08-16-01][run816]。[RV-23][rv23] を検出した直後に
「なぜ今まで誰も気づかなかったのか」を辿って、突合の仕組みが無いことが原因だと分かった。

## 推奨

「`Reference` 型（値を持たない）と `P_Deleted` を除く全 `P_` alias がカタログに存在する」ことを
検証するテストを追加する（reference の表をパースして突合）。
**人の記憶でなく仕組みで守る**＝フェイルセーフ。
[RV-23][rv23] の修正と同じ PR で入れるのが自然（**ADR 不要**）。

## 処置

`test/integration/reference-catalog.test.ts` を追加した。reference の項目表をパースして、
データ系 5 種（Candidate / Job / Client / Process / Resume）のカタログと突き合わせる。

検査は 3 方向:

1. **値を持つ標準項目がすべてカタログにある**（取りこぼし＝[RV-23][rv23] の形）
2. **カタログの項目がすべて reference にある**（綴り間違い・幻の項目）
3. **Field Type → Data Type の対応が一致する**（型の取り違え。[ADR-0016][adr16] の写像）

対象外は `Reference` 型（Field Type 16 ＝ 参照表示専用で値を持たない）と `P_Deleted`
（Read の field でのみ指定可。扱いは [RV-26][rv26] の論点）。
マスタ系と Attachment は「カタログ＝reference の全項目」という前提が成り立たないため対象にしていない
（マスタは拡張項目の read 可否・decode 形が未確認で意図的に 4 項目へ絞っている）。

## 検証

- **落ちることを 2 通り確認済み**:
  `P_Memo` を外すと「値を持つ標準項目がすべてカタログにある」が
  `expected [ 'P_Memo' ] to deeply equal []` で失敗し、
  `P_Fax` の型を `SinglelineText` に変えると「Field Type → Data Type の対応が一致する」が
  `{ alias: 'P_Fax', catalog: 'SinglelineText', reference: 'Telephone' }` で失敗する。
- **検査が空振りしないことも固定**した — 表の形が変わって 0 件パースになると
  以下の検査が全部素通りするため、「reference の表を読めている」自己チェックを先頭に置いた。
- **未知の Field Type を見逃さない** — reference に新しい型が増えたら
  「解釈できる型かどうか」のテストが落ち、`DATA_TYPE_OF` と `NOT_IN_CATALOG` の
  どちらに入れるかを決めることを強制する。

[adr16]: ../../adr/0016-field-type-granularity.md
[rv23]: 0023-candidate-catalog-missing-fields.md
[rv26]: 0026-deleted-flag-unsupported.md
[run816]: ../2026-08-16-01.md
