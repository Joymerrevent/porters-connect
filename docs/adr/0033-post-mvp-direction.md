# 33. ポスト MVP の次の注力領域（v0.2 以降）

- Status: proposed
- Date: 2026-06-22
- Deciders: jun.shiromoto (Joymerrevent)

## Context and Problem Statement

MVP（[[0003-add-attachment-to-mvp]] までの範囲）と公開基盤（CI/CD・リリース自動化・コミュニティヘルス）が一巡し、
`@joymerrevent/porters-connect@0.2.1` を npm 公開済み。レビュー台帳 [findings][findings] の RV-1〜9 はすべて `fixed`、
未起票 ADR・open PR/Issue も無い「一区切り」の状態にある。
ただし OAuth は現状 `code_direct`（サーバ間直接）のみ実装で、[[0007-oauth-public-surface]] が決めた
ブラウザ `code` フローのヘルパー（`authorizationUrl` / `exchangeAuthorizationCode` / `revoke`）は**未実装**＝決定↔実装ギャップが残る。

ここから v0.2 以降で**どこに開発帯域を割くか**、候補が複数競合している
（第2層 MCP / リソース拡充 / オフライン評価基盤 / `defineFields` 深掘り / 採用面の地固め / ブラウザ `code` フローのヘルパー）。
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
- 案F: **ブラウザ `code` フロー（`response_type=code`）のヘルパー実装** — 認可 URL 生成（手動ログイン用 URL の取得＝`authorizationUrl`）＋ redirect の `?code=` 交換（`exchangeAuthorizationCode`）＋ `revoke`。[[0007-oauth-public-surface]] SD-3 で公開面は決定済みだが**未実装**。初回の人間ブラウザ権限付与を補助する

これらは排他ではなく、**1 つを主軸に他を薄く並行**できる。

## Decision Outcome

> 本 ADR は `proposed`。以下は**推奨（議論のたたき台・未確定）**であり、stakeholder 議論で確定する。

推奨: **案A（第2層 MCP）を次の主軸**とし、**案F（ブラウザ `code` フローのヘルパー）を near-term の補完**として早期に入れる。
MCP の評価基盤として**案C の薄い版を先行/並行**、リソースは**案B を MCP 露出の需要に応じて機会的に追加**。案D / 案E は後続。

理由（Decision Drivers に照らす）:

- **差別化と普及の直結**: 「AI エージェントから PORTERS を操作」は本プロジェクト唯一無二の価値で、`使われること` に最も効く。
  第1層は薄いラッパーで価値が伝わりにくいが、MCP は「AI から動く」体験で採用導線になる。
- **案F は ADR-0007 ギャップ解消＋案A の前提**: 現状 `code_direct` のみ実装で、初回の人間ブラウザ権限付与（`response_type=code`）が無いと MCP/対話シナリオで権限付与を完了できない。
  URL 生成＋code 交換＋revoke は小コストで、受け入れ済み [[0007-oauth-public-surface]] SD-3 の未実装分を埋める（決定↔実装の整合＝フェイルセーフ）。
- **土台は十分**: 既存 MVP 面（Candidate/Job/Client/Process/Resume ＋ Attachment ＋ マスタ Read）で、意味のある MCP ツールセットを露出できる。
  不足リソースは MCP 越しの需要が見えてから案B で足せばよい（投機的拡充を避ける）。
- **契約非依存で着手可**: MCP は第1層を mock transport／フェイクサーバー上で駆動して開発・評価でき、契約環境ブロックの影響を受けない。
- **案C は案A の加速装置**: MCP の自動評価には高忠実なオフライン応答が要る。薄いフェイクサーバー（or 既存 mock transport の拡張）を先に持つと A のテスト/評価が固くなる＝フェイルセーフ。

### Consequences

- Good: 戦略ゴールに直進し、差別化＝普及に最短で効く。第1層は安定（変更を増やさない）。
- Bad: 新パッケージ（第2層）の設計・運用負荷が増える（リポジトリ構成・公開・バージョニング）。MCP 仕様・ツール設計の学習コスト。
- Neutral: 第1層は「MCP が必要とする穴」を起点に最小拡張する受け身モードへ。リソース網羅は当面 MVP ＋α に留まる。

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

### 案F: ブラウザ `code` フローのヘルパー実装

- Good: 受け入れ済み [[0007-oauth-public-surface]]（SD-3）の未実装ヘルパー（`authorizationUrl` / `exchangeAuthorizationCode` / `revoke`）を埋め、決定↔実装を整合。MCP/対話の初回権限付与を可能にし案A を後押し。コスト小。
- Bad: 実利用にはライブラリ外のブラウザ／redirect 受けが要る（利用者側手順・[[0007-oauth-public-surface]] どおり承諾自体はライブラリ外）。単独では大きな新価値にはならない。

## More Information

- 関連: [[0007-oauth-public-surface]]（案F の根拠・SD-3）、[[0024-mock-transport]]（案C の前提）、[[0023-custom-field-declaration-dsl]]（案D）、
  [PRD §3 非ゴール／§9 フェーズ][prd]、[roadmap][roadmap]（🚀 将来）、[live-verification][lv]（契約後タスク）。
- 採用後の反映先（`accepted` 後）: `docs/design/roadmap.md`・必要なら `CLAUDE.md` の MVP/フェーズ記述。
  主軸に決まった案は個別 ADR（例: MCP のパッケージ構成・ツール設計）へ分岐する。

[prd]: ../design/requirements.md
[roadmap]: ../design/roadmap.md
[lv]: ../live-verification.md
[findings]: ../reviews/findings.md
