# レビュー指摘台帳（findings register）

このファイルは `/project-review` が更新する、全レビュー横断の指摘台帳です。
ID は不変・エントリは消さない。確定したら「状態」と「処置」を更新します。
運用は [docs/live-verification.md][lv] と同じ思想（処置が追える）。

凡例 — 重要度: 🔴 High（実用ブロッカー級）/ 🟡 Medium / 🟢 Low ・ 状態: open / fixed / wontfix / deferred

## サマリー

| ID   | 重要度 | 観点              | 状態  |
| ---- | ------ | ----------------- | ----- |
| RV-1 | 🔴     | API 忠実性        | fixed |
| RV-2 | 🟡     | テスト厳密性      | fixed |
| RV-3 | 🟡     | エラーモデル      | fixed |
| RV-4 | 🟡     | リリース準備      | fixed |
| RV-5 | 🟡     | API 忠実性        | fixed |
| RV-6 | 🟢     | テスト厳密性      | open  |
| RV-7 | 🟢     | ドキュメント / DX | open  |
| RV-8 | 🟢     | アーキテクチャ    | open  |

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
- **状態**: open
- **処置**: —

## RV-7 🟢 ドキュメント / DX（未モック時エラーメッセージが冗長）

- **概要**: `createMockTransport` の未モック route エラー（`PortersConfigError`）が `req.url` 全体を埋め込むため、ADR-0020 の既定 field を載せた Read URL（例 Job ~1.2KB）でメッセージが極端に長くなる。どの route を足すべきかは method + パス部で十分で、巨大なクエリ文字列はノイズ
- **根拠**: `src/http/mock-transport.ts`（`no mock response for ${req.method} ${req.url}`）/ `pnpm sandbox` 実行時に Job 検索の未モックで巨大 URL がそのまま出力された
- **推奨**: メッセージは method + パス（`new URL(req.url).pathname` 等）に絞るか、クエリを省略/短縮。完全 URL が要るなら `context`/別フィールドに退避
- **状態**: open
- **処置**: —

## RV-8 🟢 アーキテクチャ（依存方向：resources → fields）

- **概要**: 各データリソースが「カスタム無し」の既定型 `EmptyCatalog` を `../fields` から import しており、resources → fields の **上向き依存**が生じている（型のみ・実行時循環は無し）。`EmptyCatalog` は `Record<never, never>` の汎用ユーティリティで、カタログ概念に近い
- **根拠**: `src/resources/{candidate,job,client,process,resume}.ts`（`import type { EmptyCatalog } from "../fields"`）/ 定義は `src/fields/define-fields.ts`。`fields` 側は `../errors`・`../xml/decode` のみ import（現状は循環無し）
- **推奨**: `EmptyCatalog` を `src/resources/read-core.ts`（`FieldCatalog` の隣）へ移し `resource.ts` から re-export。依存方向を fields → resources に揃え、将来 fields が resources 型を要したときの循環を予防（薄い予防的整理・緊急ではない）
- **状態**: open
- **処置**: —

[lv]: ../live-verification.md
