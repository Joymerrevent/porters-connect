# 87. カスタム項目の宣言は `tenant(id)` で束ねる（client から `fields` を外す）

- Status: accepted
- Date: 2026-09-21
- Deciders: jun.shiromoto (Joymerrevent)
- Implemented: 0.21.0

> 起票元は stakeholder の相談（2026-09-21）: 「カスタム項目はテナントごとに違うのに、宣言は client 単位でしか
> 渡せない。`porters.tenant(partition)` で足せるようにしてはどうか」。
>
> 議論の経緯: 最初の推奨は **案A**（client の `fields` を残し、`tenant()` で追加する二層）だった。
> decider から「`A_` もテナント毎に違うなら、client から `fields` を外して `tenant()` のみにしてはどうか」と
> 問われ、実装と既存 ADR を確かめたうえで **案B に推奨を切り替えた**（理由は Decision Outcome）。
> **渡し方はメソッドチェーンでなくパラメタ**（論点2 案2a）で decider と合意済み。
>
> **decider が案B ＋ 案2a ＋ 案3a を選択し `accepted`（2026-09-21）。** 実装は accept 後・別 PR
> （下記「実施時の合意事項」のとおり）。

## Context and Problem Statement

### いまの形

カスタム項目の宣言 `defineFields` の結果は **`PortersClient` のコンストラクタ**で受け取り、
そこから全テナントスコープへ流れる（`src/client.ts`）。

| 場所                             | 何をしているか                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `PortersClientOptions<C>.fields` | `DefinedFields<C>` を受け取る（`src/client.ts:114`）                                  |
| `PortersClient<C>`               | クラスの型引数 `C` は **`fields` を `tenant()` へ運ぶためだけ**にある（`:177`）       |
| `customFor(key)`                 | `options.fields?.[key]` を各リソース factory へ渡す（`:256-258`）                     |
| `buildScope(partition)`          | `tenant(id)` の実体。**partition だけ**を差し替えて同じ宣言でスコープを作る（`:269`） |
| `tenant: (id) => TenantScope<C>` | `C` は client のものに固定（`:199`）                                                  |

つまり **「どの partition か」は `tenant(id)` で毎回束ねる**のに、**「その partition の項目の形」は client に
1 つ**しか持てない。

### カスタム項目は partition ごとのもの

PORTERS の reference は各リソース記事で同じ 1 行を置いている（例: [candidate][ref-candidate]）。

> `Person.U_[Name]`（ユーザー作成）/ `Person.A_[Name]`（アプリ作成）は**テナント毎に異なる**。

[resources-list][ref-list] も「カスタム項目（`U_` / `A_`）はテナント毎に異なるため Field Read API で取得する」。
[ADR-0004][adr4] はこれを「**Partition（Company DB）ごとに異なり**、静的ドキュメントに無い」と受けている。
`U_` だけでなく **`A_` も**、出典は「テナント毎」と言っている（App 共通であることを保証していない）。

### 既存の決定は、もう「partition スコープのものは `tenant()` に置く」と言っている

- [ADR-0055][adr55] は `partition` を client から外し、**「client ＝ App レベル ＋ `tenant` ファクトリ／
  `TenantScope` ＝ partition スコープ」**と層を切った。**`fields` は partition スコープの関心のまま
  App レベルに残っている唯一のもの**である。
- [ADR-0069][adr69] のツール群は **`tenant(id)` スコープを引数に取る**:
  `generateFieldDecls(porters.tenant(1), …)`・`verifyFields(porters.tenant(1), myFields)`。
  宣言を**作る側と確かめる側は既にテナント単位**で、**使う側だけが client 単位**にずれている。

### いまの逃げ道と、その隠れたコスト

[カスタム項目ガイド][guide-cf]「複数テナントで項目が違う場合」は「**テナントごとに `PortersClient` を構築**」
と案内している。動くが、次を抱える。

- **トークンが分かれる**。既定のトークンプロバイダは client ごとに作られる（`src/client.ts` のコンストラクタ）ので、
  項目を変えたいだけなのに **トークンキャッシュも client の数だけ**になる。[ADR-0040][adr40] SD-4 が主経路に
  選んだ「共有トークン ＋ partition ルーティング」から外れる。
