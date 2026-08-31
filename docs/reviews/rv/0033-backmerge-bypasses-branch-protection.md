# RV-33 🟡 back-merge が `develop` の保護ルールをバイパスして通る

- 重要度: 🟡 ／ 観点: プロセス / フェイルセーフ
- 状態: open

## 概要

[release-runbook][rb] §2 が定める back-merge（`main` → `develop`）は `develop` への**直 push**で、
`develop` に設定された保護ルール（PR 必須・必須ステータスチェック）を**バイパスして**成功する。
管理者権限があるため止まらないが、**保護を素通りしている**ことが手順書に書かれていない。

## 根拠

- [release-runbook][rb] §2 — `git checkout develop && git pull && git merge --no-edit origin/main && git push`
  を back-merge の手順として定めている。
- 0.12.0 のリリースで実行したときの `git push` の応答（実測）:

  ```text
  remote: Bypassed rule violations for refs/heads/develop:
  remote: - Changes must be made through a pull request.
  remote: - Required status check "stryker" is in progress.
  ```

- つまり `develop` には **PR 必須**と**必須ステータスチェック**が設定されており、
  この push は**その両方を迂回**している。**必須チェックが in progress のまま**通った点も含む。

## 影響

**今回の内容は安全**（`main` の内容をそのまま戻すだけで、`main` は PR ＋ 全チェック green を経ている）。
壊れるとすればバイパスそのものではなく、**バイパスが常態化していること**のほう。

- 手順書が「直 push でよい」としか書いていないため、**保護を破っている自覚が持てない**。
  同じ手つきで別の変更を直 push する余地が残る。
- **必須チェックの完了を待たずに通る**ので、`develop` の保護が「守られている」という前提が成り立たない。
- 管理者以外が back-merge しようとすると**そもそも失敗する**（手順書どおりにやると詰まる）。

[ADR-0030][adr30] は back-merge を手動と決めているが、**保護ルールとの関係は決めていない**。

## 検出経緯

0.12.0 のリリース（2026-08-31）で runbook §2 を実行したときの push 応答から。
それ以前の版でも同じことが起きていたはずだが、応答を読んでいなかったため記録が無い。

## 推奨

処置の候補は 3 つ。**(a) を推奨**する。

### (a) back-merge も PR にする（推奨）

`main` → `develop` の PR を立てて通常どおりマージする。保護を迂回しない。
runbook §2 と [ADR-0030][adr30] の記述を書き換える。マージ 1 回分の手間が増えるが、
**「develop は必ず PR を通る」という不変条件が本当になる**。

### (b) 例外として明文化する

バイパスすることを手順書に**明記**し、「back-merge に限り直 push・内容は `main` と同一に限る」と
条件を書く。実装は変えない。手間は増えないが、**不変条件は破れたまま**になる。

### (c) 保護ルール側で back-merge を許可する

`develop` の保護に例外（特定の actor / merge commit のみ許可など）を設定する。
GitHub の設定で表現できる範囲かは未調査。

いずれにせよ **(b) だけで済ませると「守られている」という誤解が残る**ので、
最低でも手順書に実態を書く必要がある。

[rb]: ../../release-runbook.md
[adr30]: ../../adr/0030-backmerge-method.md
