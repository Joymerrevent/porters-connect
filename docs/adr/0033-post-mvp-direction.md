# 33. ポスト MVP の次の注力領域（v0.2 以降）

- Status: proposed
- Date: 2026-06-22
- Deciders: jun.shiromoto (Joymerrevent)

## Context and Problem Statement

MVP（[[0003-add-attachment-to-mvp]] までの範囲）と公開基盤（CI/CD・リリース自動化・コミュニティヘルス）が一巡し、
`@joymerrevent/porters-connect@0.2.1` を npm 公開済み。レビュー台帳 [findings][findings] の RV-1〜9 はすべて `fixed`、
未起票 ADR・open PR/Issue も無い「一区切り」の状態にある。
ただし横断監査（2026-06-22）で、**受け入れ済み ADR / P0 要件が定めた v1 公開面に複数の未実装（積み残し）**が判明した
（OAuth の `code` フロー＝[[0007-oauth-public-surface]] / Read クエリ `order`・`keywords`・`itemstate`＝[[0005-public-api-shape]]・R-5 /
`tenant(id)` ＋ per-call `partition`＝[[0008-multitenancy-partition]] / 200 件一括書き込み＝`CLAUDE.md`）。
いずれも accepted な決定↔実装ギャップで、roadmap/PRD の「P0 全実装」は実態より過大だった。

ここから v0.2 以降で**どこに開発帯域を割くか**、候補が複数競合している
（v1 公開面の積み残し / 第2層 MCP / リソース拡充 / オフライン評価基盤 / `defineFields` 深掘り / 採用面の地固め）。
1 人メンテの帯域は限られ、契約環境が無いためライブ検証はブロックされている。
**次の主軸を 1 つ定め、その理由（と先送りする選択肢）を残す**のが本 ADR の目的。

実装そのものは決めない（各案は採用後に個別 ADR で詳細設計する）。本 ADR は**方向・順序の決定**に限る。

## Decision Drivers

- 最優先目標は「**多くの実利用者に使われること**」（`CLAUDE.md`・[PRD][prd]。収益化より普及）
- 戦略ゴールは「**AI エージェントから PORTERS を操作可能にする**」＝第2層 MCP（`CLAUDE.md`）。本ライブラリ最大の差別化点
- **フェイルセーフ・薄く堅く・メンテしやすく**（土台の堅牢性を先に固める価値）
- **契約環境が無い**制約（ライブ検証 LV-1〜8 はブロック・[live-verification][lv]）→ 契約不要で進められる作業を優先したい
- **既存パターンの再利用性**とコスト（リソース拡充は確立済みパターンの横展開＝低リスク）
- 1 人メンテの**帯域**（同時に多くを抱えない）

## Considered Options

- 案A: **第2層 MCP サーバー**（`@joymerrevent/porters-mcp`・別パッケージ）を次の主軸にする
- 案B: **MVP 外リソースの R/W 拡充**（Recruiter / Contact / Activity / Contract / Sales / Opportunity / Phase）を先に広げる
- 案C: **N2 ローカルフェイクサーバー**（高忠実なオフライン評価基盤・別パッケージ・[[0024-mock-transport]] follow-up）を先に作る
- 案D: **`defineFields` follow-up**（値レベルの実行時検証・テナント実在チェック・Field Read からの宣言雛形生成・[[0023-custom-field-declaration-dsl]]）を深掘り
- 案E: **採用面の地固め**（対応 PORTERS/API バージョン表記の確定＝[PRD §8][prd]・README 英語版・DX 整備）
- 案F: **v1 公開面の積み残しを埋める**（受け入れ済み ADR / P0 要件が約束したが未実装のサーフェス群）。横断監査で判明した次を含む:
  - F-1 **OAuth 公開面 `porters.auth.*`**（`authorizationUrl` / `exchangeAuthorizationCode` / `revoke` ＝ブラウザ `code` フロー＋ `ensureAuthenticated` / `getToken`）。[[0007-oauth-public-surface]] SD-3/SD-6。初回の人間ブラウザ権限付与を補助
  - F-2 **Read クエリ面 `order` / `keywords` / `itemstate`**（＋ typed `condition`）。[[0005-public-api-shape]]・R-5。`itemstate` は削除 API 非提供下で**削除済みデータを読む唯一の正規手段**
  - F-3 **マルチテナント面 `tenant(id)` ＋ per-call `partition` 上書き**。[[0008-multitenancy-partition]]（[[0021-master-read-resources]] で `partition(id)`→`tenant(id)` に改名）
  - F-4 **一括書き込み（200 件バッチ＋200 超の自動分割）**。`CLAUDE.md`・reference write-format。encoder は配列対応済みだが公開 API は単件のみ

これらは排他ではなく、**1 つを主軸に他を薄く並行**できる。案F は単一作業でなく上記 F-1〜F-4 の束（着手順は採用後に詰める）。

## Decision Outcome

> 本 ADR は `proposed`。下記の順序は **stakeholder 判断（案F＝v1 公開面の積み残しを先行 → 案A 主軸）** を反映したもの。`accepted` への確定は最終レビュー後に行う。

決定の方向: **まず案F（v1 公開面の積み残し＝OAuth 公開面・Read クエリ面・マルチテナント面・一括書き込み）を先行**し、続いて **案A（第2層 MCP）を主軸**に据える。
MCP の評価基盤として**案C の薄い版を先行/並行**、リソースは**案B を MCP 露出の需要に応じて機会的に追加**。案D / 案E は後続。

理由（Decision Drivers に照らす）:

