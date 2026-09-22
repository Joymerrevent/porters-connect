# 88. 使い方ドキュメントを「導入／主題別／リソース別／実践例／リファレンス」の 5 章に組み直す

- Status: accepted
- Date: 2026-09-22
- Deciders: jun.shiromoto (Joymerrevent)

> [ADR-0070][0070] は使い方ドキュメントを **形**（順に読む／目的別／考え方／引く）で 4 層に切った。
> V2 達成後に通しで読み直すと、目次も全体も読者の動線に合っていない（stakeholder・2026-09-22）。
> 本 ADR は章を **軸**（順に読む／主題／リソース）で切り直し、[ADR-0070][0070] の論点1（章立て）・
> 論点2（既存ページの行き先）・accept 時の「3. リソース別ページは作らない」と、[ADR-0072][0072] の
> 論点5（目次の節順）を supersede する。**[ADR-0071][0071]（`docs/usage/` の単一ルート）、
> [ADR-0072][0072] の入門 6 本、[ADR-0070][0070] の検査①〜⑤の考え方は維持する。**
>
> 起票前の議論（2026-09-22）で stakeholder が 3 点を選択済み: **リソース別は 18 本を 1:1** ／
> **実践例は 2 本で開始** ／ **「〜したい」は題名から外して目次の索引へ**。既存の本文は使うが、
> 新しい章立てに合わない箇所は書き直す。
>
> **decider が 5 論点すべて推奨案どおり選択し `accepted`（2026-09-22）**。実装は accept 後・別 PR
> （「実装の分け方」の 4 本を順に）。

## Context and Problem Statement

[ADR-0070][0070] は Jest と Next.js の構成（Getting Started / Guides / API Reference）を写して
4 層にした。どちらもフレームワークの文書で、独立した概念が多いから「考え方」と「手順」を
分ける意味がある。このライブラリは業務 API の薄いラッパーで、読者が持っている問いは
「認証は」「検索は」「Candidate は」のように**主題**か**リソース**で始まる。形で切った層に
その問いを当てると、答えが層をまたいで散る。

### 実測（2026-09-22）: 5 つのずれ

手書きは 20 本・4,644 行（`docs/usage/{start,howto,concepts}` と `reference/` の `wc -l`）。

**1. 目的別の本文が主題別になっている。** `howto/search-records.md`（406 行）の節は
`field` / `expand` / `condition` / `order` / `keywords` / `itemstate` / `count` と**引数ごと**、
`howto/handle-failures.md`（415 行）はエラーモデルの解説、`howto/custom-fields.md`（576 行）は
宣言 DSL・自動生成・突合・複数テナントまでを 1 本で抱える。題名だけ「〜したい」で、
本文は主題のリファレンスである。[ADR-0070][0070] が退けた「機能単位」に、題名だけ変えて戻っている。

**2. 同じ主題が層をまたいで割れている。**

| 主題                            | 置き場（出現箇所）                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| 初回の権限付与                  | `start/authenticate.md`（`authorizationUrl` 等 4 箇所）と `howto/authenticate.md`（9 箇所） |
| 削除済みの読み方（`itemstate`） | `concepts/no-delete.md`（7 箇所）と `howto/search-records.md`（12 箇所）                    |
| 新規作成の必須項目              | `start/first-write.md` と `concepts/limits.md`（「リソースごとの新規必須」節）              |
| Partition と `tenant(id)`       | `concepts/partition.md`・`howto/multi-tenant.md`・`start/first-read.md`                     |

読者は 1 つの主題で 2〜3 ページを往復する。

**3. リソース固有の知識に置き場が無い。** Phase と Attachment と Field の `of()`、Process の
重複制約（Result Code 301）、Option に `searchAll` が無いこと、User の `current()`、Sales の
参照 6 項目の依存は、**目次の表の備考欄**（6 行）と `concepts/limits.md` の「PORTERS に委ねるもの」節に
散っている。[ADR-0070][0070] が accept 時に「リソース別ページは作らない（機能単位の羅列に戻る）」と
決めた帰結で、置き場が無いから目次に漏れた。

**4. 目次が本文になっている。** `docs/usage/index.md` の「リソースと操作」は 38 行の表 2 つで、
目次ではなく内容である（3 の症状）。

