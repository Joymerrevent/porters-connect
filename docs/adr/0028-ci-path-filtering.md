# 28. CI のパスベース最適化（docs-only PR の軽量化）

- Status: accepted
- Date: 2026-06-20
- Deciders: jun.shiromoto (Joymerrevent)

> 発端：docs 1 行の変更でも全 CI（`ci` フル・`test` マトリクス 20/22/24・CodeQL・
> mutation/`stryker`・commitlint）が走る。docs-only に mutation/test/CodeQL は無駄。
> 必須チェックを単純に skip するとマージ不能になる**落とし穴**があり、方式に選択肢がある。

## Context and Problem Statement

現在、全ワークフローが毎 PR 実行される（必須チェックは `ci` と `stryker`）。docs/非コード変更では
重い検査（mutation・test マトリクス・CodeQL・ci の test/build）が**無駄**＝ランナー時間とフィードバック遅延。

**落とし穴**：GitHub は**必須チェックを `paths-ignore` で“スキップ”すると、その PR が永久に
“Expected（待ち）”になりマージ不能**になる。よって「docs なら重いのを単純に飛ばす」はそのままだと詰む。
docs-only で重い検査を省きつつ、必須チェックを壊さない方式を決める。

## Decision Drivers

- **薄く**：ランナー時間・フィードバック速度を削る。
- **詰まらせない**：必須チェック × `paths-ignore` の落とし穴を回避。
- **品質バーを下げない**：code 変更は dev でもフル検査（main は dev の released＝同じバー）。
- **保守性**：ワークフローを複雑にしすぎない。

## Considered Options

### 重い検査を docs で省く方式

- **案A 全ジョブを条件分岐**：すべてのジョブは常に起動（→必須チェックは報告される）が、docs-only なら重いステップを `if` で skip（paths-filter）。
- **案B ハイブリッド**：**非必須**（test マトリクス・CodeQL）は `paths-ignore` で素直に skip（runner すら起動しない）。**必須**（`ci`・`stryker`）だけ条件分岐で報告は維持。
- **案C 現状維持**：何もしない。

### サブ論点：mutation（`stryker`）の扱い（方式と直交）

- **維持案**：必須のまま、docs-only は条件分岐で skip。
- **除外案**：必須から外し、push（develop/main）と nightly でのみ回す（PR は速いが per-PR の mutation ゲートは外れる）。

## Decision Outcome

**決定（accepted・2026-06-20）：案B（ハイブリッド）を採用。** mutation は必須維持（条件分岐で docs skip）。
test 系は**拒否リスト**（`paths-ignore`・依存/設定変更も拾う）、CodeQL は**src 許可リスト**（`paths`・自ソースのみ解析）とする。詳細は下記。

### 推奨（私案）

- **方式＝案B（ハイブリッド）**：
  - 非必須 `test` マトリクス → `paths-ignore: ['**/*.md', 'docs/**', ...]`（**拒否リスト**＝依存/設定変更も拾うため）。
  - 非必須 `CodeQL` → `paths: ['src/**', 'examples/**', ...]`（**許可リスト**＝自ソースのみ解析・依存/設定では結果不変）。
  - 必須 `ci` → 条件分岐（docs-only は **lint/format/markdownlint のみ**、typecheck/test/build/audit は skip）。
  - `stryker` → 条件分岐で docs skip（**維持案**＝必須は維持）。
- 分け方の軸は「**target branch（dev/main）」ではなく「変更が docs か code か**」。code 変更は dev でもフル検査。
- commitlint は docs PR でも有用なので維持（軽い）。

「非必須は素直に skip、必須だけ報告を保ちつつ中身を軽くする」＝詰まらせず最小実装。

> 決定後 accepted にし、実装（`paths-ignore` 追加・`dorny/paths-filter` 等での条件分岐）は**別 PR**。

### Consequences

実装は**別 PR**（ADR と分離）：

- **`test` マトリクス・`mutation`**：`paths-ignore: ['**/*.md', 'docs/**']`（拒否リスト）。依存/設定/src 変更で走り docs だけ skip。
- **`CodeQL`**：`paths: ['src/**', 'examples/**']`（許可リスト）。ソース変更時のみ。
- **必須 `ci`**：ジョブは常に起動（必須チェックは報告）。`dorny/paths-filter`（or `git diff`）で docs-only を検知し typecheck/test/build/audit を skip、lint/format/markdownlint は常時。
- **必須 `stryker`**：同様に条件分岐で docs-only は mutation step を skip（必須は維持）。
- `commitlint` は維持（軽い・docs PR でも有用）。
- 注意：**必須（ci/stryker）は `paths-ignore` で skip しない**（"Expected" 詰みを避けるため条件分岐で報告を保つ）。

## Pros and Cons of the Options

### 案A 全ジョブ条件分岐

- Good: 必須チェック名を変えない。一貫した方式。
- Bad: 非必須ジョブも runner 起動（install 分の無駄が残る）。各ジョブに分岐を足す手間。

### 案B ハイブリッド

- Good: 非必須は runner すら起動しない（最も省ける）。必須は報告維持で詰まらない。
- Bad: 必須/非必須で扱いが2系統になる（理解コスト小）。

### 案C 現状維持

- Good: 追加ゼロ。
- Bad: 無駄が残り続ける（発端の不満そのもの）。

## More Information

- 落とし穴の出典：必須チェック + `paths-ignore` = “Expected” で詰む（GitHub の既知挙動）。
- 関連: [ADR-0014][p14]（カバレッジ）／ [ADR-0015][p15]（mutation）／ `ci.yml`・`mutation.yml`・`codeql.yml`。
- 条件分岐の実装候補: `dorny/paths-filter` アクション、または `git diff` ベースの自前判定。

[p14]: 0014-test-coverage-policy.md
[p15]: 0015-mutation-testing.md
