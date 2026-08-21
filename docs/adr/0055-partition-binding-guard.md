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

## Decision Outcome

> **未決（proposed）**。以下は起票者の推奨であり、決定は decider が行う。

**推奨: 案A**（送信前の実行時ガード）。

変更は 3 点に収まる。

1. `src/client.ts` の `?? 0` を**削除**し、未設定は `undefined` のまま保持する。
2. 内部の `ResourceDeps.partition` を `number | undefined` にする。
3. URL 組立時に `undefined` なら `PortersConfigError` を投げる（`category: "config"` ＋ hint）。

```ts
const porters = new PortersClient({ host, appId, appSecret }); // partition なし
await porters.tenant(123).candidate.search(); // ✅ 通る（束ねている）
await porters.candidate.search();
// ❌ PortersConfigError: partition is not configured
//    hint: Pass `partition` to PortersClient, or bind one per call with porters.tenant(id).
```

**公開オプションの型は変えない**（`partition?: PartitionId` のまま）。

理由:

- **`tenant(id)` の経路は最初から影響を受けない**。`tenant(id)` は必ず実数を渡すので、
  ガードは「未束縛のまま呼んだ」ときにだけ発火する＝**正しい使い方を壊さない**。
- **既存の正しい設定も影響を受けない**。`partition` を渡している利用者には何も変わらない。
- **既存ガードの系列に載る**。リクエスト長・keywords・itemstate・`count`（[RV-28][rv28]）・
  Attachment 10MB と同じ「送信前に `PortersConfigError`」で、**利用者が学ぶ概念が増えない**。
  呼び出し側は `async` なので reject で届く（[ADR-0046][adr46]）。
- 案B（型で防ぐ）は**フェイルセーフとしては最も強い**（コンパイル時に気づける）が、
  `PortersClient<C>` に partition の有無を表す型パラメータが増え、
  `TenantScope` との関係も型で表現し直すことになる。**公開型の複雑さに見合わない**と判断した
  — 守りたいのは「設定し忘れ」という一点で、それは実行時ガードで十分に早く捕まる。
  将来 partition 未設定が常態になるなら再検討の価値はある。
- 案C は上記のとおり `tenant(id)` 構成を壊す。案D は問題を放置する。
- 案E（`0` の意味を実機確認）は**不要**。正典に記載が無く、由来が PoC のプレースホルダで、
  404 という帰結も文書化されている。**確認を待つ理由が無い**（LV を増やす価値も無い）。

### 実施時の合意事項（accept 後の別 PR）

1. **`?? 0` の削除が本体**。未設定を `0` に化かさない。`ResourceDeps.partition` は `number | undefined`。
2. **ガードは 1 箇所に置く**。`partition` を URL に載せるのは
   `buildReadUrl` / `buildWriteUrl` / 各マスタの URL 組立なので、
   **`appendPaging`（[RV-28][rv28]）と同じ発想で共有ヘルパー**にまとめ、そこで検査する。
   後から Read/Write を足しても素通りしないこと。
3. **Partition Read は対象外**。`partition` を取らない（[ADR-0022][adr22]・[LV-8][lv]）ので、
   `ResourceDeps` から `partition` を省いた形のまま。ガードも掛けない。
4. **メッセージは原因と対処を名指しする**。
   `partition is not configured` ＋ hint「`PortersClient` に `partition` を渡すか、
   `porters.tenant(id)` で束ねる」。**どちらの直し方もある**ことを示す（片方だけ書かない）。
5. **テストで両経路を pin する** — `tenant(id)` 経由は通ること、未束縛の呼び出しは落ちること。
   マスタ Read・Attachment・一括書き込みも含めて**全経路**を確認する。
6. **`0` を明示的に渡した場合は素通しでよい**。利用者が `partition: 0` と書いたなら
   それは利用者の選択で、404 はサーバーが答える。ライブラリが**捏造しない**ことが本 ADR の主題。
7. **ドキュメント**: [マルチテナント ガイド][mt] に「client 既定と `tenant(id)` のどちらかが要る」ことを明記。
   `PortersClientOptions.partition` の JSDoc も更新する。
8. **semver は minor**（送信できていた呼び出しが例外になる＝観測可能な挙動の変化）。

### Consequences

- Good: 設定漏れが**構築〜送信前**に、原因を名指しした `PortersConfigError` で分かる。
  ライブラリが正典に無い値を作らなくなる。`host` の扱い（[ADR-0048][adr48]）と方針が揃う。
- Bad: これまで `partition=0` で 404 を受けていたコードは**例外に変わる**（挙動変更・minor）。
  実質的に壊れていたコードなので実害は無いはずだが、404 を握りつぶしていた実装は影響を受ける。
- Neutral: 型では防げないまま（案B を採らない）。コンパイル時に気づきたくなったら
  本 ADR を supersede して型パラメータを導入できる。

## Pros and Cons of the Options

### 案A: 送信前の実行時ガード（推奨）

- Good: 変更が 3 点に収まる。`tenant(id)` 構成も既存の正しい設定も壊さない。
  既存ガードの系列に載るので利用者が学ぶ概念が増えない。
- Bad: コンパイル時には気づけない（実行するまで分からない）。

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