- **型引数の落とし穴を抱えたまま**。同ガイド「設定を切り出すときも同じ」は、`PortersClientOptions` を型引数
  なしで書くと**代入は通るのにカスタム項目が型から黙って消える**ことを 1 節かけて警告している。
  この落とし穴は `PortersClient<C>` / `PortersClientOptions<C>` がジェネリックであることから生まれている。

### 取り違えたときの倒れ方

宣言を 1 つしか持てないと、項目構成の違うテナント B を **テナント A の宣言で読む**ことになる。
その結果は [ADR-0069][adr69] が実測した表そのもので、Option の項目を `singlelineText()` で読めば **値が黙って
`null` になる**。例外も警告も出ず「その項目は空だった」と区別が付かない＝このプロジェクトが
フェイルセーフで避けたい側である。

> **訂正（2026-09-21・[RV-60][rv60]）** — 上の段落は [ADR-0069][adr69]（2026-09-09）の実測表を
> そのまま引いたが、その翌日の [RV-36][rv36] の処置（0.15.0）で Option ⇄ テキストの取り違えは
> **読み取り時に `validation` で落ちる**ようになっており、本 ADR の起票時点で既に「黙って `null`」では
> なかった（下の「信じている入力」表はそのとおり書いている）。残っていた silent な経路は
> Number ⇄ テキスト（`NaN`・[RV-58][rv58] で是正）。**決定（案B）は変わらない** — 根拠は層の整合・
> トークン共有・型引数の単純化で立ち、「別テナントの宣言を当てた」ことをライブラリが知り得ない点も
> そのまま。

問い: **カスタム項目の宣言はどこで束ねるべきか。client に残すか、`tenant()` に移すか、両方か。
移すなら渡し方はどの形か。**

## Decision Drivers

- **フェイルセーフ**: 「別テナントの宣言が黙って適用される」状態を、ガードでなく**設計で無くす**
  （[ADR-0055][adr55] 案F と同じ倒し方）。忘れたときはコンパイルエラーで落ちること（[ADR-0074][adr74] の
  宣言必須が効く形）。
- **層の整合**: partition スコープの関心は `TenantScope` に置く（[ADR-0055][adr55]）。
- **薄く**: ライブラリが `A_` と `U_` を区別しない。出典が保証していない「`A_` は App 共通」を
  ライブラリの前提にしない。
- **公開型の複雑さ**: ジェネリックとマージ規則は必要な分だけ（[ADR-0005][adr5] の「薄いラッパー」）。
- **既存資産の再利用**: `defineFields` の DSL（[ADR-0023][adr23]）と `TenantScope<C>`（[ADR-0040][adr40]）は
  そのまま使う。新しい経路を作らない。
- **1.0 前**: 破壊的変更を入れるなら今が最も安い（[ADR-0055][adr55] 0.10.0・[ADR-0074][adr74] 0.16.0 と同じ判断）。

## Considered Options

### 論点1: 宣言をどこで束ねるか

- **案A: client に残し、`tenant(id, { fields })` で追加する（二層マージ）** — 起票前の最初の推奨
- **案B: client から `fields` を外し、`tenant(id, { fields })` のみにする** — **採用**
- 案C: 現状維持（テナントごとに `PortersClient` を構築する、という案内のまま）
- 案D: 構築時に `fields: (partition) => DefinedFields` の解決関数を渡す

### 論点2: `tenant()` への渡し方

- **案2a: パラメタ** `porters.tenant(id, { fields })` — **採用（decider 合意・2026-09-21）**
- 案2b: メソッドチェーン `porters.tenant(id).withFields(fields)`

### 論点3: パラメタの形

- **案3a: オプションオブジェクト** `tenant(id, { fields })` — **採用**
- 案3b: 位置引数 `tenant(id, fields)`

## Decision Outcome

採用: **案B ＋ 案2a ＋ 案3a**（decider・2026-09-21）。**`PortersClientOptions` から `fields` を外し、宣言は `tenant(id, { fields })`
でだけ受け取る。`PortersClient` と `PortersClientOptions` はジェネリックでなくなり、型引数は
`TenantScope<C>` と `tenant()` にだけ残る。**

```ts
/** Options for {@link PortersClient.tenant}. `C` is inferred from `fields` (ADR-0023 / ADR-0087). */
export type TenantOptions<C extends DeclaredCatalogs = EmptyCatalog> = {
  /** Custom field declarations for this partition, from `defineFields`. Omit for standard `P_` only. */
  fields?: DefinedFields<C>;
};

export class PortersClient {
  readonly tenant: <C extends DeclaredCatalogs = EmptyCatalog>(
    id: PartitionId,
    options?: TenantOptions<C>,
  ) => TenantScope<C>;
}
```

