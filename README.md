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
  // 既定 https。ローカルのフェイクへ向けるときだけ env で "http" を渡す（不正値は https 側に倒す）
  scheme: process.env.PORTERS_SCHEME === "http" ? "http" : undefined,
  appId: process.env.PORTERS_APP_ID!,
  appSecret: process.env.PORTERS_APP_SECRET!,
});

// partition（Company DB）は tenant で一度だけ束ねる。**単一テナントでもこの形**
// 以降は `t` をクライアントのように使う（client 直下には auth と partition マスタだけ）
const t = porters.tenant(456);

// 検索（最大 200 件/ページ）。condition は項目の Data Type ごとに型付き
const page = await t.candidate.search({
  condition: { P_Name: { part: "山田" } }, // テキストは part（部分一致）/ full（完全一致）
  order: [{ P_UpdateDate: "desc" }], // 並び順（数値・日時・System のみ）
  count: 50,
});
console.log(page.total, page.items.length);

// 1 件取得
const one = await t.candidate.get(10001);
console.log(one?.P_Name);

// 全件を自動ページング（200 件刻み）
for await (const c of t.candidate.searchAll({
  condition: { P_Prefecture: { full: "東京都" } },
})) {
  // c は 1 件ずつ
}
```

> **`partition` はクライアントに持たせません**（ADR-0055）。PORTERS は partition スコープの全リクエストで
> `partition` を要求するので、`tenant(id)` で**明示的に一度だけ**束ねる形にしています。
> 複数 partition を 1 つの App で扱う場合・テナント別 client・partition の発見は
> [マルチテナント ガイド][multi-tenancy] にまとめています。
>
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
  transport: createMockTransport((req) =>
    req.url.includes("/v1/candidate")
      ? `<Candidate Total="1" Count="1" Start="0"><Code>0</Code><Item><Person.P_Id>1</Person.P_Id><Person.P_Name>山田 太郎</Person.P_Name></Item></Candidate>`
      : undefined,
  ), // 未モックのリクエストは明示エラー（フェイルセーフ）
});

const page = await t.candidate.search();
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
new PortersClient({ host, appId, appSecret, tokenStore });
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

| アクセサ        | リソース       | メソッド                                             |
| --------------- | -------------- | ---------------------------------------------------- |
| `t.candidate`   | 個人連絡先     | `search` / `searchAll` / `get` / `create` / `update` |
| `t.job`         | JOB            | `search` / `searchAll` / `get` / `create` / `update` |
| `t.client`      | 企業           | `search` / `searchAll` / `get` / `create` / `update` |
| `t.recruiter`   | 企業担当者     | `search` / `searchAll` / `get` / `create` / `update` |
| `t.contact`     | コンタクト     | `search` / `searchAll` / `get` / `create` / `update` |
| `t.opportunity` | 商談管理       | `search` / `searchAll` / `get` / `create` / `update` |
| `t.activity`    | アクティビティ | `search` / `searchAll` / `get` / `create` / `update` |
| `t.process`     | 選考プロセス   | `search` / `searchAll` / `get` / `create` / `update` |
| `t.resume`      | レジュメ       | `search` / `searchAll` / `get` / `create` / `update` |
| `t.attachment`  | 添付ファイル   | `search` / `get` / `create` / `update`               |

> **未対応のリソース**: Contract / Sales / Phase は順次追加中です
> （方針は [ADR-0060][adr-0060]・進捗は [ロードマップ][roadmap]）。

- `search(query?)` → `{ items, total, count, start }`（オフセット式ページング）。
- `searchAll(query?)` → `AsyncIterable`（200 件刻みで全件 yield）。
- `get(id, options?)` → 1 件 or `undefined`（`options.expand` で参照先の項目も読めます）。
- `create(input)` → 採番された **id（number）**。
- `update(id, input)` → その **id**。

**検索クエリ**（`query`）の主なキー（すべて型安全。**項目の Data Type が許す演算子だけ**を受けます）：

- `field`：取得する項目（**接頭辞なし**の alias の配列。例 `["P_Id", "P_Name"]`。接頭辞はライブラリが付けます）。
  綴り間違いや接頭辞付きは**コンパイルエラー**になります。
  **省略するとカタログ上の全項目を既定取得**します（PORTERS は field 未指定だと主キーのみ返すため、
  ライブラリが既定 field を補います）。`field: []`（空配列）を渡すと API 仕様どおり**主キーのみ**を返します（件数取得など）。
- `expand`：参照型（`System[Reference]`）の項目について、**参照先の項目も読む**（`{ P_Client: ["P_Id", "P_Name"] }`）。
  書かなければ従来どおり**参照先の ID**が返り、**書いた項目だけ**戻り型が参照レコードに変わります。1 往復で済みます。
- `condition`：検索条件。`{ 項目: { 演算子: 値 } }` 形式（複数項目は AND）。演算子は Data Type ごとに
  `eq`/`gt`/`ge`/`le`/`lt`（数値・日時・Id）、`part`/`full`（テキスト）、`or`/`and`（Option・参照/ユーザー型は ID）。
  **日時の値は ISO 8601（UTC `…Z`）**で渡すと PORTERS 形式へ自動変換します。
- `order`：並び順。`[{ 項目: "asc" | "desc" }]`（数値・日時・System 型のみ）。
- `keywords`：テキスト項目のキーワード AND 検索（`string[]`・カンマ込み **100 文字まで**）。
- `itemstate`：`"existing"`（既定）/ `"deleted"` / `"all"`。削除済みデータの取得。
- `count`（1–200・既定 10）、`start`（0 始まり）。**範囲外の `count` は送信前に `PortersConfigError`** で落ちます。

> **削除 API はありません**（PORTERS 仕様）。`delete()` メソッドは提供しません。削除済みは `itemstate: "deleted"` で読みます
> （`condition` は `P_Id` / `P_UpdateDate` / `P_UpdatedBy` に限られ、更新日は 90 日以内）。
>
> `field` の 3 通りの意味（省略＝全項目 / `[]`＝主キーのみ / 明示）、`expand` で展開できる項目、
> Data Type ごとの演算子一覧、削除済み Read の制約、送信前に落ちる条件は
> [Read クエリ ガイド][read-query-guide] にまとめています。

### カスタム項目（`U_` / `A_`）

テナント固有のカスタム項目は `defineFields` で宣言すると、**読み書きの型に現れ**、Data Type どおりに変換されます。

```ts
import { PortersClient, defineFields } from "@joymerrevent/porters-connect";

