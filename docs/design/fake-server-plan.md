# フェイクサーバー実装計画（ADR-0043）

- ステータス: living（着手中・随時更新）
- 最終更新: 2026-08-08
- 位置づけ: [ADR-0043][adr43]（accepted）の**実装タスクリスト**。決定の正は ADR-0043、本書は**進め方（フェーズ・チェックリスト）**。
  新しいセッションでもここを見れば続きから着手できる。詳細な設計判断は重複させず ADR を参照する。

## ゴールと原則（ADR-0043 より）

- 目的: 契約なしで **L1 結合テスト**と **L2（MCP・案A）e2e** をオフライン化。まず**この repo の開発**に効かせ、後に N2（利用者の無改造アプリ検証）へ。
- 忠実度: **案B「ある程度忠実」** = **契約面は高忠実**（XML ワイヤ形状／独自 OAuth／エラー語彙／制約トリガ／状態あり CRUD 往復）・**業務面は浅い**。
- 接地: **`docs/reference` が正**。黙っている挙動は**明示的な仮定**として実装コメント＋ [live-verification][lv] に LV 項目化。
- 注入を第一級: 決定的に 400（サイズ）・429（レート）・特定 result code・遅延を出せる。
- 配置: **in-repo・dev-only**（`test/fake/`＝`src/` の外）。既存設定で**公開 tarball 非同梱**（`files` は `dist` のみ）・**カバレッジ 100% 対象外**（include は `src/**`）。ただし**フェイク自身のテストは書く**（正しく振る舞う担保）。
- 再利用（in-repo の利点）: ワイヤ形状は**ライブラリ内部を直接 import**して二重管理を断つ — `src/xml/encode`（`buildWriteXml`/`encodeField`/`encodeWriteItem`）・`src/xml/parser`（`parseResourcePage`/`parseWriteResult`/`parseAuthentication` の**形**に合わせる）・`src/xml/decode`（`decodeField`）・`test/fixtures/**`。受信 write XML の解釈は同梱の `fast-xml-parser` を使う。
- 昇格可能に: 公開サーフェス／共有 fixtures 境界で作り、**N2/MCP e2e の需要が出たら** HTTP サーバー・アダプタ＋package 昇格（別 PR・要すれば別 ADR）。

## 対象エンドポイント（URL 組立より）

`/v1/oauth`（code_direct）・`/v1/token`／データ系 `/v1/{candidate,job,client,process,resume}`（Read=GET＋query・Write=POST＋body）／`/v1/attachment`（Base64）／マスタ Read `/v1/{partition,user,field,option}`。

---

## フェーズ 0 — 足場（skeleton）✅ 完了

- [x] `test/fake/` を作成（`src/` の外＝非公開・非カバレッジを確認）
- [x] `createFakeTransport(options?)` → `Transport` の骨格（`send(req)` で method＋path routing）
- [x] **挙動コア**（state store）のインターフェース定義（リソース別インメモリ・ID 採番・削除なし）
- [x] **注入 API** の型（`{ failNext?, forceCode?, rateLimit?, latencyMs?, ... }` 等の枠）
- [x] 再利用の配線確認（`src/xml/*` を import できる・`test/fixtures` を読める）
- [x] 未実装ルートは**明示エラー**（`createMockTransport` 同様フェイルセーフ）

### フェーズ 0 で確定したこと（実装メモ）

- **ファイル構成**: `test/fake/{types,store,resources,fake-transport,index}.ts` ＋ テスト
  （`store.test.ts` / `fake-transport.test.ts` / `wiring.test.ts`）。責務は phase 1 以降の追加先と一致
  （XML＝`wire.ts`・Read クエリ＝`query.ts`・OAuth＝`oauth.ts` を後から足す）。
- **ルーティングの単一ソース**: `src/resources/candidate.ts` が `CANDIDATE_DESCRIPTOR`（name/path/prefix/fields）を
  **export**し、フェイクはそれを import して経路表を作る（`ResourceConfig` は `ResourceDescriptor` ＋ `requiredOnCreate` に分解）。
  カタログの写しを持たない＝ドリフト不可能（ADR-0043 D-fixture 共有）。**`src/index.ts` には出さない**ので公開 API は不変。