### 使い方がどう変わるか

単一テナントは**行数が変わらない**。`fields` の置き場が 1 行動くだけ。

```ts
// 変更前
const porters = new PortersClient({ hostname, appId, appSecret, fields });
const t = porters.tenant(123);

// 変更後
const porters = new PortersClient({ hostname, appId, appSecret });
const t = porters.tenant(123, { fields });
```

複数テナントで項目が同じなら、利用側で 1 行包む。

```ts
const tenant = (p: PartitionId) => porters.tenant(p, { fields });
```

`A_` を App 共通、`U_` をテナント固有にしたい場合は、**今の DSL のまま**宣言関数を spread して合成する。
これで型推論まで通ることを tsc で確認した（2026-09-21・本 ADR 起票時）。

```ts
const appCandidate = (f: FieldBuilder) => ({ A_score: f.number() });

const tenantA = defineFields({
  candidate: (f) => ({ ...appCandidate(f), U_memo: f.singlelineText() }),
});
const tenantB = defineFields({ candidate: appCandidate });
```

**「共通部分の合成」は利用側の DSL で表せる**ので、ライブラリは `A_` と `U_` の区別を知らなくてよい。
これが二層マージ（案A）を持たなくてよい根拠である。

### 案B を採る理由（案A との差）

- **不正な状態そのものが消える**。案A は「client の基底宣言が、別テナントに黙って適用される」状態を残す。
  案B は**スコープの形をスコープを作る場所で必ず言う**ので、その状態が存在しない。
  忘れたときは `{ fields }` 無しのスコープに `U_` を書いた時点でコンパイルエラー（[ADR-0074][adr74]）。
  [ADR-0055][adr55] が「ガードより、そもそも作れない」を選んだのと同じ順位付け。
- **ライブラリが単純になる**。`PortersClient<C>` と `PortersClientOptions<C>` の型引数が消える
  （`C` は `customFor` にしか使われていない）。二層のマージ意味論・同じ alias を違う Data Type で
  宣言したときの衝突規則・tenant 側が勝つ型ヘルパー、のどれも要らない。
- ~~**ガイドの落とし穴が節ごと消える**。~~「`PortersClientOptions` を型引数なしで書くとカスタム項目が黙って
  消える」は、型引数が無くなれば起きない。
  **訂正（実装時 2026-09-21）**: `PortersClientOptions` についてはそのとおりだが、**同じ形の落とし穴は
  `TenantOptions` に移る**（型引数なしの `TenantOptions` 注釈でも代入は通り、`EmptyCatalog` に固定される
  — tsc で確認）。ガイドの節は削除ではなく `TenantOptions` 向けに書き換えて残した。決定（案B）は変わらない。
- **層の説明が 1 文で済む**。client ＝ App レベル（`auth`・`partition` マスタ・`tenant()`）、
  `TenantScope` ＝ partition と**その partition の項目の形**。[ADR-0055][adr55] の言い方に `fields` が乗る。
- **ADR-0069 のツールと向きが揃う**。宣言を作る（`generateFieldDecls`）・確かめる（`verifyFields`）・
  使う（`tenant(id, { fields })`）が**すべて `tenant(id)` スコープ単位**になる。

### 論点2・論点3 の根拠

- **案2a（パラメタ）**: 束ねる点が 1 つのままになる（[ADR-0055][adr55]「partition は明示的に一度だけ束ねる」と
  同じ形）。案2b は `tenant(id)` だけでも動いてしまうため `.withFields()` を付け忘れたスコープが基底カタログの
  まま通る（fail-open）。また `TenantScope` に「リソースでないメンバー」が初めて入り、[ADR-0040][adr40] 案2a が
  `tenant` のネストを除外した意図（アクセサだけの束）と、MCP 層が薄く乗る前提が崩れる。
  [ADR-0023][adr23] も client 側の `withFields()` を「経路が二系統に分裂する」で退けている。
- **案3a（オプションオブジェクト）**: `{ fields }` は client の旧オプション名と同じで移行が読みやすい。
  将来 tenant 単位の設定が増えても（[ADR-0040][adr40] 案4b の partition 別トークン seam など）
  signature を壊さない。

