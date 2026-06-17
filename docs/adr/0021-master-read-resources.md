# 21. マスタ Read リソースの公開サーフェス（Partition / User / Field / Option）

- Status: accepted
- Date: 2026-06-17
- Deciders: jun.shiromoto (Joymerrevent)

> jun.shiromoto の決定により **軸1=案1c（単数形アクセサ `porters.partition` 等 ＋ [ADR-0008][0008] の
> スコープ関数を `porters.partition(id)` → `porters.tenant(id)` へ改名）／軸2=案2a（読み取り専用契約）／
> 軸3=案3a（フラット＋`P_ParentId`）／軸4=案4a（`current()` 発見を v1 提供）／軸5=案5a（カタログ駆動）**
> で **accepted（2026-06-17）**。コードへの反映は本 ADR を受けて別 PR で行う。
> 検出元: PRD [R-3][prd] が必須に挙げるマスタ Read（Partition / User / Field / Option）が未実装
> （`src/fields/index.ts` はプレースホルダ、`src/resources/` にマスタ無し）＝唯一残った P0。

## Context and Problem Statement

PRD [R-3][prd]（Must-Have / P0）は、MVP データ系リソースに加えて
**マスタ系 Read（Partition / User / Field / Option）**を v1 の必須に挙げている。
データ系（Candidate ほか）は Read/Write とも実装・テスト済みだが、マスタ系は未着手。

マスタ系は Read レスポンスの封筒（`<{Resource} Total Count Start><Item>…`）こそデータ系と共通だが、
公開サーフェス上はデータ系と**非対称な論点**がある（[docs/reference のマスタ各表][ref-masters]・
[Read パラメータ][ref-read]・[gotchas][gotchas]）:

1. **Write API が存在しない**（4 マスタとも読み取り専用）。[CLAUDE.md][claude]/[R-3][prd] の「delete を生やさない」に加え、
   **create/update も型に出してはいけない**。データ系の汎用 `Resource`（`search`/`searchAll`/`get`/`create`/`update`）をそのまま使えない。
2. **`porters.partition` の命名衝突**。[ADR-0008][0008] 案2 は `const t = porters.partition(123)` を
   **マルチテナント・スコープ関数**として計画している（[basic-design][bd] §82/§117）。マスタ Read のアクセサを素朴に
   `porters.partition` と名付けると、この計画 API と衝突する。
3. **ログイン中 Partition / User の発見**。`Partition Read` / `User Read` を **`request_type=0`** で叩くと
   ログイン中の Partition / User を返す（[gotchas][gotchas]）。[basic-design][bd] §118 は「L1 が提供するオンボーディング補助」と位置づける。
   通常の `search` とはパラメータ・意味が異なる。さらに Partition 発見は **`partition` 必須パラメータとの鶏卵**
   （まだ partition を知らない段階で叩く）があり、実機未確認。
4. **Option の入れ子 `Items`**。Option Read は選択肢マスタを返し、`Items` という**親子（ツリー）コレクション**を含む
   （[option 表][ref-masters]）。データ系の**フラットな**レコード decode では表現しきれない。

問い: **マスタ Read を公開 API としてどう露出するか**。(a) アクセサの名前・形（衝突回避）、(b) 読み取り専用の型契約、
(c) Option ツリーの表現、(d) ログイン発見の出し方、(e) 型付けの導出元 を決める。

## Decision Drivers

- **API 忠実性**: マスタは読み取り専用。Write/delete を**型レベルでも**出さない（[R-3][prd]/[CLAUDE.md][claude]）。
- **フェイルセーフ / least surprise**: 存在しない操作を型に出さない。既定 Read は意味あるレコードを返す（[ADR-0020][0020] と一貫）。
- **single source of truth / 再利用**: データ系で確立した**カタログ駆動の Read 内部**（[ADR-0019][0019]/[ADR-0020][0020]：`as const` カタログ →
  既定 field → decode）を流用し、ズレと重複を作らない。XML は `xml/` に閉じる（[ADR-0011][0011]）。
- **オンボーディング**: [basic-design][bd] §118 の「partition 発見」を L1 が提供できる形にする（GTM の評価可能性）。
- **計画 API を潰さない**（[非ゴール「設計で潰さない」][prd]）: `partition` という名前を [ADR-0008][0008] のスコープ関数のために空けておく。
- **薄いラッパー**: マスタの値表現も PORTERS の形に素直に従う（過剰な再構築をしない）。

## Considered Options

### 軸1: 公開アクセサの名前と形（`partition` 衝突の解消）

- **案1a: 複数形プロパティ** — `porters.partitions` / `porters.users` / `porters.fields` / `porters.options`。
  単数形 `porters.partition(id)` を [ADR-0008][0008] スコープ関数に空けられる。短く、トップ階層に並ぶ。
  難点: データ系が単数（`porters.candidate`）なので**単複が不揃い**。
