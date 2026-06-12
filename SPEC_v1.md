# @joymerrevent/porters-connect — SPEC v1

> PORTERS Connect API（旧 HRBC）向け、非公式 TypeScript ラッパー & MCP サーバー。
> Joymerrevent（ジョイメリベント）管理リポジトリ。

---

## 0. このドキュメントの位置づけ

- 本書は Claude Code（CC）での実装を前提とした設計仕様書。
- 同梱の `CLAUDE.md`（実装規約）と `KICKOFF_PROMPT.md`（初手プロンプト）とセットで使う。
- 実装は「第1層ラッパー」から着手し、第2層・第3層は後続フェーズで積み上げる。

---

## 1. プロジェクト概要

| 項目 | 内容 |
|---|---|
| パッケージ名（第1層） | `@joymerrevent/porters-connect` |
| パッケージ名（第2層） | `@joymerrevent/porters-mcp`（後続フェーズ） |
| 配布 | npm（npx 起動）＋ Docker イメージ（後続フェーズ） |
| ライセンス | MIT |
| GitHub リポジトリ | `joymerrevent/porters-connect`（組織アカウント。屋号管理） |
| 公式との関係 | **非公式（unofficial）**。商標は株式会社ポーターズに帰属。READMEで明示 |
| 言語 / ランタイム | TypeScript / Node.js（ESM 前提、CJS も配慮） |
| 目的 | 収益化より「多くの実利用者に使われること」を最優先 |

---

## 2. 背景（調査結果サマリ）

### 2.1 既存ライブラリは事実上ゼロ
- npm / GitHub に PORTERS Connect API 専用の TS/JS ラッパー・SDK は**公式・非公式とも存在しない**（調査時点）。
- 公開ナレッジは Qiita 記事（GAS で XML 操作）等の個別ハウツーのみ。再利用可能な npm パッケージは無し。
- ポーターズ社は**公式 SDK を提供しておらず**、認定開発パートナー制度で外部開発に委ねる方針。
- → **空白市場。デファクトを取りに行ける。**

### 2.2 PORTERS API の「使いにくさ」（＝ラッパーが解決すべき課題）
- **レスポンスが XML**（`application/xml;charset=UTF-8` 統一）。JSON 非対応。
- **OAuth が独自仕様**：トークンを独自ヘッダ `X-porters-hrbc-oauth-token` に載せる。認証コードの有効期限は発行から **30秒**。`code`（ブラウザ経由）/ `code_direct`（サーバ間直接）の2方式。スコープはリソース別 R/W（例 `candidate_r` / `candidate_w`）。
- **UTC 前提**：日本時間運用には +9h の時差補正が必要。
- **削除 API が存在しない**（提供予定も無し）。
- **リクエスト 32KB 超で 400 エラー**。
- **レート制限**：API オプションは 15万アクセス/月まで（超過課金あり）。
- **リクエストURIのホスト名のみ非公開**：契約企業へ接続情報納品時に通知される（テストには契約環境が必須）。
- ドキュメント自体はサインイン不要で公開（hrbcapi.porters.jp）。

### 2.3 リソース構成（公式 API List）
- マスタ系：Partition / User / Field / Option
- データ系：Client / Recruiter / Contact / Job / Candidate / Resume / Process / Activity / Contract / Sales / Opportunity / Phase / Attachment
- 各リソースに必要スコープが定義されている。

### 2.4 市場・需要（推測を含む）
- PORTERS は国内シェア No.1 を標榜、導入 2,200社超。ただし API 利用は**有償オプション（約3万円/月）かつ契約者限定**。
- API 連携の実需は大口企業中心のごく一部（顧客の7割超が10ID以下の中小）。**実需は数十〜百数十社規模（推測）**。
- 主要ターゲットは「人材会社から API 連携を受託するフリーランス / 受託開発者 / 制作会社」。
- 普及期待値：国内 B2B SaaS 公式 SDK 最上位の kintone でも週次DL約1万・スター119。本件は**数百〜数千DL/月・スター数十・実利用数社〜数十社**が現実線（推測）。

