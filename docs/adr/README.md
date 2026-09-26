# Architecture Decision Records (ADR)

このディレクトリは `@joymerrevent/porters-connect` の設計判断を、決めた理由ごと残す場所です。
`docs/history/SPEC_v1.md` は**素案**であり、ここで議論・確定した内容が正となります。

> **ADR の一覧は [索引（index.md）][index]** にあります。本ファイルは**運用ルールと未起票の論点**を置きます
> （役割分担は [ADR-0053][0053]）。

## ADR とは

「なぜその設計にしたか」を 1 判断 1 ファイルで残す軽量な記録です。
コードを読んでも分からない「選ばなかった選択肢」と「その理由」を未来の自分／貢献者に伝えます。
形式は [MADR（Markdown Any Decision Records）][madr-markdown-any-decision-records] のフル版に準拠します。

## 運用ルール

- 1 判断 = 1 ファイル。ファイル名は `NNNN-kebab-title.md`（連番 + 内容）。
- **番号は ADR を起票する時に採番**する（その時点の最大番号 + 1）。**連番のみ・欠番や振り直し・再利用はしない**。
  バックログには番号を振らない（差し込みのたびに番号と参照を直す事故を防ぐため）。
- **未起票の ADR を参照するときは番号でなくトピック名で指す**（例: 「→ 型設計の ADR」）。起票後にリンクへ更新してよい。
- **ADR は自己完結させない**。フローは **起票（`proposed`）→ チームで議論 → 決定を反映（`accepted`）**。
  個人や AI が単独で `accepted` にしない。**決定事項の反映（`CLAUDE.md` / `SPEC` などの更新）は `accepted` 後**に行う。
- ステータスは次のいずれか：`proposed`（議論中）/ `accepted`（確定）/ `rejected`（不採用）/ `deprecated`（廃止）/ `superseded by NNNN`（後続で置換）。
- **`accepted` 後の直しは 2 通りある。「方針を変える」のか「間違いを直す」のかで扱いが違う**。
  - **方針（決定）を変える → 本文の書き換えは禁止**。新しい ADR を起こし、旧 ADR を
    `superseded by NNNN` にする。決定を上書きすると「なぜそう決めたか」の記録が消え、
    ADR が存在する理由そのものが無くなるため。
  - **事実の間違い・古くなった記述を直す → 直してよい**。決定が変わらないなら新 ADR は要らない。
    ただし**黙って直さない**: 誤った記述に取り消し線（`~~…~~`）を引き、**訂正（日付）**で始まる注記を
    続けて、①何が違ったか ②現状はどうか ③**決定そのものは変わらないこと**を書く。
    読んだ人が「決定が変わったのか」を判断できるようにするため。
    先例は [ADR-0049][0049]（実装時に前提の見立てが誤りと判明した箇所に
    `**訂正（実装時 2026-08-12）**` を注記し、決定は据え置いた）。
  - 判断に迷ったら **「その注記を読んで、決定が変わったと思う人がいるか」** で切り分ける。
    いるなら方針変更＝新 ADR、いないなら訂正注記でよい。
