# RV-23 🔴 Candidate の静的カタログが標準項目 4 件を欠く

- 重要度: 🔴 ／ 観点: API 忠実性 / 型安全
- 状態: fixed

## 概要

Candidate の `FIELDS` カタログに、reference が定義する標準項目のうち
**`P_Memo`（メモ）／`P_Street`（住所詳細）／`P_Fax`／`P_PhaseMemo`（フェーズメモ）の 4 件が無い**。
[ADR-0019][adr19] はカタログを single source of truth と定めているので、
**欠落はそのまま公開型の欠落**になる。

## 根拠

- `src/resources/candidate.ts:20-39` — 18 項目のカタログ（上記 4 件が無い）。
- `docs/reference/resource-api/resources/candidate.md` —
  `Person.P_Memo`（MultilineText）/ `P_Street`（MultilineText）/ `P_Fax`（Telephone）/
  `P_PhaseMemo`（MultilineText）の各行が存在する。
- 対比 `src/resources/client.ts:30-38` — **Client には同じ 4 種がすべて載っている**＝リソース間で非一貫。
- [ADR-0019][adr19]（カタログ＝真実源）・[ADR-0020][adr20]（既定 field はカタログ導出）。
- ADR-0019 に「標準項目の部分実装」という方針は無い＝設計判断ではなく**取りこぼし**。

## 影響

**実用ブロッカー級**。影響は Read / Write の両方向に出る。

- `candidate.create({ P_Memo: "…" })` は**型エラー**になる（`CreateInput` がカタログ導出のため）。
- 既定 field 送信（[ADR-0020][adr20]）もカタログ由来なので、**Read でも取りに行かない**。
- 落ちている 4 件に**メモと住所詳細が含まれる**のが決定的で、
  候補者のメモを型安全に扱えない ATS ラッパーは実用に耐えない。

Candidate は MVP の筆頭リソース（[ADR-0003][adr3] の実装順で最初）であり、
最も使われるリソースで最も基本的な項目が欠けている。

## 検出経緯

[2026-08-16-01][run816]。stakeholder の「どこまで完成しているか」への回答として
**reference の全 `P_` alias と全カタログを機械的に突き合わせた**ところ検出した。
Client / Job / Resume / Process の差分は `Reference` 型（Field Type 16 ＝ 参照表示専用で値を持たない）と
`P_Deleted` だけ＝正しい除外で、**Candidate だけが値のある標準項目を落としていた**。

この突合をしなければ人手では出なかった（0.1.0 から 12 版・563 テストを素通りしている）。

## 推奨

カタログに 4 件を追加する（Data Type は reference のとおり Telephone / MultilineText）。
型は自動追従するので変更は 1 箇所。semver は **minor**（公開型に項目が増える）。
併せて **[RV-29][rv29]**（reference ↔ カタログ突合の自動化）で再発を止める。

## 処置

カタログに 4 件を追加した（`src/resources/candidate.ts`）— `P_PhaseMemo`（MultilineText）/
`P_Memo`（MultilineText）/ `P_Fax`（Telephone）/ `P_Street`（MultilineText）。
Data Type は reference のとおり。並び順は **Client と同じグルーピング**に揃えた
（フェーズ系 → 氏名・メモ → 連絡先 → 住所）ので、2 つのカタログを見比べたときに差分が目で追える。

[ADR-0019][adr19] のとおりカタログが真実源なので、`Candidate` / `CandidateCreateInput` /
`CandidateUpdateInput` / `CandidateSearchQuery` は**自動で追従**する（型定義の変更はゼロ）。
semver は **minor**（公開型に項目が増える）。

併せて **[RV-29][rv29]** の突合テストを同じ PR で入れ、再発を仕組みで止めた。

## 検証

- `test/integration/reference-catalog.test.ts` が
  **「値を持つ標準項目がすべてカタログにある」**ことを検証し、Candidate も通る。
- **落ちることを確認済み**: `P_Memo` を外すと
  `expected [ 'P_Memo' ] to deeply equal []` で失敗する＝本 finding をそのまま再現して検出する。
- 既存 579 テストは無改修で緑。フェイクサーバーは descriptor を共有しているため
  ([ADR-0043][adr43])、追加した 4 項目は**フェイク側にも自動で反映**され、
  L1 結合テストの CRUD 往復でそのまま扱える。
- `field` 省略時の既定 field が 4 つ増えるため Read URL が約 100 文字伸びるが、
  送信前ガード（~15000 字・[RV-5][rv5]）に対しては十分小さい。

[adr3]: ../../adr/0003-add-attachment-to-mvp.md
[adr19]: ../../adr/0019-static-resource-types.md
[adr20]: ../../adr/0020-read-field-default.md
[adr43]: ../../adr/0043-local-fake-server.md
[rv5]: 0005-request-size-guard-read-url.md
[rv29]: 0029-reference-catalog-check-missing.md
[run816]: ../2026-08-16-01.md
