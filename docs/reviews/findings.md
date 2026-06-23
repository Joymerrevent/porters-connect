# レビュー指摘台帳（findings register）

このファイルは `/project-review` が更新する、全レビュー横断の指摘台帳です。
ID は不変・エントリは消さない。確定したら「状態」と「処置」を更新します。
運用は [docs/live-verification.md][lv] と同じ思想（処置が追える）。

凡例 — 重要度: 🔴 High（実用ブロッカー級）/ 🟡 Medium / 🟢 Low ・ 状態: open / fixed / wontfix / deferred

## サマリー

| ID    | 重要度 | 観点                      | 状態  |
| ----- | ------ | ------------------------- | ----- |
| RV-1  | 🔴     | API 忠実性                | fixed |
| RV-2  | 🟡     | テスト厳密性              | fixed |
| RV-3  | 🟡     | エラーモデル              | fixed |
| RV-4  | 🟡     | リリース準備              | fixed |
| RV-5  | 🟡     | API 忠実性                | fixed |
| RV-6  | 🟢     | テスト厳密性              | fixed |
| RV-7  | 🟢     | ドキュメント / DX         | fixed |
| RV-8  | 🟢     | アーキテクチャ            | fixed |
| RV-9  | 🟡     | アーキテクチャ / リリース | fixed |
| RV-10 | 🟡     | アーキテクチャ / DX       | fixed |
| RV-11 | 🟡     | 認証                      | open  |
| RV-12 | 🟢     | ドキュメント              | fixed |

> RV-10〜12 は横断監査（[2026-06-22-03][run3]）で検出したドリフト群。受け入れ済み ADR が定めた v1 公開面の**未実装サーフェス**（OAuth `porters.auth.*` / Read クエリ `order`・`keywords`・`itemstate` / `tenant(id)`＋per-call `partition` / 200 件一括書き込み）は finding 化せず [ADR-0033][adr33] 案F（先行フェーズ）で扱う。

---

## RV-1 🔴 API 忠実性

- **概要**: `get()` と field 省略時の `search()`/`searchAll()` が本番では `{Resource}.P_Id` のみ返す。現行 App は field 未指定で主キーのみ返るため、`one?.P_Name` 等は常に undefined になる
- **根拠**: `src/resources/resource.ts:142`（buildReadUrl が field 空なら送らない）/ `:228`（get に field を渡す手段が無い）/ docs `tmp/porters-docs/txt/115010010367-…緩和措置あり.md`
- **推奨**: field 省略時はカタログ全 `P_` alias を既定送信（ADR-0019 でカタログが SoT）。`get` も内部で全 field 要求。ADR-0020 化を検討
- **状態**: fixed
- **処置**: `search`/`searchAll`/`get` が field 省略時にカタログ導出の既定 field を送る（User は4サブ展開・Reference は ID）。`field:[]` で主キーのみにオプトアウト。README/JSDoc に明記。ADR-0020 accepted（案A+2a+3a+軸4・透明化）

## RV-2 🟡 テスト厳密性

- **概要**: field 無し `search()` に全項目を返す `ALL` fixture を使用しており、本番（P_Id のみ）と乖離。RV-1 の罠をテストが隠している
- **根拠**: `src/resources/candidate.test.ts:27-41,65`（ALL fixture）/ `:103-109`（get テストは 0 件応答のみで field 未検証）
- **推奨**: fixture を「field 省略時 P_Id のみ」の現実形に直し、既定 field 注入（RV-1 修正）を pin するテストを追加
- **状態**: fixed
- **処置**: 既定 field 注入で fieldless search が全項目要求になり ALL fixture が現実と整合。既定 field 送信を pin するテストを `resource.test.ts` / `candidate.test.ts` に追加

## RV-3 🟡 エラーモデル