- **未実装の可視化（フェイルセーフ）**: 未ルートの path・未実装の endpoint・**未配線のオプション**（`rateLimit` 等）・
  **未適用の注入 kind**（`resultCode` 等）はすべて `PortersConfigError` で落ちる。「渡したのに何も起きない」＝
  偽の green を作らない。配線済みの集合は `WIRED_OPTIONS` / `WIRED_FAULT_KINDS` が正。
- **フェーズ 0 で既に動くもの**: routing・`latencyMs`（＋`setLatency`）・state store（ID 採番 10001〜・**delete なし**）・
  transport 層の注入（`network`＝retryable な `PortersNetworkError` ／ `http`＝生の status/body）。
- **品質ゲートの配線**: `test/tsconfig.json` を追加し `pnpm typecheck` を `tsc --noEmit && tsc -p test` に拡張
  （eslint の型付き lint も同 project を使う）。coverage（include=`src/**`）と tarball（`files`=`dist`）は**設定変更なしで**対象外。

## フェーズ 1 — 縦スライス（OAuth＋Candidate 往復＋注入）✅ 完了

- [x] **OAuth 自動応答**: `/v1/oauth`（code_direct）＋`/v1/token`。`parseAuthentication` が食う envelope・トークン TTL（ms）を忠実に（`AccessTokenExpiresIn` 等）
- [x] **Candidate CRUD 往復**（状態あり）:
  - [x] 受信 write XML（`buildWriteXml` 出力）を **`fast-xml-parser` で解釈** → store 反映（create=ID 採番／update=対象 ID）
  - [x] write 応答 = `parseWriteResult` が食う `<Item><Id/><Code/></Item>`（送信順・同数・per-item code）
  - [x] read 応答 = `parseResourcePage` が食う envelope（`Total`/`Count`/`Start`＋items）。field は `encodeField`/`decodeField` の型で往復
- [x] **注入（第1弾）**: 特定 result code／400（サイズ超過）／429（レート）を決定的に出せる
- [x] **結合テスト**: `new PortersClient({ transport: createFakeTransport() })` を駆動 — search / create / update / read の往復 ＋ 注入の異常系（`PortersError`＋`category`）
- [x] **フェイク自身のテスト**（envelope 構築・store 遷移の単体）
- [x] ドキュメント: `createMockTransport`（薄い N1）↔ Fake（状態あり N2/e2e）の**棲み分けメモ**
- [x] 品質ゲート: typecheck / lint / format / test green（`test/fake` は coverage 100% 対象外だが lint 等は通す）

### フェーズ 1 で確定したこと（実装メモ）

- **ファイル追加**: `wire.ts`（XML 入出力）・`query.ts`（Read パラメータ）・`oauth.ts`（トークン生存期間）・
  `masters.ts`（User/Option マスタ）・`records.ts`（サーバ所有フィールド）。`store.ts` はフェーズ0のまま**無変更**
  （レコードだけを持ち、フィールドの意味は上の層が決める＝骨格が正しかったことの確認）。
- **Read/Write の非対称を実装**: User は ID で書き `<User>` 入れ子で読む／Option は裸 alias で書き `<OptionRoot>` で読む／
  DateTime は PORTERS 形式で往復。`field=Person.P_Owner(User.P_Id,…)` のサブ選択も尊重する。
- **サーバ所有フィールド**: `P_Id`（`-1`＝新規）・`P_RegistrationDate`/`P_UpdateDate`（Write 不可）はフェイクが打刻し、
  `P_RegisteredBy`/`P_UpdatedBy` は**省略時のみ**自動割当（write-format.md）。
- **注入の的（target）**: 注入は「次のリクエスト」ではなく**次の該当リクエスト**で消費する
  （`resultCode` は Resource・`authError` は Authentication・`writeItemCodes` は Write のみ）。
  でないと初回の OAuth 往復に食われて的を外す。`pendingFaults()` で消費されていないことを検証できる。
- **レート 429** は `failNext({ kind: "http", status: 429 })` で決定的に出せる。**1 分あたり上限の自動発火は
  フェーズ4**（reference が「429 とは書いておらず強制切断され得る」としか言わないため、既定は切断＝LV-9）。