- **移設前のパス表記**: ファイルを移したり名前を変えたりしたら、ここに読み替えを足す（ADR の本文は書き換えないので、
  古いパスのまま残る）。2026-09-12 より前の ADR 本文にある `docs/reference/…` / `docs/howto/…` /
  `docs/start/…` / `docs/api/` は、いずれも現在の `docs/usage/…` を指す（[ADR-0071][0071]）。
  リンクは移設時に直してあるが、**決定の文面は書き換えない**運用なので散文の表記は当時のまま残る。
  同じく 2026-09-22 より前の `docs/usage/howto/…` / `docs/usage/concepts/…` は `docs/usage/topics/…`
  （添付は `resources/attachment.md`、同期と複数テナントは `recipes/…`）を指す（[ADR-0088][0088]）。
  同じく 2026-09-25 より前の ADR 本文にある `src/` のパスは、次のとおり読み替える（[ADR-0097][0097]）:
  `src/resources/{resource,query,expand,image,bulk-write,get-many}.ts` → `src/resources/core/…`、
  `src/resources/read-core.ts` → `src/resources/core/read.ts`、`src/http/retry.ts` → `src/http/backoff.ts`、
  `src/auth/token-provider.ts` → `src/auth/default-token-provider.ts`、`src/auth/memory-store.ts` →
  `src/auth/memory-token-store.ts`、`src/types/`（`Scheme` / `Scope` / `PartitionId`）→ `src/http/access-point.ts` /
  `src/auth/types.ts` / `src/client.ts`、`AccessTokenSource` は `src/auth/types.ts` → `src/http/types.ts`。
  さらに [ADR-0098][0098] で、`src/resources/resource-list.ts` / `src/resources/field-type.ts` → `src/porters/…`、
  `DataType`（`src/xml/decode.ts`）→ `src/porters/data-type.ts`、出典に書いてある上限・値（`MAX_REQUEST_LENGTH` など）→
  `src/porters/{request,read-rules,write-rules,image,attachment,custom-field,time-of-day}.ts` に移した。
  その後の整理で `src/resources/core/resource.ts` を分け、データ系の factory は `src/resources/core/data-resource.ts`
  （`createResource` → `createDataResource`）、`ResourceDescriptor` は `core/descriptor.ts`、`firstWriteResultId` /
  `buildWriteUrl` は `core/write.ts` に移した。マスタの読み取りは `core/master-resource.ts`（`createMasterResource`）。
  2026-09-26 の `core/` の整理で、さらに次のとおり分けた・名前を変えた（いずれも `src/resources/core/` の中）:
  `data-resource.ts` の読み込み・書き込み → `read-data.ts`（`createDataReader`）/ `write-data.ts`（`createDataWriter`）、
  `master-resource.ts` の読み込み → `read-master.ts`（`createMasterReader`）、`read.ts` の項目の一覧の型と `rawValue` →
  `catalog.ts`、`ResourceDeps` → `deps.ts`、`decoderFor` → `decoder.ts`、`Paging` / `paginate` などのページ送り →
  `paging.ts`、`field` の組み立て → `field-param.ts`、`bareAlias` → `src/util/alias.ts`、`query.ts` の組み立て →
  `query-encode.ts`、`get-many.ts` → `read-many.ts`（`readByIds` → `readMany`）、`bulk-write.ts` → `write-many.ts`
  （`runBulkWrite` → `writeMany`）、読み込みの戻り値の型（`RequestedRecord` など）→ `read-record.ts`、
  `CreateInput` / `UpdateInput` → `write-record.ts`、`Without` → `src/util/types.ts`。
- 雛形は [`0000-template.md`][0000-template-md]（MADR フル）をコピーして使う。
- セクション構成：Context and Problem Statement → Decision Drivers → Considered Options →
  Decision Outcome（+ Consequences）→ 信じている入力 → Pros and Cons of the Options → More Information。
  「信じている入力」は**実装前に埋める**節で、該当が無ければ「該当なし — 理由」を 1 行書く
  （節ごと消さない）。信頼できない入力源が 3 つ以上ある決定では必須。

### 索引との付き合い方（[ADR-0053][0053]）

- **ADR を起票したら [索引][index] にも 1 行足す**。ステータスを変えたら索引も直す。
- **状態の正は各 ADR 本文**（`- Status:` と `- Implemented:`）で、索引はその写し。
  ズレは **`pnpm check:index`** が検出して CI で落とす（人の注意でなく仕組みで守る）。
- **`- Implemented: X.Y.Z`** は「その決定が世に出た版」。**任意**で、プロセス決定など実装の概念が無い ADR には書かない
  （索引では `—`）。書いたら索引の「実装」列と一致させる。
- **索引に散文を書かない**。「実装待ち」「議論中」といった状態の言い換えは、テーブルの列で表す。
  かつて索引に置いていた状態別の節は、**4 件が陳腐化した実績**があるため廃止した（[ADR-0053][0053]）。

## フェーズ凡例

各 ADR / バックログ項目に**フェーズ**を付ける：**プロセス**（進め方・メタ）／ **要件定義**（何を作るか・PRD 担当）／ **基本設計**（外部仕様・全体像：公開 API・型・エラー・認証・層責務）／ **詳細設計**（内部実装・実装フェーズで決める）。

## 論点バックログ（未起票）

**まだ ADR を起こしていない論点**だけを置く（起票済みのものは [索引][index] が正）。
**番号は付けない**（起票時に採番）。前方参照はトピック名で行う。フェーズは上記凡例に従う。

### 【要件定義】

- PRD オープン論点（[requirements §8][prd]）の確定 — **2026-09-18 時点で残るのは 1 件**：
  「成功指標の数値化タイミング」[stakeholder]。
  （2026-08-09 の棚卸しでは 2 件だった。「v1 で CJS 出力まで出すか」[eng] は [0082][0082] として
  起票・accepted・実装済み＝ここには残さない。バージョン表記は [0042][0042]、サンドボックス R-17 は
  P1 のまま出荷、npm スコープ/組織は公開実績で決着。「1 App トークンで複数 partition」は
  実機確認事項のため [live-verification][lv-doc] LV-13 へ移送）