- **概要**: `ErrorCategory` の `"rateLimit"` がどの分類関数からも返されず到達不能。レート超過は強制切断 → `PortersNetworkError`（category `"network"`）になる。README は `e.category` 例に `"rateLimit"` を挙げる
- **根拠**: `src/errors/porters-error.ts:11`（定義）/ `src/errors/classify.ts`（未使用）/ `src/http/fetch-transport.ts:29` / `README.md:229`
- **推奨**: 予約注記／型から削除／強制切断検知に配線 のいずれかで整合させる
- **状態**: fixed
- **処置**: rateLimit を予約として明示（型はコメント、README 整合）。強制切断は network 継続

## RV-4 🟡 リリース準備

- **概要**: スコープ付き package（既定 private）に `publishConfig.access:"public"` が無く `npm publish` が失敗する。`repository`/`bugs`/`homepage`/`keywords`/`author` も未設定
- **根拠**: `package.json:1-23`
- **推奨**: `publishConfig.access:"public"` 追加、npm メタデータ補完（公開前）
- **状態**: fixed
- **処置**: publishConfig.access=public ＋ npm メタデータ補完

## RV-5 🟡 API 忠実性（送信前ガードの非対称）

- **概要**: 送信前リクエスト長ガード（`MAX_REQUEST_LENGTH`）が `req.body` だけを検査するため、Read（GET）の URL 長は送信前に弾けない。ADR-0020 で field 省略時に既定 field を全送信するようになり Read URL が伸びた（さらに利用者が大きな明示 `field`/`condition` を渡せば一段伸びる）。約 15000 文字を超えても明確な `PortersConfigError` でなく不透明な server 400 に倒れる。ADR-0020 の Consequences(Neutral) は「リクエスト長超過時は既存の送信前ガードが働く」と記すが、その Read 経路は実際には未カバー
- **根拠**: `src/http/requester.ts:75-87`（`req.body !== undefined` 前提＝GET は body 無しで素通り）/ `src/resources/resource.ts:127-132`（`defaultFieldList`）, `:229`（field 省略時に既定 field 送信）/ `docs/reference/resource-api/README.md:86`（「リクエスト全体の長さ ~15000 文字」＝GET は URL 全体が対象）/ `docs/adr/0020-read-field-default.md:83`（Consequences Neutral の当該記述）
- **推奨**: いずれか — (a) ガードを Read URL 長にも適用（送信前に URL 長を ~15000 で検知し `PortersConfigError`）、(b) ADR-0020 の当該記述を「Read 経路は送信前ガード未カバー。現行カタログは小さく実害なし、将来 count API／大規模カタログ／巨大 field 指定時に再評価」へ訂正。現行 MVP カタログ（最大 Job=34 項目・既定 Read URL ~1.2KB）では未発火＝latent（今すぐ壊れる問題ではないが、フェイルセーフの中核ガードに非対称な穴があり ADR の記述が実装と食い違う）
- **状態**: fixed
- **処置**: 案(a)。送信前ガードを `requester.ts` で **URL + body の合算長**判定に変更（`req.url.length + (req.body?.length ?? 0) > MAX_REQUEST_LENGTH`）。Read（GET・body 無し）の URL 長も送信前に `PortersConfigError` で弾く。`unboundedBody`（Attachment アップロード）は従来どおり全体スキップ（write URL は短いため安全）。メッセージ/hint を read/write 両対応に一般化。Read URL 超過の回帰テスト追加（`requester.test.ts`）。本修正により ADR-0020 Consequences「既存の送信前ガードが働く」が Read 経路でも真になり、accepted ADR の改稿は不要

## RV-6 🟢 テスト厳密性（mock transport の既定 status 経路が未テスト）

