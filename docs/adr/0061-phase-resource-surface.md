# 61. Phase の公開サーフェス（接頭辞なし・resource 必須・System[Department]）

- Status: proposed
- Date: 2026-08-30
- Deciders: jun.shiromoto (Joymerrevent)

> [[0060-full-resource-coverage-direction]] が **D1 の最後の 1 本**として「Phase は専用 ADR で設計してから」と
> 分岐させた論点。実装は accepted 後の**別 PR**。

## Context and Problem Statement

[[0060-full-resource-coverage-direction]] の D1 で、Recruiter / Contact / Opportunity / Activity /
Contract / Sales の 6 種を追加した（12/13）。**残るは Phase だけ**で、0060 は着手前に
「接頭辞なし・`System[Department]`・Write の特殊制約で汎用 factory の前提から外れる」として
専用 ADR に分岐させていた。

正典（Field List / Read / Write / 2019-12-10 の機能拡張記事）を読み直した結果、**想定より論点が多い**。
Phase は他の 12 種と**4 つの軸で違う**。本 ADR はそれぞれをどう公開 API に落とすかを決める
（＋ `resource` の値の表し方＝論点5 を stakeholder 提起で追加）。

### 実測（正典で確認したこと）

| #   | 違い                                     | 中身                                                                                                                      |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | **alias に接頭辞も `P_` も無い**         | `Id` / `Resource` / `ResourceId` / `Phase` / `Date` / `Memo` / `Recent` / `Owner` …（17 項目）。他は全部 `{Prefix}.P_Xxx` |
| 2   | **Read が `resource` を必須で取る**      | `GET /v1/phase?partition=&**resource=**&resourceId=&id=&…`。`resource` は Resource List の数値 ID                         |
| 3   | **`System[Department]` を 3 項目で使う** | `OwnerDepartment` / `JobOwnerDepartment` / `ResumeOwnerDepartment`                                                        |
| 4   | **Write に最新フェーズ条件**             | フェーズ日付が現在の最新より新しいこと等。同一フェーズなら上書き、別フェーズなら追加                                      |

補足として、**カスタム項目を持たない**（固定項目のみ）・**`Deleted` 相当の項目が無い**・
`JobOwner*` / `ResumeOwner*` は **Process / Sales に紐づく Phase にしか現れない**。

**朗報が 2 つある。**

- **`System[Department]` の応答形は確定できた**（[2019-12-10 の機能拡張記事][ext2019]のサンプル）。
  `User` と**同じ入れ子の形**で、`LV` 待ちではない:

  ```xml
  <OwnerDepartment>
    <Department>
      <Department.P_Id>1001</Department.P_Id>
      <Department.P_Name>所属なし</Department.P_Name>
    </Department>
  </OwnerDepartment>
  ```

- **`field` は素の alias で送る**ことがサンプルで確認できた
  （`field=Id,Resource,ResourceId,Phase,Date,Recent`）。
  Read 記事の本文は「省略時は **`Phase.P_Id`** が指定されたものとみなす」と書いており**表記が食い違う**が、
  サンプルと応答（`<Id>10001</Id>`）はどちらも接頭辞なしなので、**素の alias を正**とする（本文はドキュメントの綴りの揺れ）。

### 既存実装との噛み合わせ

- **decode は既に接頭辞なしを読める**。`xml/decode.ts` は `obj["{prefix}.{key}"] ?? obj[key]` と
  フォールバックするので、`prefix: ""` でも `<Id>` を拾える。
- **要求側は素通りしない**。`readFieldEntry`（`read-core.ts`）は無条件に `` `${prefix}.${alias}` `` を組むので、
  `prefix: ""` だと **`.Id`** という壊れた値を送る。ここは手当てが要る。
- **Attachment に前例がある**（接頭辞なし・[[0018-attachment-design]]）が、Attachment は
  **カタログを持たない bespoke 実装**で、Phase は 17 項目のカタログを持つ点が違う。

## Decision Drivers

