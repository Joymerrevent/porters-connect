# RV-37 🟡 Field Read が Process を選べず、同じ事実の対応表が 2 つに割れている

- 重要度: 🟡 ／ 観点: API 忠実性 / 機能網羅
- 状態: fixed

## 概要

Field Read（`/v1/field`）は `resource` に Resource List の Value を渡して、そのリソースの項目一覧を取る。
ライブラリはこの対応表を **`src/resources/field.ts` の `RESOURCE_VALUE`（10 件）** に持っているが、
**Process（Value 7）が抜けている**。そのため `t.field.search({ resource: "process" })` は
型エラーになり、**Process のカスタム項目をライブラリから調べる手段が無い**。

さらに悪いことに、**同じ事実の対応表がもう 1 つある**。`src/resources/resource-list.ts` の
`RESOURCE_VALUES`（11 件）は Process を含んでいて正しい。同じ PORTERS の 1 枚の表が、
`src/` の中で 2 つに割れて、片方だけ欠けている。

## 根拠

- **reference は Process = 7 を明記**している。`docs/reference/resource-api/resources-list.md`
  のデータ系テーブルに `| Process | /v1/process | 7 | process_r / process_w | Process | … |` の行があり、
  Process の **Field List 記事へのリンクも存在する**（`[process-field]: …/115008016727`）。
  Value 欄が `—` なのは **Phase と Attachment だけ**。
- **欠けている側**（`src/resources/field.ts:24`）:

  ```ts
  export const RESOURCE_VALUE = {
    candidate: 1,
    job: 3,
    client: 5,
    recruiter: 9,
    sales: 11,
    contract: 13,
    resume: 17,
    activity: 19,
    opportunity: 25,
    contact: 27,
  } as const; // ← process: 7 が無い（10 件）
  ```

  直前のコメントは **「Master/Phase/Attachment have no Value, so only the R/W data resources are
  selectable here.」**と書いており、**コード自身の説明と実物が食い違っている**
  （Process は R/W データリソースであり、Value を持つ）。書き落としであって判断ではない。

- **揃っている側**（`src/resources/resource-list.ts:27`）は `PROCESS_DESCRIPTOR.path` を含む 11 件で、
  `src/resources/resource-list.test.ts` には**「Value を持つリソースを全部覆い、それ以外は含まない」**という
  網羅テストがある（Phase / Attachment を除外する根拠つき）。`field.ts` 側には**この網羅テストが無い**。
  だから片方だけ静かにずれた。
- [ADR-0022][adr22] D2 は「`ResourceType`（Field 用）は [resources-list][res-list] の Value
  （Candidate=1/Job=3/Client=5/…）に対応する名前付き型」と決めている。**reference の表に対応する**のが
  決定なので、10 件しか無い現状は決定に反している。
- 時系列: `RESOURCE_VALUE`（field.ts）は ADR-0022 期のもの、`RESOURCE_VALUES`（resource-list.ts）は
  Phase の `of()` を作った [ADR-0061][adr61] 期に**後から**作られた。後発の側が正しく、
  **先発の側が取り残された**形。

## 影響

- **機能の穴**: Process のカスタム項目（`U_` / `A_`）をライブラリ経由で列挙できない。
  Process は MVP のリソースで、`defineFields` も `process` のカスタム項目を**受け付ける**
  （`CustomFieldResource` は 11 件で process を含む）。つまり
  **「宣言はできるが、実物を確かめる手段だけ無い」**という非対称になっている。
- **`1.0.0` の V1 に直撃する**: V1 は「API エンドポイント × 機能」を reference と**両方向**で突合し、
  非対応セルには ADR 番号を要求する条件（[roadmap][rm]）。本件は
  **ADR の根拠が無い非対応セル**であり、マトリクスを作れば必ず引っかかる。
- **同じ事実の二重管理**が残り続ける。片方を直しても、次に PORTERS が Value を足したときに
  また片方だけ更新される形は変わらない。
- 実害の大きさとしては、Process のカスタム項目を使うテナントで
  「項目を調べるだけ別手段（画面や手作業）が要る」に留まる。データは壊れない。

## 検出経緯

ロードマップの案D（`defineFields` 深掘り）の設計にあたって、**テナント突合・宣言生成は
Field Read を土台にする**ので「`defineFields` が受け付けるリソース（11 件）と Field Read で
読めるリソースは一致するか」を突き合わせたところ、**Process だけ一致しない**と分かった。
続けて `src/` を検索して、同じ対応表が 2 つあること・後発の側は正しいことを確認した。

## 推奨

**(a) を推奨**する。

### (a) 対応表を 1 つにする（推奨）

`field.ts` の `RESOURCE_VALUE` を消し、`resource-list.ts` の `RESOURCE_VALUES` を唯一の正典にする。
`ResourceType` は `ResourceName` から導出するか、そのまま使う。