- **概要**: `createMockTransport` の `MockReply` をオブジェクト形 `{ body }`（`status` 省略）で返したときに 200 になる経路が未テスト。`toResponse` の `reply.status ?? 200` の **null 合体（既定 200）側**が実行されず、`?? 200` を別値へ変える変異が生存し得る（branch 94.11%）
- **根拠**: `src/http/mock-transport.ts:41`（`reply.status ?? 200` — coverage の Uncovered Line=41）/ `src/http/mock-transport.test.ts`（オブジェクト形は `{status:403,body}` のみ・status 省略形が無い）
- **推奨**: `{ body: "…" }`（status 省略）→ 200 を pin するテストを 1 本追加（ADR-0014 の perFile branch≥90 は満たすが、ADR-0015 の変異厳密性で穴）
- **状態**: fixed
- **処置**: `mock-transport.test.ts` に「オブジェクト形 `{ body }`（status 省略）→ 200」を pin するテストを追加。`mock-transport.ts:41` の branch が 100% になり、`reply.status ?? 200` の既定 200 側の変異を捕捉

## RV-7 🟢 ドキュメント / DX（未モック時エラーメッセージが冗長）

- **概要**: `createMockTransport` の未モック route エラー（`PortersConfigError`）が `req.url` 全体を埋め込むため、ADR-0020 の既定 field を載せた Read URL（例 Job ~1.2KB）でメッセージが極端に長くなる。どの route を足すべきかは method + パス部で十分で、巨大なクエリ文字列はノイズ
- **根拠**: `src/http/mock-transport.ts`（`no mock response for ${req.method} ${req.url}`）/ `pnpm sandbox` 実行時に Job 検索の未モックで巨大 URL がそのまま出力された
- **推奨**: メッセージは method + パス（`new URL(req.url).pathname` 等）に絞るか、クエリを省略/短縮。完全 URL が要るなら `context`/別フィールドに退避
- **状態**: fixed
- **処置**: `routeLabel(method, url)` を追加し、未モック route エラーを `method + new URL(url).pathname`（クエリ省略）に変更。不正 URL は raw にフォールバック（フェイルセーフ）。`pnpm sandbox` の Job 未モックが `GET /v1/job` と簡潔表示になることを確認。pathname/フォールバック双方の回帰テストを追加

## RV-8 🟢 アーキテクチャ（依存方向：resources → fields）

- **概要**: 各データリソースが「カスタム無し」の既定型 `EmptyCatalog` を `../fields` から import しており、resources → fields の **上向き依存**が生じている（型のみ・実行時循環は無し）。`EmptyCatalog` は `Record<never, never>` の汎用ユーティリティで、カタログ概念に近い
- **根拠**: `src/resources/{candidate,job,client,process,resume}.ts`（`import type { EmptyCatalog } from "../fields"`）/ 定義は `src/fields/define-fields.ts`。`fields` 側は `../errors`・`../xml/decode` のみ import（現状は循環無し）
- **推奨**: `EmptyCatalog` を `src/resources/read-core.ts`（`FieldCatalog` の隣）へ移し `resource.ts` から re-export。依存方向を fields → resources に揃え、将来 fields が resources 型を要したときの循環を予防（薄い予防的整理・緊急ではない）
- **状態**: fixed
- **処置**: `EmptyCatalog` を `read-core.ts`（`FieldCatalog` の隣）へ移し `resource.ts` で re-export。データリソース 5 種は `./resource` から取得（`../fields` import を撤去）。`define-fields.ts`・`client.ts` は `resources/read-core` から import。これで resources→fields の上向き依存が消え、依存方向は fields → resources に統一（型のみ・循環無し）

## RV-9 🟡 アーキテクチャ / リリース（単調増加チェックの baseline が back-merge ラグで誤検知）