---

## 3. 設計原則（Joymerrevent の哲学に沿う）

> 「動くものではなく、動き続けるものを作る」

1. **薄く・堅く**：第1層は「fetch + XMLパース + 型 + UTC補正 + OAuth」の薄いコアに徹する。ビジネスロジックを混ぜない。
2. **XML を内部に隠蔽**：利用者には型付き JS オブジェクトのみを返す。XML は外に漏らさない。
3. **型安全を最優先**：リソース・スコープ・レスポンスを型で表現。`any` を撒かない。
4. **API バージョン追従**：PORTERS は 8.x→9.x と更新が続く。対応バージョンを README とコードに明記。
5. **非公式を明示**：READMEで「非公式」「PORTERS契約＋APIオプション契約が必要」を冒頭に記載。
6. **秘匿情報を絶対にコミットしない**：App ID / Secret / ホスト名 / トークンは全て環境変数。`.env.example` のみ同梱。

---

## 4. アーキテクチャ（3層・積層設計）

```
┌─────────────────────────────────────────────┐
│ 第3層：配布                                   │
│   npm（npx 起動）／ Docker イメージ           │
│   将来：Docker MCP Catalog 登録               │
├─────────────────────────────────────────────┤
│ 第2層：@joymerrevent/porters-mcp（後続）      │
│   @modelcontextprotocol/sdk で MCP サーバー化 │
│   第1層をそのまま内部で呼ぶ                   │
│   tools: search_candidates / get_job / ...    │
├─────────────────────────────────────────────┤
│ 第1層：@joymerrevent/porters-connect ★最初   │
│   OAuth ／ XML隠蔽 ／ 型付け ／ UTC補正        │
│   リソース別メソッド（client/job/candidate…） │
└─────────────────────────────────────────────┘
```

**実装順序：第1層 →（安定後）第2層 →（手応えあれば）第3層 Docker化・Catalog登録。**

---

## 5. 第1層 詳細仕様（今フェーズの実装対象）

### 5.1 ディレクトリ構成（案）
```
porters-connect/
├── src/
│   ├── index.ts              # public export
│   ├── client.ts             # PortersClient（エントリポイント）
│   ├── auth/
│   │   └── oauth.ts          # OAuth（code / code_direct）、トークン管理
│   ├── http/
│   │   ├── request.ts        # fetch ラッパー（リトライ/スロットリング/32KB対策）
│   │   └── headers.ts        # X-porters-hrbc-oauth-token 等
│   ├── xml/
│   │   └── parser.ts         # XML→型付きオブジェクト（fast-xml-parser 等）
│   ├── resources/
│   │   ├── candidate.ts
│   │   ├── job.ts
│   │   ├── client.ts
│   │   ├── process.ts
│   │   └── ...               # 段階的に追加
│   ├── types/                # リソース・スコープ・レスポンスの型
│   └── util/
│       └── datetime.ts       # UTC↔JST 補正
├── test/
├── .env.example              # APP_ID / APP_SECRET / HOST など（値は空）
├── package.json
├── tsconfig.json
├── README.md                 # 英語メイン
├── README.ja.md              # 日本語併記
├── LICENSE                   # MIT
└── CLAUDE.md
```

### 5.2 公開 API（イメージ）
```ts
import { PortersClient } from "@joymerrevent/porters-connect";

const porters = new PortersClient({
  host: process.env.PORTERS_HOST!,      // 契約時に通知されるホスト名
  appId: process.env.PORTERS_APP_ID!,
  appSecret: process.env.PORTERS_APP_SECRET!,
  scopes: ["candidate_r", "job_r"],
});

// XML を意識させず、型付きで返す
const candidates = await porters.candidate.search({ /* 条件 */ });
const job = await porters.job.get(jobId);
```

