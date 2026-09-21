# RV-57 🟢 RV-54 で保留した書き込み側の判断が ADR バックログにも roadmap にも無い

- 重要度: 🟢 ／ 観点: プロセス / ドキュメント
- 状態: fixed

## 概要

[RV-54][rv54] の処置は案 (a)（読み側で `PortersError` に包む）だけを入れ、案 (b)（`fast-xml-parser`
が拒否する予約名 `prototype` / `constructor` / `__proto__` を**書き込み側でも弾くか**）は
「実例が出てから決める・**要 ADR のまま**」と保留した。だが ADR README の論点バックログは
【基本設計】【詳細設計】とも「未起票の論点はなし」、roadmap V3 も「要 ADR 0」。
**保留した判断が、fixed になった RV ファイルの中にしか無い。**

## 根拠

- `docs/reviews/rv/0054-reserved-tag-name-read-throws.md:101-104` — 「案 (b)（書き込み側でも弾く）は
  入れていない … 要 ADR のまま」。
- `docs/adr/README.md:59-62` — バックログは「**まだ ADR を起こしていない論点**だけを置く」場所。
  同 `:75` / `:79` / `:82` — 「未起票の論点はなし」。
- `docs/roadmap.md:71` — V3「要 ADR 0」。
- grep: `RV-54` / `予約名` / `prototype` は `docs/adr/README.md` と `docs/roadmap.md` に 0 件。

## 影響

🟢。今すぐ何も壊れない。困るのは**実例が出たとき**: 利用者が Option alias `prototype` を書き、
読み返せなくなり（`cause` 付き `PortersResourceError`）、そこで「書き込み側で弾くべきか」を決める
番になる。そのとき「既に検討して保留した」事実と理由（[ADR-0002][adr2] との兼ね合い＝ PORTERS が
受ける値を JS パーサの都合で拒否してよいか）は rv/0054 にしか無く、**fixed の RV は誰も読み返さない**
（[ADR-0052][adr52] で「fixed の分まで読まない」構造にした）。バックログは未起票の論点を 1 箇所に
集める場所で、条件付き（実例が出たら）の項目も置ける。V3「要 ADR 0」は「条件が揃えば要 ADR」を
数えていないので誤りではないが、読み手は「保留中の判断は無い」と受け取る。

## 検出経緯

観点2 で ADR README の「ADR を起こさずに決着した論点」に [RV-49][rv49] はあるのに RV-54 が無い
ことから、RV-54 の処置節を読み直して保留の記述を見つけた。RV-49 は「決定不要」で終わったので
記録先が「決着した論点」で正しいが、RV-54 は「決定を**先送り**」なので本来の置き場はバックログ。

## 推奨

- (a) ADR README【詳細設計】に条件付きの 1 項目を足す:
  「`fast-xml-parser` が拒否する予約名を書き込み側でも弾くか — [RV-54][rv54] 案 (b)。
  **実例が出たら起票**。論点は [ADR-0002][adr2] との兼ね合い」。
- (b) roadmap の V3 注記に「条件付き 1 件（RV-54）」を添える。

**ADR 不要**（記録の置き場の話）。

## 処置

**完了（案 (a) ＋ (b)・2026-09-21）。**

- (a) [ADR README][adr-readme] の論点バックログ【詳細設計】に**条件付き 1 項目**を足した:
  「`fast-xml-parser` が拒否する予約名を書き込み側でも弾くか — [RV-54][rv54] 案 (b)。**実例が出たら起票**。
  論点は [ADR-0002][adr2] との兼ね合い（PORTERS が受け付ける値を JS パーサの都合で拒否してよいか）」。
  いまの倒れ方（書けるが読み返すと `PortersResourceError`・`cause` にパーサの説明）と、
  「実例の無い判断をしない」という保留の理由もそこに書いた＝ fixed の RV を読み返さなくても分かる。
  「未起票の論点はなし」の 1 行は「上記以外の未起票の論点はなし」に改めた。
- (b) [roadmap][roadmap] の V3 現在地に「要 ADR 0（条件付き 1 件＝ RV-54 案 (b)・実例が出たら起票。
  分母に数えない）」を添え、「要 ADR（起票から）」節にも同じ 1 項目を置いて置き場（ADR README の
  バックログ）へリンクした。**V3 の「要 ADR 0」は変えていない**（条件が揃うまでは起票しないので、
  自分で進められる作業ではない）。
- ADR は起こしていない（記録の置き場の話。指摘どおり）。

## 検証

- `grep RV-54 docs/adr/README.md docs/roadmap.md` — 指摘時 0 件 → README 1 箇所・roadmap 2 箇所。
- `pnpm check:links` / `pnpm lint:md` / `pnpm check:index` が緑（README のアンカー付きリンクも実在を確認）。

[adr2]: ../../adr/0002-ground-design-in-live-api-docs.md
[adr-readme]: ../../adr/README.md
[roadmap]: ../../roadmap.md
[adr52]: ../../adr/0052-findings-register-layout.md
[rv49]: 0049-throttle-options-unvalidated.md
[rv54]: 0054-reserved-tag-name-read-throws.md
