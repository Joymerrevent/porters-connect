# @joymerrevent/porters-connect

[![npm version][npm-badge]][npm] [![License: MIT][mit-badge]][mit] ![Node >= 20][node-badge] [![OpenSSF Scorecard][scorecard-badge]][scorecard]

PORTERS Connect API（旧 HRBC）を **TypeScript から型安全・簡単に**扱うための、
[Joymerrevent（ジョイメリベント）][joymerrevent] 製の **非公式（unofficial）** ラッパーです。

> [!IMPORTANT]
> これは**非公式**ライブラリです。ポーターズ株式会社とは無関係で、公式ロゴ・商標は使用していません。
> 利用には **PORTERS の契約 ＋ Connect API オプション契約**が必要です（ホスト名・App ID/Secret は契約時に通知されます）。

XML レスポンスを型付きオブジェクトに変換し、独自仕様の OAuth・レート制御・エラー整理を内側に隠します。
**薄く・堅く**を方針に、フェイルセーフ（壊れたときに安全側へ倒れる）設計です。

---

## 特徴

- **型安全**：リソース・項目の値を型で表現。`any` を撒きません。
- **XML を外に出さない**：返り値は型付きオブジェクト、入力も素直な JS の値。
- **独自 OAuth を透過**：`code_direct` によるトークン取得・キャッシュ・更新を自動化。
- **良き API 市民**：スロットリング・リトライ（指数バックオフ）・リクエストサイズガード内蔵。
- **日時は ISO 8601（UTC）に正規化**。業務タイムゾーン変換はしません（利用側の責務）。
- **PORTERS の全リソースに対応**：データ系 13 種 ＋ Phase ＋ マスタ Read 4 種。

## 前提

1. **PORTERS 契約 ＋ Connect API オプション契約**。ホスト名・App ID・App Secret が通知されます。
2. **初回のみブラウザで権限付与**（人手・1 回）。以降はライブラリが `code_direct`（サーバ間）で
   無人運用します。手順は[認証を通す][s-auth]にあります。
3. Node.js 20 以上（ESM）。型定義は同梱です。

**契約が無くても試せます** — [インストールと、最初の 1 回][s-install]は、契約もネットワークも
無しで動かすところから始まります。

## インストール

```sh
npm i @joymerrevent/porters-connect
# pnpm add @joymerrevent/porters-connect
# yarn add @joymerrevent/porters-connect
```

## 最短で動かす

```ts
import { PortersClient } from "@joymerrevent/porters-connect";

const porters = new PortersClient({
  host: process.env.PORTERS_HOST ?? "", // 契約時に通知される値。ハードコード禁止
  appId: process.env.PORTERS_APP_ID ?? "",
  appSecret: process.env.PORTERS_APP_SECRET ?? "",
});

// partition（Company DB）は tenant で一度だけ束ねる。**単一テナントでもこの形**
const t = porters.tenant(456);

const page = await t.candidate.search({
  field: ["P_Id", "P_Name", "P_UpdateDate"], // 省略すると主キーしか返らない
  condition: { P_Name: { part: "山田" } }, // part = 部分一致 / full = 完全一致
  order: [{ P_UpdateDate: "desc" }],
  count: 50, // 1 ページ最大 200
});

console.log(page.total, page.items[0]?.P_Name);
```

続きは[入門][s-install]（5 ページ）へ。読み取り・書き込み・本番に出す前の確認まで順に進みます。

## リソースと操作

**操作はどのリソースでも共通**です（`search` / `searchAll` / `get` / `create` / `update`）。

| アクセサ        | リソース       | アクセサ       | リソース                                  |
| --------------- | -------------- | -------------- | ----------------------------------------- |
| `t.candidate`   | 個人連絡先     | `t.contract`   | 契約                                      |
| `t.job`         | JOB            | `t.sales`      | 成約・売上                                |
| `t.client`      | 企業           | `t.process`    | 選考プロセス                              |
| `t.recruiter`   | 企業担当者     | `t.resume`     | レジュメ                                  |
| `t.contact`     | コンタクト     | `t.attachment` | 添付ファイル（`searchAll` なし）          |
| `t.opportunity` | 商談管理       | `t.phase`      | フェーズ履歴（`of(リソース名)` で束ねる） |
| `t.activity`    | アクティビティ |                |                                           |

マスタ Read は `porters.partition` / `t.user` / `t.field` / `t.option` の 4 種（読み取り専用）。
各リソースの項目一覧・引数・戻り値は **[API リファレンス][api-ref]** が正典です。

## ドキュメント

