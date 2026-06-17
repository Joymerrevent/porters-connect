# レポート様式（findings register + per-run snapshot）

レビュー結果は 2 種類のファイルに残す。`docs/live-verification.md` と同じ「**エントリは消さず、状態と処置を更新する**」運用を踏襲する。

```
docs/reviews/
├── README.md            # 運用の説明（初回のみ生成）
├── findings.md          # 生きた指摘台帳（全 run 横断・エントリは消さない）
└── YYYY-MM-DD.md        # その run のスナップショット（毎回追加）
```

---

## 1. `docs/reviews/findings.md`（生きた台帳）

全レビューを横断する指摘の単一の正典。**ID は採番したら不変**。**確定してもエントリは削除せず**、「状態」と「処置」を更新する（`live-verification.md` の LV と同じ思想）。

### 様式

見出し＋箇条書き形式（1 フィールド = 1 行）で記録する。テーブルは diff が行全体に広がるため使わない。

```markdown
# レビュー指摘台帳（findings register）

このファイルは `/project-review` が更新する、全レビュー横断の指摘台帳です。
ID は不変・エントリは消さない。確定したら「状態」と「処置」を更新します。
運用は [docs/live-verification.md][lv] と同じ思想（処置が追える）。

凡例 — 重要度: 🔴 High（実用ブロッカー級）/ 🟡 Medium / 🟢 Low ・ 状態: open / fixed / wontfix / deferred

## サマリー

| ID   | 重要度 | 観点       | 状態 |
| ---- | ------ | ---------- | ---- |
| RV-1 | 🔴     | API 忠実性 | open |

---

## RV-1 🔴 API 忠実性

- **概要**: get()/field 省略 search() が本番では P_Id のみ返す
- **根拠**: `src/resources/resource.ts:142,228` / docs 115010010367
- **推奨**: field 省略時はカタログ全 P_ alias を既定送信
- **状態**: open
- **処置**: —

<!-- 参照定義はファイル末尾にまとめる（MD054 / ユーザー規約）。例: -->

[lv]: ../live-verification.md
```

### 採番・更新ルール

- ID は `RV-1` から連番。**新規指摘のみ次番号を採る**。既存指摘の再掲では新 ID を作らない。
- 各 run で**既存の open エントリを再評価**する:
  - 解消されていれば `状態` を `fixed` にし、`処置` に「何をしたか」を記入。
  - 仕様として許容と判断したら `wontfix`、契約環境待ち等で保留なら `deferred`（理由を処置欄に）。
  - まだ残っていれば `open` のまま（処置は `—` のまま）。
- **エントリは削除しない**。fixed/wontfix も残し、判断の経緯を保つ。
- `live-verification.md` の LV と重なる項目（契約が無いと確定できない仮定）は、台帳に重複させず **LV-N を参照**する（例: 処置欄に「LV-3 参照」）。役割分担: LV=契約待ちの仮定、findings=今この時点の品質指摘。

---

## 2. `docs/reviews/YYYY-MM-DD.md`（スナップショット）

その日のレビューの一回限りの記録。台帳が「現在地」なら、こちらは「その時の写真」。

### 様式

```markdown
# プロジェクトレビュー YYYY-MM-DD

- 対象: @joymerrevent/porters-connect
- ブランチ / HEAD: <branch> @ <short-sha>
- レビュアー: /project-review（Claude Code）

## 品質ゲート

<scripts/gates.sh の出力（表）をそのまま貼る>

## 今回の指摘（サマリ）

ここは**重要度順（問題が先）**に並べる＝優先度ビュー。下の観点別所見は固定順なので、急ぎの判断はこの表で済む。

| ID   | 重要度 | 観点       | 概要 | 状態 |
| ---- | ------ | ---------- | ---- | ---- |
| RV-1 | 🔴     | API 忠実性 | …    | open |

- 新規: RV-3, RV-4
- 状態変化: RV-1 open→fixed（…）

## 観点別所見

固定の 8 観点を**番号順（1→8）で通す**（並べ替えない＝位置が安定し過去回と差分が取りやすい・番号が飛ばない）。優先度は上のサマリ表が示す。**指摘ゼロの観点も記録**する（退行検知）。問題のある見出しには重要度バッジを `— 🔴 RV-N` の形で付ける。

### 1. API 忠実性 — 🔴 RV-1
（root cause、根拠 file:line、docs/reference の該当、推奨を散文で。台帳の要約ではなく「なぜ」を残す）

### 2. アーキテクチャ / ADR 遵守 — 問題なし
…

### 3. コーディング規約（ADR-0013） — 問題なし
### 4. 型安全 / 公開面 — 問題なし
### 5. エラーモデル — 🟡 RV-3
### 6. テスト厳密性 — …
### 7. ドキュメント / DX — …
### 8. リリース準備 — 🟡 RV-4

## 良かった点（strengths）

- 退行監視のため、設計上効いている点も記録する（フェイルセーフの実装箇所など）。

## 次アクション候補

- RV-1 を最優先（実用ブロッカー）。…
```

---

## 初回 `docs/reviews/README.md`

初回 run でだけ生成する（既にあれば触らない）。

```markdown
# レビュー記録（reviews）

`/project-review` スキルが生成・更新するレビュー成果物です。

- [findings.md][findings] — 全レビュー横断の生きた指摘台帳。ID 不変・エントリは消さず処置を更新。
- `YYYY-MM-DD.md` — 各回のスナップショット。

思想は [docs/live-verification.md][lv] と同じ（処置が追えること＝フェイルセーフ）。
台帳の項目と実コードの対応は `RV-N`（findings）/ `LV-N`（live-verification）で双方向に辿れます。

[findings]: findings.md
[lv]: ../live-verification.md
```