- **Process が自動的に入る**（表が 1 つなので欠けようがない）。
- `resource-list.test.ts` の網羅テストが**両方の用途を同時に守る**ことになる。
- 影響範囲は小さい: `RESOURCE_VALUE` の参照は `field.ts` 内 2 箇所・`field.test.ts` 1 箇所・
  `test/fake/master-read.ts` 1 箇所だけ。
- ただし `RESOURCE_VALUE` は**公開型 `ResourceType` の裏**にあり（`src/index.ts:211` で
  `ResourceType` を export 済み）、`process` が増えるのは**公開型の拡張**にあたる。
  取り除く方向ではないので破壊的ではないが、CHANGELOG には出る。
- フェイクの Field Read（`test/fake/master-read.ts:161`）は Value → path の逆引きをしているので、
  Process の descriptor が引ければそのまま動く（`ctx.resources` に Process は入っている）。

### (b) `field.ts` に `process: 7` を足すだけ

最小の修正。穴は塞がるが、**表が 2 つある構造は残る**ので、次の追加でまた割れる。
(a) の下ごしらえとしてなら妥当。

### (c) 「Process は Field Read の対象外」と決めて ADR に書く — ✗ 根拠が無い

reference が Value 7 と Field List 記事の両方を持っている以上、非対応にする根拠が無い。
V1 の「非対応セルは ADR 番号必須」を満たせない。

---

いずれの案でも、**`field.ts` 側にも網羅テストを置く**こと（`resource-list.test.ts` と同じ形）。
今回ずれた直接の原因は、片方にだけ「全部覆っているか」を聞く検査が無かったことにある。

なお **Value を送れること自体は未確認**（契約前なので当然）で、
Process の Field Read が実際に応答するかは実機で確かめる必要がある。ただしこれは
**既に `RESOURCE_VALUES` 経由で `t.phase.of("process")` が同じ Value 7 を送っている**のと
同じ信頼度であり、本件のために新しい仮定を増やすわけではない。

## 処置

**(a) を実施**（2026-09-10）。方針は [ADR-0069][adr69] の論点6＝案6a で決まっていた
（「RV-37 を先に直し、**対応表を 1 つに統合してから**本 ADR を実装する」）。

- **`field.ts` の `RESOURCE_VALUE` を削除**し、`resource-list.ts` の `RESOURCE_VALUES` を
  唯一の正典にした。公開型 `ResourceType` は `ResourceName` の**別名**にしてある
  （同じ集合を指すので、2 つ目の表を作らない）。名前を 2 つ残したのは、使用箇所ごとに
  役割が読めるほうがよいため（`ResourceType` は Field Read のセレクタ、
  `ResourceName` は `t.phase.of()` の語彙）。
- **`process` が自動的に入った** — 表が 1 つなので欠けようがない。
  `t.field.search({ resource: "process" })` が書けるようになった。
- **網羅テストを Field Read 側にも置いた**（`field.test.ts`）。ずれた直接の原因は
  片方にしか「全部覆っているか」を聞く検査が無かったことなので、そこを塞ぐのが本体。
  型レベル（`ResourceType` が 11 件ちょうど・`ResourceName` と同一・Phase / Attachment を含まない）と
  実行時（`RESOURCE_VALUES.process === 7`・11 件）の両方を固定した。
- **統合テストを 1 本足した**（`test/integration/masters.test.ts`）。フェイク経由で
  Process のカタログを読み、`P_ResourceType === 7` を確認する＝
  セレクタが実際に 7 として届いていることの確認。
- フェイクの Field Read（`test/fake/master-read.ts`）も同じ表を引くように直した。

**検査が効くことを実際に確かめた**（読んだだけで済ませていない）。`RESOURCE_VALUES` から
`process` の行を一時的に外すと:

```text
typecheck  field.test.ts(128,40): error TS2344  ← 型レベルの網羅テストが落ちる
           field.test.ts(142,23): error TS2344
           field.test.ts(158,28): error TS2339  Property 'process' does not exist
vitest     × reads the Value from the one table, so `resource=` cannot drift
```

品質ゲートは全 green（**885 tests**・coverage は perFile 100%／branch 98.93%）。
`ResourceType` に `"process"` が増えるのは**拡張**なので破壊的ではないが、公開型が変わるため
changeset（minor）を入れてある。

> **Value を送れること自体は未確認**（契約前なので当然）で、Process の Field Read が実際に
> 応答するかは実機で確かめる必要がある。ただしこれは**既に `RESOURCE_VALUES` 経由で
> `t.phase.of("process")` が同じ Value 7 を送っている**のと同じ信頼度であり、
> 本件のために新しい仮定を増やしてはいない（LV へのエントリ追加は不要）。

[adr22]: ../../adr/0022-master-read-query-surface.md
[adr61]: ../../adr/0061-phase-resource-surface.md
[adr69]: ../../adr/0069-tenant-field-catalog-tooling.md
[res-list]: ../../usage/reference/resource-api/resources-list.md
[rm]: ../../roadmap.md
