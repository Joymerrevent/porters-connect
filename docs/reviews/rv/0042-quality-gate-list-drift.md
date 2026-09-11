# RV-42 🟢 品質ゲートの一覧が 4 箇所に分散して腐る

- 重要度: 🟢 ／ 観点: プロセス / DX
- 状態: open

## 概要

「手元で回すべき品質ゲート」の一覧が 4 箇所に写されていて、**どれも実際の CI より少ない**。
`CONTRIBUTING.md` どおりに確認して出した貢献者が、**存在を知らないゲートで CI に落とされる**。
このブランチが消そうとした「手元は緑・CI で赤」と同じ形が、別の層に残っている。

## 根拠

実測（2026-09-12）。`pnpm check:links` を挙げている文書は **0 件**だった。

| 場所                                             | 挙げているゲート                                                                                                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`（**事実**）           | format:check / lint / check:release / check:index / check:links / check:docs / check:api / check:shell / shellcheck ＋ typecheck / test / build / check:publish / audit |
| `CONTRIBUTING.md:34`                             | typecheck / lint / format:check / test / build（「CI でも同じゲートが走ります」と書く）                                                                                 |
| `.claude/skills/project-review/SKILL.md:8`       | typecheck / lint / test / coverage / build                                                                                                                              |
| `.claude/skills/project-review/scripts/gates.sh` | typecheck / lint:ts / lint:md / format:check / test:coverage / build                                                                                                    |
| `.claude/skills/change-review/SKILL.md:153`      | 上記 ＋ check:shell / check:index / check:release / check:publish（links / docs / api が無い）                                                                          |

`check:links` は新しいので全部から漏れているが、**`check:docs` と `check:api` も同様に漏れている**
（それぞれ #257 / #254 で追加）。つまり単発の書き忘れではなく、**一覧を写す形そのものが腐る**。

## 影響

**小さい。** CI が本当のゲートなので、漏れても品質は落ちない。落ちるのは往復回数と、
`CONTRIBUTING.md` の「CI でも同じゲートが走ります」という記述の正しさ。
コラボレーター限定のリポジトリなので影響範囲は狭い。

## 検出経緯

change-review 2 巡目（2026-09-12）。1 巡目では「`gates.sh` に `check:links` が無い」とだけ
記録して掘らなかった（**取りこぼし**）。2 巡目で全 md を洗って、4 箇所すべてが古いと分かった。

## 推奨

**一覧を増やさず、一本化する。** このリポジトリは既に
`lint: pnpm run "/^lint:(?!fix$)[^:]+$/"` という pattern script を使っているので、
同じ形で `check` を足せば列挙が 1 箇所に減る:

```json
"check": "pnpm run \"/^check:[^:]+$/\""
```

そのうえで文書からは列挙を消し、`pnpm check` と書く。

この形が効くことは実測済み（2026-09-12、`pnpm run "/^check:(links|index)$/"` で 2 本が走った）。
束ねると走るのは **7 本** — `check:publish` / `check:release` / `check:index` / `check:docs` /
`check:links` / `check:api` / `check:shell`。ただし **`check:publish` は `build` 済みを前提にする**
ので、束ねる順序（または `check:publish` を別扱いにするか）は実測して決めること。

## 処置

**止めどきの規則により見送り**（`.claude/skills/change-review/SKILL.md` §7）。
`package.json` のスクリプトを足す変更は CI の形に触るので、
`docs/concepts-pages`（ドキュメントの PR）に混ぜずに独立して行う。