**5. リファレンスが 2 箇所にある。** 生成物の `api/`（公開 API の全記号）と手書きの `reference/`
（PORTERS API の事実）が別の階層に並び、後者は「**ここだけで仕様が分かる**ことを目標」と
宣言しているため、ライブラリが隠している Write の XML 書式や OAuth の wire の細部まで載る。

### 残すもの

- **入門 6 本**（[ADR-0072][0072]）: 準備を先に、本物に繋がることを最初の成功にする並びは、読み直しても正しい。
- **検査①〜⑤の考え方**（[ADR-0070][0070] 論点4・追記）: 目次と実ファイルの 1:1／入門の鎖／公開記号が
  ガイドから辿れる／コード例がコンパイルする／引く層の各ページに出口がある。対象の階層を差し替えて使う。
- **本文 4,644 行**: 密度は足りている。[ADR-0070][0070] 案2c（全部書き直す）を退けた理由
  「腐敗を止めるのは書き直しでなく検査」はいまも正しい。
- **`docs/usage/` の単一ルート**（[ADR-0071][0071]）と、`api/`（[ADR-0068][0068]）・`reference/` の物理配置。

### 問い

**章をどの軸で切るか。既存の 20 本をどこへ移し、どこを書き直すか。検査をどう追随させるか。**

## Decision Drivers

- **読者は 1 人に絞る**: 契約済みで、PORTERS の画面は知っていて、Connect API は知らない TypeScript 開発者
  （[ADR-0072][0072] と同じ。CLAUDE.md の最優先目標＝多くの実利用者に使われること）
- **引く軸は 2 種類要る**: 主題とリソース。業務 API のラッパーは、リソースで引けないと引けない
- **1 主題 1 ページ**: 考え方・使い方・細かい規則を同じページに置き、往復させない
- **目次は目次**: 入口と索引だけを持ち、内容を持たない
- **既存の本文は資産**: 移して統合する。章立てに合わない箇所だけ書き直す（stakeholder・2026-09-22）
- **検査が空振りしない**（[ADR-0071][0071] の教訓: 移設そのものが、移設を検出すべき検査を無効化する）
- **サイト化のときに、そのまま sidebar になる**（[ADR-0070][0070] 論点5 の方針を引き継ぐ）
- 日本語ファースト（CLAUDE.md）

## Considered Options

### 論点1: 章の軸

- **案1a: 5 章 — 導入／主題別／リソース別／実践例／リファレンス**（推奨）

  ```text
  docs/usage/
    index.md       目次。5 章への入口と、「〜したい」から引く索引表だけ
    start/         導入。順に読む 6 本（今のまま）
    topics/        主題別。1 主題 1 ページ。concepts/ と howto/ を統合（10 本）
    resources/     リソース別。一覧表 ＋ 1 リソース 1 ページ（18 本）。新設
    recipes/       実践例。用途に沿って組み立てる（2 本で開始）。新設
    reference/     PORTERS API の事実・用語集・落とし穴・トラブルシューティング（既存 ＋ 1）
    api/           公開 API の全記号（生成物・そのまま）
  ```

  `reference/` と `api/` は物理的に動かさず、目次の「リファレンス」章に 2 つ並べる。`api/` を動かすと
  TypeDoc の出力先・`check:api`・`check:mentions`・`check:links`・markdownlint の除外・`check:usage` の
  定数 6 箇所が動き、得るものは目次の見た目だけ。

- **案1b: 4 層を維持し、リソース別だけ足す。** 置き場の問題（ずれ 3・4）は解けるが、主題の分裂
  （ずれ 1・2）は残る。
- **案1c: 現状維持で目次の表だけ薄くする。** 最小。ずれ 1〜3 が全部残る。

### 論点2: リソース別ページの本数

- **案2a: 18 本を 1:1**（推奨・stakeholder 選択）。`TenantScope` の 17 アクセサ ＋ client 直下の `partition`。
  固有の事情が無いリソースは短いページになるが、**引く軸としては「あるかどうか分からない」より
  「必ずある」が強い**。18 ↔ 18 の両方向突合が検査にできる（D4 と同じ形）。
- **案2b: 固有の事情がある 7 本だけ**（Process / Phase / Attachment / Partition / User / Field / Option）。
  残り 11 本は一覧表の行で済ませる。書く量は減るが、Candidate を引いた読者がページに辿り着けない。
  「固有の事情」の境界も人の判断で、検査にできない。

### 論点3: 実践例の章