- **概要**: ADR-0031 の単調増加検証の baseline が**グローバル最大タグ**（`git tag --list` の最大版）。git-flow のリリースは「release ブランチで version bump → **main** へ直マージ → `tag.yml` が `vX.Y.Z` 作成 → **手動** back-merge で develop に version 反映」（ADR-0030 案H・runbook §2）の順なので、**「タグ作成」と「手動 back-merge」の間は develop の version が最新タグより低い**。この窓で develop への通常 PR が `version < baseline` ＝「版の逆行」で落ちる（例: develop=0.2.0／最新タグ v0.3.0）。ADR-0031 が掲げた「通常 PR では version==baseline ＝毎 PR 安全（通常 PR を落とさない）」前提が back-merge ラグを見落としている（決定↔実装の乖離）。「人の注意でなく仕組みで守る」はずが、誤検知回避を「back-merge を忘れず即実行」という人の注意に依存させてしまう
- **根拠**: `scripts/check-release-invariants.mjs:96`（`git tag --list`＝全タグ）/ `:32-40`（`maxTagVersion`＝グローバル最大）/ `:84`（`compareSemver(version, baseline) < 0` で失敗）/ `.github/workflows/ci.yml`（checkout は `fetch-tags: true`＝shallow のまま・到達可能性判定用の履歴は無い）/ `docs/adr/0031-version-number-validation.md`（Considered Options「通常 PR では version == baseline」・Decision Outcome「毎 PR 安全」）/ `docs/release-runbook.md:27-31`（main 直マージ→自動タグ→手動 back-merge の順）/ `docs/adr/0030-backmerge-method.md`（back-merge は手動＝ラグ源）
- **推奨**: いずれか — (a) baseline を **HEAD から到達可能な最大タグ**に変更（`git describe --tags --abbrev=0` 等。main のタグは develop の祖先でないため除外され、develop=据え置きでも pass。ただし到達可能性判定に `fetch-depth: 0` が要る＝CI を一段重く）。(b) 単調増加検査を**リリース文脈に限定**（base=main の PR / release ブランチのみで実施し、develop の通常 PR では skip）。(c) ADR-0031 を amend し「back-merge を tag 直後の必須ステップ化」＋窓の許容を明記（仕組みでなく手順で担保＝フェイルセーフとしては弱い）。いずれも ADR-0031 の baseline 定義（案A「直近の git タグ」の解釈＝グローバル最大 vs 到達可能最大）に関わるため **ADR amend を伴う**。現状 develop=0.2.0＝最新タグで未発火＝latent（今は緑だが次回リリースの back-merge 窓で develop PR を巻き込む）
- **状態**: fixed
- **処置**: [ADR-0032][adr32] accepted（案A：単調増加検証(2)を base=main の PR に限定）。`scripts/check-release-invariants.mjs` で (2) を `releaseContext`（`process.env.GITHUB_BASE_REF === "main"`）ガード下に変更＝develop の通常 PR・push・local では skip。形式検証(1)・baseline（直近 git タグ）・自前比較は ADR-0031 のまま不変。版の逆行は publish 経路（必ず main 向け PR を通る）で確実に弾くため実害なし・CI も据え置き（`fetch-depth:0` 不要）。release 文脈で逆行検知／非 release 文脈で skip するテストを追加（`check-release-invariants.test.mjs`）。ADR-0031 (2) の実行範囲は ADR-0032 で superseded（ADR-0031 本文は不変・supersede 注記のみ追記）

## RV-10 🟡 アーキテクチャ / DX（per-call partition の JSDoc 偽宣言）

- **概要**: `PortersClientOptions.partition` の JSDoc が「overridable per call (ADR-0008)」と謳うが、per-call 上書きは**未実装**。partition は構築時に固定され、`SearchQuery`／`create`／`update`／マスタクエリのいずれにも `partition` 引数が無い。ADR-0008/0005・basic-design は per-call 上書きを公開面として定めるため、実装が未達なうえ **JSDoc が存在しない機能を主張**している（利用者を誤誘導＝フェイルセーフ違反）
- **根拠**: `src/client.ts:48`（JSDoc「overridable per call」）/ `src/resources/resource.ts:35-46`（`SearchQuery` に `partition` 無し）, `:175,184,187`（`deps.partition` を一律使用）/ `docs/adr/0008-multitenancy-partition.md:46` / `docs/adr/0005-public-api-shape.md:44` / `docs/design/basic-design.md:63`
- **推奨**: いずれか — (a) per-call `partition` 上書きを実装（[ADR-0033][adr33] 案F-3 で対応予定。`tenant(id)` も同群）、(b) 暫定で JSDoc から「overridable per call」を削除し未対応を明示。少なくとも (b) で**偽宣言を即時解消**（嘘をつかない＝フェイルセーフ）。本実装は案F-3 に委ね、doc 訂正は先行可
- **状態**: fixed
- **処置**: 暫定 (b) を実施。`src/client.ts:53` の JSDoc から「overridable per call」を削除し「per-call override は未対応・予定（ADR-0033）」と明示。偽宣言を解消（per-call 上書きの実装自体は案F-3 に委ねる）。0.3.0 プレリリース整備で対応

