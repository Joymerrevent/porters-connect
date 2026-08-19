---
"@joymerrevent/porters-connect": minor
---

Candidate で**メモ・住所詳細・FAX・フェーズメモが扱えるようになりました**（RV-23）: 静的カタログに
`P_Memo`（メモ・MultilineText）／`P_Street`（住所詳細・MultilineText）／`P_Fax`（FAX・Telephone）／
`P_PhaseMemo`（フェーズメモ・MultilineText）の 4 項目を追加しました。
これらは PORTERS の標準項目でありながらカタログから漏れており、カタログが型の真実源（ADR-0019）であるため
**`Candidate` 型にも `CandidateCreateInput` / `CandidateUpdateInput` にも現れず**、
`candidate.create({ P_Memo: "…" })` は型エラー、`field` 省略時の既定 field（ADR-0020）にも含まれないため
**Read でも取得されない**状態でした。同じ 4 項目は Client には最初から載っており、リソース間で非一貫でした。
今回の追加で、Candidate の値を持つ標準項目は reference と一致します（`Reference` 型＝参照表示専用で値を持たない項目と、
Read 専用の `P_Deleted` は対象外）。

既存コードへの影響はありません（項目が増えるだけ）。ただし `field` を省略した Read は
**既定 field が 4 つ増えるぶん URL が長くなります**（Candidate の既定 Read URL で約 100 文字）。

併せて、reference（`docs/reference`）と静的カタログの突合を CI で検査するようになりました（RV-29）。
値を持つ標準項目の取りこぼし・カタログ側の幻の項目・Field Type → Data Type の取り違えを検出します。
この欠落は 0.1.0 から 12 版・563 テストをすべて素通りしていたため、人の目ではなく仕組みで守ります。
