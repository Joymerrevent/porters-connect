# 62. back-merge も PR を通す（ADR-0030 の実行方式を改訂）

- Status: proposed
- Date: 2026-08-31
- Deciders: jun.shiromoto (Joymerrevent)
- Supersedes: [ADR-0030][adr30] の**実行方式**のみ（back-merge を手動で行うこと自体は不変）

> [ADR-0030][adr30] は back-merge を **案H（手動・`git merge` 1 ステップ）**と決めたが、
> **保護ルールとの関係を決めていなかった**。0.12.0 のリリースで、その手順が `develop` の
> 保護を bypass して通っていることが分かった（[findings][findings] **RV-33**）。方式を決め直す。

## Context and Problem Statement

[release-runbook][rb] §2 が定める back-merge（`main` → `develop`）は `develop` への**直 push** で、
`develop` に設定された保護ルールを**素通り**する。0.12.0 のリリースで実際に返った応答:

```text
remote: Bypassed rule violations for refs/heads/develop:
remote: - Changes must be made through a pull request.
remote: - Required status check "stryker" is in progress.
```

`develop` の保護設定（2026-08-31 実測・classic branch protection）:

| 項目                   | 値                                  |
| ---------------------- | ----------------------------------- |
| PR 必須                | あり（必要な承認数は 0）            |
| 必須ステータスチェック | `ci` / `stryker`                    |
| `enforce_admins`       | **false**（＝管理者は素通りできる） |
| ruleset                | **0 件**（classic のみ）            |

つまり「`develop` へ入る変更は必ず PR ＋ 必須チェック green を通る」という前提は、
**リリースのたびに、しかも黙って破られていた**。今回の内容自体は安全（`main` の内容をそのまま戻すだけで、
`main` は PR ＋ 全チェック green を経ている）だが、**bypass が常態化していること**と、
**手順書がそれを書いていないこと**が問題になる。同じ手つきで別の変更を直 push する余地が残り、
管理者以外が手順どおりにやると**そもそも失敗する**。

## Decision Drivers

- **フェイルセーフ** — 「壊れない」ではなく「破れたときに気づける」。**不変条件は本当であるか、明文で例外にする**かのどちらかにする。
- **トークンレス維持**（[ADR-0030][adr30] から引き継ぐ）— 長期シークレット・秘密鍵を増やさない。
- **属人化しない** — 管理者権限を持たない人が同じ手順を実行できる。
- **低頻度・低リスク**（リリース毎・月数回以下／内容は `main` と同一）＝重い仕組みは要らない。

## Considered Options

- **案A: back-merge も PR にする** — `main` → `develop` の PR を立て、**merge commit** でマージする。
- **案B: 例外として明文化する** — 直 push のまま、runbook に「back-merge に限り bypass する」と明記する。
- **案C: ruleset へ移行して bypass を明示する** — classic protection を ruleset に移し、back-merge の実行主体だけ bypass actor に登録する。
- **案D（参考・不採用のまま）: GitHub App で自動化** — [ADR-0030][adr30] の案I。秘密鍵 Secret が増える。

## Decision Outcome

**決定（stakeholder・2026-08-31）：案A（back-merge も PR にする）。**

保護を迂回しない唯一の案で、追加のシークレットも設定移行も要らない。増えるのは
**リリース 1 回につきマージ 1 回分の手間**だけで、[ADR-0030][adr30] が「back-merge は低頻度・低リスク」
と評価した前提のまま吸収できる。案B は手間ゼロだが**不変条件は破れたまま**、
案C は bypass 自体が残るうえ ruleset 移行という重い作業を伴う。

### 手順（runbook §2 に反映する形）

1. `main` へのリリース PR をマージし、`tag.yml` の自動タグを確認する（従来どおり）。
2. `gh pr create --base develop --head main` で back-merge PR を立てる。
3. `ci` / `stryker` の green を確認し、**merge commit で**マージする。

### Consequences

- Good: **「`develop` へ入る変更は必ず PR ＋ 必須チェック green を通る」が本当になる**。
  破ろうとすれば PR を作る手が止まる＝気づける。
- Good: **管理者権限に依存しない**。誰が back-merge しても同じ手順が通る。
- Bad: リリース 1 回につき**マージ操作が 1 回増える**。必須チェックの完了待ち（`stryker` で数分）も入る。
- Neutral: **merge commit でマージすること**が条件になる。squash / rebase を選ぶと `develop` に
  `main` と異なるコミットができ、**次回以降の back-merge が毎回競合する**（履歴保持はリリース PR と同じ理由）。
- Neutral: back-merge PR は base が `main` ではないので、**PR タイトルが commitlint の検査対象**になる
  （[ADR-0039][adr39]）。`chore: …` の形にする。
- Neutral: 版の**単調増加検査は base=`main` の PR でのみ**走る（[ADR-0032][adr32]）ため back-merge PR では走らない。
  内容が `main` と同一である以上、検知すべき逆行は起こらない。
- Neutral: back-merge の**自動化はしない**という [ADR-0030][adr30] の判断は変えない。変えるのは経路だけ。

## Pros and Cons of the Options

### 案A back-merge も PR にする（採用）

- Good: 保護を迂回しない。不変条件が本当になる。追加のシークレット・設定移行が要らない。
- Good: 管理者以外でも実行できる。CI の結果が `develop` へ入る前に見える。
- Bad: 手順が 1 ステップ増え、必須チェックの待ち時間が入る。
- Bad: マージ方法を間違える（squash）と履歴が乖離する — 手順書に明記して防ぐ。

### 案B 例外として明文化する

- Good: 手間が増えない。実態と手順書が一致する（今より良くはなる）。
- Bad: **不変条件は破れたまま**。「`develop` は保護されている」という理解が誤りのまま残る。
- Bad: 管理者以外は実行できないままで、属人化が解けない。

### 案C ruleset へ移行して bypass を明示する

- Good: bypass が設定として可視になり、誰が迂回できるかが明示される。
- Bad: **現状は ruleset が 0 件**＝ classic protection からの移行作業が要る（保護設定の作り直し）。
- Bad: classic の `bypass_pull_request_allowances` では **PR 必須しか迂回対象にできず**、
  必須チェックの迂回は `enforce_admins` に依存する＝「必要な分だけ許す」がそもそも表現しきれない。
- Bad: 移行しても**bypass が残る**ことに変わりはない（不変条件は本当にならない）。

### 案D GitHub App で自動化（参考）

- Good: 完全自動。手順そのものが消える。
- Bad: App 作成・秘密鍵 Secret・bypass 登録が要る。[ADR-0030][adr30] と同じ理由で、ソロ運用には重くトークンレス方針に反する。

## More Information

- 起票元: [findings][findings] **RV-33**（0.12.0 のリリースで push 応答から判明）。
- 反映先: [release-runbook][rb] §2（手順そのもの）。**本 ADR が accepted になってから**直す。
- 保護設定は 2026-08-31 に GitHub API で実測（`repos/…/branches/develop/protection`）。
- **範囲外だが記録**: 同じ実測で `develop` は **force push が許可**されている（`main` は不可）。
  back-merge とは別の穴なので、必要なら別途起票する。

[adr30]: 0030-backmerge-method.md
[adr32]: 0032-monotonic-check-release-scope.md
[adr39]: 0039-commitlint-release-range.md
[findings]: ../reviews/findings.md
[rb]: ../release-runbook.md