- **案1b: `masters` ネームスペース** — `porters.masters.partition` / `.user` / `.field` / `.option`。
  「読み取り専用のマスタ」という**カテゴリ**を名前で示し、トップ階層を汚さず、`partition` 名も空く。
  難点: 1 段深い。データ系と並びが違う。
- **案1c: 単数形プロパティ＋スコープ関数を改名** — `porters.partition`（マスタ Read）にし、[ADR-0008][0008] のスコープ関数を
  `porters.tenant(id)` 等へ。難点: 既に [basic-design][bd]/[ADR-0008][0008] に載る計画名の変更＝波及が大きい。

### 軸2: 読み取り専用の型契約

- **案2a: 専用の readonly 契約** — マスタ用 factory は `{ search, searchAll, get }` **のみ**を返す（`create`/`update` を型に出さない）。
  `resource.ts` の Read 内部（`buildReadUrl`/`decodeItem`/ページング/既定 field）を**共有関数に切り出して再利用**し、Write を結線しない。
- **案2b: 汎用 `Resource` を流用し Write を実行時に塞ぐ** — 型に `create`/`update` が残り、呼ぶと throw。
  難点: 「型は呼べると言うのに実行時に落ちる」＝フェイルセーフ/最小驚きに反する。

### 軸3: Option の入れ子 `Items`（ツリー）の表現

- **案3a: フラット＋`P_ParentId`（`Items` は当面そのまま/後回し）** — `Option.P_Id/P_Name/P_Alias/P_ParentId/P_Type/P_Order` を
  フラットに返す。親子は `P_ParentId` で利用側が辿れる。`Items` の構造化は将来（必要が出てから）。最も薄い。
- **案3b: ツリー型で返す** — `children: Option[]` を組み立てて返す。難点: 第1層に再構築ロジックが増える／
  `Items` の実 XML 形が未確認（[gotchas][gotchas]/[ADR-0011][0011] の接地待ち）で、確定前にツリー契約を固めると後で割れる。

### 軸4: ログイン中 Partition / User の発見（`request_type=0`）

- **案4a: 専用の発見メソッド** — `porters.<partitions>.current()` / `<users>.current()` が `request_type=0` を送り 1 件返す。
  オンボーディングの意図が API に出る。Partition 発見の `partition` 鶏卵もこの経路に閉じ込められる。
- **案4b: クエリ拡張パラメータ** — `SearchQuery` に `requestType?: 0` を足し、`search({ requestType: 0 })` で発見。汎用だが意図が埋もれる。
- **案4c: v1 では後回し** — まず通常 `search`/`get` のみ。発見は後続フェーズ。難点: [basic-design][bd] §118 のオンボーディング価値を v1 で出せない。

### 軸5: マスタの型付け（導出元）

- **案5a: カタログ駆動（[ADR-0019][0019] 流用）** — マスタも `as const` カタログ（bare alias → Data Type）で宣言し、Read 型を導出。
  reference で型が `—`（Partition/Field/Option の多く）は `SinglelineText` 扱い、User は表どおり（Mail/Telephone/Date/User 自己参照/System[Department]）。
- **案5b: マスタだけ型をハンドロール** — カタログを介さず手書き型。難点: SoT が割れ、decode 経路も別建てになる。

## Decision Outcome

採用: **軸1=案1c ／ 軸2=案2a ／ 軸3=案3a ／ 軸4=案4a ／ 軸5=案5a**。

- **1c（単数形アクセサ＋スコープ関数を改名）**: マスタ Read を `porters.partition` / `porters.user` / `porters.field` /
  `porters.option` で露出し、**データ系（`porters.candidate`）と同じ単数形**で統一する。衝突する [ADR-0008][0008] の
  マルチテナント・スコープ関数は **`porters.partition(id)` → `porters.tenant(id)` へ改名**する（「テナントを束ねる」意味も
  `tenant` の方が明示的）。波及は本 ADR の accept を受けて [basic-design][bd]（§36/§82/§117）へ反映し、[ADR-0008][0008] には
  改名注記（amended）を付す（accepted ADR 本文は書き換えない）。
- **2a（専用 readonly 契約）**: 存在しない Write を型に出さない＝フェイルセーフ。`resource.ts` の Read 内部を共有関数へ切り出し、
  データ系と**同じカタログ/decode/ページング**を再利用（重複ゼロ）。
- **3a（フラット＋`P_ParentId`）**: 薄いラッパーを保ち、`Items` の実 XML 形が確定する（[ADR-0011][0011] の接地）まで
  ツリー契約を固定しない。親子は `P_ParentId` で表現可能。`Items` の構造化は follow-up。
