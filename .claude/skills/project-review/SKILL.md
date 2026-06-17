---
name: project-review
description: >-
  @joymerrevent/porters-connect の状態を多観点でクロスレビューし、処置が追える
  レポートを docs/reviews/ に出力する。定期レビュー・健全性チェック・リリース前点検に使う。
  「プロジェクトをレビューして」「状態を確認して」「クロスレビュー」「定期レビュー」
  「リリース前チェック」「project review」などと言われたら、たとえ "スキル" と明示
  されなくても必ずこのスキルを使う。品質ゲート実行（typecheck/lint/test/coverage/build）
  と、API 忠実性・ADR 遵守・型安全・エラーモデル・テスト厳密性・ドキュメント・公開準備の
  観点別レビューを束ね、findings 台帳と日付スナップショットを更新する。
---

# Project Review — porters-connect 多観点クロスレビュー

このプロジェクトの状態を、固定の観点から毎回同じ深さでレビューし、結果を**処置が追える台帳**として残すためのスキル。`docs/live-verification.md` と同じ「行は消さず状態を更新する」運用で、レビューが**一度きりの感想で終わらず、回を重ねて退行を捕まえる**ようにするのが狙い。

## このスキルの前提（なぜこの形か）

- **正典は `docs/`**（CLAUDE.md 冒頭）。要件=`docs/design/`、決定=`docs/adr/`、API 事実=`docs/reference/`。レビューの判断は記憶や一般論ではなく**この正典に接地**させる。特に API 挙動の指摘は `docs/reference/`（または `tmp/porters-docs/` の原典）を必ず引く。
- このライブラリの**存在理由**は PORTERS 固有の罠（XML/独自 OAuth/UTC/削除 API 無し/リクエスト長/レート制限/ホスト非公開）を正しく隠すこと（CLAUDE.md「PORTERS API 固有の注意点」）。だから **API 忠実性が最重要観点**。
- 設計哲学は**フェイルセーフ**＝壊れたとき安全側に倒れる。良い実装ほどこの観点で評価が上がる。

## 実行フロー

1. **下調べ（接地）** — まず現状を掴む。これを飛ばすと指摘が宙に浮く。
   - `git log --oneline -15` / `git status` で直近の変化を把握。
   - `CLAUDE.md`、`docs/adr/README.md`（決定の索引）、`docs/live-verification.md`（契約待ちの既知仮定）に目を通す。
   - **前回の台帳 `docs/reviews/findings.md` を必ず読む**（無ければ初回）。open 指摘の再評価が今回の仕事の半分。
2. **品質ゲート** — スクリプトで一括実行し、結果表を得る:
   ```sh
   bash .claude/skills/project-review/scripts/gates.sh
   ```
   出力（Markdown 表＋カバレッジ行）をスナップショットにそのまま貼る。落ちたゲートがあれば、その観点の指摘より先に**ゲート赤を最優先指摘**にする。
3. **多観点クロスレビュー** — 下記「観点」を順に当てる。各観点で、関係する実ファイルを読み、正典と突き合わせ、`file:line` と docs 参照付きで指摘を起こす。判断に迷う重さの仕様は ADR 化を推奨に含める。
4. **レポート出力** — `references/report-format.md` の様式で:
   - `docs/reviews/findings.md`（生きた台帳）を更新（新規採番＋既存 open の状態更新、行は消さない）。
   - `docs/reviews/YYYY-MM-DD.md`（その回のスナップショット）を新規作成。
   - 初回のみ `docs/reviews/README.md` を生成。
   日付は環境のシステム日付（currentDate）を使う。`references/report-format.md` を読んでから書くこと。
5. **要約を会話に返す** — ヘッドライン指摘（最も重要な 1〜2 件）、ゲート結果、新規/状態変化した指摘 ID、次アクション候補を簡潔に。詳細はレポートに書いたと伝える。

## 観点（fixed perspectives）

毎回この順で当てる。**指摘ゼロの観点も「問題なし」と記録**する（次回の退行検知のため）。各観点の括弧内は接地すべき正典。

### 1. API 忠実性（最重要・`docs/reference/`）
実装が PORTERS の実挙動と一致するか。**コードの自然な読みと正典がズレていないか**を疑う。代表的な確認点:
- **Read の `field` 既定挙動**: 現行 App は `field` 省略時 `{Resource}.P_Id` のみ返る（docs `115010010367`）。`search`/`get` が full record を返す前提のコード・README 例になっていないか。
- **XML 入出力の対称性**: Option（`string[]`）、User/Reference（ID のみ Write）、DateTime/Date の ISO⇄PORTERS 変換（`src/xml/`, `src/util/datetime.ts`）。Read で取れた値を Write に戻せるか（round-trip）。
- **OAuth 独自仕様**: `X-porters-hrbc-oauth-token`、`code`/`code_direct`、認証コード 30 秒、トークン有効期限の**単位（ms）**（`docs/reference/authentication-api/token.md`）。
- **制限**: リクエスト長 ~15000 文字、200 件分割、レート Read 2000/Write 500/分（`docs/reference/resource-api/README.md`）。スロットル既定値が正典と一致するか。
- **削除 API を生やしていないか**、**ホスト名ハードコードが無いか**。
- 契約が無いと断定できない仮定は `docs/live-verification.md` の LV と対応させ、台帳では重複させず LV を参照。