- **未確定の挙動は LV 化**: LV-9（長さ/レート超過の HTTP 応答）・LV-10（System[Reference] の入れ子タグ）・
  LV-11（Write 失敗時の Result Code）を追加し、コードに `VERIFY(live)` を残した。
- **副産物（ライブラリ側の所見）**: フェイクを「忠実度の強制関数」として使った結果、[findings][findings] に
  **RV-13**（HTTP ステータスを一切見ていない）・**RV-14**（Write のルート `<Code>` を読まない）を起票。
  どちらも挙動変更を伴うため**別 ADR / 別 PR**（LV-11 の実機確認が先）。

## フェーズ 2 — データ系リソース横展開 ✅ 完了

- [x] Job / Client / Process / Resume（generic `/v1/{path}`・フェーズ1 の型を流用）
- [x] **Attachment**（Base64・`unboundedBody` 経路・単件）
- [x] 200 件超 → **分割要求**の挙動（一括書き込み `createMany`/`updateMany` を Fake 越しに検証）

### フェーズ 2 で確定したこと（実装メモ）

- **経路表の一般化**: `FakeResource`＝`{ descriptor, idAlias, unboundedWrite? }`。フェーズ1 が暗黙に前提していた
  「主キーは `P_Id`」「alias には接頭辞がある」を**リソース属性に外出し**した（Attachment は `Id`・接頭辞なし）。
  store も `FakeTable`（path ＋ 主キー alias）を受け取る形へ。
- **descriptor の追加 export**: `JOB_/CLIENT_/PROCESS_/RESUME_DESCRIPTOR`（Candidate と同じ型・同じ理由）。
  Attachment はライブラリ側にもカタログが無い（`decodeAttachment` が手書き）ため、**フィールド名だけ**を
  `ATTACHMENT_FIELD_NAMES` として export し、Data Type はフェイクが持つ。ドリフト検知は `wiring.test.ts` の
  「フェイクの表がライブラリの名前一覧と一致する」テストで担保。
- **Attachment はサイズ上限を免除**: ライブラリが `unboundedBody` で送る経路（ADR-0018）に合わせ、
  フェイクも `unboundedWrite` のリソースでは ~15000 字ガードを適用しない。でないと正当なアップロードが 400 になる。
- **判明した事実**: 一括 create は **~15000 字の上限が先に効く**（1 件 ≒ 110 字なら 130 件程度で分割）ため、
  **200 件バウンドに到達しない**。200 件が効くのは ID のみ update のような小さいレコードのとき。
  テストは「分割数」ではなく**両方の不変条件**（1 リクエスト ≤200 件かつ ≤15000 字・全件書き込み・順序保持）を検証する。

## フェーズ 3 — マスタ Read ✅ 完了

- [x] Partition / Field / Option（読み取り専用・bespoke クエリ）
- [x] User＋`current()`（自己同定）
- [x] Option 複数選択・User/Reference・DateTime のフィールド型往復を網羅

### フェーズ 3 で確定したこと（実装メモ）

- **マスタは generic Read に乗せない**（[ADR-0022][adr22]）。`master-read.ts` に 4 本の bespoke ハンドラを置き、
  `FakeResource.master` で dispatch。`condition`/`get(id)` は無く、`field` を取るのは User だけ。
- **`request_type` は OAuth 方式依存**（ADR-0022 事実4）。フェイクは `code_direct` として振る舞うので、
  **Partition `request_type=0` は Result Code 403**、**User `request_type=0` はアプリ自身のユーザー**（`currentUserId`）。
- **マスタのデータ源はフェイクの既存状態**: Partition＝`partitions` オプション／User＝User マスタ（`User` 型項目の展開と同じ registry）／
  **Field＝リソース descriptor のカタログそのもの**（ライブラリの正から Field 行を生成）／Option＝`optionTree` シード。
- **書き込みで参照した値をマスタに登録**する（`registerReferenced`）。`P_Owner: 77` と書けば `/v1/user` に 77 が現れ、
  Option alias も `/v1/option` に出る＝「書いた値が消えない」（フェイルセーフ）。
