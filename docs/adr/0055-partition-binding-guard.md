# 55. `partition` が束ねられていない呼び出しの扱い

- Status: proposed
- Date: 2026-08-21
- Deciders: jun.shiromoto (Joymerrevent)

> [findings RV-25][rv25] の是正案。`partition` を渡さずに構築したクライアントが、
> **ライブラリの発明した `0`** を全リクエストに載せている。`0` に意味が無いことは調査で確定したので、
> 論点は「**`0` を廃したあと、未束縛の呼び出しをどこでどう落とすか**」に絞られる。
> 決定は decider が行う（自己 accept しない）。実施は accept 後の別 PR。

## Context and Problem Statement

`src/client.ts:209` は `buildScope(options.partition ?? 0)` と書かれており、
`partition` が未設定なら **`0`** が全リクエストのクエリに載る。

### `0` に意味は無い（調査結果）

- **正典に記載が無い**。`docs/reference/resource-api/README.md:21` の Read パラメータ表は
  `partition` を「**Partition Id（数値）。Partition Read で取得可能**」とし、**必須（●）**。既定値の記載は無い。
  [glossary][glossary] も「会社ごとに独立したデータ単位。Read では `partition` 必須」。
  reference 全体を `partition` × `0` / 既定 / default で検索しても該当なし。
- **ADR / 設計文書にも無い**。[ADR-0005][adr5] や [basic-design][bd] が言う「client 既定 partition」は
  **利用者が設定した既定値**の意味で、**未設定時に何を送るか**は誰も決めていない。
- **出所は PoC のプレースホルダ**。`git log -S"partition ?? 0"` が指すのは最初の縦切り
  （`9459067 feat: PoC — OAuth(code_direct) + Candidate Read 縦切り`）で、
  型を通すための穴埋めがそのまま残っていた＝設計判断ではない。
- **実際の帰結は文書化されている**。[result-codes][rc] の **404** は
  「partition が存在しない/利用期間外（未開始/解約/**ID 誤り**/Token 失効）」。
  `partition=0` は「ID 誤り」に該当し、**サーバー由来の 404** として返る。

> **`request_type=0` とは別物**。Partition Read / User Read の `request_type=0`（ログイン中の
> partition / user を取る）には意味があるが（[ADR-0022][adr22]）、それは**別のパラメータ**で、
> `partition=0` とは無関係。混同しやすいので明記しておく。

### 何が問題か

設定漏れが「**構築時の明確な設定エラー**」ではなく「**実行時のサーバー 404**」になる。
利用者から見れば「そんな partition は無い」と言われるだけで、
**自分が `partition` を設定し忘れたことに気づけない**。

これは [ADR-0048][adr48] / [ADR-0049][adr49] が `host` について塞いだのと**同じ形の穴**である。
`host` は「スキームやパスを含む値は接続を試みる前に落とす」と決めたのに、
partition は無検証のまま**ライブラリが値を捏造している**ぶん、むしろ悪い。

### 単純な必須化はできない

`partition` を必須オプションにすれば構築時に落とせるが、**それは正しい使い方を壊す**。
`porters.tenant(id)`（[ADR-0040][adr40] F-3）で partition をスコープに束ねる SaaS 構成では、
**client 既定の partition は不要**だからだ。

```ts
const porters = new PortersClient({ host, appId, appSecret }); // 正当な構成
await porters.tenant(123).candidate.search(); // partition=123 で送られる
```

つまり「未設定」は**エラーではなく正当な状態**でありうる。落とすべきなのは
「**未束縛のまま、partition を要するリクエストを出そうとした**」瞬間だけ。

## Decision Drivers

- **誤設定は早く・明確に落とす**（[ADR-0048][adr48] で `host` について確立した方針を partition にも及ぼす）
- **値を捏造しない**。ライブラリが正典に無い値を作ってはいけない（`0` はその違反）
- **正しい使い方を壊さない** — `tenant(id)` だけを使う構成は `partition` 未設定が正当
- **公開型の複雑さを増やしすぎない**（[ADR-0005][adr5] の「薄いラッパー」）
- **フェイルセーフ**: 防げるなら早い段階（型 > 構築時 > 送信前 > サーバー）で防ぐ

## Considered Options

- **案A: 送信前の実行時ガード** — 未設定は `undefined` のまま持ち、
  URL を組む段で `undefined` なら `PortersConfigError`（hint 付き）で落とす。
- **案B: 型で防ぐ** — `partition` の有無を型パラメータに持ち、
  **未設定の client からはデータ系アクセサを生やさない**（`porters.candidate` がコンパイルエラー）。
- **案C: 構築時に必須化** — `partition` を必須オプションにする。
- **案D: 現状維持** — `0` を送り続け、404 を利用者に解釈させる。
- **案E: `0` の意味を実機で確認する**（[live-verification][lv] へ登録し、確定するまで保留）。
- **案F: `PortersClient` から `partition` を外す** — client 既定を廃止し、
  **partition スコープのリソースは `porters.tenant(id)` 経由でしか得られない**ようにする。
  client 直下に残るのは partition を取らないもの（`auth` ＋ `partition` マスタ）だけ。

