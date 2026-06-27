# @joymerrevent/porters-connect

[![npm version][npm-badge]][npm] [![License: MIT][mit-badge]][mit] ![Node >= 20][node-badge]

PORTERS Connect API（旧 HRBC）を **TypeScript から型安全・簡単に**扱うための、
[Joymerrevent（ジョイメリベント）][joymerrevent] 製の **非公式（unofficial）** ラッパーです。

> [!IMPORTANT]
> これは**非公式**ライブラリです。ポーターズ株式会社とは無関係で、公式ロゴ・商標は使用していません。
> 利用には **PORTERS の契約 ＋ Connect API オプション契約**が必要です（ホスト名・App ID/Secret は契約時に通知されます）。

XML レスポンスを型付きオブジェクトに変換し、独自仕様の OAuth・レート制御・エラー整理を内側に隠します。
**薄く・堅く**を方針に、フェイルセーフ（壊れたときに安全側へ倒れる）設計です。

---

## 特徴

- **型安全**：リソース・フィールド値を型で表現。`any` を撒きません。
- **XML を外に出さない**：返り値は型付きオブジェクト、入力も素直な JS の値。
- **独自 OAuth を透過**：`code_direct` によるトークン取得・キャッシュ・更新を自動化。
- **良き API 市民**：自前スロットリング・リトライ（指数バックオフ）・リクエストサイズガード内蔵。
- **日時は ISO 8601（UTC）に正規化**。業務タイムゾーン変換はしません（利用側の責務）。
- **6 リソース対応**：Candidate / Job / Client / Process / Resume / Attachment（Read/Write）。
- **マスタ Read**：Partition / User / Field / Option（読み取り専用・`user.current()` で自己同定）。

## 前提

1. **PORTERS 契約 ＋ Connect API オプション契約**。ホスト名・App ID・App Secret が通知されます。
2. **初回のみブラウザで権限付与**（人手・1 回）。`response_type=code` で対象 Company DB の権限を付与します。
   これを済ませれば、以降はライブラリが `code_direct`（サーバ間・ブラウザ不要）で無人運用できます。
   手順は [OAuth 認証ガイド][oauth-guide] を参照（API 仕様は [認証 API のフロー][auth-flow]）。

## インストール

```sh
# npm
npm i @joymerrevent/porters-connect

# pnpm
pnpm add @joymerrevent/porters-connect

# yarn
yarn add @joymerrevent/porters-connect
```

- Node.js 20+（ESM）。TypeScript 型定義（`.d.ts`）同梱。
- 公開先：[npm（`@joymerrevent/porters-connect`）][npm]。

## クイックスタート

```ts
import { PortersClient } from "@joymerrevent/porters-connect";

const porters = new PortersClient({
  host: process.env.PORTERS_HOST!, // 契約時に通知される値。ハードコード禁止
  appId: process.env.PORTERS_APP_ID!,
  appSecret: process.env.PORTERS_APP_SECRET!,
  partition: 123, // Partition（Company DB）Id
});

// 検索（最大 200 件/ページ）。condition は項目の Data Type ごとに型付き
const page = await porters.candidate.search({
  condition: { P_Name: { part: "山田" } }, // テキストは part（部分一致）/ full（完全一致）
  order: [{ P_UpdateDate: "desc" }], // 並び順（数値・日時・System のみ）
  count: 50,
});
console.log(page.total, page.items.length);

// 1 件取得
const one = await porters.candidate.get(10001);
console.log(one?.P_Name);

// 全件を自動ページング（200 件刻み）
for await (const c of porters.candidate.searchAll({
  condition: { P_Prefecture: { full: "東京都" } },
})) {
  // c は 1 件ずつ
}
```

> 認証情報やホスト名は**コミットしない**でください。`.env.example` を参考に `.env` で渡します。

## 契約なしで試す（オフライン評価）

PORTERS 契約が無くても、公開ヘルパー `createMockTransport` にモック XML を返させれば**全機能をオフラインで**動かせます（OAuth / トークンは自動応答）。