- **封筒の差**: Partition/User/Field は `Total/Count/Start`、**Option は `<Code>` ＋ 再帰 `<Items>`**（属性なし・ADR-0022 事実5）。
  `Field.P_ReferTo` は **`<OptionRoot>` を挟まない**入れ子（事実6）＝ `optionShape: "bare"`。
- **カスタム項目の User 型はリクエストから推論**: 静的カタログに無い `U_`/`A_` は Data Type が分からないが、
  ライブラリは User 型を `alias(User.P_Id,…)` と展開して要求する。この形だけが User なので、
  **サブ選択の有無を型の手がかり**に使う（ADR-0023 の宣言を二重管理しないため）。
- 未確定挙動は **LV-12**（Field Read の `P_Alias` 表記・System 系の Field Type Value）に登録。

## フェーズ 4 — 忠実度の作り込み（制約・エラー・接地）✅ 完了

- [x] 制約トリガ網羅: **~15000 字→400** ／ **レート（1分 Read2000/Write500・月15万）→429・throttle 相当** ／ 送信前サイズガードとの整合
- [x] エラー語彙: result code カタログ／エラー XML 形状を `test/fixtures/errors/**` に拡充
- [x] **接地の棚卸し**: reference に無い挙動は明示的仮定＋ [live-verification][lv] へ LV 追加（契約取得後に検証）

### フェーズ 4 で確定したこと（実装メモ）

- **レート上限を既定で発火**（`rate-limit.ts`）: 1 分あたり Read 2000 / Write 500 ＋ 月 15 万（直近30日のローリング窓）。
  超過は**既定で強制切断**（retryable な `PortersNetworkError`）＝ reference が「429 の記載は無い・強制切断され得る」と
  言うため。`mode: "http429"` でもう一方の読み筋も試せる。**認証 API は数えない**（上限は Resource API のもの）。
  ライブラリは上限の 90% で自制するので**通常利用では発火しない**——それを回帰テストで固定した。
- **未配線オプションの門番（`WIRED_OPTIONS`）を撤去**: 公開オプションが全部配線済みになり、守るものが無くなった＝
  死んだ分岐。フェーズ0〜3 の「部分実装を偽の green にしない」役目は終えた。
- **エラー語彙の担保方法**: `test/fixtures/errors/**` を拡充（resource 401/124/1000・auth 103/401・per-item 失敗の write）。
  テストは**フェイクの出力を fixture と突き合わせる**（自前の期待値ではなく reference の形と比較）。
  加えて result code カタログ 28 件・認証エラー 17 件を**全件**「コード → category」で検証。
- **制約の両側**: 送信前ガード（ライブラリ）とサーバ側拒否（フェイク）を別々にテストし、
  「ライブラリが止めたのでリクエストが出ていない」ことも実測する（transport をラップして件数を数える）。
- **副産物（ライブラリ側の所見）**: [findings][findings] に **RV-15**（Read クエリと Attachment のガードが
  **同期 throw** になり、`search(q).catch(...)` で捕まらない）を追加。ADR-0024 が Transport 層で
  「同期 throw ではなく reject」と定めた原則と公開リソース面がずれている。
- **接地の棚卸し**: `grep -rn "VERIFY(live)" src test` で仮定が LV-1〜12 に対応することを確認済み
  （フェイク由来は LV-9/10/11/12）。

> **フェーズ5 の分割（stakeholder 2026-08-09）**: 旧フェーズ5 は「HTTP 化」「無改造対応（ライブラリ変更）」「配布」の
> **3 つの別物**が混ざっていた。必要になる場面も前提も違うので、5／6／7 に割り直した。
> MCP e2e は「HTTP で叩けること」だけが要る＝**フェーズ5 で足りる**（monorepo 内から相対参照できるため）。
> 「無改造アプリ」を名乗れるのは**フェーズ6 から**、外部 repo が使えるのは**フェーズ7 から**。

## フェーズ 5 — ローカル HTTP サーバー（ライブラリ変更なし）✅ 完了