## Decision Outcome

> **未決（proposed）**。以下は起票者の推奨であり、決定は decider が行う。

**推奨: 案F**（`PortersClient` から `partition` を外す）。

```ts
const porters = new PortersClient({ host, appId, appSecret });

await porters.auth.ensureAuthenticated(); // App レベル（partition を取らない）
await porters.partition.search(); // partition の発見（partition を取らない）

const t = porters.tenant(123); // ここで束ねる
await t.candidate.search();
```

理由:

- **不正な状態そのものが消える**。案A は「未設定という状態を許して、使われた瞬間に落とす」だが、
  案F は**未設定という状態が存在しない**。`ResourceDeps.partition` は `number` のままでよく、
  `undefined` の分岐も、ガードも、そのテストも要らない。
  フェイルセーフの階層で言えば **案A は「送信前に落とす」・案F は「そもそも作れない」**で、後者が上位。
- **公開型を複雑にせずに型で守れる**。案B（型パラメータで partition の有無を表す）と同じ効果を、
  **既にある `tenant(id)` の形だけ**で得られる。新しい型パラメータは増えない。
- **役割が綺麗に割れる**。実装を確認したところ `options.partition` の使用箇所は**1 箇所だけ**で、
  `TenantScope` には**partition を要するリソースが既に全部揃っている**
  （データ 5 種 ＋ Attachment ＋ マスタ user/field/option）。
  client 直下に残るのは**partition を取らないもの**（`auth`・`partition` マスタ）だけになり、
  「client ＝ App レベル ＋ tenant ファクトリ」「TenantScope ＝ partition スコープ」と説明が 1 文で済む。
- **[ADR-0040][adr40] の 2 層解決が 1 層になる**。「スコープと client 既定のどちらが効いているか」を
  利用者が考える必要がなくなる（`partition` の取り違え事故の芽も消える）。
- **いま入れるのが最も安い**。0.x で、公開から日が浅く、1.0 の前。1.0 後に同じことをやると重い。

### 破壊的変更であること（正直なコスト）

単一テナントの利用者は書き換えが要る。

```ts
// 変更前
const porters = new PortersClient({ host, appId, appSecret, partition: 123 });
await porters.candidate.search();

// 変更後
const porters = new PortersClient({ host, appId, appSecret });
const t = porters.tenant(123);
await t.candidate.search();
```

ただし**スコープを一度持てば以降のエルゴノミクスは同じ**（`t.candidate` と `porters.candidate` は等価）。
むしろ「partition は必ず明示する」ことが型で強制される。

**`tenant(id)` という名前**は多テナント機能に見えるが、単一テナントの利用者も必ず通る道になる。
改名（`for(id)` 等）も考えられるが、[ADR-0021][adr21] が `partition(id)` → `tenant(id)` に改名した経緯があり
（`porters.partition` マスタと衝突するため）、再改名は churn を増やす。
**`tenant` のまま、ドキュメントで「単一テナントでも使う」と明示**するのが妥当。

### 案A を次善として残す

破壊的変更を避けたい場合は **案A（送信前の実行時ガード）**が次善。
`?? 0` を削除して `undefined` のまま持ち、URL 組立時に落とす。
公開 API は変わらないが、**不正な状態は残り**、ガードとそのテストを保守し続けることになる。

案B は公開型が複雑になるうえ、実行時に partition を決める構成（設定ファイル・環境変数）では
結局 `undefined` を扱うので型だけでは閉じない。案C は `tenant(id)` 構成を壊す。案D は問題を放置する。
案E（`0` の意味を実機確認）は**不要** — 正典に記載が無く、由来は PoC のプレースホルダで、
404 という帰結も文書化されている。確認を待つ理由が無い。

### 実施時の合意事項（accept 後の別 PR）

1. **`PortersClientOptions` から `partition` を削除**する。`?? 0` も当然消える。
   `ResourceDeps.partition` は `number` のまま（`undefined` を持ち込まない）。
2. **client 直下から partition スコープのアクセサを外す** — `candidate` / `job` / `client` /
   `process` / `resume` / `attachment` / `user` / `field` / `option` は `tenant(id)` 経由のみ。
   client に残すのは **`auth`（App レベル）と `partition` マスタ（発見用・partition を取らない）と
   `tenant(id)` 自身**。
3. **`tenant(id)` は改名しない**（上記の理由）。ただし**単一テナントでも使うもの**だと
   [マルチテナント ガイド][mt] と README に明記する。ガイドの章立ても
   「マルチテナント向け」から「**partition の束ね方**」へ寄せる。
4. **移行手順を CHANGELOG に書く**。`partition: N` を渡していたコードは
   `const t = porters.tenant(N)` に置き換える、という 1 対 1 の対応を示す。
5. **テストで両方を pin する** — `tenant(id)` 経由で全リソースが使えること、
   client 直下に partition スコープのアクセサが**生えていない**こと（型テスト）。
6. **README・全ガイド・examples の書き換え**。`partition: 123` を渡す例が
   README 2 箇所・マルチテナント ガイド・カスタム項目ガイドにあるので、全部揃える。
