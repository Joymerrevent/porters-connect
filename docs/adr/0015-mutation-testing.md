# 15. ミューテーションテスト（Stryker）でテスト品質を測る

- Status: accepted
- Date: 2026-06-15
- Deciders: jun.shiromoto (Joymerrevent)

> [ADR-0014][0014] のカバレッジは「実行されたか」を測るが「正しく検証したか」は測れない
> （assertion 無しでも緑＝coverage theater）。テストの**質**を測る手段を決める。`accepted`（2026-06-15）：
> Stryker を導入し、カバレッジ同様に**継続運用・CI で回帰を止める**（score `break` 閾値）。
> PR は差分（incremental）で高速に・nightly でフル。baseline を作り survived を潰して閾値を設定・ratchet。
>
> **訂正（2026-09-22・decider）**: 実行戦略のうち「PR は差分（incremental）」は**取り下げ、PR もフル run**
> にした。理由は下記 Decision Outcome の訂正。閾値は `break` 100 に到達済み（[RV-59][rv59]）。
>
> **訂正（2026-09-23・stakeholder）**: リリースの流れの PR（リリース PR・back-merge PR）で、コードが develop と
> 同じときは skip する。判定と理由は [ADR-0028][0028] の訂正。
>
> **Amended by [ADR-0094][adr94]（2026-09-25）**: 実行戦略の「PR もフル run」は改められた。`main` 以外への PR は
> 変更したファイルだけを毎回ゼロから検査し（incremental は使わない）、`main` への PR は必ずフル run にする。

## Context and Problem Statement

[ADR-0014][0014] で statements/functions/lines=100%・branches=90% を強制したが、**行・分岐カバレッジは
「コードを実行したか」しか測らない**。assertion の弱い/無いテストでも 100% になり得る。テストが**実際に
バグを捕まえられるか**（フェイルセーフの本丸）を測りたい。導入するか・どう運用するかを決める。

## Decision Drivers

- **フェイルセーフ**: テストが本当に回帰を検出できることを担保する。
- **公認品質**: 「意味のあるテスト」を仕組みで裏づける。
- **薄く・現実的**: 遅い手法なので CI を不必要に重くしない。
- **契約なしで回せる**: mock + fixture（[ADR-0002][0002]）のままで実行できる。
- **[ADR-0014][0014] と補完**: カバレッジ＝床（実行）、mutation score＝実力（検証）。

## Considered Options

- **導入しない**（カバレッジのみ）
- **Stryker（StrykerJS）導入**（JS/TS の定番。`>`→`>=`・`&&`→`||`・`??` 削除・`return` 改変等で mutant を生成し
  「テストが倒せるか」を測る）
- 実行頻度: **毎 PR で強制** / **定期（nightly）または手動オンデマンド** / レポートのみ

## Decision Outcome

**採用: Stryker を導入し、テスト品質を継続運用で担保（CI で score 回帰を止める）**。一度きりの計測でなく、
カバレッジ（[ADR-0014][0014]）と同じく「壊れたら CI が落ちる」運用にする。

- ツール: **StrykerJS**（`@stryker-mutator/core` ＋ `@stryker-mutator/vitest-runner`）。
- 対象: src のロジック（[ADR-0014][0014] と同様にバレル/型/プレースホルダ/テストを除外）。
- **CI 強制**: mutation score の `break` 閾値を設け、下回ったら CI を落とす（回帰防止）。
- ~~**実行戦略**: **PR は差分のみ（incremental / `--since`）で高速**に、**nightly（schedule）でフル run** して全体 score を追跡。~~
  **訂正（2026-09-22）**: **PR / push / nightly のすべてでフル run**（CI 実測 約 11 分・incremental は約 3 分）。
  Stryker の incremental は **static mutant**（モジュール読み込み時に評価される定数: リソースの項目表・
  応答 XML・regex …）の "Survived" を、**その行のコードを変えるか `--force` を掛けるまで再利用し続ける**
  （static には per-test の coverage が無く、再試験の条件「cover するテストが増えた」に決して該当しない —
  `@stryker-mutator/core` の `incremental-differ`）。`break` 100 と組み合わせると、static の穴を**テストで塞いだ
  PR が必ず落ちる**（#375 で実際に起きた: 進捗は survived 0 なのに、復元したキャッシュの Survived 4 件が
  最終表に残った）。安全側ではあるがゲートとして成立しないので、差分再評価をやめて速度を手放した。
  代替案（PR だけ `ignoreStatic`／キャッシュから static の結果だけ捨てる）は、前者が static の退行を PR で
  見なくなり、後者は static が時間の 6 割を占めるためフル run とほぼ同コストで機構だけ増える、として退けた。