- **案3a: 2 本で開始する**（推奨・stakeholder 選択）。毎日の差分同期（`howto/sync-batch.md` を移す）と、
  複数テナントを 1 プロセスで扱う SaaS の組み立て（`howto/multi-tenant.md` の後半 ＋
  `howto/custom-fields.md` の「宣言したスコープを関数に渡す」節を寄せる）。
  Web フォームからの取り込み・BI へのエクスポートなど、増える見込みがある。
- **案3b: 章を置かない**。同期を主題別に、複数テナントを `topics/tenant.md` に溶かす。
  章が 1 つ減るが、「用途に沿った組み立て」は主題ページの形（まず知ること → 使い方 → 規則）に
  収まらない。溶かすと主題ページが長くなり、ずれ 1 を作り直す。

### 論点4: ページの題名

- **案4a: 名詞の題名にし、「〜したい」は目次の索引表に降ろす**（推奨・stakeholder 選択）。
  一覧で目に入るのは名詞で、「〜したい」は文で読まないと分からない。[ADR-0070][0070] が
  目的別を採った狙い（目的から引ける）は、目次に「〜したい → ページの節」の表を置いて残す。
  索引表の行き先は節のアンカーまで指し、`check:links` が見出しの実在を見る。
- **案4b: 「〜したい」の題名を維持**。#376 で揃えたばかりだが、本文が主題別である以上、題名が本文と合わない。

### 論点5: 検査の追随

- **案5a: 定数の差し替え ＋ 番人 ＋ リソース別の両方向突合を新設**（推奨）。

  | 検査                                                                      | いま                                     | 変更                                                                                                       |
  | ------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
  | ① 目次と実ファイルの 1:1（`check-doc-index.mjs` の `USER_DOC_DIRS`）      | `start` / `concepts` / `howto`           | `start` / `topics` / `resources` / `recipes`                                                               |
  | ② 入門の鎖（`START_DIR`）                                                 | `docs/usage/start`                       | 変更なし                                                                                                   |
  | ③ 公開記号がガイドから辿れる（`check-api-mentions.mjs` の `GUIDE_GLOBS`） | `start` / `howto`                        | `start` / `topics` / `resources` / `recipes`                                                               |
  | ④ コード例の型検査（`check-doc-examples.mjs` の `MARKDOWN_ROOTS`）        | `index` / `start` / `concepts` / `howto` | `index` / `start` / `topics` / `resources` / `recipes`                                                     |
  | ⑤ 引く層の出口（`HOWTO_DIR`）                                             | `howto` だけ                             | `topics` / `resources` / `recipes` の 3 階層                                                               |
  | **⑥ リソース別 ↔ アクセサ**（新設）                                       | —                                        | `TenantScope` の 17 アクセサ ＋ `partition` と `resources/*.md` の**両方向**突合。片方にしか無ければ落ちる |

  番人（[ADR-0071][0071] 論点2）は各階層に 1 本以上の実在を要求する形のまま、階層名だけ差し替える。

- **案5b: 定数の差し替えだけ**。安いが、リソース別ページの追加漏れ（アクセサを足したのにページが無い）を
  誰も止めない。今回まさに「置き場が無い」から目次に漏れたので、置き場を作るなら漏れの検査も一緒に置く。

## Decision Outcome

採用: **論点1=案1a ／ 論点2=案2a ／ 論点3=案3a ／ 論点4=案4a ／ 論点5=案5a**。
論点2〜4 は起票前の議論で stakeholder が推奨案どおり選択した（2026-09-22）。

選んだ理由:

- **軸を形から主題・リソースに変えると、ずれ 1〜4 が同時に消える**（案1a）。主題ページは
  「考え方」と「手順」を 1 本に持つので分裂が消え、リソース別が備考欄の行き先になるので目次が目次に戻る。
- **リソースは「必ずある」ページにする**（案2a）。引く軸の価値は網羅にあり、境界を人が判断する形は
  検査にならない。
- **用途に沿った組み立ては別の章に置く**（案3a）。主題ページに溶かすとずれ 1 を作り直す。
- **題名は名詞、目的は索引で**（案4a）。両方の引き方を残しつつ、題名と本文の食い違いを消す。
- **置き場を作るなら漏れの検査も置く**（案5a）。D1〜D5・V1 と同じ「両方向の突合」の形。

### 各章の役割と、ページの型