```ts
import {
  PortersClient,
  createMockTransport,
} from "@joymerrevent/porters-connect";

const porters = new PortersClient({
  host: "sandbox.invalid",
  appId: "demo",
  appSecret: "demo",
  partition: 1,
  transport: createMockTransport((req) =>
    req.url.includes("/v1/candidate")
      ? `<Candidate Total="1" Count="1" Start="0"><Code>0</Code><Item><Person.P_Id>1</Person.P_Id><Person.P_Name>山田 太郎</Person.P_Name></Item></Candidate>`
      : undefined,
  ), // 未モックのリクエストは明示エラー（フェイルセーフ）
});

const page = await porters.candidate.search();
console.log(page.items[0]?.P_Name); // 山田 太郎
```

そのまま動くサンプルも同梱しています（[`examples/offline-sandbox.ts`][sandbox]）。

```sh
pnpm sandbox
```

実利用では `transport` を渡さず、`host` / `appId` / `appSecret` を設定するだけです。

## 認証

`appId` / `appSecret` を渡すと、ライブラリが**透過的に** `code_direct` でトークンを取得・キャッシュし、
失効時に自動更新します（`connect()` の明示呼び出しは不要）。トークンの保存先は既定でインメモリ。
複数インスタンス運用では `tokenStore` を注入して Redis / DB / ファイルに永続化できます。

```ts
import type { TokenStore } from "@joymerrevent/porters-connect";

const tokenStore: TokenStore = {
  get: async () => /* StoredTokens | undefined */ undefined,
  set: async (t) => {
    /* 保存 */
  },
  clear: async () => {
    /* 破棄 */
  },
};
new PortersClient({ host, appId, appSecret, partition, tokenStore });
```

`transport`（HTTP 注入）や `auth`（独自 `TokenProvider`）も差し替え可能です。

### 初回の権限付与（`porters.auth.*`）

初回だけは人手でブラウザでの権限付与が必要です（「前提」を参照）。ライブラリは認可 URL の生成と `code` 交換を補助します。

```ts
// 1) 認可 URL を生成 → ユーザーのブラウザで開く（ログイン → 承諾）
const url = porters.auth.authorizationUrl({
  redirectUrl: "https://app.example.com/porters/callback",
});

// 2) redirect で戻る ?code= を交換（30 秒以内）。以後は透過運用に乗る
await porters.auth.exchangeAuthorizationCode(code);
```

> 起動時確認 `ensureAuthenticated()`、利用終了 `revokeUrl()` ＋ `clearTokens()`、カスタムストラテジ時の挙動など `porters.auth.*` の全手順は [OAuth 認証ガイド][oauth-guide] にまとめています。

## リソースと操作

すべてのデータ系リソースは同じ形のアクセサを持ちます。

| アクセサ             | リソース     | メソッド                                             |
| -------------------- | ------------ | ---------------------------------------------------- |
| `porters.candidate`  | 個人連絡先   | `search` / `searchAll` / `get` / `create` / `update` |
| `porters.job`        | JOB          | `search` / `searchAll` / `get` / `create` / `update` |
| `porters.client`     | 企業         | `search` / `searchAll` / `get` / `create` / `update` |
| `porters.process`    | 選考プロセス | `search` / `searchAll` / `get` / `create` / `update` |
| `porters.resume`     | レジュメ     | `search` / `searchAll` / `get` / `create` / `update` |
| `porters.attachment` | 添付ファイル | `search` / `get` / `create` / `update`               |

- `search(query?)` → `{ items, total, count, start }`（オフセット式ページング）。
- `searchAll(query?)` → `AsyncIterable`（200 件刻みで全件 yield）。
- `get(id)` → 1 件 or `undefined`。
- `create(input)` → 採番された **id（number）**。
- `update(id, input)` → その **id**。

**検索クエリ**（`query`）の主なキー（すべて型安全。**項目の Data Type が許す演算子だけ**を受けます）：

- `field`：取得する項目（接頭辞付き alias の配列。例 `["Person.P_Id", "Person.P_Name"]`）。
  **省略するとカタログ上の全項目を既定取得**します（PORTERS は field 未指定だと主キーのみ返すため、
  ライブラリが既定 field を補います）。`field: []`（空配列）を渡すと API 仕様どおり**主キーのみ**を返します（件数取得など）。
- `condition`：検索条件。`{ 項目: { 演算子: 値 } }` 形式（複数項目は AND）。演算子は Data Type ごとに
  `eq`/`gt`/`ge`/`le`/`lt`（数値・日時・Id）、`part`/`full`（テキスト）、`or`/`and`（Option・参照/ユーザー型は ID）。
  **日時の値は ISO 8601（UTC `…Z`）**で渡すと PORTERS 形式へ自動変換します。
