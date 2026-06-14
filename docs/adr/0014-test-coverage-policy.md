# 14. テストカバレッジ方針（計測・閾値・CI 強制）

- Status: accepted
- Date: 2026-06-14
- Deciders: jun.shiromoto (Joymerrevent)

> PoC（OAuth + Candidate Read）マージ後、UT は 44 件あるが**カバレッジ計測も閾値も未設定**。
> 「壊れたら安全側に倒す」フェイルセーフを担保するため、計測と回帰ゲートを決める。`accepted`（2026-06-14）：
> 全ロジック網羅＋v8＋`vitest.config.ts`＋CI 強制で確定。

## Context and Problem Statement

`@vitest/coverage-v8` 未導入・vitest 設定ファイル無し・CI は `pnpm test` のみ（`coverage/` は .gitignore 済み）。
**どの水準のカバレッジを・どう測り・CI でどう強制するか**を決める。利用者の意向は
「**すべてのロジックを通す**」。ただし 100% 強制は無意味テスト/過剰モックを誘発し得るトレードオフがある。

## Decision Drivers

- **フェイルセーフ**：全ロジックを実際に通し、壊れたら CI で止める。
- **公認に値する品質**：回帰防止・サポート負荷を増やさない。
- **薄く堅く**：軽量な計測（v8）・設定の複雑化を避ける。
- **意味のあるテスト**：数値合わせの空テストを誘発しない（fixture 駆動＋実 assertion）。
- **契約なしで測れる**：mock + XML fixture（[ADR-0002][0002]）。

## Considered Options

- **水準**: 計測のみ（enforce 無し）／ 80%・branches 70%＋ratchet ／ 90% ／ **全ロジック網羅**（statements/functions/lines=100%・branches は高め）
- **provider**: v8（軽量・推奨）／ istanbul
- **設定形式**: `vitest.config.ts`（型付き・選択済み）
- **強制場所**: `test:coverage` を CI で実行し PR をブロック

## Decision Outcome

**提案（推奨）: 全ロジック網羅 ＋ v8 ＋ `vitest.config.ts` ＋ CI 強制**。

- **閾値**: `statements / functions / lines = 100%`、`branches = 高め`（実測で 100% が非現実的な分岐のみ
  実測直下に調整し理由を記録）。**真に到達不能な防御コードのみ** `/* v8 ignore next */`＋理由で限定除外（乱用しない）。
- **計測対象（include）**: `src/**/*.ts`。**除外**: バレル `src/**/index.ts`／型のみ `src/**/types.ts`・`src/types/**`／
  プレースホルダ `src/fields/**`／テスト `**/*.test.ts`（＝ロジックを持つ実ファイルだけを対象）。
- **provider**: `v8`（軽量・追加依存が小さい）。
- **CI**: `test:coverage` を実行し、閾値割れで PR を落とす。`coverage/`（html/lcov）はコミットしない。

### Consequences

- Good: 全ロジックが実行され回帰を機械的に止める＝フェイルセーフ。可視化で穴が分かる。
- Bad: 100% は「数合わせテスト」を誘発し得る → **fixture 駆動＋意味のある assertion** を規約で担保。
  初期に穴埋めコスト（decode 追加型・token-provider 端・errors 等）。
- Neutral: `vitest.config.ts`（root .ts）は eslint の `allowDefaultProject` で型プロジェクト外のまま lint する。

## Pros and Cons of the Options

### 水準

- 計測のみ: Good 導入即・摩擦なし。Bad 回帰を止められない。
- 80%＋ratchet: Good 現実的・段階的。Bad 「通っていないロジック」を許容＝フェイルセーフに穴。
- 90%: Good 高品質。Bad 端数の攻防が曖昧。
- **全ロジック網羅（採用提案）**: Good 穴ゼロ・哲学一致。Bad 無意味テスト誘発リスク（assertion 品質で対処）。

### provider

- v8（採用提案）: Good 軽量・高速・追加依存小。Bad 稀に行マッピングが粗いことがある。
- istanbul: Good 精緻。Bad 追加 instrument コスト。

## More Information

- 前提/依存: [ADR-0002][0002]（mock+fixture で測れる）、[ADR-0013][0013]（テスト方針・規約）、[requirements][prd]（公認品質）。
- 反映（accepted 後）: `@vitest/coverage-v8` 追加・`vitest.config.ts`・`package.json`（`test:coverage`）・
  `ci.yml`（Test を coverage 実行に）・不足テスト穴埋め。必要なら CLAUDE.md に一行。
- 業界動向: 多くは 70–85% を enforce／**100% は小さく純粋なライブラリで一般的**（本ライブラリは該当）。
  行カバレッジは「実行」を測り「正しさ」は測らないため（Fowler の警鐘＝coverage theater）、**fixture 駆動＋
  意味のある assertion** で担保し、将来 **mutation testing（Stryker）** で補強しうる。大規模では
  diff/patch coverage＋ratchet が主流だが、本ライブラリの性質では全ロジック網羅が適切。
- 関連: [[0002-ground-design-in-live-api-docs]], [[0013-coding-conventions-class-vs-function]]。

[prd]: ../design/requirements.md
[0002]: 0002-ground-design-in-live-api-docs.md
[0013]: 0013-coding-conventions-class-vs-function.md