const fields = defineFields({
  candidate: (f) => ({ U_score: f.number(), U_source: f.option() }),
});
const porters = new PortersClient({
  host,
  appId,
  appSecret,
  fields,
});

const one = await t.candidate.get(10001);
one?.U_score; // number | null | undefined
```

宣言しなくても読み書きはできますが（生の文字列として通ります）、**型が付かず、`field` 省略時に取得もされません**。

> 宣言できる型の一覧、テナントの項目を Field Read で調べる方法、複数テナントでの扱いは
> [カスタム項目 ガイド][custom-fields-guide] にまとめています。

### マスタ Read（読み取り専用）

マスタ系は**読み取り専用**で、実 API が受けるクエリだけを持ちます（`condition` と `get(id)` はありません）。

| アクセサ            | リソース          | メソッド                           | 主なクエリ                                |
| ------------------- | ----------------- | ---------------------------------- | ----------------------------------------- |
| `porters.partition` | Partition         | `search` / `searchAll`             | `requestType`（1=アクセス可能一覧・既定） |
| `t.user`            | User              | `search` / `searchAll` / `current` | `requestType` / `userType` / `field`      |
| `t.field`           | Field（項目定義） | `search` / `searchAll`             | `resource`（必須）/ `active`              |
| `t.option`          | Option（選択肢）  | `search`                           | `alias` / `level` / `enabled`             |

```ts
// アクセス可能な Partition（Company DB）を発見
const partitions = await porters.partition.search();