7. **semver は major ではなく minor**（0.x のため。ただし CHANGELOG では
   **破壊的変更**として最上部に明記し、移行手順を添える）。
   1.0 前に入れることが本決定の前提の一つ。

### Consequences

- Good: **不正な状態（partition 未束縛）が型として存在しなくなる**。ライブラリが正典に無い値を作らない。
  partition の解決が 1 層になり説明が単純になる。ガードとそのテストを保守しなくてよい。
  「partition は必須」という PORTERS の事実が API の形に現れる。
- Bad: **破壊的変更**。単一テナントの利用者は `porters.tenant(N)` を挟む書き換えが要る。
  ドキュメント・examples の書き換え範囲も広い。
  client を 1 つ持ち回る設計では、`TenantScope` と `PortersClient` の 2 つを持ち回ることになる場合がある
  （`auth` と data の両方が要るコード）。
- Neutral: [ADR-0040][adr40] の 2 層解決（スコープ → client 既定）は 1 層に縮む＝**部分的に supersede** する。
  [ADR-0008][adr8] 案2 の「client 既定値も持てる」という記述も本決定で無効になる。

## Pros and Cons of the Options

### 案A: 送信前の実行時ガード（次善）

- Good: 変更が 3 点に収まる。`tenant(id)` 構成も既存の正しい設定も壊さない。
  既存ガードの系列（リクエスト長・keywords・`count`）に載るので利用者が学ぶ概念が増えず、
  呼び出し側は `async` なので reject で届く（[ADR-0046][adr46]）。**破壊的変更にならない**。
- Bad: コンパイル時には気づけない（実行するまで分からない）。
  **不正な状態（未束縛）は残る**ので、ガードとそのテストを保守し続けることになる。

### 案B: 型で防ぐ（未設定なら data アクセサを生やさない）

- Good: **最も早く**気づける（コンパイルエラー）。フェイルセーフとして最強。
- Bad: `PortersClient<C>` に型パラメータが増え、`TenantScope` との関係も型で表し直すことになる。
  公開型が複雑になり、[ADR-0005][adr5] の「薄いラッパー」から遠ざかる。
  `partition` を実行時に決める構成（設定ファイル・環境変数）では結局 `undefined` を扱うので、
  型だけでは閉じない。

### 案C: 構築時に必須化

- Good: 最も単純。落ちる場所が 1 箇所。
- Bad: **`tenant(id)` だけを使う正当な構成を壊す**（[ADR-0040][adr40] の設計と衝突）。

### 案D: 現状維持

- Good: 何もしなくてよい。
- Bad: ライブラリが正典に無い値を捏造し続ける。設定漏れがサーバー 404 に化け、原因が分からない。

### 案F: `PortersClient` から `partition` を外す（推奨）

- Good: **不正な状態が存在しなくなる**（ガードではなく設計で防ぐ）。公開型を複雑にせず型で守れる。
  partition の解決が 1 層。役割の説明が 1 文で済む。1.0 前なら移行コストが最も安い。
- Bad: **破壊的変更**。単一テナントでも `tenant(id)` を挟む。ドキュメント・examples の書き換えが広い。
  `auth` と data の両方が要るコードは 2 つのオブジェクトを持ち回ることがある。

### 案E: `0` の意味を実機で確認（LV 登録）

- Good: 仮定を実測で潰す、という本プロジェクトの作法には沿う。
- Bad: **確認する価値が無い**。正典に記載が無く、由来は PoC のプレースホルダで、
  404 という帰結も文書化済み。契約取得まで判断を遅らせる理由にならない。

## More Information

- 起票元: [findings RV-25][rv25]。
- 同じ形の先例: [ADR-0048][adr48]（`host` の書式検証）／[ADR-0049][adr49]（既定ポート）。
  **設定の正しさを構築時／送信前に強制する**系列。
- ガードの置き方の先例: [RV-28][rv28] の `appendPaging`（6 箇所の重複を 1 つのヘルパーへ集約し、
  そこにガードを置いた）。本件も同じ形にする（合意事項 2）。
- `partition` の解決順序: [ADR-0040][adr40]（`tenant(id)` スコープ → client 既定の 2 層・per-call 引数は無し）。
- Partition Read が `partition` を取らないこと: [ADR-0022][adr22]・[LV-8][lv]。

[adr5]: 0005-public-api-shape.md
[adr8]: 0008-multitenancy-partition.md
[adr21]: 0021-master-read-resources.md
[adr22]: 0022-master-read-query-surface.md
[adr40]: 0040-multitenancy-surface-impl.md
[adr46]: 0046-guard-error-contract.md
[adr48]: 0048-access-point-host-validation.md
[adr49]: 0049-host-port-roundtrip.md
[bd]: ../design/basic-design.md
[glossary]: ../reference/glossary.md
[lv]: ../live-verification.md
[mt]: ../guide/multi-tenancy.md
[rc]: ../reference/resource-api/result-codes.md
[rv25]: ../reviews/rv/0025-partition-default-zero.md
[rv28]: ../reviews/rv/0028-count-range-unvalidated.md
