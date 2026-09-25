# @joymerrevent/porters-connect

[![npm version][npm-badge]][npm] [![License: MIT][mit-badge]][mit] ![Node >= 22.12.0][node-badge] [![OpenSSF Scorecard][scorecard-badge]][scorecard] [![OpenSSF Best Practices][bp-badge]][bp]

PORTERS Connect API（旧 HRBC）を **TypeScript から型安全・簡単に**扱うための、
[Joymerrevent（ジョイメリベント）][joymerrevent] 製の **非公式（unofficial）** ラッパーです。

> [!IMPORTANT]
> これは**非公式**ライブラリです。ポーターズ株式会社とは無関係で、公式ロゴ・商標は使用していません。
> 利用には **PORTERS の契約 ＋ Connect API オプション契約**が必要です（ホスト名・App ID/Secret は契約時に通知されます）。

PORTERS が返す XML は、型の付いたオブジェクトに変換して返します。PORTERS 独自の OAuth、上限を守るための制御、
エラーの分類はライブラリが受け持ちます。

---

## 特徴

- **型安全**：リソースと項目の値に型が付きます。`any` は使いません。
- **XML を扱わなくてよい**：戻り値は型の付いたオブジェクトで、渡す値もふつうの JavaScript の値です。
- **OAuth の手続きを自動で行う**：`code_direct` でのトークンの取得・キャッシュ・更新をライブラリが行います。
- **上限を守る**：スロットリング、リトライ（指数バックオフ）、リクエストの長さの検査を備えています。
- **日時は ISO 8601（UTC）でやり取りする**：JST などへの変換はしません（利用側で行います）。
- **PORTERS の全リソースに対応**：マスタ系 5 種（読み取り専用）＋ データ系 13 種（Phase・Attachment を含む）。
  一覧と呼べるメソッドは[リソースと操作][docs-resources]にあります。

## 前提

使い始める前に、次の **4 つ**を済ませておく必要があります。揃っていないと PORTERS を呼べません。

1. **PORTERS 契約 ＋ Connect API オプション契約**（オプションは別契約）。
2. **PORTERS への API アプリの登録**。ここで Redirect URL を決め、**ホスト名・App ID・App Secret** が
   通知されます（いずれも機密情報なので、コードに直接書かず環境変数で渡します）。
3. **初回だけ、ブラウザで権限を付与する**（人の操作が要ります。Company DB ごとに 1 回）。2 回目以降は、ライブラリが
   `code_direct`（サーバ間）で人の操作なしにトークンを取ります。
4. **付与するスコープを決める**（リソースごとに読み `_r` / 書き `_w`。読み取りだけでも複数のスコープが要ることがあります）。

揃え方は[始める前に][s-prereq]に、権限付与の手順は[認証を通して、疎通を確認する][s-auth]にあります。

実行環境は **Node.js 22.12 以上**です。型定義は同梱していて、型を読むには **TypeScript 5.4 以上**が要ります。
配布しているのは ESM（`import`）のファイル 1 つですが、CJS（`require`）からも
`require("@joymerrevent/porters-connect")` で読み込めます（[CJS から使う][s-cjs]）。

契約や権限付与を**待っている間**も、PORTERS に接続せずにコードとテストを書けます
（[契約なしでテストする][test-without-contract]）。

## インストール

```sh
npm i @joymerrevent/porters-connect
# pnpm add @joymerrevent/porters-connect
# yarn add @joymerrevent/porters-connect
```

## クイックスタート

```ts
import { PortersClient } from "@joymerrevent/porters-connect";

const porters = new PortersClient({
  hostname: process.env.PORTERS_HOST ?? "", // 契約時に通知される値。コードに直接書かず環境変数で渡す
  appId: process.env.PORTERS_APP_ID ?? "",
  appSecret: process.env.PORTERS_APP_SECRET ?? "",
});

// Partition（Company DB）は tenant(id) で指定する（既定の Partition は無い）。テナントが 1 つでも同じ書き方
const t = porters.tenant(456);

const page = await t.candidate.search({
  field: ["P_Id", "P_Name", "P_UpdateDate"], // 省略時は標準項目（P_）が全部返る
  condition: { P_Name: { part: "山田" } }, // part = 部分一致 / full = 完全一致
  order: [{ P_UpdateDate: "desc" }],
  count: 50, // 1 ページ最大 200
});

console.log(page.total, page.items[0]?.P_Name);
```

README で説明するのはここまでです。認証の準備・書き込み・エラーの扱いなど、使い方の全体は
[docs/usage][docs-index] の目次から読めます<!-- 根拠: ADR-0070（README は入口に絞る） -->。はじめての人は[導入][s-prereq]（6 ページ）から順に進んでください。

## ドキュメント

**[docs/usage][docs-index] が目次**です。7 つの章に分かれていて、順に読むのは導入だけです。