// 現在の API ユーザー（code_direct ではアプリ自身の User）＝自己同定
const me = await t.user.current();

// Job リソースの項目定義（U_/A_ カスタム項目を含む）を取得
const fields = await t.field.search({ resource: "job" });

// 選択肢マスタをフラットな配列で取得（親子は P_ParentId で復元）
const options = await t.option.search({ alias: "Option.P_Gender" });
```

- `t.option.search()` は入れ子の選択肢ツリーを**深さ優先でフラット化**して返します（全ノード・`P_ParentId`/`P_Order` で階層復元可）。`start` が無いため `searchAll` はありません。
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
const c = await t.candidate.get(10001);
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
const newId = await t.candidate.create({
  P_Owner: 5, // User 項目は id
  P_Name: "鈴木 一郎",
  P_Reading: "すずき いちろう",
});

// 更新
await t.candidate.update(newId, { P_Mail: "ichiro@example.com" });

// 選考プロセス（関連 id を指定）
await t.process.create({
  P_Owner: 1,
  P_Client: 100,
  P_Recruiter: 200,
  P_Job: 300,
  P_Candidate: 10001,
  P_Resume: 50,
});

// 一括作成／更新（200 件＋サイズで自動分割・部分成功を返す）
const bulk = await t.candidate.createMany([
  { P_Owner: 5, P_Name: "山田 太郎" },
  { P_Owner: 5, P_Name: "鈴木 花子" },
]);
if (bulk.hasFailures) console.warn(bulk.failed); // per-item は throw せず結果で返す
```

> 1 リクエストの長さは**約 15000 文字**まで（PORTERS 仕様）。超えるとライブラリが送信前に弾きます。一括書き込み（`createMany` / `updateMany`）は 200 件＋サイズで自動分割し、部分成功を `BulkWriteResult` で返します — 詳しくは [一括書き込み ガイド][bulk-write] を参照。

## 添付ファイル（Attachment）

`Content` は Base64 文字列です。バイト列からの変換ヘルパー（opt-in）も同梱しています。

```ts
import { bytesToBase64 } from "@joymerrevent/porters-connect";

const id = await t.attachment.create({
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
  await t.candidate.get(1);
} catch (e) {
  if (e instanceof PortersError) {
    e.category; // "auth" | "permission" | "notFound" | "conflict" | "network" | ...
    e.code; // PORTERS のコード（無い場合 null）
    e.retryable; // 再試行可否
    e.hint; // 対処のヒント（あれば）
    e.httpStatus; // 応答の HTTP ステータス（応答を伴わない失敗では undefined）
  }
}
```

- トークン失効は内側で自動回復します。設定ミスは `PortersConfigError` で早期に落とします。
- **`Promise` を返す公開メソッドは同期 throw しません**（[ADR-0046][adr46]）。設定ミスも含め常に **reject** で届くので、
  `t.candidate.search(q).catch(handler)` でも捕まえられます（`string` を返す `auth.authorizationUrl` や
  コンストラクタなど、Promise を返さない API は同期 throw のままです）。
- 一時エラー・ネットワークは内蔵リトライ。非冪等な `create` はネットワーク不確実時に握り潰さず表面化します。
- レート制限超過時、PORTERS は判別可能なコードを返さず接続を切るため、`PortersNetworkError`（category `"network"`）として表面化します。
- **PORTERS の応答でない HTTP エラー**（LB・プロキシ・メンテナンス画面の 4xx/5xx）も分類されます（[ADR-0044][adr44]）。
  PORTERS の `<Code>` を持つ応答はそちらが優先され、無い場合だけ status から判定します
  （5xx → `server`・429 → `rateLimit`・408 → `network`・401/403 → `permission`・その他 4xx → `config`）。
  いずれも `code` は `null`、`httpStatus` にステータスが載ります。

> 症状別の早見表と 2 系統（認証 / リソース）のコード対応表は [エラーハンドリング ガイド][error-handling]にまとめています。