### 2. アーキテクチャ / ADR 遵守（`docs/adr/`）
- 層分離: transport → requester(throttle/auth/retry) → resources → xml。**XML が `resources/` に漏れていないか**、第1層に業務ロジックが混じっていないか（CLAUDE.md「絶対にやってはいけない」）。
- 各 ADR の決定が実装に反映されているか。最近 accept された ADR（`git log` 参照）は特に。決定と実装の乖離は指摘。

### 3. コーディング規約（ADR-0013 / eslint）
- class は Error 派生と `PortersClient` のみ、状態持ちは factory 関数で契約型、関数は全 arrow、型は全 `type`。`index.ts` はバレル、公開面 `src/index.ts` は明示 export でキュレーション。ファイル名 kebab-case。
- `any` を撒いていないか。lint が緑でも規約の精神（薄く・堅く）から外れた箇所を見る。

### 4. 型安全 / 公開サーフェス
- `src/index.ts` の export が意図通りか（内部実装が漏れていない／必要な型が出ている）。
- 公開型・メソッド名・public JSDoc は**英語**（CLAUDE.md）。読み取り値・入力の型が実挙動を正しく表現しているか（例: field 選択モデルと optional/nullable の整合）。

### 5. エラーモデル（ADR-0006 / `src/errors/`）
- 判別可能な型（基底＋系統別＋`category`）。未知コードを握り潰さず `"unknown"` に倒すか。
- **定義済みだが未到達の category が無いか**（例: `rateLimit` がどこからも返らない等）。README の `category` 例と実際に produce される値の整合。

### 6. テスト / 変異テスト厳密性（ADR-0014 / ADR-0015）
- カバレッジ閾値（perFile, stmts/funcs/lines=100, branch≥90）。
- **fixture が実挙動と乖離していないか**（例: `field` 省略 Read に full record を返す fixture は本番と食い違い、罠を隠す）。テストが「あり得ない応答」を前提にしていないか。
- Stryker の equivalent-mutant 抑制コメントが妥当か。

### 7. ドキュメント / DX
- README に**非公式明示・契約必須の注記・対応バージョン**があるか（CLAUDE.md「絶対に省かない」）。
- README のコード例が実挙動と一致するか（観点1とクロス）。md はリンク参照スタイル（ユーザー規約）。
- `live-verification.md` の VERIFY(live) ↔ 表の対応が保たれているか。

### 8. リリース準備（公開前点検）
- `package.json`: version、`publishConfig.access`（スコープ付き＝既定 private、`"public"` が無いと publish 失敗）、`repository`/`bugs`/`homepage`/`keywords`/`author`、`files`、`exports`。
- 生成物（`coverage/`/`reports/`/`tmp/`/`dist/`）が git に追跡されていないか（`git ls-files` で確認）。
- MVP リソースの充足（OAuth→Candidate→Job→Client→Process→Resume→Attachment）。

## レポートの書き方（要点）

- **`references/report-format.md` を読んでから書く**。台帳の ID は不変・エントリは消さない・状態と処置を更新する。
- 指摘は必ず **`file:line` と（API 系なら）docs 参照**を伴う。再現・追跡できない指摘は価値が低い。
- 重要度: 🔴 High（実用ブロッカー級）/ 🟡 Medium / 🟢 Low。「動くが将来困る」と「今すぐ壊れる」を混同しない。
- **並び順の分担**: スナップショット上部の「今回の指摘」サマリ表は**重要度順（問題が先）**＝優先度ビュー。下の「観点別所見」は**観点番号順（1→8）で固定**し、並べ替えない（位置が安定＝過去回と差分を取りやすい／番号が飛ばず読み手が迷わない）。固定順でも問題が目立つよう、各見出しに重要度バッジ（🔴/🟡）を `— 🔴 RV-N` の形で付ける。
- スナップショットの観点別所見は**「なぜ」を残す**（台帳の要約コピーにしない）。退行監視のため**良かった点**も書く。
- 既存 open 指摘が解消されていれば `状態` を `fixed` にし、`処置` に何をしたかを記入する。仕様として許容なら `wontfix`、契約待ちは `deferred`。

## やらないこと

- **勝手にコードを修正しない**。このスキルは診断と記録まで。修正は別途ユーザーの指示で。
- 既存の `findings.md` エントリを削除・上書きしない（判断経緯の消失はフェイルセーフに反する）。
- サブエージェントの乱用をしない。観点が多くても 1 セッションで順に当てれば足りる（ユーザーが明示要望した場合を除く）。
