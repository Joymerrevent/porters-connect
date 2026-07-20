# フェイクサーバー実装計画（ADR-0043）

- ステータス: living（着手中・随時更新）
- 最終更新: 2026-07-20
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

## フェーズ 0 — 足場（skeleton）

- [ ] `test/fake/` を作成（`src/` の外＝非公開・非カバレッジを確認）
- [ ] `createFakeTransport(options?)` → `Transport` の骨格（`send(req)` で method＋path routing）
- [ ] **挙動コア**（state store）のインターフェース定義（リソース別インメモリ・ID 採番・削除なし）
- [ ] **注入 API** の型（`{ failNext?, forceCode?, rateLimit?, latencyMs?, ... }` 等の枠）
- [ ] 再利用の配線確認（`src/xml/*` を import できる・`test/fixtures` を読める）
- [ ] 未実装ルートは**明示エラー**（`createMockTransport` 同様フェイルセーフ）

## フェーズ 1 — 縦スライス（OAuth＋Candidate 往復＋注入）★最初の PR

- [ ] **OAuth 自動応答**: `/v1/oauth`（code_direct）＋`/v1/token`。`parseAuthentication` が食う envelope・トークン TTL（ms）を忠実に（`AccessTokenExpiresIn` 等）
- [ ] **Candidate CRUD 往復**（状態あり）:
  - [ ] 受信 write XML（`buildWriteXml` 出力）を **`fast-xml-parser` で解釈** → store 反映（create=ID 採番／update=対象 ID）
  - [ ] write 応答 = `parseWriteResult` が食う `<Item><Id/><Code/></Item>`（送信順・同数・per-item code）
  - [ ] read 応答 = `parseResourcePage` が食う envelope（`Total`/`Count`/`Start`＋items）。field は `encodeField`/`decodeField` の型で往復
- [ ] **注入（第1弾）**: 特定 result code／400（サイズ超過）／429（レート）を決定的に出せる
- [ ] **結合テスト**: `new PortersClient({ transport: createFakeTransport() })` を駆動 — search / create / update / read の往復 ＋ 注入の異常系（`PortersError`＋`category`）
- [ ] **フェイク自身のテスト**（envelope 構築・store 遷移の単体）
- [ ] ドキュメント: `createMockTransport`（薄い N1）↔ Fake（状態あり N2/e2e）の**棲み分けメモ**
- [ ] 品質ゲート: typecheck / lint / format / test green（`test/fake` は coverage 100% 対象外だが lint 等は通す）

## フェーズ 2 — データ系リソース横展開

- [ ] Job / Client / Process / Resume（generic `/v1/{path}`・フェーズ1 の型を流用）
- [ ] **Attachment**（Base64・`unboundedBody` 経路・単件）
- [ ] 200 件超 → **分割要求**の挙動（一括書き込み `createMany`/`updateMany` を Fake 越しに検証）

## フェーズ 3 — マスタ Read

- [ ] Partition / Field / Option（読み取り専用・bespoke クエリ）
- [ ] User＋`current()`（自己同定）
- [ ] Option 複数選択・User/Reference・DateTime のフィールド型往復を網羅

## フェーズ 4 — 忠実度の作り込み（制約・エラー・接地）

- [ ] 制約トリガ網羅: **~15000 字→400** ／ **レート（1分 Read2000/Write500・月15万）→429・throttle 相当** ／ 送信前サイズガードとの整合
- [ ] エラー語彙: result code カタログ／エラー XML 形状を `test/fixtures/errors/**` に拡充
- [ ] **接地の棚卸し**: reference に無い挙動は明示的仮定＋ [live-verification][lv] へ LV 追加（契約取得後に検証）

## フェーズ 5 — 昇格（後日・N2／MCP e2e の需要時）

- [ ] **HTTP サーバー・アダプタ**（挙動コアを HTTP でラップ・`host` を向ける）
- [ ] **ライブラリ側の小変更**（別 PR・要すれば別 ADR）: URL 組立 8 箇所を1関数に集約／**アクセスポイント・scheme 設定**（既定 https・VPN/LB も同 seam）／**http は明示のみ＋ループバック含め毎起動で警告＋env（`PORTERS_SUPPRESS_INSECURE_HTTP_WARNING` 等）で抑止**。フェイクは **http（証明書不要）**、自己署名 https は不採用
- [ ] **package 昇格**: pnpm workspace 化・`@joymerrevent/porters-fake`（`porters-mock-server` ではなく **fake**）・monorepo 判断（`porters-mcp`＝案A の配置と併せて）
- [ ] N2 利用ガイド（無改造アプリを `http://localhost` へ）

---

## 進め方メモ

- 1 フェーズ ≒ 1〜数 PR。**フェーズ1（縦スライス）を最初の PR** にして設計を実証してから横展開。
- ブランチ→develop 向け PR→メンテナがマージ（既存フロー）。件名・PR タイトルは先頭大文字を避ける（commitlint）。
- ADR-0043 の決定を変えたくなったら**書き換えず新 ADR**（ADR 運用ルール）。

## 関連

- 決定: [ADR-0043][adr43]（フェイクサーバー設計）／[ADR-0024][adr24]（`createMockTransport`＝N1・本フェイクは N2 follow-up）
- 全体像: [roadmap][rm]（「いま着手」）／ API 事実: [docs/reference][ref]／ 契約後検証: [live-verification][lv]

[adr43]: ../adr/0043-local-fake-server.md
[adr24]: ../adr/0024-mock-transport.md
[rm]: ../roadmap.md
[ref]: ../reference/README.md
[lv]: ../live-verification.md