- `order`：並び順。`[{ 項目: "asc" | "desc" }]`（数値・日時・System 型のみ）。
- `keywords`：テキスト項目のキーワード AND 検索（`string[]`・カンマ込み **100 文字まで**）。
- `itemstate`：`"existing"`（既定）/ `"deleted"` / `"all"`。削除済みデータの取得。
- `count`（1–200・既定 10）、`start`（0 始まり）。

> **削除 API はありません**（PORTERS 仕様）。`delete()` メソッドは提供しません。削除済みは `itemstate: "deleted"` で読みます
> （`condition` は `P_Id` / `P_UpdateDate` / `P_UpdatedBy` に限られ、更新日は 90 日以内）。

### マスタ Read（読み取り専用）

マスタ系は**読み取り専用**で、実 API が受けるクエリだけを持ちます（`condition` と `get(id)` はありません）。

| アクセサ            | リソース          | メソッド                           | 主なクエリ                                |
| ------------------- | ----------------- | ---------------------------------- | ----------------------------------------- |
| `porters.partition` | Partition         | `search` / `searchAll`             | `requestType`（1=アクセス可能一覧・既定） |
| `porters.user`      | User              | `search` / `searchAll` / `current` | `requestType` / `userType` / `field`      |
| `porters.field`     | Field（項目定義） | `search` / `searchAll`             | `resource`（必須）/ `active`              |
| `porters.option`    | Option（選択肢）  | `search`                           | `alias` / `level` / `enabled`             |

```ts
// アクセス可能な Partition（Company DB）を発見
const partitions = await porters.partition.search();

// 現在の API ユーザー（code_direct ではアプリ自身の User）＝自己同定
const me = await porters.user.current();

// Job リソースの項目定義（U_/A_ カスタム項目を含む）を取得
const fields = await porters.field.search({ resource: "job" });

// 選択肢マスタをフラットな配列で取得（親子は P_ParentId で復元）
const options = await porters.option.search({ alias: "Option.P_Gender" });
```

- `porters.option.search()` は入れ子の選択肢ツリーを**深さ優先でフラット化**して返します（全ノード・`P_ParentId`/`P_Order` で階層復元可）。`start` が無いため `searchAll` はありません。
- `porters.partition.current()` は提供しません（`request_type=0` は既定の `code_direct` 認証では 403 になるため）。一覧は `search()`（既定 `requestType: 1`）で取得します。

## 読み取り値の表現

`search` / `get` の各レコードは、項目 alias（接頭辞無し）をキーにした型付きオブジェクトです。
PORTERS の Field Type に応じてデコードされます。

| Field Type                                          | 返り値                                          |
| --------------------------------------------------- | ----------------------------------------------- |
| Id / Number / Currency                              | `number`                                        |
| 文字列系（Singleline/Multiline/Mail/Telephone/URL） | `string`                                        |
| DateTime                                            | ISO 8601 `...Z`（UTC）                          |
| Date / Age                                          | `yyyy-mm-dd`                                    |
| Option（単一・複数とも）                            | **`string[]`**（選択 alias の配列）             |
| User                                                | `{ P_Id, P_Type, P_Name, P_Mail }`（`UserRef`） |
| System[Reference]（関連 Client/Job 等）             | 参照先の **id（number）**                       |
| 空・未設定                                          | `null`                                          |

```ts
const c = await porters.candidate.get(10001);
c?.P_Id; // number
c?.P_Name; // string | null
c?.P_RegistrationDate; // "2026-01-02T03:04:05Z" | null
c?.P_Phase; // string[] | null（例 ["Option.P_PersonPhase_Applied"]）
c?.P_Owner; // { P_Id, P_Name, ... } | null
```

## 書き込み（create / update）

入力も項目 alias（接頭辞無し）をキーにしたオブジェクトです。値の渡し方：

- **User / Reference 項目**：関連レコードの **id（number）**。
- **Option 項目**：選択 alias の **配列（`string[]`）**（単一選択も 1 要素配列）。
- **日時**：ISO 8601（`...Z`）。ライブラリが PORTERS 形式へ変換します。
- `null`：その項目を**省略**（不変）。`""`：文字列項目をクリア。
- `P_Id` は `create`/`update` が自動で付与するため**指定不要**（型でも受け付けません）。
- 入力は項目ごとに**静的型付き**です（Option は `string[]`、User/参照は `number`…）。`create` は
  リソースが新規登録で要求する項目を**型で必須化**します（例: `P_Owner`、Process は関連 6 項目）。
  `update` は全項目任意です。登録日/更新日などの読み取り専用項目は型に出ません。