- [x] **HTTP サーバー・アダプタ**（挙動コアを `node:http` でラップ・`pnpm fake:serve` で起動）
- [x] **転送 Transport**（`https://{host}/v1/...` → `http://localhost:PORT/v1/...` に書き換えて実 fetch）＝
      アプリは `transport` 1 行だけ差し替え。**ライブラリのコード変更は不要**
- [x] 強制切断・注入・制約が **HTTP 越しでも同じ形**で出ることを結合テストで確認
- [x] in-repo・dev-only のまま（配布はフェーズ7）

### フェーズ 5 で確定したこと（実装メモ）

- **挙動コアは無変更**。`http-server.ts` は `IncomingMessage` → `TransportRequest` → HTTP レスポンスに
  変換するだけの薄いアダプタ。フェーズ0〜4 の資産がそのまま HTTP 越しで動く。
- **例外は「ワイヤ上の意味」に翻訳**する:
  - `PortersNetworkError`（レート超過など）→ **ソケットを destroy**。reference が言う「強制切断」を実際に起こす＝
    クライアントは本物のネットワーク失敗として受け取る（in-process と同じ形）。
  - `PortersConfigError`（未実装ルート・マスタへの Write）→ **HTTP 501 ＋ メッセージ**。別プロセスからは例外を
    投げられないので、空の結果と誤読されない形にする（フェイルセーフ）。
  - PORTERS が使わない verb（DELETE 等）→ **405**。削除 API は無いので、あるように見せない。
- **接続はまだ `transport` 差し替えが要る**（`createForwardingTransport`）。ライブラリが `https://` を
  10 箇所でハードコードしているため。`PORTERS_HOST` を向けるだけで済むのは**フェーズ6**。
- **起動**: `pnpm fake:serve`（既定 127.0.0.1:4010・`PORT` で変更）。デモ用に候補者2件・ユーザー2件・
  Option ツリーを seed 済みで、curl でもそのまま叩ける。

## フェーズ 6 — アクセスポイント / scheme 設定（真の N2・要 ADR）

- [ ] **ADR 起票**（別 PR・`proposed` → 議論 → accepted）: 公開サーフェスの追加と http のセキュリティ姿勢を決める
- [ ] **ライブラリ側の小変更**: URL 組立 **10 箇所**を 1 関数に集約／**アクセスポイント・scheme 設定**（既定 https・VPN/LB も同 seam）／
      **http は明示のみ＋ループバック含め毎起動で警告＋env（`PORTERS_SUPPRESS_INSECURE_HTTP_WARNING` 等）で抑止**。
      フェイクは **http（証明書不要）**、自己署名 https は不採用
- [ ] これで初めて **`PORTERS_HOST` を向けるだけ＝アプリ無改造**が成立する

## フェーズ 7 — package 昇格・配布（外部消費の需要時）

- [ ] **package 昇格**: pnpm workspace 化・`@joymerrevent/porters-fake`（`porters-mock-server` ではなく **fake**）・monorepo 判断（`porters-mcp`＝案A の配置と併せて）
- [ ] N2 利用ガイド（無改造アプリを `http://localhost` へ）

---

## 進め方メモ

- **1 フェーズ = 1 PR**（レビュー単位を小さく保つ・stakeholder 2026-08-08）。フェーズ0（足場）→ フェーズ1（縦スライス）で
  設計を実証してから横展開する。
- ブランチ→develop 向け PR→メンテナがマージ（既存フロー）。件名・PR タイトルは先頭大文字を避ける（commitlint）。
- ADR-0043 の決定を変えたくなったら**書き換えず新 ADR**（ADR 運用ルール）。

## 関連

- 決定: [ADR-0043][adr43]（フェイクサーバー設計）／[ADR-0024][adr24]（`createMockTransport`＝N1・本フェイクは N2 follow-up）
- 全体像: [roadmap][rm]（「いま着手」）／ API 事実: [docs/reference][ref]／ 契約後検証: [live-verification][lv]

[adr43]: ../adr/0043-local-fake-server.md
[adr24]: ../adr/0024-mock-transport.md
[findings]: ../reviews/findings.md
[adr22]: ../adr/0022-master-read-query-surface.md
[rm]: ../roadmap.md
[ref]: ../reference/README.md
[lv]: ../live-verification.md