- **4a（`current()` 発見メソッド）**: [basic-design][bd] §118 のオンボーディングを v1 で提供。`request_type=0` と
  partition 鶏卵をこのメソッドに閉じ込め、通常 `search` を汚さない。
- **5a（カタログ駆動）**: [ADR-0019][0019]/[ADR-0020][0020] の SoT・既定 field・decode をそのまま流用。型 `—` は `SinglelineText`。

### Consequences

- Good: 唯一残った P0（[R-3][prd] マスタ Read）を充足。読み取り専用が型で保証され（Write/delete 不在）、
  データ系と内部を共有（カタログ/decode/ページング/既定 field 再利用）。オンボーディング（partition 発見）を v1 で提供。
  アクセサがデータ系と同じ単数形で統一され、`tenant(id)` はスコープの意図がより明示的。
- Bad: [ADR-0008][0008] 計画名 `porters.partition(id)` の改名（`tenant(id)`）が必要＝[basic-design][bd] への波及反映と
  ADR-0008 への注記。Read 内部の共有関数化に伴うリファクタ（`resource.ts` 分割）が要る。スコープ関数は未実装のため、改名の実コスト＝ドキュメントのみ。
- Neutral: Option の `Items` ツリー・Partition 発見の `partition` 鶏卵・`User.P_Department`（System[Department]）の decode 形は
  **実機未確認**＝[live-verification][lv] に LV エントリを追加し、`VERIFY(live)` で接地する。新スコープ
  `partition_r`/`user_r`/`field_r`/`option_r` は既存 `Scope`（`${string}_r`）テンプレートに収まり**型変更不要**。

## Pros and Cons of the Options

### 軸1

- **案1a**: Good=短い・トップ階層・`partition` 名を空けられる。Bad=データ系と単複不揃い。
- **案1b**: Good=読み取り専用カテゴリを明示・`partition` 名を空けられる・トップ階層を汚さない。Bad=1 段深い。
- **案1c**: Good=データ系と同じ単数形で統一。Bad=計画済みスコープ関数名の変更＝[ADR-0008][0008]/[basic-design][bd] へ波及。

### 軸2

- **案2a**: Good=存在しない操作を型に出さない（フェイルセーフ）。Bad=Read 内部の共有関数化が要る。
- **案2b**: Good=実装が即席。Bad=型は呼べると言うのに実行時に落ちる＝最小驚き違反。

### 軸3

- **案3a**: Good=薄い・接地待ちのツリー契約を固定しない・`P_ParentId` で親子可。Bad=`Items` を今は構造化しない。
- **案3b**: Good=ツリーが使いやすい。Bad=第1層に再構築・未確認 XML 形で契約が割れる恐れ。

### 軸4

- **案4a**: Good=意図が API に出る・鶏卵を閉じ込める。Bad=専用メソッドの追加。
- **案4b**: Good=汎用。Bad=オンボーディング意図が埋もれる・`search` に発見専用パラメータが混ざる。
- **案4c**: Good=最小。Bad=[basic-design][bd] §118 の価値を v1 で出せない。

### 軸5

- **案5a**: Good=SoT 一本化・decode 再利用。Bad=型 `—` を `SinglelineText` に寄せる近似。
- **案5b**: Good=マスタ固有型を厳密化。Bad=SoT 分裂・decode 別建て。

## More Information

- 接地: [docs/reference マスタ各表（partition/user/field/option）][ref-masters]・[Read パラメータ][ref-read]・[gotchas（request_type=0）][gotchas]。
- 依存/関連: [ADR-0005][0005]（公開 API の形）／[ADR-0008][0008]（`partition(id)` スコープ＝命名衝突元）／
  [ADR-0019][0019]（カタログ SoT）／[ADR-0020][0020]（既定 field）／[ADR-0011][0011]（decode の入れ子形）／[ADR-0017][0017]（Option 値表現）。
- 不確実性: [live-verification][lv]（Option `Items` の XML 形・Partition 発見の `partition` 鶏卵・`User.P_Department` の参照可否）を accept 後に LV 追加。
- フォローアップ: accept 後に実装 PR（Read 内部の共有関数化 → マスタ factory → カタログ → テスト fixture → README/JSDoc）。

[prd]: ../design/requirements.md
[bd]: ../design/basic-design.md
[claude]: ../../CLAUDE.md
[lv]: ../live-verification.md
[ref-masters]: ../reference/resource-api/resources/
[ref-read]: ../reference/resource-api/README.md
[gotchas]: ../reference/gotchas.md
[0005]: 0005-public-api-shape.md
[0008]: 0008-multitenancy-partition.md
[0011]: 0011-xml-parse-serialize.md
[0017]: 0017-option-read-shape.md
[0019]: 0019-static-resource-types.md
[0020]: 0020-read-field-default.md