- **PORTERS に忠実**（[[0002-ground-design-in-live-api-docs]]）。Phase が他と違うなら、**違いを型に出す**。
  揃えるために嘘をつかない。
- **フェイルセーフ**: `resource` の指定漏れを**実行時エラーではなくコンパイルエラー**にしたい
  （必須パラメータを忘れると 400 が返るだけで、原因が見えにくい）。
- **既存パターンの再利用**（[[0060-full-resource-coverage-direction]] の前提）。汎用 factory を壊さない。
- **他 12 種の利用者に税をかけない**。Phase のための一般化で、既存リソースの型や書き味を変えない。
- **1 ファイル 1 責務**・**公開 API は薄く**（`CLAUDE.md`）。

## Considered Options

**論点1: 接頭辞と alias の形をどう扱うか**

- 案1a: **`prefix: ""` を汎用 factory が正式に受ける**（`readFieldEntry` が空接頭辞なら素の alias を送る）。（推奨）
- 案1b: **Attachment と同じ bespoke 実装**にする（`createResource` を使わず Phase 専用に書く）。
- 案1c: 内部だけ `Phase.` を付けて送る（＝ Read 記事の本文どおり）。

**論点2: 必須の `resource` をどう受けるか**

- 案2a: **`t.phase.of(resource)` でスコープを束ねる**（`tenant(id)` と同じ形。以降 `search` / `create` は resource 不要）。（推奨）
- 案2b: **クエリの必須フィールド**にする（`t.phase.search({ resource: 5, … })`）。
- 案2c: リソース別アクセサ（`t.candidate.phases` のように上位リソースにぶら下げる）。

**論点3: `System[Department]` をどう型に足すか**

- 案3a: **`DataType` に `System[Department]` を足し、`UserRef` と同形の `DepartmentRef` を返す**。（推奨）
- 案3b: 生文字列のまま返す（型を足さない）。

**論点4: Write の最新フェーズ条件**

- 案4a: **型では止めず、PORTERS に委ねる**（[書き込みの制約ガイド][write-constraints]に明記）。（推奨）
- 案4b: クライアント側で最新フェーズを読んでから検証する。

**論点5: `resource` の値を何で表すか**（論点2 とは独立。stakeholder 提起 2026-08-30）

> **この論点だけ先に決着した — stakeholder 判断で案5b（2026-08-30）。**
> 残る論点1〜4 は判断待ちのため、**ADR 全体は `proposed` のまま**。

- 案5a: **数値 ID のまま**受ける（`of(5)`）。Resource List の値をそのまま渡す。
- 案5b: **リソース名の文字列リテラル union**（`of("client")`）。数値への写像はライブラリが持つ。**（採用）**
- 案5c: **名前 ＋ 数値の両方**を受ける（`ResourceName | number`）。将来 PORTERS が値を増やしたときの逃げ道つき。

Resource List（[出典][resource-list]・updated_at 2023-08-21）が値を与えているのは **11 リソースで、全部が実装済み**:

| 値  | リソース  | 値  | リソース  | 値  | リソース    |
| --- | --------- | --- | --------- | --- | ----------- |
| 1   | Candidate | 9   | Recruiter | 19  | Activity    |
| 3   | Job       | 11  | Sales     | 25  | Opportunity |
| 5   | Client    | 13  | Contract  | 27  | Contact     |
| 7   | Process   | 17  | Resume    |     |             |

**値が飛んでいる**（1/3/5/7/9/11/13/17/19/25/27）ので、数値は覚えられず毎回リストを引くことになる。
Phase / Attachment には値が無い＝ `resource` の候補にならない。

### 各案での書き味

題材はどの案でも同じ — **Client（Resource List の `5`）の ID `20001` に紐づくフェーズ履歴を、日付の新しい順に読む**。
Phase の項目は正典どおり `Id`（System[Id]）/ `Resource`（Number）/ `ResourceId`（Number）/ `Phase`（Option）/
`Date`（DateTime）/ `Memo`（MultilineText）/ `Owner`（User）/ `OwnerDepartment`（System[Department]）。
**`Id` / `Resource` / `ResourceId` は新規・更新とも `●`**（必須）。

