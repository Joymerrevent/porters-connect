# 60. 次の主軸を「全リソース網羅 ＋ ドキュメント充実」に変える（ADR-0033 の supersede）

- Status: accepted
- Date: 2026-08-30
- Deciders: jun.shiromoto (Joymerrevent)

> **stakeholder 判断（案4＝1 リソース＝1 PR でインクリメンタル／完了条件は D1〜D5 すべて）で `accepted`
> （2026-08-30）。** [[0033-post-mvp-direction]]（案F 先行 → 案A 主軸／案B は機会的）を**本 ADR が supersede** する。
> 各リソースの詳細設計（特に Phase）と R-4（`Link` / `Image`）は、実装前に個別 ADR へ分岐する。実装は**別 PR**。

## Context and Problem Statement

[[0033-post-mvp-direction]] は「**案F（v1 公開 API の積み残し）を先行 → 案A（第2層 MCP）を主軸**、
案B（MVP 外リソース R/W）は **MCP 越しの需要に応じて機会的に**（投機的拡充を避ける）」と決めた。
案F は F-1〜F-4 まで完了し、0.11.0 まで出荷済み。**着手可能な作業は無く**、[roadmap][roadmap] は
「次の主軸」を判断待ちとして 2026-08-16 に起票している。

stakeholder は「**ライブラリの完成＝全リソースにアクセスでき、API でやれることをできるようにする
＋ 使い方のドキュメント充実**」を次の目標にしたい、と申し出ている。これは 0033 の決定と方向が異なるため、
**supersede する新しい ADR が要る**（[ADR README の運用ルール][adr-readme]：accepted な ADR は書き換えず、
新 ADR で置き換える）。

本 ADR で決めるのは次の 3 点に限る。各リソースの詳細設計は accepted 後に個別 ADR へ分岐する。

1. **次の主軸を変えるか**（案B ＋ ドキュメントへ / 0033 のまま案A へ）
2. 変えるなら「**網羅**」の完了条件を**何で測るか**（「網羅した」を主張できる根拠）
3. **刻み方と順序**（どの単位で PR を出し、どのリソースから着手するか）

### 現在地（2026-08-30 に再実測）

