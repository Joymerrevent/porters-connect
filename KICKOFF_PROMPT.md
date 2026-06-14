# KICKOFF_PROMPT.md

Claude Code に最初に投げるプロンプトです。
このリポジトリのルートに `SPEC_v1.md` と `CLAUDE.md` を置いた状態で、以下を貼り付けてください。

> **注記（2026-06 追記）**: これはプロジェクト初期（scaffold 着手時）の**歴史的プロンプト**です。
> 設計はその後 `docs/`（要件・基本設計 `docs/design/` ／ 決定 `docs/adr/` ／ API 事実 `docs/reference/`）へ移行し、そちらが正。
> 本文中の `SPEC_v1.md` 参照（読み込み・「ディレクトリ構成 5.1」）は**素案（superseded・将来削除予定）**前提で、`docs/design/basic-design.md` §2 に読み替えてください。

---

## 初手プロンプト（コピペ用）

```text
このリポジトリで @joymerrevent/porters-connect を実装します。
まず SPEC_v1.md と CLAUDE.md を読んでから着手してください。

【今回のゴール：第1層ラッパーの土台（scaffold）を作る】

1. プロジェクト初期化
   - TypeScript（strict）/ ESM / Node 18+ 前提
   - tsup（ビルド）, vitest（テスト）, tsx（実行）, fast-xml-parser をセットアップ
   - package.json は name=@joymerrevent/porters-connect, license=MIT, type=module
   - tsconfig.json, .gitignore, .env.example（値は空）, LICENSE(MIT) を用意

2. ディレクトリ構成を SPEC_v1.md 5.1 に従って作成
   - src/index.ts, client.ts, auth/oauth.ts, http/{request,headers}.ts,
     xml/parser.ts, resources/, types/, util/datetime.ts

3. まず OAuth と Candidate（読み取り）を最小実装
   - OAuth: code_direct 方式。認証コード有効期限30秒を考慮。
     トークンを X-porters-hrbc-oauth-token ヘッダに載せる。
   - PortersClient のエントリポイントを作り、
     porters.candidate.search() / porters.candidate.get(id) が型付きで返るところまで。
   - XML レスポンスは内部でパースし、型付きオブジェクトのみ返す（XMLを外に出さない）。
   - host/appId/appSecret は環境変数から受け取る（ハードコード禁止）。

4. CLAUDE.md の「絶対にやってはいけないこと」を厳守
   - 秘匿情報をコミットしない。.env.example のみ。
   - delete メソッドは作らない（削除API非対応）。
   - README は英語メイン。冒頭に「非公式 / PORTERS契約＋APIオプション契約が必要」を明記。

5. vitest でユニットテストを用意（XMLパース・UTC補正・OAuthトークン付与の検証）
   - 実 API は契約環境が必要なため、まずはモックXMLでテストする。

実装方針で不明点があれば、コードを書く前に質問してください。
まず全体の scaffold とファイル雛形を作り、その後 OAuth → Candidate の順で中身を埋めましょう。
```

---

## 補足メモ（JJ用）

- **実 API テストには契約環境が必須**（ホスト名が契約時通知のため）。
  scaffold 段階はモック XML で進め、PoC で実環境に繋ぐのは契約環境が用意できてから。
- GitHub リポジトリは **`joymerrevent/porters-connect`**（組織アカウント `joymerrevent` を作成）。
  GitHub で組織 `joymerrevent` を作成 → リポジトリ作成 → ローカルで `git init` → リモート設定、の順で。
- 第1層が安定したら、別リポジトリ or 同リポジトリの packages/ 配下に
  `@joymerrevent/porters-mcp`（第2層 MCP サーバー）を追加する。
  その際は @modelcontextprotocol/sdk を使い、第1層を内部呼び出しするだけにする。