#### 論点1 — 接頭辞（利用者の書き方は変わらず、変わるのは送信形と実装コスト）

```text
案1a / 案1b が送るもの:  field=Id,Date,Memo        ← 正典のサンプルと一致
案1c が送るもの:         field=Phase.Id,Phase.Date ← サンプルにも応答にも無い形
```

案1a は descriptor に `prefix: ""` を置き、`readFieldEntry` が空接頭辞なら `.` を付けない、という 1 箇所の分岐で済む。
案1b は同じ利用者向けの形を得るために、**17 項目のカタログとクエリ一式を Phase 専用に書き直す**（下記は
案1b で二重持ちになる部分）。

```ts
// 案1b: 汎用 factory を使わないので、この手の定義を Phase だけもう一度書くことになる
const PHASE_FIELDS = {
  Id: "System[Id]",
  Resource: "Number" /* …17 項目… */,
} as const;
// search / searchAll / get / create / update / condition / order / ページングも自前
```

#### 論点2 — 必須の `resource` をどう受けるか（**利用者から見て一番違う**）

```ts
// 案2a（推奨）: resource を 1 度だけ束ねる。以降のシグネチャは他リソースと同じ
const phases = t.phase.of(5); // 5 = Resource List の Client
const page = await phases.search({
  condition: { ResourceId: { eq: 20001 } },
  order: [{ Date: "desc" }],
});
for await (const p of phases.searchAll({
  condition: { ResourceId: { eq: 20001 } },
})) {
  p.Memo; // string | null | undefined
}
// resource を書き忘れる形が存在しない（`t.phase.search(...)` は型として無い）
```

```ts
// 案2b: アクセサの形は他と同じ。resource はクエリの必須フィールド
const page = await t.phase.search({
  resource: 5, // 省略はコンパイルエラー
  condition: { ResourceId: { eq: 20001 } },
  order: [{ Date: "desc" }],
});
await t.phase.searchAll({
  resource: 5,
  condition: { ResourceId: { eq: 20001 } },
}); // 毎回書く

// 取り違えは型では止まらない（どちらも resource は埋まっている）
const client = await t.phase.search({
  resource: 5,
  condition: { ResourceId: { eq: 20001 } },
});
const job = await t.phase.search({
  resource: 3,
  condition: { ResourceId: { eq: 20001 } },
});
```

```ts
// 案2c: 上位リソース側に生やす
await t.client.phases({ condition: { ResourceId: { eq: 20001 } } });
await t.candidate.phases({ order: [{ Date: "desc" }] }); // 同じものを 13 リソース分そろえる
```

> **どの案でも残る細部**: Read は `resourceId` と `id` を**専用のクエリ引数**でも受ける
> （正典いわく、複数指定の or 検索は `condition` を使う）。上の例は `condition` で書いているが、
> 単一指定を専用引数に載せるかは**実装時に詰める**（送信形が変わるだけで、公開 API の形は 3 案とも同じ）。

**Write でも差が出る。** 案2a は束ねた `resource` を `Resource` に充てられる（`ResourceId` は毎回指定）。
案2b / 案2c は `Resource` を毎回書く。なお `Id` は他リソースの `P_Id` と同じくライブラリが供給する。

```ts
// 案2a
await t.phase.of(5).create({
  ResourceId: 20001,
  Phase: ["Opt_Contacted"],
  Date: "2026-08-30T00:00:00Z",
});
// 案2b
await t.phase.create({
  Resource: 5,
  ResourceId: 20001,
  Phase: ["Opt_Contacted"],
  Date: "2026-08-30T00:00:00Z",
});
```

#### 論点3 — `System[Department]` の読み取り値