**導入（`start/`）**: 変更なし。`going-live.md` の「次に読む」の出口だけ、主題別とリソース別に向け直す。

**主題別（`topics/`）**: ~~10 本~~ 11 本（下の訂正）。各ページは **まず知ること（PORTERS 側の前提）→ 使い方 → 細かい規則** の順で書き、
末尾に `## 関連`（検査⑤）。

| ページ             | 主題                         | 素材                                                                                                       |
| ------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `auth.md`          | 認証とトークン               | `howto/authenticate.md` 全体 ＋ `start/authenticate.md` と重複する初回付与の説明を 1 本に                  |
| `tenant.md`        | Partition とテナントスコープ | `concepts/partition.md` ＋ `howto/multi-tenant.md` の §1〜§2（`tenant(id)` の使い分け）                    |
| `query.md`         | 検索                         | `howto/search-records.md`（`itemstate` の節は `deleted.md` へ）                                            |
| `write.md`         | 書き込み                     | `start/first-write.md` の「かたちが変わる」＋ `howto/bulk-write.md` ＋ `concepts/limits.md` の「新規必須」 |
| `custom-fields.md` | カスタム項目                 | `howto/custom-fields.md`（「宣言したスコープを関数に渡す」は `recipes/multi-tenant.md` へ）                |
| `errors.md`        | エラーと再試行               | `howto/handle-failures.md`（「症状 → 原因 → 対処」表は `reference/troubleshooting.md` へ）                 |
| `limits.md`        | 上限とレート                 | `concepts/limits.md`（「新規必須」は `write.md` へ・Sales / Process の固有事情は `resources/` へ）         |
| `datetime.md`      | 日時と時分型                 | `concepts/datetime.md`                                                                                     |
| `deleted.md`       | 削除と削除済みデータ         | `concepts/no-delete.md` ＋ `howto/search-records.md` の `itemstate` 節                                     |
| `testing.md`       | 契約なしでテストする         | `howto/test-without-contract.md`                                                                           |

**訂正（実装時 2026-09-22）**: 上の表は `concepts/aliases.md`（alias と Data Type）を漏らしていた。
主題別は ~~10 本~~ **11 本**で、`fields.md`（項目と値の形）として置く。決定そのもの（5 章の軸・
1 主題 1 ページ）は変わらない。

**リソース別（`resources/`）**: `README.md`（アクセサ × メソッドの一覧表。今 `index.md` にある 2 表の行き先）＋ 18 本。
各ページは同じ節構成にする（検査⑥で節の実在まで見るかは実装時に決める）:

```text
# Candidate（個人連絡先）
画面名（Agent / Staffing）・アクセサ・スコープ
## 呼べるメソッド        search / searchAll / get / create / update / createMany / updateMany の有無
## 固有の注意            of() で束ねる・重複制約・一括なし・current() など。無ければ「特に無し」
## 新規作成の必須項目
## 項目と型              reference の項目表 ／ api の型（Candidate・CandidateCreateInput …）へのリンク
## 関連
```

素材は `index.md` の備考欄・`concepts/limits.md` の固有事情・`howto/attachments.md`（→ `resources/attachment.md`）・
`reference/glossary.md` の画面名対応表・`reference/resource-api/resources/*.md`。
**PORTERS の項目表（`reference/resource-api/resources/*.md`）はそのまま残す** —
`test/integration/reference-catalog.test.ts` が読む突合の入力であり、リソース別ページはそこへリンクする。

**実践例（`recipes/`）**: 2 本。用途 → 使う機能 → 組み立て → ライブラリの外（利用側の責務）の順で書く。