### 【基本設計】

- **未起票の論点はなし**（過去にここへ挙げていた「ページング・検索条件の抽象化」は [0038][0038] として起票・accepted・実装済み）。

### 【詳細設計】

- **条件付き 1 件（実例が出たら起票）**: **`fast-xml-parser` が拒否する予約名（`prototype` /
  `constructor` / `__proto__`）を書き込み側でも弾くか** — [RV-54][rv54] の案 (b)。RV-54 の処置では
  読み側で `PortersError` に包む案 (a) だけを入れ、この判断は**保留**した（2026-09-20）。
  論点は [0002][0002] との兼ね合い＝ **PORTERS が受け付ける値を JS パーサの都合で拒否してよいか**。
  いまは「書けるが読み返すと `PortersResourceError`（`cause` にパーサの説明）」で倒れる。
  利用者がこの名前の alias を実際に使い、読めないことが問題になった時点で起票する
  （それまでは決めない＝実例の無い判断をしない）。
- 上記以外の未起票の論点はなし（ここへ挙げていた「必須の `resource` をどう束ねるか」は
  [0080][0080]（URL パラメータのリソースは `of()` で束ねる）と [0081][0081]（Attachment の Read を
  出典の語彙に）で決着・実装済み。Field / Phase / Attachment の 3 本が `of()` に揃った。
  HTTP トランスポート／リトライ・スロットリング／XML パース・シリアライズ／トークンのキャッシュ・更新／
  FieldType の粒度／Option の読み取り値／Attachment／マスタ Read はすべて起票済み。各々の状態は
  [索引][index] を参照）。

### ADR を起こさずに決着した論点（記録）

- **値レベルの実行時検証**（ロードマップの案D の残り 1 つ）— **ADR 不要と判断**（2026-09-10）。
  一度ここに未起票論点として挙げたが、精査すると**方針は既に accepted で決まっていた**
  （[ADR-0006][0006]「宣言型と実データの食い違いも `validation` で surface・silent な誤変換は
  しない」／[ADR-0011][0011] が同旨）。残った 1 点（書き側の検証範囲）も**現状維持**の決定に
  なったため、新しい決定は 1 つも生じない。実装は [RV-36][rv36] の処置として行う
  （**事前**に突き合わせる側は [0069][0069] が担当＝実行時／事前の両輪）。
  **教訓**: 「未起票の論点」に見えるものが、既存 ADR の**未実装**であることがある。
  起票する前に既存 ADR を検索する。

- **スロットルの上限値の検証**（[RV-49][rv49]）— **ADR 不要と判断**（2026-09-19）。
  `createThrottle` が `floor(上限 × safety) = 0` を受け付けて永久に待つ欠陥だが、
  **決定は既に accepted で出ている**: [ADR-0077][0077]（公開 factory の数値オプションは
  構築時に検証し、`0` のように「無効」と読める値を弾く）／[ADR-0006][0006]（呼び出し側由来は
  `PortersConfigError`）／[ADR-0047][0047]（許可と沈黙を分ける＝「1 件も通さない」を
  黙って受けない）。新しい決定は 1 つも生じず、**0077 の未適用の片側**を埋めるだけ
  （[RV-25][rv25] が [ADR-0048][0048] に対してそうだったのと同じ形）。
  実装は [RV-49][rv49] の処置として行った。
  **教訓**: 「公開 factory の数値オプション」は 2 つあり（`timeoutMs` と上限値）、
  片方だけ検証されていた。**同じ種類の継ぎ目が複数あるなら、決定は全部に当てたか確かめる。**

- **時分型の decode 側の範囲検証**（[RV-55][rv55]）— **ADR 不要と判断**（2026-09-21）。
  `decodeTimeOfDay` が基準日は見るが時・分・秒の範囲を見ず、`1970-01-01T30:00:00Z` を `"30:00"` と
  読んで**別の wire 値に往復**していた欠陥だが、**決定は既に accepted で出ている**:
  [ADR-0086][0086] 論点3（変換関数は**両方向とも**検証し、外れたら `PortersConfigError` の
  `validation`）。通していた値はどれも出典の書式に無く、新しい決定は 1 つも生じない＝
  **0086 の未適用の片側**を埋めるだけ（上の [RV-49][rv49] と同じ形）。実装は [RV-55][rv55] の処置として行った。
  **教訓**: ADR が「両方向」と書いた検証は、**両方向の実装を突き合わせて**初めて決定どおりになる。
  往復の property が正常域しか引かないと、片側の欠けは通り抜ける（拒否を証明するなら不正域も生成する）。