### 実施時の合意事項（accept 後の別 PR）

1. **`PortersClientOptions` から `fields` を削除**し、`PortersClientOptions` / `PortersClient` の型引数 `C` を
   外す。`customFor` は `buildScope` の内側に移す。
2. **`tenant` をジェネリックにし、第 2 引数に `TenantOptions<C>`** を取る。`TenantOptions` を
   `src/index.ts` から export する。`tenant(id)`（第 2 引数なし）は `TenantScope<EmptyCatalog>` を返す＝
   **今の `tenant(id)` は無変更**。
3. **テストで両方を pin する**（型テスト）: `tenant(id, { fields })` の結果に宣言した `U_` が型付きで生える／
   `tenant(id)` には生えない／`PortersClient` に型引数を渡すとコンパイルエラー／`PortersClientOptions` に
   `fields` を書くと excess property でコンパイルエラー。実行時: `tenant(1, { fields: a })` と
   `tenant(2, { fields: b })` が**それぞれの宣言で decode** すること（同じ client から）。
4. **CHANGELOG 最上部に破壊的変更として明記**し、移行手順を 1 対 1 で示す
   （コンストラクタの `fields` → `tenant()` の第 2 引数）。semver は 0.x のため **minor**
   （[ADR-0055][adr55] 合意事項 7 と同じ扱い）。
   **追記（実装時 2026-09-21）**: この repo の実務では実装 PR は **changeset** に書き、CHANGELOG へは
   リリース時に転記する（[release runbook][runbook]）。移行手順は changeset に載せた。
5. **ドキュメントの洗い出し**（[breaking change の作法][sweep]＝ts スニペットは `check:docs` が拾うが、
   地の文は手で洗う）:
   - [カスタム項目ガイド][guide-cf]: 「3 行で」の構築例／「複数テナントで項目が違う場合」を
     「テナントごとに宣言を渡す」に書き換え（テナント別 client の案内は**認証を分けたい場合**に限る）／
     「宣言したクライアントを関数に渡す」の `PortersClient<DeclaredCatalogs>` を非ジェネリックに／
     「設定を切り出すときも同じ」は~~**節ごと削除**（落とし穴が消えるため）~~
     **訂正（実装時 2026-09-21）: `TenantOptions` 向けに書き換えて残す**（上記 Decision Outcome の訂正と
     同じ理由）／`A_` 共通 ＋ `U_` 固有の合成例（上記）を足す。
   - [マルチテナントガイド][guide-mt]: §2 に `{ fields }` を載せる。§3（テナント別 client）は
     **認証の分離だけ**の理由にする。
   - [日時の概念][guide-dt]・[基本設計][bd] §「公開 API」の構築例・`examples/offline-sandbox.ts`・
     README（構築例に `fields` が無いことを確認する）。
   - [ADR-0005][adr5]（コンストラクタ `fields: myFields`）と [ADR-0023][adr23]（D1 案1
     「`PortersClient<C>` をジェネリック化」）に **Amended by ADR-0087** の注記を足す。決定の文面は書き換えない。
   - JSDoc（`PortersClient` / `TenantScope` / `defineFields` の `@example`）。
6. **フェイクサーバー・`verifyFields`・`generateFieldDecls`・`readCustomCatalog` は無変更**
   （既に `tenant(id)` スコープを取る）。
7. **追記（実装時 2026-09-21・変更レビューの指摘）**: 旧形の `fields` がコンストラクタに残っていても、
   型はフレッシュなリテラルにしか excess property check を掛けず、実行時は読まないので**黙って捨てられる**
   （記録 mock で確認: 構築は通り、URL はカスタム項目を要求しない）。設定オブジェクトを別の場所で組む
   TypeScript 利用者と JavaScript 利用者がこの経路に入る。RV-17 / RV-25 と同じ「設定の誤りが実行前に
   落ちない」型なので、**`PortersClientOptions.fields` を `never` で型付け**（非フレッシュでも落ちる）し、
   **コンストラクタで `PortersConfigError`（`category: "config"`・hint は `tenant(id, { fields })`）**を
   投げる（ADR-0048 の系列）。`fields: undefined` は未指定と同じ扱い（任意の spread を落とさない）。
   トレードオフ: 設定オブジェクトに `fields` を同居させて `tenant(id, { fields: config.fields })` と
   使い回す書き方は、client に渡す前に外す必要がある。

