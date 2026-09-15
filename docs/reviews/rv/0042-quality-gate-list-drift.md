# RV-42 🟢 品質ゲートの一覧が 4 箇所に分散して腐る

- 重要度: 🟢 ／ 観点: プロセス / DX
- 状態: fixed

## 概要

「手元で回すべき品質ゲート」の一覧が 4 箇所に写されていて、**どれも実際の CI より少ない**。
`CONTRIBUTING.md` どおりに確認して出した貢献者が、**存在を知らないゲートで CI に落とされる**。
このブランチが消そうとした「手元は緑・CI で赤」と同じ形が、別の層に残っている。

## 根拠

実測（2026-09-12）。**この台帳エントリ群を除けば**、`pnpm check:links` を挙げている文書は
**0 件**だった（本エントリ自身がゲートの一覧表を持つので、素朴に grep すると当然ヒットする）。

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

**一本化した**（2026-09-15）。推奨どおり pattern script で束ねた。

```json
"check": "pnpm run \"/^check:(?!publish$)[^:]+$/\""
```

`check:publish` は**束ねない** — `dist` を見るので build 前だと「ファイルが無い」で落ちる
だけで検査にならず、古い `dist` が残っていれば逆に**嘘の緑**になる。build の後に別で回す
（順序は実測して決めた。下記「検証」）。

そのうえで**一覧を持っていた 4 箇所すべてから列挙を消した**:

| 場所                                             | どうしたか                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`                       | 個別 7 ステップ → `pnpm check` の 1 ステップ                                 |
| `CONTRIBUTING.md`                                | 5 ゲートの列挙 → `pnpm check` の 1 行 ＋ CI が足すもの（shellcheck / audit） |
| `.claude/skills/project-review/scripts/gates.sh` | `check` と `check:publish` を追加（個別の `check:*` は並べない）             |
| `.claude/skills/change-review/SKILL.md`          | 個別 `check:*` の列挙 → `pnpm check`                                         |

**CI も置き換えた**のが台帳の推奨から踏み込んだ点。列挙を CI 側に残すと、今度は
「`pnpm check` にあるのに CI では走らない」という**逆向きのズレ**が起きる（`check:docs` /
`check:links` / `check:api` が各所の一覧から漏れていたのと同じ形）。個別ステップの
値打ちだった「どのゲートで落ちたかが一覧で分かる」は失うが、束ねると**全部走ってから
まとめて赤くなる**ので往復は減る。各検査の「なぜ常時実行か」はステップのコメントに残した。

`CONTRIBUTING.md` にはゲートの**件数も書かない**（増えたときに数字だけ古くなる）。
なお本エントリの一覧表は**当時の事実の記録**なので残してある（現在の一覧ではない）。

## 検証

**束ねが効くこと**（2026-09-15 実測）: `pnpm check` は 7 本（`check:release` / `check:index` /
`check:docs` / `check:links` / `check:mentions` / `check:api` / `check:shell`）を**並列**で回して
1.5 秒。壊れリンクを 1 本仕込むとバンドルの終了コードは **1**（1 本落ちれば赤になる）。

**`check:publish` を束ねない理由の裏取り**: `dist` を退避して回すと
`pkg.main is ./dist/index.js but the file does not exist` で終了コード **1**。
＝build 前に回しても検査にならない。

**ゲート全体**: `bash .claude/skills/project-review/scripts/gates.sh` で
**8 ゲートすべて pass**（1011 tests・coverage 100%／branch 99.05%）。