- **baseline → ratchet**: 導入時にフル run → survived mutant をテストで潰す → `break` 閾値を実測付近に置き徐々に引き上げる。
- フェイルセーフ: survived は「テストの穴」。`// Stryker disable` は真の同値変異のみに限定（濫用しない）。

### Consequences

- Good: 空テスト/弱い assertion を CI で継続的に弾ける＝テスト品質を維持。カバレッジの限界を補完。
- Bad: **遅い**（mutant 数だけ test suite を回す）→ ~~PR は incremental・full は nightly で緩和~~
  **訂正（2026-09-22）**: 緩和しない。コード変更を含む PR は毎回フル run（約 11 分）。同値変異の仕分けコスト。
- Neutral: `break` 閾値は実装で確定（2026-09-21 以降 100）。score を上げる継続作業が発生（coverage と同性質）。

## Pros and Cons of the Options

### 導入しない

- Good: 追加コストゼロ。
- Bad: テスト質の盲点が残る（coverage theater を検出できない）。

### Stryker 導入（推奨）

- Good: JS/TS 標準・vitest 連携・mutation score で質を定量化。
- Bad: 実行が重い・チューニング（除外・タイムアウト）が要る。

### 実行頻度

- 毎 PR 強制: Good 抜け漏れ無し／Bad CI が重く遅い・初期は不安定。
- 定期/オンデマンド（推奨）: Good 軽い・段階導入／Bad 強制力は弱い（運用で補う）。

## More Information

- 前提/依存: [ADR-0014][0014]（カバレッジは床）、[ADR-0013][0013]（テスト方針）、[ADR-0002][0002]（mock+fixture）。
- 実績（2026-06-15 更新）: 導入時 baseline 約 74%（[PR #12][pr12]）から **全 survived を撃破し
  mutation score 100%（生存 0）** を達成（[PR #13][pr13]）。ratchet で `break` 閾値を **70 → 95** に
  引き上げ（実体は `stryker.config.json` の `thresholds = high/low/break = 100/95/95`）。同値変異
  （equivalent mutant）のみ `// Stryker disable` ＋理由で限定明示＝`parser.ts` / `decode.ts` /
  `candidate.ts` の 3 箇所。`parser.ts` は `Number(asString(x) ?? "0")` を `toInt` ヘルパへ集約して
  等価変異そのものを除去（`Number("") === 0` のため `?? "0"` が等価化していた）。
- 後続: ✅ score 閾値の CI 強制は実装・運用済み（上記）。以降はフル 100% 維持を前提に、緩めば
  CI が落ちる。新たな等価変異が出たときのみ `// Stryker disable` を追加する。
- 関連: [[0014-test-coverage-policy]], [[0013-coding-conventions-class-vs-function]]。
- **その後（2026-09-21・[RV-59][rv59]）**: 06-15 の「生存 0」は 08-09 には 96.84 まで緩んでいた
  （`break` 95 が許す幅で survivor が溜まり、レビューはそれを「同値」と読んでいた）。79 件を行ごとに
  分類すると 34 件は挙動・契約の穴だったので全件撃破し、同値 1 件だけを `// Stryker disable` で
  明示、`break` を **100** に上げた（`thresholds = 100/100/100`）。以降は survivor が 1 件でも
  CI が落ちる＝本決定の「撃破か明示か」を仕組みで強制する。経緯は [ADR README][readme] の
  「ADR を起こさずに決着した論点」。**翌日、PR の incremental run が上記の static 再利用で落ち、
  実行戦略を訂正した**（Decision Outcome の訂正・`.github/workflows/mutation.yml`）。
- **その後**: 「[ADR-0014][0014] と同様にバレル/型/**プレースホルダ**/テストを除外」のうち
  `stryker.config.json` の `!src/fields/**` は、`src/fields/` がプレースホルダでなくなったあとも残っていた。
  coverage 側と揃えて [RV-44][rv44] で外し、カスタム項目まわりも mutation の対象にした。

[0002]: 0002-ground-design-in-live-api-docs.md
[0013]: 0013-coding-conventions-class-vs-function.md
[0014]: 0014-test-coverage-policy.md
[rv44]: ../reviews/rv/0044-fields-excluded-from-coverage.md
[rv59]: ../reviews/rv/0059-tenant-fields-threading-unpinned.md
[readme]: README.md
[pr12]: https://github.com/Joymerrevent/porters-connect/pull/12
[pr13]: https://github.com/Joymerrevent/porters-connect/pull/13
[0028]: 0028-ci-path-filtering.md
[adr94]: 0094-mutation-changed-files-on-pr.md