### Consequences

- Good: **「別テナントの宣言が黙って適用される」状態が存在しなくなる**。`PortersClient` /
  `PortersClientOptions` が非ジェネリックになり、公開型と説明が単純になる。マージ規則・衝突規則を持たない。
  ~~ガイドの落とし穴の節が消える。~~（訂正・実装時: `TenantOptions` に移るので節は書き換えて残す）
  宣言を作る・確かめる・使うが全部 `tenant(id)` 単位で揃う。
  項目が違うテナント群を **1 つの client（1 つのトークンキャッシュ）**で扱える。
- Bad: **破壊的変更**。`fields` を渡している利用者は `tenant()` の第 2 引数へ移す（1 対 1・機械的）。
  項目が同じ複数テナントでは呼び出しごとに `{ fields }` を渡すか、利用側で 1 行包む。
  ドキュメントの書き換え範囲が広い（ガイド 2 本・概念 1 本・基本設計・examples・ADR 注記 2 本）。
- Neutral: `tenant(id)` の第 2 引数なしは無変更。[ADR-0023][adr23] D1（`PortersClient<C>`）は
  **本 ADR で部分的に supersede** される（DSL・検証境界・マージ意味論 D2〜D7 は不変）。
  [ADR-0005][adr5] のコンストラクタ例の `fields` 行も無効になる。

## 信じている入力

宣言は**開発者の設定値**で、「その宣言がその partition に合っているか」をライブラリは
自分では確かめられない（確かめる手段は opt-in の `verifyFields`）。支配的な故障は
「**別テナントの宣言を当てる**」＝案B はこれを「宣言をスコープ生成時に必ず言わせる」ことで
起きにくくするが、**言った内容が正しいか**は次の表の守り方に依る。

| 値                              | 出どころ                         | 誰が書けるか | 守り方                                                                                                                        | 取れなかったら                                                                             | 誤っていたら                                                                                                     |
| ------------------------------- | -------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `tenant(id, { fields })` の宣言 | 利用者のコード（`defineFields`） | 開発者       | **仕組み**: `defineFields` が alias 書式とリソース名を同期検証（[ADR-0023][adr23] D4）・branded で再検証しない                | `{ fields }` 省略＝標準項目のみ。`U_` / `A_` に触るとコンパイルエラー（[ADR-0074][adr74]） | 実データと形が食い違えば `validation` で surface（[RV-36][rv36]）。事前に知りたければ `verifyFields`（opt-in）   |
| partition ↔ 宣言の対応          | 利用側（SaaS の DB など）        | 開発者       | **散文のみ**: 対応付けは利用側の責務（[ADR-0008][adr8]）。ライブラリは partition と宣言を同じ呼び出しで受けるだけ             | —（両方とも `tenant()` の引数＝片方だけ欠ける形が無い）                                    | `verifyFields(porters.tenant(p, { fields }), fields)` で突き合わせ可（opt-in）。突き合わせなければ RV-36 の経路  |
| 「`A_` は App 共通」という前提  | 出典（reference）の含意          | PORTERS      | **散文のみ**: 出典は `A_` も「テナント毎に異なる」としか言わない。ライブラリは `A_` / `U_` を区別しない＝この前提に依存しない | —                                                                                          | 共通と思った `A_` が無いテナントでは、その項目が `missing`（`verifyFields`）／読みは `undefined`（未返却と同じ） |

## Pros and Cons of the Options

### 案A: client に残し `tenant()` で追加（二層マージ）

- Good: 非破壊。項目が同じテナント群は client の宣言だけで済む。
- Bad: 「基底宣言が別テナントに黙って適用される」状態が残る（ガードで防ぐしかない）。マージ意味論・
  衝突規則・tenant 側が勝つ型ヘルパーが要る。`PortersClient<C>` のジェネリックと、その落とし穴も残る。
  合成は DSL の spread で利用側が書けるので、ライブラリ側のマージは**二重の手段**になる。

### 案B: client から外し `tenant()` のみ（採用）

- Good: 不正な状態が存在しない。公開型が単純（client 非ジェネリック・マージ規則なし）。層の説明が
  1 文。ADR-0069 のツールと向きが揃う。1 client で項目の違うテナント群を扱える。
- Bad: 破壊的変更（移行は 1 対 1）。項目が同じ複数テナントで `{ fields }` を毎回渡す（利用側で 1 行包める）。
  ドキュメントの書き換え範囲が広い。