| ページ            | 素材                                                                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sync-batch.md`   | `howto/sync-batch.md`                                                                                                                                                   |
| `multi-tenant.md` | `howto/multi-tenant.md` の §3 以降（認証の分離・オンボーディング）＋ `howto/custom-fields.md` の「宣言したスコープを関数に渡す」＋ スロットルの共有（`createThrottle`） |

**リファレンス**: `api/`（生成物）と `reference/`（PORTERS の事実）を目次の 1 章に並べる。`reference/README.md` の
「ここだけで仕様が分かる」を「**このライブラリを使ううえで必要な PORTERS 側の事実**」に改め、ライブラリが
隠すもの（Write の XML 書式・OAuth の wire）は残しても目標にしない。`reference/troubleshooting.md` を新設
（症状 → 原因 → 対処の早見表を `errors.md` から切り出す）。

**目次（`index.md`）**: 全面的に書き直す。持つのは 5 章の表と「目的から探す」索引表（〜したい → ページの節）だけ。

### 書き直す箇所

「既存の本文を使う」の範囲を明示する。

- **新規に書く**: `index.md` ／ `resources/README.md` と 18 本 ／ `reference/troubleshooting.md` ／
  各主題ページの冒頭「まず知ること」節（考え方ページの要点を吸収する部分）
- **統合して書き直す**: `topics/auth.md`・`tenant.md`・`write.md`・`deleted.md`・`limits.md`（2 本以上を寄せるもの）／
  `recipes/multi-tenant.md`
- **移して手直し**: `topics/query.md`・`custom-fields.md`・`errors.md`・`datetime.md`・`testing.md` ／ `recipes/sync-batch.md`
  （題名を名詞に・冒頭節を足す・移した節を抜く・`## 関連` の行き先）
- **触らない**: `start/` の本文（導線の文言だけ）・`reference/`（README の目標の 1 文以外）・`api/`（生成物）

### 影響範囲（2026-09-22 実測）

`docs/usage/(start|howto|concepts)` へのリンクは `docs/usage/` の外に **README 8・CHANGELOG 8・roadmap 3・
`docs/design/` 7・ADR 30 本・RV 15 本・スクリプト 3 本・`src/resources/sales.ts` の JSDoc 2**。
`start/` は動かさないので実際に直すのは `howto` / `concepts` を指すものだけ。Markdown 側は `check:links` が
全件止める。JSDoc の 2 箇所は `docs:api` の再生成で `api/type-aliases/SalesCreateInput.md` に出るので
`check:api` が止める。ADR の本文は決定の文面を書き換えない運用（[README][adr-readme]）なのでリンク定義だけ直す。

### 実装の分け方

accept 後・別 PR（[ADR-0001][0001]）。同じ docs を触る変更を無理に分割しない（積んだ PR は squash で毎回衝突する）
ので、**順に 1 本ずつ**出す:

1. **階層と検査**: `topics/` `resources/` `recipes/` の新設と検査①③④⑤の定数差し替え・番人・~~検査⑥~~。
   この PR では既存ページを**移すだけ**（`git mv`）で本文は触らない ＝ 検査が新しい階層で通る状態を先に作る
2. **リソース別**: `resources/README.md` と 18 本を書く。`index.md` の表を消す。検査⑥もここ（下の訂正）
3. **主題別と実践例**: 統合・書き直し（上記「書き直す箇所」）。~~`concepts/` が消える~~（下の訂正）
4. **目次と README**: `index.md` の全面書き直し・README の「ドキュメント」節（4 層 → 5 章）・
   `docs/README.md`・`reference/README.md` の目標の 1 文

1 で移す先が決まるので、2〜4 のリンクの張り替えは 1 度で済む。

**訂正（実装時 2026-09-22）**: 検査⑥は 1 でなく **2（リソース別 18 本と同じ PR）** に入れる。1 の時点では
`resources/` に `attachment.md` しか無く、⑥ を入れると 17 本の欠落で赤のままマージすることになるため。
また `concepts/` は 3 でなく **1 の `git mv` で消える**（考え方 5 本もそこで `topics/` へ移す）。
分け方の順序と、検査⑥を新設する決定は変わらない。