- **Stryker の survivor 79 件の扱い**（[RV-59][rv59] 案 (b)）— **ADR 不要と判断**（2026-09-21・stakeholder）。
  「規則（[0015][0015]: survived は撃破か、同値のみ `// Stryker disable` ＋理由）と実態（Survived 89 ／
  Ignored 42・閾値 95 の下に溜まる）のどちらを直すか」を、**件数でなく行の一覧**で判断した。
  79 件の内訳: **挙動 25**（Option search の `method: "GET"` を `""` にしても 1437 件緑・`itemstate === "all"`・
  2MB 境界の計算違い・`field-type` の勝者規則が表の並び順で同値 …）／**契約 9**（`PortersConfigError` の
  `category` を空にしても通る）／文言 34／`context` 8／同値 3。**43% は規則を改訂しても残る穴**で、
  しかも穴の 2 つ（`method` / `itemstate`）は文字列変異＝「文字列は pin しない」と一括で除外すると
  見えなくなる種類だった。文言の pin は部分文字列で足り、0.21.0 で見つかった「hint が廃止済みの
  `host` を案内」のような陳腐化を仕組みで捕まえる価値もある。よって **0015 の決定をそのまま適用**
  （全件撃破・同値 1 件のみ明示）し、ratchet の決定どおり `break` を **95 → 100** に上げた
  （新しい survivor は PR で落ちる＝人の記憶でなく仕組みで守る）。実装は #374 と後続 PR。
  **教訓**: 「survivor N 件・前回と同じ」を「中身も同じ」と読まない。同値と言うなら行ごとに言う。
  静的初期化（module scope の `reduce`）の変異は**入力データの並び順に依存して同値**になることが
  あり、純関数に切り出して合成データで試すと規則そのものを pin できる。

### 決定済み（ADR / PRD）

- 型モデル: [ADR-0004][0004]／公開 API: [ADR-0005][0005]／エラーモデル: [ADR-0006][0006]／OAuth 公開 API: [ADR-0007][0007]／マルチテナント: [ADR-0008][0008]／日時の表現: PRD R-10（ISO 8601・UTC）／MVP: [ADR-0003][0003]／接地方針: [ADR-0002][0002]

[madr-markdown-any-decision-records]: https://adr.github.io/madr/
[index]: index.md
[prd]: ../design/requirements.md
[lv-doc]: ../live-verification.md
[rv36]: ../reviews/rv/0036-write-value-validation-partial.md
[0011]: 0011-xml-parse-serialize.md
[0015]: 0015-mutation-testing.md
[0047]: 0047-access-point-scheme.md
[0048]: 0048-access-point-host-validation.md
[0077]: 0077-fetch-transport-timeout.md
[rv25]: ../reviews/rv/0025-partition-default-zero.md
[rv49]: ../reviews/rv/0049-throttle-options-unvalidated.md
[rv54]: ../reviews/rv/0054-reserved-tag-name-read-throws.md
[rv55]: ../reviews/rv/0055-time-of-day-decode-hour-unchecked.md
[rv59]: ../reviews/rv/0059-tenant-fields-threading-unpinned.md
[0086]: 0086-time-of-day-fields.md
[0069]: 0069-tenant-field-catalog-tooling.md
[0000-template-md]: 0000-template.md
[0002]: 0002-ground-design-in-live-api-docs.md
[0003]: 0003-add-attachment-to-mvp.md
[0004]: 0004-field-type-model.md
[0005]: 0005-public-api-shape.md
[0006]: 0006-error-model.md
[0007]: 0007-oauth-public-surface.md
[0008]: 0008-multitenancy-partition.md
[0038]: 0038-read-query-surface-impl.md
[0080]: 0080-resource-parameter-binding.md
[0081]: 0081-attachment-read-parameters.md
[0042]: 0042-supported-version-policy.md
[0082]: 0082-module-format-and-node-baseline.md
[0049]: 0049-host-port-roundtrip.md
[0053]: 0053-adr-index-split.md
[0071]: 0071-usage-docs-single-root.md
[0088]: 0088-usage-docs-five-chapters.md
[0097]: 0097-src-module-layout.md
[0098]: 0098-porters-rules-folder.md