## PORTERS 固有の注意

- **削除 API は存在しない**（`delete()` は提供しない）。
- **日時は UTC 前提**。ISO 8601（`...Z`）で入出力し、JST 等の変換はしない（利用側の責務）。
- **レート制限**：1 分あたり Read 2000 / Write 500 は**内蔵スロットリングで自制**します（上限の 90% で分散）。
  **月 15 万アクセスは契約条件**で、プロセスをまたぐ累積は本ライブラリでは管理できません（**利用側の運用責務**）。
- **ホスト名は非公開**：`PORTERS_HOST` で受け取り、ハードコードしない。ポートが要る場合は `host` に含めます（`localhost:4010`）。
- **アクセスポイントの scheme**（[ADR-0047][adr47]）：既定は `https`。ローカルのフェイクサーバーや信頼できるトンネルに向けるときだけ
  **`scheme: "http"`** を明示できます。http はトークンを含む全リクエストが**平文**で流れるため、**ループバックでも毎プロセス 1 回**警告します。
  抑止は専用の環境変数 `PORTERS_SUPPRESS_INSECURE_HTTP_WARNING=1` のみ＝**許可（`scheme`）と沈黙（env）は別**です。

  ```ts
  new PortersClient({ host: "localhost:4010", scheme: "http" }); // ローカル検証用
  ```

  **ライブラリは `host` / `scheme` を環境変数から読みません**（設定の出所を明示にするため。読むのは上の警告抑止 1 本だけ）。
  env で本番⇔ローカルを切り替えたい場合は、クイックスタートのように**アプリ側で `PORTERS_SCHEME` を `scheme` に渡して**ください
  （`.env.example` に雛形あり）。以後はコードを触らず env の差し替えだけで向き先が変わります。

  ```sh
  PORTERS_HOST=127.0.0.1:4010 PORTERS_SCHEME=http node app.js # ローカルのフェイクへ
  PORTERS_HOST=xxxxx.example.com node app.js                  # 本番（未設定なら https）
  ```

## 対応バージョン

- **契約は Connect API Version 2**：`X-P-ConnectAPI-Version: 2` を既定送信し、**v2 を動作の前提**とします（担当者型・部署型 Link 等は v2 必須）。互換性はこの **API version** で明示します。
- **PORTERS 製品 8.x / 9.x は参考**：v2 が提供される製品世代です（個別マイナーの動作保証はしません）。**正典は [docs/reference][ref]**（実 API ドキュメントに接地）。

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
[scorecard]: https://scorecard.dev/viewer/?uri=github.com/Joymerrevent/porters-connect
[scorecard-badge]: https://api.scorecard.dev/projects/github.com/Joymerrevent/porters-connect/badge
[joymerrevent]: https://github.com/Joymerrevent
[contributing]: ./CONTRIBUTING.md
[security]: ./SECURITY.md
[coc]: ./CODE_OF_CONDUCT.md
[issues]: https://github.com/Joymerrevent/porters-connect/issues
[auth-flow]: ./docs/reference/authentication-api/README.md
[oauth-guide]: ./docs/guide/oauth.md
[error-handling]: ./docs/guide/error-handling.md
[custom-fields-guide]: ./docs/guide/custom-fields.md
[read-query-guide]: ./docs/guide/read-query.md
[multi-tenancy]: ./docs/guide/multi-tenancy.md
[bulk-write]: ./docs/guide/bulk-write.md
[sandbox]: ./examples/offline-sandbox.ts
[adr]: ./docs/adr/README.md
[adr-0060]: ./docs/adr/0060-full-resource-coverage-direction.md
[roadmap]: ./docs/roadmap.md
[adr44]: ./docs/adr/0044-http-status-handling.md
[adr46]: ./docs/adr/0046-guard-error-contract.md
[adr47]: ./docs/adr/0047-access-point-scheme.md
[design]: ./docs/design/basic-design.md
[ref]: ./docs/reference/README.md