```ts
// 作成（新規）
const newId = await porters.candidate.create({
  P_Owner: 5, // User 項目は id
  P_Name: "鈴木 一郎",
  P_Reading: "すずき いちろう",
});

// 更新
await porters.candidate.update(newId, { P_Mail: "ichiro@example.com" });

// 選考プロセス（関連 id を指定）
await porters.process.create({
  P_Owner: 1,
  P_Client: 100,
  P_Recruiter: 200,
  P_Job: 300,
  P_Candidate: 10001,
  P_Resume: 50,
});
```

> 1 リクエストの長さは**約 15000 文字**まで（PORTERS 仕様）。超えるとライブラリが送信前に弾きます。

## 添付ファイル（Attachment）

`Content` は Base64 文字列です。バイト列からの変換ヘルパー（opt-in）も同梱しています。

```ts
import { bytesToBase64 } from "@joymerrevent/porters-connect";

const id = await porters.attachment.create({
  resource: 17, // 関連リソース種別コード（Resource List 参照）
  resourceId: 10001, // 関連レコードの id
  contentType: "application/pdf",
  fileName: "履歴書.pdf",
  content: bytesToBase64(fileBytes), // Uint8Array -> Base64
});
```

- 1 ファイル **10MB まで**。超過分はライブラリが送信前に弾きます。

## エラーハンドリング

エラーは判別可能な型で throw されます。基底は `PortersError`、系統別に
`PortersAuthError` / `PortersResourceError` / `PortersNetworkError` / `PortersConfigError`。

```ts
import { PortersError } from "@joymerrevent/porters-connect";

try {
  await porters.candidate.get(1);
} catch (e) {
  if (e instanceof PortersError) {
    e.category; // "auth" | "permission" | "notFound" | "conflict" | "network" | ...
    e.code; // PORTERS のコード（無い場合 null）
    e.retryable; // 再試行可否
    e.hint; // 対処のヒント（あれば）
  }
}
```

- トークン失効は内側で自動回復します。設定ミスは `PortersConfigError` を早期に throw。
- 一時エラー・ネットワークは内蔵リトライ。非冪等な `create` はネットワーク不確実時に握り潰さず表面化します。
- レート制限超過時、PORTERS は判別可能なコードを返さず接続を切るため、`PortersNetworkError`（category `"network"`）として表面化します（`category` の `"rateLimit"` は将来の配線用に予約された値で、現状はどの分類も produce しません）。

> 症状別の早見表と 2 系統（認証 / リソース）のコード対応表は [エラーハンドリング ガイド][error-handling]にまとめています。

## PORTERS 固有の注意

- **削除 API は存在しない**（`delete()` は提供しない）。
- **日時は UTC 前提**。ISO 8601（`...Z`）で入出力し、JST 等の変換はしない（利用側の責務）。
- **レート制限**：1 分あたり Read 2000 / Write 500、月 15 万アクセス。内蔵スロットリングで分散。
- **ホスト名は非公開**：`PORTERS_HOST` で受け取り、ハードコードしない。

## 対応バージョン

- **Connect API Version 2**（ヘッダ `X-P-ConnectAPI-Version: 2` を既定送信）。
- PORTERS 8.x / 9.x を想定。**正典は [docs/reference][ref]**（実 API ドキュメントに接地）。

## リンク

- 設計・決定の記録：[ADR][adr] ／ 基本設計：[docs/design][design] ／ API 事実：[docs/reference][ref]
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
[joymerrevent]: https://github.com/Joymerrevent
[contributing]: ./CONTRIBUTING.md
[security]: ./SECURITY.md
[coc]: ./CODE_OF_CONDUCT.md
[issues]: https://github.com/Joymerrevent/porters-connect/issues
[auth-flow]: ./docs/reference/authentication-api/README.md
[oauth-guide]: ./docs/guide/oauth.md
[error-handling]: ./docs/guide/error-handling.md
[sandbox]: ./examples/offline-sandbox.ts
[adr]: ./docs/adr/README.md
[design]: ./docs/design/basic-design.md
[ref]: ./docs/reference/README.md