```ts
const page = await t.phase
  .of(5)
  .search({ field: ["Owner", "OwnerDepartment"] });
const p = page.items[0];

// 案3a（推奨）: User と同形の参照レコードになる
p?.Owner; // UserRef | null       → { P_Id: 78, P_Type: …, P_Name: …, P_Mail: … }
p?.OwnerDepartment; // DepartmentRef | null → { P_Id: 1001, P_Name: "所属なし" }

// 案3b: 入れ子が文字列に潰れる。User だけ型が付く非対称が残る
p?.OwnerDepartment; // string | null
```

> **案3a の注意**: `DataType` に足すと `WritableDataType`（`System[Id]` / `System[DateTime]` だけを除外）に
> **自動で入り**、Write 値が既定の `string` になる。書けるのか・書けるなら `Department.P_Id`（`number`）なのかは
> 正典で未確認なので、**union を広げるときに派生型まで見る**（[[0056-deleted-flag-typing]] の教訓）。

#### 論点4 — Write の最新フェーズ条件

```ts
// 案4a（推奨）: そのまま送り、PORTERS の判定を型付きエラーで受ける
try {
  await t.phase.of(5).create({
    ResourceId: 20001,
    Phase: ["Opt_Contacted"],
    Date: "2020-01-01T00:00:00Z",
  });
} catch (e) {
  // 最新フェーズより古い日付 → PortersResourceError（Result Code つき）
}

// 案4b: 送信前に最新を読んで判定する（+1 往復。読んだ後に他者が更新するレースは残る）
const latest = await t.phase
  .of(5)
  .search({ condition: { ResourceId: { eq: 20001 }, Recent: { eq: 1 } } });
```

#### 論点5 — `resource` の値を何で表すか（**案5b で決定**）

```ts
// 案5a: 数値 ID。5 が何かは Resource List を引かないと分からない
await t.phase.of(5).search({ condition: { ResourceId: { eq: 20001 } } });
await t.phase.of(6); // ← 6 は欠番。型では止まらず、実行時に 400
await t.phase.of(9); // Recruiter のつもりで 11（Sales）と取り違えても気づけない

// 案5b（推奨）: アクセサ名と同じ語彙で書く。数値への写像はライブラリが持つ
await t.phase.of("client").search({ condition: { ResourceId: { eq: 20001 } } });
await t.phase.of("recruiter");
await t.phase.of("clinet"); // ← コンパイルエラー（綴り間違い）
await t.phase.of("phase"); // ← コンパイルエラー（Resource List に値が無い）

// 案5c: 名前を既定にしつつ数値も通す
await t.phase.of("client"); // 通常はこちら
await t.phase.of(29); // PORTERS が値を増やしたとき、版を待たずに書ける
```

**名前は `t.client` / `t.recruiter` というアクセサ名と同じ**にでき、descriptor の `path` から**導出**できる
（`ResourceName = "candidate" | "job" | "client" | …`）。手書きの対応表を別に持たないので、
リソースを足したときに片方だけ更新される事故が起きない。

> **`Activity.P_Resource` も同じ問題を抱えている**（未リリース分。すでに `Number` として実装済み）。
> あちらは**メソッド引数ではなくカタログ上の項目**なので、名前で受けるなら別の仕組みが要る
> （項目単位で書き込み値の型を差し替える）。**本 ADR では Phase だけを決め、Activity は別途**にする。
> 揃えないなら「`of()` は名前・`P_Resource` は数値」という非対称が残る＝ここは明示的に選ぶ。

## Decision Outcome

> **論点5 は決定済み（案5b・stakeholder 判断 2026-08-30）。** 残る**論点1〜4 は推奨のまま**で
> （案1a ＋ 案2a ＋ 案3a ＋ 案4a）、本 ADR は `proposed`。4 つが決まった時点で
> 本節全体を「採用」へ更新する（[ADR README の運用ルール][adr-readme]）。

推奨の理由（Decision Drivers に照らす）:

- **案1a（`prefix: ""` を正式に受ける）**: decode は既に対応済みで、直すのは `readFieldEntry` の 1 箇所。
  bespoke（案1b）にすると 17 項目のカタログ・`condition` / `order` / ページングを**全部書き直す**ことになり、
  Attachment のときと違って重複が大きい。案1c は**正典のサンプルと食い違う**ので採らない。