**[docs/usage][docs-index] が目次**です。4 層に分かれています。

| 層               | 何が書いてあるか                                                                   |
| ---------------- | ---------------------------------------------------------------------------------- |
| **入門**         | 順に読む 5 ページ。契約なしで動かす → 認証 → 読み → 書き → 本番前                  |
| **考え方**       | PORTERS 固有の前提（Partition ／ alias と Data Type ／ UTC ／ 削除が無い ／ 上限） |
| **目的別**       | 「〜したい」から引く 9 ページ（検索・一括書き込み・添付・同期バッチ・テスト ほか） |
| **リファレンス** | [公開 API の全記号][api-ref]（JSDoc から生成）と [PORTERS API の事実][ref]         |

## PORTERS 固有の注意

このライブラリを使ううえで、**PORTERS 側の前提**として先に知っておくと迷いません。詳しくは
それぞれの「考え方」ページにあります。

- **削除 API が存在しない**。`delete()` は型の上でも生やしていません（[削除 API が無いということ][c-no-delete]）。
- **日時は UTC 前提**。ISO 8601（`…Z`）で入出力し、JST 等への変換はしません（[日時は UTC][c-datetime]）。
- **データは Partition に分かれる**。`tenant(id)` で毎回束ねます（[Partition とテナント][c-partition]）。
- **上限がある**。リクエスト長 約 15000 文字・1 リクエスト 200 件・1 分あたり Read 2000 / Write 500 は
  ライブラリが自制しますが、**月 15 万アクセスは契約条件**で利用側の運用責務です（[上限][c-limits]）。
- **ホスト名は非公開**。`PORTERS_HOST` で受け取り、ハードコードしません。

## 対応バージョン

- **契約は Connect API Version 2**：`X-P-ConnectAPI-Version: 2` を既定送信し、**v2 を動作の前提**とします（担当者型・部署型 Link 等は v2 必須）。互換性はこの **API version** で明示します。
- **PORTERS 製品 8.x / 9.x は参考**：v2 が提供される製品世代です（個別マイナーの動作保証はしません）。**正典は [docs/reference][ref]**（実 API ドキュメントに接地）。

## リンク

**この README は「最短で動かす」ところまで**です。網羅は目次側が担当します（[ADR-0070][adr70]）。

- 利用者向け：[docs/usage][docs-index]（目次）／[公開 API の全記号][api-ref]／[PORTERS API の事実][ref]
- 開発・保守：[docs/README.md][docs-readme]（ADR・基本設計・ロードマップ・台帳への入口）
- 提供元：[Joymerrevent][joymerrevent]

## コントリビュート / セキュリティ

- バグ報告・要望・質問は [Issues][issues] へ（外部からの提案は Issue 経由・PR 作成はコラボレーター限定）。詳しくは [CONTRIBUTING][contributing]。
- 脆弱性は公開 Issue ではなく [セキュリティポリシー][security] の手順で**非公開**で報告してください。
- 行動規範：[Contributor Covenant][coc]。

> 念のため：本ライブラリは**非公式**です。PORTERS 製品・Connect API 本体の不具合や要望は PORTERS 公式へお願いします。

## ライセンス

[MIT][mit] © Joymerrevent

[npm]: https://www.npmjs.com/package/@joymerrevent/porters-connect
[npm-badge]: https://img.shields.io/npm/v/@joymerrevent/porters-connect
[mit]: ./LICENSE
[mit-badge]: https://img.shields.io/badge/License-MIT-blue.svg
[node-badge]: https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg
[scorecard]: https://scorecard.dev/viewer/?uri=github.com/Joymerrevent/porters-connect
[scorecard-badge]: https://api.scorecard.dev/projects/github.com/Joymerrevent/porters-connect/badge
[joymerrevent]: https://github.com/Joymerrevent
[contributing]: ./CONTRIBUTING.md
[security]: ./SECURITY.md
[coc]: ./CODE_OF_CONDUCT.md
[issues]: https://github.com/Joymerrevent/porters-connect/issues
[api-ref]: docs/usage/api/index.md
[c-datetime]: docs/usage/concepts/datetime.md
[c-limits]: docs/usage/concepts/limits.md
[c-no-delete]: docs/usage/concepts/no-delete.md
[c-partition]: docs/usage/concepts/partition.md
[s-auth]: docs/usage/start/authenticate.md
[s-install]: docs/usage/start/install.md
[docs-index]: docs/usage/index.md
[adr70]: ./docs/adr/0070-usage-documentation-architecture.md
[docs-readme]: ./docs/README.md
[ref]: docs/usage/reference/README.md