- **案F を先に（受け入れ済み設計の積み残し解消＝フェイルセーフ）**: F-1〜F-4 はいずれも accepted ADR / P0 要件が約束したのに未実装で、土台の穴。
  特に F-1（初回ブラウザ権限付与）は MCP/対話シナリオの前提、F-2 の `itemstate` は削除済み Read の唯一手段。**主軸（MCP）を薄い穴の上に積まないよう、先に v1 公開面を accepted 設計へ一致させる。**
- **差別化と普及の直結（案A 主軸）**: 「AI エージェントから PORTERS を操作」は本プロジェクト唯一無二の価値で、`使われること` に最も効く。
  第1層は薄いラッパーで価値が伝わりにくいが、MCP は「AI から動く」体験で採用導線になる。
- **土台は十分**: 既存 MVP 面（Candidate/Job/Client/Process/Resume ＋ Attachment ＋ マスタ Read）で、意味のある MCP ツールセットを露出できる。
  不足リソースは MCP 越しの需要が見えてから案B で足せばよい（投機的拡充を避ける）。
- **契約非依存で着手可**: MCP は第1層を mock transport／フェイクサーバー上で駆動して開発・評価でき、契約環境ブロックの影響を受けない。
- **案C は案A の加速装置**: MCP の自動評価には高忠実なオフライン応答が要る。薄いフェイクサーバー（or 既存 mock transport の拡張）を先に持つと A のテスト/評価が固くなる＝フェイルセーフ。

### Consequences

- Good: 受け入れ済み設計の積み残し（案F）を先に塞いでから戦略ゴール（MCP）へ直進。第1層を「約束どおり」にしてから上に積む＝フェイルセーフ。
- Bad: 先行フェーズ（案F）の実装範囲が当初想定より広い（OAuth/クエリ/multitenancy/batch の 4 群）。MCP 着手が一段後ろ倒し。新パッケージ（第2層）の設計・運用負荷も別途増える。
- Neutral: リソース網羅（案B）は当面 MVP ＋α に留め、MCP 越しの需要で機会的に拡充。案F 完了で v1 公開面が accepted 設計と一致する。

## Pros and Cons of the Options

### 案A: 第2層 MCP を主軸

- Good: 戦略ゴール／最大の差別化に直結。AI から使える体験が採用導線。第1層の安定を保てる。
- Bad: 新パッケージの設計・公開・運用が増える。MCP のツール粒度・認証受け渡し設計が新規論点。

### 案B: MVP 外リソース拡充

- Good: 確立パターンの横展開で低リスク。網羅性が上がる。
- Bad: 1 リソースあたりの限界価値が逓減。需要不明なまま広げると投機的。差別化には寄与しにくい。

### 案C: ローカルフェイクサーバー先行

- Good: オフライン評価・契約前検証が固くなる。案A / 案B の基盤になりフェイルセーフ。
- Bad: それ自体は利用者価値に直結しない（内部基盤）。単独主軸だと普及が前進しない。

### 案D: defineFields 深掘り

- Good: 既存 P1 機能の堅牢化。型安全／実行時検証の厚みが増す。
- Bad: 価値が一部上級ユーザーに限定。差別化・普及への寄与は限定的。

### 案E: 採用面の地固め

- Good: 低コストで普及の摩擦を下げる（バージョン表記・英語 README）。
- Bad: 単独では「新しい価値」を生まない。MCP 等の主軸と並行すべき補助。

### 案F: v1 公開面の積み残しを埋める

- Good: 受け入れ済み ADR / P0 要件（[[0007-oauth-public-surface]] / [[0005-public-api-shape]]・R-5 / [[0008-multitenancy-partition]] / `CLAUDE.md`）と実装を一致させ、決定↔実装ギャップを解消＝フェイルセーフ。F-1 は案A（MCP の初回権限付与）を後押し、F-2 の `itemstate` は削除済み Read を回復。各項目は小〜中コスト。
- Bad: 4 群あり先行フェーズが厚め（着手順の判断が要る）。OAuth は実利用でライブラリ外のブラウザ／redirect 受けが残る（利用者手順）。単独では「新しい価値」より「約束の履行」寄り。

## More Information

- 案F の根拠（積み残しの出典）: [[0007-oauth-public-surface]]（OAuth 公開面・F-1）、[[0005-public-api-shape]]（Read クエリ面・R-5・F-2）、[[0008-multitenancy-partition]] ＋ [[0021-master-read-resources]]（tenant/partition・F-3）、`CLAUDE.md`（200 件分割・F-4）。横断監査 2026-06-22 で検出。
- 関連: [[0024-mock-transport]]（案C の前提）、[[0023-custom-field-declaration-dsl]]（案D）、[PRD §3 非ゴール／§9 フェーズ][prd]、[roadmap][roadmap]（🚀 将来）、[live-verification][lv]（契約後タスク）。
- B 群（ドリフト・要修正）は本 ADR の対象外で [findings][findings] に起票（per-call partition の JSDoc 偽宣言・refresh 失効時の挙動乖離・roadmap の coverage 過大）。
- 採用後の反映先（`accepted` 後）: `docs/design/roadmap.md`・必要なら `CLAUDE.md` の MVP/フェーズ記述。主軸に決まった案・案F の各群は個別 ADR（例: MCP のパッケージ構成、クエリ面の抽象化）へ分岐する。

[prd]: ../design/requirements.md
[roadmap]: ../design/roadmap.md
[lv]: ../live-verification.md
[findings]: ../reviews/findings.md