- **案2a（`of(resource)` で束ねる）**: `resource` は「どのリソースのフェーズ履歴か」という**文脈**であって
  検索条件ではない。`tenant(id)` で partition を 1 回だけ明示させたのと**同じ形**にすれば、
  指定漏れが**型として存在しない状態**になる（[[0055-partition-binding-guard]] と同じ考え方＝フェイルセーフ）。
  案2b は毎回書く必要があり、`searchAll` のページングで取り違える余地が残る。
- **案3a（`DepartmentRef`）**: 応答形が確定しており、`User` の実装をそのまま写せる。
  **D3 のデータ型 14/17 → 15/17** が同時に進む（残りは `Link` / `Image`）。
- **案4a（委ねる）**: 最新フェーズ条件は**サーバー側の状態**に依存するので、手前で判定するには追加の Read が要る。
  厳しくしすぎると正当な呼び出しを弾く（Sales の `※` と同じ判断）。
- **案5b（名前で受ける・決定済み）**: 数値 ID は **1/3/5/…/25/27 と飛んでいて覚えられず**、欠番（`6`）も取り違え
  （`9` と `11`）も型では止まらない。名前なら**アクセサ名と同じ語彙**になり、綴り間違いがコンパイル時に止まる。
  写像は **descriptor の `path` から導出**でき、手書きの対応表を持たないので更新漏れが構造的に起きない。
  **値を持つ 11 リソースは全部実装済み**なので、名前だけで穴が空かない。
  案5c（数値も通す）は逃げ道になるが、**同じものを 2 通りで書ける**状態は
  [[0059-read-field-bare-alias]] が案B として退けた形なので採らない
  — PORTERS が値を増やしたら、そのリソースを足す版で union も広げる（同じリリースで済む）。

### Consequences

- Good: Phase が汎用 factory に載り、D1 が **13/13** で完了する。`System[Department]` で D3 も進む（15/17）。
  `resource` は**指定漏れも綴り間違いもコンパイルエラー**になり、数値 ID を覚える必要が無くなる。
- Bad: 公開 API に **`of(resource)` という Phase だけの形**が増える（学習コスト）。
  `readFieldEntry` に空接頭辞の分岐が入る（他 12 種には無関係な条件が 1 つ増える）。
  リソース名 → 数値の写像を**ライブラリが持つ**（PORTERS が値を増やしたら union も広げる）。
- Neutral: reference ↔ カタログ突合（D4）は **`| {Prefix}.P_` 前提の行パーサ**なので、Phase 用に緩める必要がある。
  Phase はカスタム項目を持たないので `CustomFieldResource` には**加えない**。

## Pros and Cons of the Options

### 案1a: `prefix: ""` を汎用 factory が受ける（推奨）

- Good: 変更が 1 箇所。カタログ・クエリ・ページングを再利用できる。decode は既に対応済み。
- Bad: 汎用側に Phase 専用の分岐が 1 つ増える。

### 案1b: bespoke 実装（Attachment と同じ）

- Good: 汎用側に一切触らない。
- Bad: 17 項目のカタログと Read クエリ一式を二重に持つ。**ドリフトの温床**（RV-23 と同じ形の事故）。

### 案1c: 内部で `Phase.` を付ける

- Good: 既存コードを一切変えずに済む。
- Bad: **正典のサンプルと食い違う**。動かない可能性が高く、動いても根拠が無い。

### 案2a: `t.phase.of(resource)`（推奨）

- Good: 指定漏れが型として存在しない。`tenant(id)` と同じ形＝学習コストが低い。
- Bad: Phase だけ 1 段深くなる。

### 案2b: クエリの必須フィールド

- Good: アクセサの形が他と同じ。
- Bad: 毎回書く。`searchAll` の途中で変えられてしまう余地が残る。