| 軸                | 現在地                    | 中身                                                                                                                          |
| ----------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| (a) リソース網羅  | **10 / 17**               | マスタ Read 4/4・データ R/W 6/13。未実装は Recruiter / Contact / Activity / Contract / Sales / Opportunity / Phase            |
| (a') マスタの項目 | **User 4 / 17 ほか**      | 「4/4」は**リソース数**。項目では User 4/17・Field 9/10（`P_ResourceType` 欠）・Option 6/7（`Items` 欠）・Partition 3/3       |
| (b) API 機能網羅  | ほぼ全部 ✅               | Read 8 パラメータ・Write・一括・ページング・OAuth 2 方式・マルチテナント・制限対応・`P_Deleted`・`expand` まで実装済み        |
| (c) データ型網羅  | **14 / 17**               | 欠けるのは `Link` / `Image`（＝ [PRD R-4][prd]・カスタム項目経由でのみ出現）と `System[Department]`                           |
| (d) ドキュメント  | README ＋ **ガイド 6 本** | oauth / read-query / multi-tenancy / bulk-write / custom-fields / error-handling。[[0035-usage-documentation-structure]] の型 |

読み方の訂正が 2 つある（どちらも今回の再実測で判明）。

- **(d) は roadmap の記載より進んでいる**。roadmap の「ガイド 4 本／`defineFields` の使い方が皆無（RV-24）／
  F-2 のガイドが無い（RV-27）」は **2026-08-16 時点の写し**で、[RV-24][rv24] / [RV-27][rv27] は**どちらも fixed**、
  ガイドは 6 本ある。**「ドキュメント充実」の残りは、型（0035）から漏れている領域ではなく、
  リソースを増やしたぶんを同じ型で埋めること**が主。
- **(a) の「マスタ 4/4 完了」はリソース単位の数え方**で、項目では埋まっていない（(a') 行）。
  マスタのカタログは「拡張項目の read 可否・decode 形が未確認」という理由で**意図的に絞ってある**
  （[RV-29][rv29] の処置で対象外にしたのと同じ前提）。「**全リソースにアクセスできる**」を
  **項目レベル**で読むなら、ここも網羅の対象に入る。

### 未実装 7 リソースの実測（reference の項目表より）

| リソース    | 項目数 | 接頭辞           | 実装上の論点                                                                                                                   |
| ----------- | ------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Recruiter   | 27     | `Recruiter.P_`   | Client とほぼ同形（住所・連絡先・Phase 3 点セット）。descriptor パターンに素直に載る                                           |
| Contact     | 27     | `Contact.P_`     | Recruiter と**項目構成が同一**（`P_Client` 参照を持つ人物系）                                                                  |
| Opportunity | 12     | `Opportunity.P_` | 最小。参照は `P_Client` / `P_Recruiter`                                                                                        |
| Activity    | 19     | `Activity.P_`    | `P_Resource` ＋ `P_ResourceId` で**上位リソースが可変**（Resource List の数値 ID）。`Option[Checkbox]` あり                    |
| Contract    | 40     | `Contract.P_`    | 最大。`Currency` を 3 項目で使うが **Data Type は `Number`**＝新しい型は不要                                                   |
| Sales       | 34     | `Sales.P_`       | `System[Reference]` を 6 項目（`P_Contract` 含む）。`P_*Owner` 5 項目は Field Type `Reference`（値を持たない＝カタログ対象外） |
| Phase       | 17     | **接頭辞なし**   | `Id` / `Resource` / `ResourceId` … と `P_` すら付かない。`System[Department]` 3 項目。**Write に特殊制約**（最新フェーズ条件） |

**7 種のうち 6 種は descriptor パターン**（`src/resources/client.ts` は 89 行）**にそのまま載る**。
`Currency` は Data Type が `Number` なので (c) の穴とは無関係
（[field-data-types][field-types] で確認。Field Type と Data Type は別物）。
**Phase だけが汎用 factory の前提から外れる**（接頭辞なし・`System[Department]`・Write の作法）。

## Decision Drivers

- **最優先目標は「多くの実利用者に使われること」**（`CLAUDE.md` / [PRD][prd]）。収益化より普及。
- **フェイルセーフ**＝「壊れたときに安全側へ倒れる」。ここでは**いつ中断しても出荷可能な状態**であること
  （途中で需要が変わっても、出したところまでが使える）。
- **網羅の主張は測れること**。過去に 2 度、数え方で足をすくわれている
  （[RV-12][rv12]＝roadmap の coverage 過大主張、[RV-23][rv23]＝標準項目 4 件の取りこぼし）。
  **人の注意ではなく CI の検査で守る**（[RV-29][rv29] の reference ↔ カタログ突合）。
- **ドキュメントが実装から遅れないこと**。[[0035-usage-documentation-structure]] の型（README 短節 ＋
  `docs/guide/<topic>.md`）は、後追いにすると穴が開く（[RV-24][rv24] / [RV-27][rv27] が実例）。
- **1 人メンテの帯域**（同時に多くを抱えない）。
- **契約非依存で進められること**（ライブ検証 LV は契約待ちでブロックされている）。
- **案A（MCP）の価値は消えない**。第1層が広いほど MCP が露出できるツールも広い＝**排他ではなく順序の問題**。

## Considered Options

- 案1: **0033 を維持**（案A＝MCP を主軸／案B は MCP 越しの需要に応じて機会的）
- 案2: **主軸を変え、「網羅を全部 → その後まとめてドキュメント」の 2 フェーズ**で進める
- 案3: **主軸を変え、「ドキュメント先行 → その後網羅」**で進める
- 案4: **主軸を変え、「リソース 1 種＝1 PR（実装＋テスト＋reference 突合＋ドキュメント）」でインクリメンタルに進める**（採用）
- 案5: **網羅と MCP を並行**して進める

## Decision Outcome

採用: **案4**（次の主軸を「全リソース網羅 ＋ ドキュメント充実」に変え、**リソース 1 種＝1 PR**
＝実装・テスト・reference 突合・ドキュメントを同じ PR で出す）。**完了条件は下記 D1〜D5 のすべて**。
案A（第2層 MCP）は**後続**へ回す（取り下げではなく順序の変更）。

理由（Decision Drivers に照らす）:

- **フェイルセーフ（いつ止めても出荷可能）**: 1 リソース＝1 PR なら、7 種のうち 3 種まで進んだ時点で
  需要が MCP へ動いても、**そこまでが完成品として世に出ている**。案2 は「全部終わるまでドキュメントが無い」、
  案3 は「広げる前に書いたガイドを、広げるたびに書き直す」＝どちらも中断に弱い。
- **ドキュメントが遅れない**: 実装と同じ PR で README の表と `docs/guide` を更新するので、
  [RV-24][rv24] / [RV-27][rv27] の形（型の外に落ちる）を**構造的に**防げる。
- **測れる網羅**: 完了条件（下記 D1〜D5）を CI の検査に落とすので、「網羅した」が主張でなく**検査結果**になる。
- **帯域に合う**: 6 種は既存パターンの横展開で 1 種あたり小さい。Phase だけを別 ADR に切り出せば、
  難所が 1 個所に閉じる。

### 「網羅」の完了条件（測れる形）

「全リソースにアクセスでき、API でやれることをできるようにする」を、次の 5 つで**数えられる形**に定義する。

| ID  | 完了条件                                                    | 現在地 → 目標                                                                         | どう検査するか                                 |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------- |
| D1  | データ系リソースの R/W                                      | 6/13 → **13/13**                                                                      | `TenantScope` の型 ＋ 結合テスト               |
| D2  | マスタ Read の標準項目                                      | User 4/17・Field 9/10・Option 6/7 → **全項目**                                        | reference ↔ カタログ突合を**マスタへも拡張**   |
| D3  | データ型                                                    | 14/17 → **17/17**（`Link` / `Image` / `System[Department]`）                          | `DataType` union ＋ decode/encode の UT        |
| D4  | reference ↔ カタログ突合の対象                              | データ系 5 種 → **全リソース**                                                        | `test/integration/reference-catalog.test.ts`   |
| D5  | ドキュメント（[[0035-usage-documentation-structure]] の型） | ガイド 6 本 ＋ README にリソース一覧が無い → **全リソース表 ＋ 新規トピックのガイド** | 例が型検査を通ることを確認（RV-24 と同じ方法） |

D3 の `Link` / `Image` は [PRD R-4][prd] の積み残しで、**カスタム項目（`U_`/`A_`）経由でしか現れない**
＝ `defineFields` の builder への露出まで含めて **1 本の ADR**で扱う（roadmap の「随時・任意」に既出）。
`System[Department]` は User と Phase に現れる（decode 形は [live-verification][lv] 待ちの部分がある）。

### 着手順（依存の浅い順・1 種＝1 PR）

1. **Recruiter** — Client と同形。**descriptor パターンの横展開が本当に効くかをここで確かめる**（ものさしになる）
2. **Contact** — Recruiter と項目構成が同一。2 本目で型が固まる
3. **Opportunity** — 最小（12 項目）
4. **Activity** — `P_Resource` ＋ `P_ResourceId` の可変参照をどう型で表すかが論点（要 ADR の可能性）
5. **Contract** — 最大（40 項目）だが型は素直
6. **Sales** — `System[Reference]` 6 項目 ＝ `expand`（[[0058-reference-expansion-read]]）の効きどころ
7. **Phase** — **最後**。接頭辞なし・`System[Department]`・Write の特殊制約＝**専用 ADR で設計**

**分岐する ADR（accepted 後に起票）**: ① Phase の公開サーフェス ② `Link` / `Image` ＋ `defineFields` builder（R-4）
③ マスタ項目の拡張（`System[Department]` の decode 形） ④ Activity の可変参照（必要なら）。

### Consequences

- Good: 「ライブラリとして完成している」が**測れる形**で定義され、CI が守る。途中で止めても出荷可能。
  第1層が広がるぶん、後続の MCP が露出できるツールも広がる。ドキュメントが実装と同時に出る。
- Bad: **案A（MCP）が後ろ倒し**になる。0033 が「最大の差別化点」と評価した価値の実現が遅れる。
  7 リソース＋マスタ項目＋型 3 種で**実装量は案F より大きい**。公開サーフェスと tarball も増える
  （0.11.0 で 430.0 kB。カタログは静的な定数なので増分は小さいが 0 ではない）。
- Neutral: 変更はすべて**追加**（`TenantScope` にアクセサが増える）＝**破壊的変更にはならない**見込み。
  リリースは minor bump の連続になる。**0033 が退けた「投機的拡充」を、意図して選び直す**ことになる
  （＝需要が見えてから広げるのではなく、先に広げて需要に備える）。

## Pros and Cons of the Options

### 案1: 0033 を維持（MCP 主軸）

- Good: 決定が変わらない（supersede 不要）。最大の差別化点に最短で到達する。「使われること」に直結しうる。
- Bad: **stakeholder の目標と合わない**。MCP が露出できるのは第1層が持つものだけなので、
  未実装 7 リソースはそのまま MCP の穴になる。新パッケージの設計・公開・運用が増える。

### 案2: 網羅を全部 → その後まとめてドキュメント

- Good: 実装に集中でき、ガイドを一度に整合させられる。
- Bad: **完成まで使い方が無い**期間が長い。書く量がまとまって最後に来るので、失速すると
  [RV-24][rv24] と同じ形（実装済みだが使い方が無い）に戻る。中断に弱い。

### 案3: ドキュメント先行 → その後網羅

- Good: 既存機能の採用障壁が先に下がる。書く対象が確定しているので迷いが少ない。
- Bad: **今のドキュメントは 0035 の型を満たしている**（ガイド 6 本・RV-24/27 は fixed）ので、
  先行させる緊急度が低い。リソースを増やすたびに書き直す二度手間になる。

### 案4: 1 リソース＝1 PR でインクリメンタル（採用）

- Good: 常に出荷可能（フェイルセーフ）。ドキュメントが遅れない。1 PR が小さくレビューしやすい。
  1 本目（Recruiter）が**残り 6 本の見積もりのものさし**になる。
- Bad: PR とリリースの本数が増える（運用の手数）。横断的な整理（共通化）が後回しになりやすい。

### 案5: 網羅と MCP を並行

- Good: 差別化と網羅の両方が進む。
- Bad: **1 人メンテの帯域に合わない**（0033 の Decision Drivers）。第1層が動いている最中に
  第2層を作ると、追従で二重に手が要る。どちらも中途半端になるリスク。

## More Information

- **supersede 対象**: [[0033-post-mvp-direction]]（accepted 2026-06-22）。0033 は
  `superseded by 0060` にし、決定当時の記録として残置する（accepted ADR は書き換えない）。
  案C（フェイクサーバー）・案D（`defineFields`）・案E（バージョン表記）の評価は 0033 のまま引き継ぐ。
- **現在地の出典**: [roadmap][roadmap]「📊 完成度」／[reference の resources-list][resources-list] ＋
  各リソースの項目表（[resources/][resources]）／[field-data-types][field-types]／
  `src/resources/*.ts` の `FIELDS` カタログ／`src/xml/decode.ts` の `DataType`。
- **関連**: [[0035-usage-documentation-structure]]（ドキュメントの型）／[[0058-reference-expansion-read]]（Sales で効く）／
  [[0023-custom-field-declaration-dsl]]（`Link` / `Image` の露出先）／[[0004-field-type-model]]・[[0016-field-type-granularity]]（型の粒度）。
- **台帳**: [findings][findings] の open は [RV-22][rv22] のみ（契約待ち）＝本 ADR の妨げにならない。
- accepted 後の反映先: [索引][index]・[roadmap][roadmap]（「🧭 方針」「いま何をやるか」「📊 完成度」。
  陳腐化していた (d) 行の訂正もここで入れる）・`CLAUDE.md`（リソースのフェーズ記述）。
  **実装は別 PR**（ADR と実装は分ける）。

[roadmap]: ../roadmap.md
[prd]: ../design/requirements.md
[lv]: ../live-verification.md
[findings]: ../reviews/findings.md
[adr-readme]: README.md
[index]: index.md
[resources-list]: ../reference/resource-api/resources-list.md
[resources]: ../reference/resource-api/resources/README.md
[field-types]: ../reference/resource-api/field-data-types.md
[rv12]: ../reviews/rv/0012-coverage-overclaim-docs.md
[rv22]: ../reviews/rv/0022-ratelimit-create-no-retry.md
[rv23]: ../reviews/rv/0023-candidate-catalog-missing-fields.md
[rv24]: ../reviews/rv/0024-define-fields-undocumented.md
[rv27]: ../reviews/rv/0027-read-query-guide-missing.md
[rv29]: ../reviews/rv/0029-reference-catalog-check-missing.md
