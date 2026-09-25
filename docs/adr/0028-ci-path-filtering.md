# 28. CI のパスベース最適化（docs-only PR の軽量化）

- Status: accepted
- Date: 2026-06-20
- Deciders: jun.shiromoto (Joymerrevent)
- Implemented: 0.2.1

> 発端：docs 1 行の変更でも全 CI（`ci` フル・`test` マトリクス 20/22/24・CodeQL・
> mutation/`stryker`・commitlint）が走る。docs-only に mutation/test/CodeQL は無駄。
> 必須チェックを単純に skip するとマージ不能になる**落とし穴**があり、方式に選択肢がある。
>
> **Amended by [ADR-0094][adr94]（2026-09-25）**: 2026-09-23 の訂正の「リリースの流れの PR（リリース PR・back-merge PR）は
> develop と同じなら skip」は改められた。`main` への PR は必ずフル run、back-merge PR はほかの PR と同じ変更ファイルの規則で判定する。

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

**訂正（2026-09-23・stakeholder）**: **リリースの流れの PR では、develop と比べて判定する**。
0.22.0 のリリースで、`stryker`（フル run・約 11 分）が**同じコードに 3 回**走った: リリース PR
（`release/X.Y.Z` → `main`）、`main` への push、back-merge PR（`main` → `develop`）。後の 2 つは同じコミットで、
PR の画面にも 2 組並ぶ。原因は 2 つある:

- **リリース PR の差分は base（`main`）に対して取るので、前のリリース以降に develop へ入ったコードがすべて
  「変更」に見える**。実際にリリースブランチで足すのは版番号・CHANGELOG・changeset だけなのに、docs-only に
  ならない。しかもそのコードは develop へのマージ時に必須の `stryker` を通っている。
- **back-merge PR の head は `main` そのもの**で、同じコミットを `main` への push が検査している。

そこで、`pull_request` のうち **base=`main` かつ head が `release/` で始まるもの**と **base=`develop` かつ
head=`main` のもの**に限り、**検査対象（PR のマージ結果）を `origin/develop` と比べ**、違いが
「コードでないもの（`**/*.md`・`docs/**`）」と「`package.json` の `version` だけの変更」に収まるときは
`stryker` を skip する（報告は保つ＝上の落とし穴は踏まない）。

- **品質バーは下げない**: skip するのは、コードが develop（必須の `stryker` を通ったもの）と同じときだけ。
  リリースブランチで欠陥を直した（コードを変えた）とき、develop が先に進んで差が出たとき、依存を変えたときは
  フル run になる。`main` への push と nightly のフル run はそのまま残る。
- **判定に失敗したら走らせる**（fetch や JSON の読み取りに失敗したら skip しない）。省くのは速度のためで、
  判定が壊れたときに検査が消えるのは逆向き。
- 対象は `stryker` だけ。`ci`（約 1 分）と `test` マトリクス（約 30 秒）は据え置く。この 2 つのためにワークフローを
  複雑にする利点は小さい。
- 判定は `scripts/` の小さなスクリプトに置いてテストする（ワークフローの `if` に式を並べると、条件の穴が見えない）。

**注記（2026-09-25・stakeholder）**: **`main` への push も、同じ判定で develop と比べる**。上の訂正で残した
「`main` への push のフル run」は、0.24.0 のリリースでも約 11 分走り、`gh release create` の前に待つことになった。
`main` への push はリリース PR のマージで、中身は develop ＋ 版番号・CHANGELOG・changeset の消費なので、
コードは develop への push（マージ後の中身を検査する唯一の run。`develop` の保護は「最新にしてからマージ」を
求めない）で検査済みになっている。

- `push` のうち `refs/heads/main` に限り、リリースの流れの PR と同じく `origin/develop` と比べ、
  版番号と文書だけの違いなら `stryker` を skip する（0.24.0 の `86bd557` と当時の develop `3314ade` を判定して
  `bookkeeping=true` になることを確かめた）。
- リリースの後に develop が先へ進んでいれば差が出るのでフル run、判定に失敗してもフル run（上と同じ）。
- `develop` への push と nightly のフル run はそのまま残す。

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
[adr94]: 0094-mutation-changed-files-on-pr.md