### 案2c: 上位リソースにぶら下げる

- Good: `t.candidate.phases()` は読みやすい。
- Bad: **13 リソース分の重複**。Phase を持たないリソースにも生えてしまう。

### 案3a / 案3b（`System[Department]`）

- 案3a Good: 応答形が確定しており `User` と同形。D3 が進む。／ Bad: `DataType` union が 1 つ増える
  （派生型 `WritableDataType` 等への波及を確認する必要がある — [[0056-deleted-flag-typing]] の教訓）。
- 案3b Good: 変更ゼロ。／ Bad: 入れ子を生文字列で返すことになり、**他の参照型と一貫しない**。

### 案4a / 案4b（Write の条件）

- 案4a Good: 正当な呼び出しを弾かない。実装が薄い。／ Bad: 失敗はサーバー応答まで分からない。
- 案4b Good: 手前で気づける。／ Bad: 追加の往復。レースがあり、結局サーバーが正。

### 案5a / 案5b / 案5c（`resource` の値）

- 案5a Good: 正典の値をそのまま渡す＝写像を持たない。／ Bad: **飛び番で覚えられない**。
  欠番も取り違えも型では止まらない。読んだときに何のフェーズか分からない。
- 案5b **（採用）** Good: **アクセサ名と同じ語彙**。綴り間違いがコンパイル時に止まる。descriptor の `path` から
  導出でき、対応表の更新漏れが構造的に起きない。／ Bad: ライブラリが写像を持つ。
  PORTERS が値を増やしたら union を広げる版が要る。
- 案5c Good: 案5b の利点＋将来の値を版を待たずに書ける逃げ道。／ Bad: **同じものを 2 通りで書ける**
  （[[0059-read-field-bare-alias]] が案B として退けた形）。逃げ道が要る場面は現時点で存在しない。

## More Information

- 出典: [Phase Field List][field-list]（接頭辞なしの 17 項目）／[Phase Read][read]（`resource` 必須・
  `field` / `condition` / `order`）／[Phase Write][write]／[2019-12-10 機能拡張][ext2019]
  （**`System[Department]` の応答形**・`field` が素の alias であるサンプル）／
  [Write API - Phase の更新について][write-format]（最新フェーズ条件）。
- 関連: [[0060-full-resource-coverage-direction]]（本 ADR の親）／[[0018-attachment-design]]（接頭辞なしの前例）／
  [[0055-partition-binding-guard]]（束ねて必須を消す形）／[[0016-field-type-granularity]]（Data Type の粒度）／
  [[0056-deleted-flag-typing]]（union を広げるときの注意）。
- accepted 後: **別 PR** で実装（`src/resources/phase.ts` ＋ co-located UT ／ `readFieldEntry` の空接頭辞対応 ／
  `DataType` に `System[Department]` ＋ `DepartmentRef` ／ `ResourceName` と数値の写像 ／ 突合テストの行パーサ ／
  README・ガイド）。完了すれば **D1 が 13/13**、D3 が 15/17 になる。
- **`Activity.P_Resource` を名前で受けるか**は本 ADR の対象外（カタログ項目なので機構が別）。
  案5b を採るなら、`of()` は名前・`P_Resource` は数値という非対称が残る＝**別途起票して揃えるか決める**。
- **残る論点は D3 の `Link` / `Image`**（R-4）と D2（マスタ項目の拡張）で、どちらも別 ADR。

[adr-readme]: README.md
[write-constraints]: ../guide/write-constraints.md
[write-format]: ../reference/resource-api/write-format.md
[resource-list]: ../reference/resource-api/resources-list.md
[field-list]: https://hrbcapi.porters.jp/hc/ja/articles/115008171728-Phase-Field-List
[read]: https://hrbcapi.porters.jp/hc/ja/articles/115012161288-Phase-Read
[write]: https://hrbcapi.porters.jp/hc/ja/articles/115012161268-Phase-Write
[ext2019]: https://hrbcapi.porters.jp/hc/ja/articles/360039307694