## RV-11 🟡 認証（refresh 失効時の挙動が doc と乖離）

- **概要**: R-1 受け入れ基準・ADR-0007 は「Refresh も失効 → **判別可能な再認証エラー**（`PortersAuthError`）」を約束するが、実装は refresh 不可時に**黙って `code_direct` 再取得へフォールバック**する。再認証エラーは code_direct 自体が失敗したときだけ表面化。透過既定としては妥当な挙動かもしれないが、doc の受け入れ基準と一致しない（意図なら doc を直す、意図でないなら明確化が要る）
- **根拠**: `src/auth/token-provider.ts:90-96`（`renew` が `canRefresh=false` で `acquire()` にフォールバック）, `:83`（code_direct 失敗時のみ `PortersAuthError`）/ `docs/design/requirements.md:64-65` / `docs/adr/0007-oauth-public-surface.md:113`
- **推奨**: 挙動と doc を整合させる — (a) refresh 失効を判別可能な再認証イベント／エラーとして表面化、(b) もしくは「透過既定では自動再取得する」を R-1／ADR-0007 に明記して受け入れ基準を更新。決定を要するため **ADR amend を伴う**可能性
- **状態**: open
- **処置（予定）**: 0.3.0 前に是正（option 2）。透過既定の自動再取得（refresh 不可→ `code_direct` 再取得）は実用上妥当なため、**amend ADR（refresh 失効時の自動 code_direct 再取得を明記）を起票** → accepted 後に doc（R-1／ADR-0007/0012）を実装へ整合させて fixed にする

## RV-12 🟢 ドキュメント（roadmap/PRD の coverage 過大主張）

- **概要**: roadmap が「P0 = R-1〜R-15 すべて実装」「P1 すべて実装」と記すが、横断監査で **R-5（`order`/`keywords`/`itemstate`）が partial・R-4（Link/Image 正規化）が未実装・マルチテナント面（`tenant(id)`／per-call `partition`）が未実装**と判明＝実態より過大。加えて R-4 は basic-design・roadmap で実質 future 扱いなのに **PRD 本文は P0 で名指し**＝PRD 内の不整合
- **根拠**: `docs/design/roadmap.md:26-28`（P0/P1 全実装の主張）/ `docs/design/requirements.md:69-70`（R-4/R-5）/ `docs/design/basic-design.md:142`・`docs/design/roadmap.md:99`（Link/Image を future 扱い）。未実装サーフェスの一次根拠は [ADR-0033][adr33] 案F に集約
- **推奨**: roadmap の coverage 節を実態へ訂正（R-5/R-4/multitenancy を partial・未実装と明記し ADR-0033 案F へリンク）。R-4 の「P0 名指し vs future 扱い」の不整合は PRD 側で解消（defer 明記 or スコープ縮小）。実装は ADR-0033 案F・**doc 訂正は本 finding**
- **状態**: fixed
- **処置**: roadmap の P0 見出しを「R-1〜R-15 を実装」→「大半を実装・一部に積み残しあり（※）」に訂正（R-5/R-4/マルチテナントの積み残しは既存脚注＋ADR-0033 案F に集約済み）。PRD の R-4 を「Link/Image の正規化は v1 では未対応・deferred」と明示し、P0 名指し↔future 扱いの不整合を解消。0.3.0 プレリリース整備で対応

[adr32]: ../adr/0032-monotonic-check-release-scope.md
[adr33]: ../adr/0033-post-mvp-direction.md
[run3]: 2026-06-22-03.md
[lv]: ../live-verification.md