| 章               | 概要                                                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **導入**         | PORTERS への接続から、データの読み書き、本番での運用までを、6 ページで順に説明します                                                                             |
| **ガイド**       | Partition・検索・書き込み・認証・上限など、PORTERS を使ううえで欠かせない事柄を 1 ページずつ説明します。PORTERS 側の前提と、ライブラリが受け持つ範囲が分かります |
| **クライアント** | クライアントの作り方と、クライアントから呼び出せる機能をまとめています                                                                                           |
| **リソース**     | 18 のリソースごとに、使えるメソッド・注意点・新規作成の必須項目をまとめています                                                                                  |
| **関数**         | `import` して使う関数ごとに、使い方と失敗したときの扱いをまとめています                                                                                          |
| **実践例**       | 毎日の差分同期や複数テナントなど、よくある用途ごとに、機能の組み合わせ方を最初から最後まで示します                                                               |
| **リファレンス** | 型やメソッドの正確な定義（[公開 API リファレンス][api-ref]）と、PORTERS 側の仕様（[PORTERS API の事実][ref]）をまとめています                                    |

目次の末尾の「目的から探す」から、やりたいことに合うページへ直接進めます。

## PORTERS 固有の注意

PORTERS 側の仕様で、使い始める前に知っておきたいものです。詳しくは、それぞれのガイドのページの「まず知ること」に
あります。

- **PORTERS には削除の API がありません**。このライブラリにも `delete()` はありません（[削除と削除済みデータ][c-no-delete]）。
- **日時は UTC です**。ISO 8601（`…Z`）で受け渡しし、JST などへの変換はしません（[日時と時分型][c-datetime]）。
- **データは Partition（Company DB）ごとに分かれています**。`tenant(id)` で Partition を指定してから読み書きします
  （[Partition とテナントスコープ][c-partition]）。
- **上限があります**。リクエストの長さ（約 15000 文字）・1 リクエスト 200 件・1 分あたり Read 2000 / Write 500 は
  ライブラリが守ります。**月 15 万アクセスは契約の条件**で、数えて守るのは利用側です（[上限とレート][c-limits]）。
- **ホスト名は契約時に通知されます**。環境変数（`PORTERS_HOST` など）で渡し、コードに直接書かないでください。

## 対応バージョン

- **Connect API Version 2 を前提にしています**。リクエストには `X-P-ConnectAPI-Version: 2` を付けて送ります
  （担当者型・部署型の参照項目（Link）などは v2 が必要です）。互換性は、この Connect API のバージョンで示します。
- **PORTERS の製品バージョン 8.x / 9.x は参考です**。どちらも v2 を提供している世代ですが、マイナーバージョンごとの動作は
  保証しません。PORTERS 側の仕様は [PORTERS API の事実][ref]（PORTERS の公式ドキュメントに基づく）にまとめています。

## リンク

- 利用者向け：[docs/usage][docs-index]（目次）／[公開 API リファレンス][api-ref]／[PORTERS API の事実][ref]
- 開発・保守：[docs/README.md][docs-readme]（ADR（設計判断の記録）・基本設計・ロードマップ・台帳）
- 提供元：[Joymerrevent][joymerrevent]

## コントリビュート / セキュリティ

- バグ報告・要望・質問は [Issues][issues] へお願いします。外部の方からの提案は Issue で受け付けていて、PR を作れるのは
  コラボレーターだけです。詳しくは [CONTRIBUTING][contributing] にあります。
- 脆弱性は公開 Issue ではなく [セキュリティポリシー][security] の手順で**非公開**で報告してください。
- 行動規範は [Contributor Covenant][coc] です。

> このライブラリは**非公式**です。PORTERS の製品や Connect API そのものの不具合・要望は、PORTERS の公式窓口へお問い合わせください。

## ライセンス

[MIT][mit] © Joymerrevent

[npm]: https://www.npmjs.com/package/@joymerrevent/porters-connect
[npm-badge]: https://img.shields.io/npm/v/@joymerrevent/porters-connect
[mit]: ./LICENSE
[mit-badge]: https://img.shields.io/badge/License-MIT-blue.svg
[node-badge]: https://img.shields.io/badge/node-%3E%3D22.12.0-brightgreen.svg
[scorecard]: https://scorecard.dev/viewer/?uri=github.com/Joymerrevent/porters-connect
[scorecard-badge]: https://api.scorecard.dev/projects/github.com/Joymerrevent/porters-connect/badge
[bp]: https://www.bestpractices.dev/projects/14611
[bp-badge]: https://www.bestpractices.dev/projects/14611/badge
[joymerrevent]: https://github.com/Joymerrevent
[contributing]: ./CONTRIBUTING.md
[security]: ./SECURITY.md
[coc]: ./CODE_OF_CONDUCT.md
[issues]: https://github.com/Joymerrevent/porters-connect/issues
[api-ref]: docs/usage/api/index.md
[c-datetime]: docs/usage/topics/datetime.md
[c-limits]: docs/usage/topics/limits.md
[c-no-delete]: docs/usage/topics/deleted.md
[c-partition]: docs/usage/topics/tenant.md
[s-auth]: docs/usage/start/authenticate.md
[s-cjs]: docs/usage/start/install.md#cjs-から-require-する
[s-prereq]: docs/usage/start/prerequisites.md
[test-without-contract]: docs/usage/topics/testing.md
[docs-index]: docs/usage/index.md
[docs-resources]: docs/usage/resources/README.md
[docs-readme]: ./docs/README.md
[ref]: docs/usage/reference/README.md