### 5.3 MVP で実装するリソース（優先順）
1. **OAuth（認証）** — 全ての前提
2. **Candidate**（R/W）
3. **Job**（R/W）
4. **Client**（R/W）
5. **Process**（R/W）
6. **Resume**（R）
- 残りリソース（Activity / Contract / Sales 等）は v0.2 以降で段階追加。

### 5.4 横断機能
- リトライ & スロットリング（15万/月のレート制限に配慮）
- 32KB 超リクエストの事前検知 / 分割の警告
- UTC↔JST 変換ユーティリティ
- 削除 API 非対応を型レベルで明示（delete メソッドを生やさない）
- エラー型の整備（認証失敗 / レート超過 / 400 等を判別可能に）

### 5.5 依存ライブラリ候補
- XML パース：`fast-xml-parser`
- HTTP：標準 `fetch`（Node 18+）or `ky`（軽量・リトライ容易）
- 型生成補助：必要に応じて手書き型 + テストで担保
- 開発：`tsup`（ビルド）/ `vitest`（テスト）/ `tsx`（実行）

---

## 6. 第2層 概要（後続フェーズ・MCP サーバー）

- `@modelcontextprotocol/sdk`（TypeScript）でサーバー実装。
- 第1層を**内部でそのまま呼ぶ**だけ。ロジック重複を作らない。
- 単一責任の原則：PORTERS ドメイン1つに集約。将来分割するなら「候補者検索専用」「案件管理専用」等に分ける余地を残す。
- 公開ツール例：`search_candidates` / `get_job` / `create_process` / `get_candidate` 等。
- 人材会社＝個人情報を扱うため、**最小権限スコープ**でツールを公開する（読み取り専用トークン等）。

---

## 7. 第3層 概要（後続フェーズ・配布）

- **npm 公開**：npx 即起動に対応。
- **Docker イメージ**：マルチステージビルド、非 root 実行、healthcheck、ハッシュ固定タグ。
- **Docker MCP Catalog 登録**：手応えが出たら community-built として PR 提出を検討（発見性が一気に上がる）。
- npx と Docker は**二択ではなく両対応**：手軽さ重視 → npx、セキュリティ重視・企業利用 → Docker。

---

## 8. 法的・運用上の注意

- 「PORTERS」は株式会社ポーターズの商標。**非公式を明示**し、公式ロゴは使わない。
- READMEに「利用には PORTERS 契約 ＋ Connect API オプション契約が必要」と明記。
- App ID / Secret / ホスト名 / トークンを**リポジトリにコミットしない**（環境変数化を徹底）。
- 公開後、ポーターズ社へ一報し、可能なら認定パートナー登録 / 紹介ページ掲載を打診（“公認”に近い信頼を獲得）。

---

## 9. ロードマップ

| 段階 | 内容 | 判断基準 |
|---|---|---|
| 1. PoC | 契約環境で OAuth＋1リソース取得を型付きで実証 | コード量・型安全が明確に改善するか |
| 2. MVP 公開 | 第1層を MIT で npm 公開（主要5リソース） | 3〜6か月で DL推移 / Issue / 実利用問い合わせ |
| 3. 第2層 MCP | 安定後に MCP サーバー追加 | MCP 経由の実利用が見えるか |
| 4. Docker / Catalog | 手応えありで Docker化・Catalog登録 | 月数千DL・複数組織利用が定常化 |

---

## 10. Caveats（前提・限界）

- 需要規模（社数・DL数）は**すべて推測**。ポーターズ社は API 連携企業の内訳を非公開。
- API 仕様は変化しうる（将来 JSON 対応や公式 SDK が出ればラッパー価値は変動）。
- ホスト名非公開のため、契約のない開発者は実 API を叩けない＝コントリビュータ獲得の障壁。
- 「既存ライブラリ無し」はプライベートリポジトリ等までは観測不能なため完全な証明ではない。