**訂正（実装時 2026-09-22・stakeholder）**: ~~別 PR 4 本を順に~~ **1 本の PR に、修正ごとのコミットで 1〜4 の順に積む**
（[#378][pr378]）。分けた理由は「積んだ PR は squash で毎回衝突する」だったが、1 本の PR なら衝突そのものが無く、
develop に「目次は旧 4 層のまま `topics/` を指す」ような途中の状態を置かずに済む。レビューはコミット単位で追える。
分け方の順序・各段の中身・検査⑥は変わらない。

### Consequences

- **Good**: 主題で引いても、リソースで引いても、1 ページで答えが出る。目次が目次に戻る。
  リソース固有の知識に置き場ができ、漏れは検査⑥が止める。サイト化のとき 5 章がそのまま sidebar になる。
- **Bad**: 手書きのページが 20 → 約 39 本に増える（導入 6・主題 ~~10~~ 11・リソース 19・実践 2・troubleshooting 1）。
  リンクの張り替えが広い（上記）。`concepts/` と `howto/` という名前が消えるので、外部から張られた
  リンクがあれば切れる（npm の README は publish 時の内容なので、次の版まで旧パスを指す）。
  リソース別 18 本のうち固有の事情が無いものは短く、書く価値を疑われる。
- **Neutral**: [ADR-0070][0070] 論点1・論点2・accept 時の 3 と [ADR-0072][0072] 論点5 を supersede する。
  [ADR-0071][0071]、入門 6 本、検査①〜⑤の考え方は不変。英語版・サイト化は引き続き別 ADR。
  [roadmap][rm] の V2 は、達成の定義（4 層）を本 ADR の 5 章に読み替える。

## 信じている入力

該当なし — 本決定は**自分たちが書く文章の並べ方**の話で、外部 API・LLM・第三者が書ける文書からの
入力を受け取らない。検査⑥の入力は `src/client.ts` の `TenantScope` と `docs/usage/resources/*.md` で、
どちらも同一リポジトリにあり CI で突合できる。

## Pros and Cons of the Options

### 案1a（5 章）

- Good: 主題とリソースの両方で引ける。考え方と手順の分裂が消える。目次が目次に戻る。
- Bad: ページ数が約 2 倍になる。`concepts/` と `howto/` が消えるのでリンクの張り替えが広い。

### 案1b（4 層 ＋ リソース別）

- Good: 既存の階層を触らないので安い。ずれ 3・4 は解ける。
- Bad: ずれ 1・2（本文が主題別・主題が層をまたぐ）が残る。層が 5 つになり、説明が増える。

### 案1c（目次の表だけ薄くする）

- Good: 一日で終わる。
- Bad: 今回の不満（層の切り方）が全部残る。

### 案2a（18 本 1:1）

- Good: 引けば必ずある。両方向の突合が検査にできる。
- Bad: 固有の事情が無いページが短い。

### 案2b（7 本だけ）

- Good: 書く量が 4 割で済む。
- Bad: 11 リソースはページが無い。「固有の事情」の境界を人が決めるので検査にならない。

### 案3a（実践例 2 本で開始）

- Good: 用途に沿った組み立てが主題ページを膨らませない。増やす場所ができる。
- Bad: 2 本の章は薄く見える。

### 案3b（章を置かない）

- Good: 章が 1 つ少ない。
- Bad: 主題ページに用途の話が混ざり、ずれ 1 を作り直す。

### 案4a（名詞の題名 ＋ 目次の索引）

- Good: 一覧で読める。目的からの引き方も残る。題名と本文が合う。
- Bad: 索引表は目次の手書き部分で、節を動かすと直す箇所が 1 つ増える（`check:links` がアンカーで止める）。

### 案4b（「〜したい」を維持）

- Good: 変更なし。
- Bad: 本文が主題別なので題名が嘘になる。

### 案5a（定数 ＋ 番人 ＋ 検査⑥）

- Good: リソース別の追加漏れを機械が止める。
- Bad: スクリプトを 1 本足す。

### 案5b（定数だけ）

- Good: 安い。
- Bad: アクセサを足してページを忘れても誰も気づかない。

## More Information

- **supersede**: [ADR-0070][0070] 論点1（4 層）・論点2（既存 7 本の行き先）・accept 時「3. リソース別ページは作らない」／
  [ADR-0072][0072] 論点5（目次の節順）。0070 の論点3（README を入口に絞る）・論点4（検査で完成を測る）・
  論点5（frontmatter を入れない）・論点6（英語は別 ADR）と、0072 の論点1〜4・6 は引き継ぐ。
- **維持**: [ADR-0071][0071]（単一ルート・番人）／ [ADR-0068][0068]（`api/` の生成）。
- 経緯: V2 は [roadmap][rm] で達成済み。本 ADR は達成した原稿の並べ方を変える。
- follow-up（スコープ外）: 説明サイトの構築（generator）／ 英語版。

[0001]: 0001-record-architecture-decisions.md
[0068]: 0068-api-reference-tooling.md
[0070]: 0070-usage-documentation-architecture.md
[0071]: 0071-usage-docs-single-root.md
[0072]: 0072-start-contract-first.md
[adr-readme]: README.md
[rm]: ../roadmap.md
[pr378]: https://github.com/Joymerrevent/porters-connect/pull/378
