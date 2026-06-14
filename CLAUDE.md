# CLAUDE.md — @joymerrevent/porters-connect

このファイルは Claude Code がこのリポジトリで作業する際に常時参照する規約です。
設計の正は `docs/`（要件・基本設計: `docs/design/` ／ 決定: `docs/adr/` ／ API 事実: `docs/reference/`）を参照してください。
`SPEC_v1.md` は初期の素案（superseded・将来削除予定）で、歴史的経緯としてのみ残置しています。

---

## プロジェクトの目的

PORTERS Connect API（旧 HRBC）を TypeScript から型安全・簡単に扱うための**非公式**ラッパー。
将来的に MCP サーバー化し、AI エージェントから PORTERS を操作可能にする。

- 提供元：Joymerrevent（ジョイメリベント）
- 最優先目標：**収益化より、多くの実利用者に使われること**
- 哲学：**フェイルセーフ**＝「壊れたときに安全側へ倒れるものを作る」→ 想定外でも被害を広げない。薄く・堅く・メンテしやすく

---

## 技術スタック

- 言語：TypeScript（strict）
- ランタイム：Node.js 18+（ESM 前提、可能なら CJS も出力）
- ビルド：tsup
- テスト：vitest
- 実行：tsx
- XML パース：fast-xml-parser
- HTTP：標準 fetch（`docs/adr/0009-http-transport.md` で確定。ky は不採用）
- ライセンス：MIT

---

## PORTERS API 固有の注意点（最重要）

実装時、以下は必ず考慮すること。これらが本ライブラリの存在理由です。

1. **レスポンスは XML**。利用者には型付きオブジェクトのみ返す。XML を外に漏らさない。
2. **OAuth は独自仕様**：
   - トークンは独自ヘッダ `X-porters-hrbc-oauth-token` に載せる。
   - 認証コードの有効期限は**発行から30秒**。取得後すぐトークン交換する。
   - `code`（ブラウザ経由）と `code_direct`（サーバ間直接、code を XML で返却）の2方式。
   - スコープはリソース別 R/W（例 `candidate_r` / `candidate_w`）。
3. **UTC 前提**。ライブラリは日時を **ISO 8601（UTC, `...Z`）に正規化**して入出力し、**JST 等の業務タイムゾーン変換はしない**（利用側の責務）。`util/datetime.ts`（PORTERS 形式 ⇄ ISO）に集約。
4. **削除 API は存在しない**。`delete()` メソッドを生やさない（型レベルで非対応を明示）。
5. **リクエスト 32KB 超で 400 エラー**。送信前にサイズを検知し警告 / 分割。
6. **レート制限**：15万アクセス/月。リトライ＆スロットリングを内蔵。
7. **ホスト名は非公開**：契約時に通知される値を環境変数（`PORTERS_HOST`）で受け取る。ハードコード禁止。

---

## リソース（公式 API List 準拠）

- マスタ系：Partition / User / Field / Option
- データ系：Client / Recruiter / Contact / Job / Candidate / Resume / Process / Activity / Contract / Sales / Opportunity / Phase / Attachment

MVP 優先順：**OAuth → Candidate → Job → Client → Process → Resume → Attachment**。残りは v0.2 以降。
（Attachment を MVP に追加：`docs/adr/0003-add-attachment-to-mvp.md`）

---

## コーディング規約

- `any` を撒かない。リソース・スコープ・レスポンスは型で表現する。
- フィールド型モデル：**標準 `P_` は同梱の静的型／テナント毎 `U_`・`A_` は利用者が宣言＋実行時検証**（ハイブリッド。`docs/adr/0004-field-type-model.md`）。
- public API は `src/index.ts` から明示的に export。内部実装は外に漏らさない。
- エラーは判別可能な型に整理：基底 `PortersError` ＋ 系統別サブクラス（Auth / Resource / Network / Config）＋ `category`（`docs/adr/0006-error-model.md`）。
- 1ファイル1責務。XML パース・OAuth・HTTP・リソースを混ぜない。
- テストを伴わない新リソース追加はしない。
- **公開サーフェス（型名・メソッド名・public API の JSDoc）は英語**。**内部実装コメントは日本語可**
  （保守者が読めること＝フェイルセーフ優先。海外コントリビュータは契約ゲートで実質入れない）。実行時 i18n はしない。
- README / ドキュメント / ブログは**日本語ファースト →（後で）英語**（読者は国内の開発者）。

---

## 絶対にやってはいけないこと

- App ID / App Secret / ホスト名 / トークンを**コミットしない**。`.env.example`（値は空）のみ同梱。
- PORTERS 公式ロゴを使わない。READMEで**「非公式（unofficial）」を明示**する。
- 「利用には PORTERS 契約 ＋ Connect API オプション契約が必要」の注記を README から省かない。
- ビジネスロジックを第1層に混ぜない（第1層は薄いラッパーに徹する）。

---

## ディレクトリ構成

モジュール構成（ディレクトリ＝責務境界）とテスト配置は `docs/design/basic-design.md` §2 が正。
ファイル単位の分割は詳細設計／実装で確定する。下記は要点のみ（雛形・非確定）：

```text
src/
  index.ts        # public export
  client.ts       # PortersClient
  auth/oauth.ts
  http/{request,headers}.ts
  xml/parser.ts
  resources/{candidate,job,client,process,...}.ts
  types/
  util/datetime.ts
```

---

## バージョン管理

- PORTERS は 8.x→9.x と更新が続く。**対応 PORTERS バージョンを README とコードコメントに明記**する。
- semver に従う。破壊的変更はメジャーバンプ。

---

## リポジトリ / 命名（要確認事項あり）

- npm スコープ：`@joymerrevent`
- パッケージ名：`@joymerrevent/porters-connect`（第2層は `@joymerrevent/porters-mcp`）
- GitHub：`joymerrevent/porters-connect`（組織アカウント `joymerrevent` を作成して屋号管理）。
