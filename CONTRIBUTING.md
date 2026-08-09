# コントリビュートガイド

`@joymerrevent/porters-connect` への関心をありがとうございます。
このライブラリは [Joymerrevent][joymerrevent] 製の **非公式（unofficial）** PORTERS Connect API ラッパーです。

## はじめに（重要な前提）

- **非公式**：ポーターズ株式会社とは無関係です。PORTERS 製品・Connect API 本体への要望や不具合は PORTERS 公式へ。
- **契約ゲート**：実 API に対する動作確認には **PORTERS 契約 ＋ Connect API オプション契約**が必要です（ホスト名・App ID/Secret は契約時に通知）。契約が無くても、公開モック `createMockTransport` を使えばオフラインで動作確認・テストできます。

## コントリビュートの流れ

このリポジトリは **PR 作成をコラボレーターに限定**しています（契約ゲートの性質上、外部からの fork-PR は実質機能しないため）。

- **バグ報告・機能要望・質問** → [Issues][issues] からお願いします（テンプレートあり）。
- **コード変更を提案したい** → まず Issue を立てて方針を相談してください。合意できればメンテナが対応、または必要に応じてアクセスを調整します。

行動の基準は [行動規範][coc]（Contributor Covenant）に従います。

## 開発環境

- Node.js 20+ / **pnpm**（npm ではなく pnpm を使用）。

```sh
pnpm install
pnpm typecheck     # tsc --noEmit
pnpm test          # vitest
pnpm lint          # eslint + markdownlint
pnpm format:check  # prettier
pnpm build         # tsup
pnpm sandbox       # オフラインのサンプル実行
```

提出前に **すべての品質ゲート（typecheck / lint / format:check / test / build）が green** であることを確認してください。CI でも同じゲートが走ります。

### テストの書き分け（モック / フェイク）

契約なしで動かす手段が 2 つあります。**どちらを使うかは「1 回の呼び出しを見たいのか、流れを見たいのか」**で決めます。

|            | `createMockTransport`（`src`・**公開 API**）     | `createFakeTransport`（`test/fake`・**開発専用**）                     |
| ---------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| 性質       | 状態を持たないスタブ（リクエスト→固定の応答）    | 状態を持つフェイクサーバー（OAuth・レコード・API の制約）              |
| 使いどころ | 単体テスト・利用者向けサンプル（`pnpm sandbox`） | 結合テスト（`create → search → update` の往復）・異常系の注入          |
| 出せる失敗 | 自分で書いた XML / status                        | 実 Result Code・トークン失効・partition 不一致・長さ超過・注入した障害 |
| 配布       | npm に含む（利用者も使える）                     | **含まない**（`files` = `dist`・coverage 対象外）                      |

フェイクの設計は [ADR-0043][adr43]、実装フェーズは [フェイクサーバー実装計画][fake-plan] を参照してください。

### フェイクをローカルサーバーとして起動する

別プロセス（curl・スクラッチスクリプト・将来の MCP サーバー）から叩きたいときは HTTP で起動します。

```sh
pnpm fake:serve            # http://127.0.0.1:4010（PORT で変更可）
```

ライブラリから繋ぐときは、**設定だけ**を書き換えます（[ADR-0047][adr47]）。フェイクは証明書を持たないので
`scheme: "http"` を明示します。**アプリのコードは変えません**。

```ts
new PortersClient({
  host: "127.0.0.1:4010", // PORTERS_HOST に入れる値（ポート込み）
  scheme: "http", // 明示したときだけ平文。毎プロセス 1 回警告します
});
```

警告は意図した平文利用でのみ `PORTERS_SUPPRESS_INSECURE_HTTP_WARNING=1` で抑止します（許可と沈黙は別）。

ライブラリの設定に触れず transport 側で繋ぎたいときは、フェーズ5 の転送 transport も残してあります
（`host` はアプリの設定のまま・ライブラリ非依存）。

```ts
import { createForwardingTransport } from "./test/fake/index";

new PortersClient({
  host: "fake.test",
  transport: createForwardingTransport({ baseUrl: "http://127.0.0.1:4010" }),
});
```

## ブランチ運用（git-flow）

- ベースは **`develop`**（統合ブランチ）。`main` はリリース済みの状態。
- 作業は `develop` から切ったブランチで行い、`develop` 向けに PR を出します。
- **PR のマージはメンテナが行います。**

## コミット規約

- **Conventional Commits**（例：`feat:` / `fix:` / `docs:` / `chore:` / `ci:` / `refactor:` / `test:`）。
- 公開済みコミットの **amend・履歴書き換えはしない**（修正は新しいコミットで）。

## コーディング規約（[ADR-0013][adr13] が正）

- `any` を撒かない。リソース・スコープ・レスポンスは型で表現する。
- クラスは `Error` 派生と `PortersClient` のみ。状態を持つ内部協調子は **factory 関数**。**関数は全 arrow（`const`）／型定義は全 `type`（`interface` 不使用）**。eslint で強制。
- ファイル名は **kebab-case**。1 ファイル 1 責務（XML / OAuth / HTTP / リソースを混ぜない）。
- **削除 API は生やさない**（PORTERS 仕様。`delete()` は提供しない）。
- **公開サーフェス（型名・メソッド名・public API の JSDoc）は英語**。内部実装コメントは日本語可。
- **テストを伴わない新リソース追加はしない。**
- ドキュメント / README は**日本語ファースト**。Markdown のリンクは**参照スタイル**（本文 `[text][label]`、定義は末尾にまとめる）。

## 設計判断（ADR）

設計に関わる判断は **ADR** で記録します。フローは **起票（`proposed`）→ 議論 → 決定（`accepted`）**。
**個人や AI が単独で `accepted` にしない。** 詳細は [docs/adr][adr]。

## ライセンス

コントリビュートは **MIT ライセンス**の下で提供されたものとみなします。

[joymerrevent]: https://github.com/Joymerrevent
[issues]: https://github.com/Joymerrevent/porters-connect/issues
[coc]: ./CODE_OF_CONDUCT.md
[adr]: ./docs/adr/README.md
[adr13]: ./docs/adr/0013-coding-conventions-class-vs-function.md
[adr43]: ./docs/adr/0043-local-fake-server.md
[adr47]: ./docs/adr/0047-access-point-scheme.md
[fake-plan]: ./docs/design/fake-server-plan.md