### 案C: 現状維持（テナントごとに client）

- Good: 何も変えない。
- Bad: トークンキャッシュが client の数だけ増え、[ADR-0040][adr40] の主経路から外れる。
  「テナント毎」と出典が言うものを client 単位に固定し続ける。落とし穴の節も残る。

### 案D: 構築時に解決関数 `fields: (partition) => …`

- Good: 呼び出し側は `tenant(id)` のまま。
- Bad: 宣言を DB から引く SaaS では非同期になり、同期のコンストラクタに合わない。partition ↔ 宣言の
  対応付け（[ADR-0008][adr8] が利用側の責務とした業務ロジック）を L1 に引き込む。

### 案2b: メソッドチェーン `tenant(id).withFields(f)`

- Good: 既存の `tenant(id)` に何も足さない。
- Bad: 付け忘れたスコープが基底カタログのまま通る（fail-open）。`TenantScope` にアクセサでないメンバーが
  入り、[ADR-0040][adr40] 案2a と MCP 前提を崩す。[ADR-0023][adr23] が client 側で退けた形と同じ。

### 案3b: 位置引数 `tenant(id, fields)`

- Good: 1 文字少ない。
- Bad: tenant 単位の設定が増えたとき signature を壊す。旧オプション名 `fields` との対応が見えにくい。

## More Information

- 起票元: stakeholder との相談（2026-09-21）。合成例の型推論は tsc で確認済み（起票時）。
- 接地（コード）: `src/client.ts`（`PortersClientOptions.fields` :114／`PortersClient<C>` :177／
  `tenant` :199／`customFor` :256-258／`buildScope` :269）、`src/fields/define-fields.ts`
  （`FieldDecls` = リソースごとの `(f: FieldBuilder) => ResourceDecl`＝spread で合成できる形）、
  `src/fields/tenant-catalog.ts`（`FieldCatalogSource` = `tenant(id)` スコープの構造型）。
- 出典: [resources-list][ref-list]（カスタム項目はテナント毎）・各リソース記事（例 [candidate][ref-candidate]）。
- 関連 ADR: [ADR-0004][adr4]（型モデル・カスタムは Partition ごと）／[ADR-0005][adr5]（コンストラクタ
  `fields`・本 ADR で部分的に無効）／[ADR-0008][adr8]（partition の対応付けは利用側）／
  [ADR-0023][adr23]（DSL・D1 案1 を本 ADR が部分的に supersede）／[ADR-0040][adr40]（`TenantScope`・
  共有トークン）／[ADR-0055][adr55]（client から `partition` を外した先例）／[ADR-0069][adr69]
  （テナント単位のツール）／[ADR-0074][adr74]（宣言必須＝忘れがコンパイルエラーになる根拠）。
- 影響を受けるガイド: [カスタム項目][guide-cf]／[マルチテナント][guide-mt]／[日時][guide-dt]／[基本設計][bd]。
- 後続（本 ADR の対象外）: [ADR-0040][adr40] 案4b（partition 別トークンの seam）を開くときは
  `TenantOptions` が置き場になりうる。実機確認は [LV-13][lv]。

[adr4]: 0004-field-type-model.md
[adr5]: 0005-public-api-shape.md
[adr8]: 0008-multitenancy-partition.md
[adr23]: 0023-custom-field-declaration-dsl.md
[adr40]: 0040-multitenancy-surface-impl.md
[adr55]: 0055-partition-binding-guard.md
[adr69]: 0069-tenant-field-catalog-tooling.md
[adr74]: 0074-custom-field-declaration-required.md
[rv36]: ../reviews/rv/0036-write-value-validation-partial.md
[rv58]: ../reviews/rv/0058-number-decode-nan-unchecked.md
[rv60]: ../reviews/rv/0060-changelog-stale-silent-null-premise.md
[ref-list]: ../usage/reference/resource-api/resources-list.md
[ref-candidate]: ../usage/reference/resource-api/resources/candidate.md
[guide-cf]: ../usage/topics/custom-fields.md
[guide-mt]: ../usage/recipes/multi-tenant.md
[guide-dt]: ../usage/topics/datetime.md
[bd]: ../design/basic-design.md
[sweep]: ../../CLAUDE.md
[lv]: ../live-verification.md
[runbook]: ../release-runbook.md
