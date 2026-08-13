# Changelog

このプロジェクトの主な変更を記録します。形式は [Keep a Changelog][kac] に準拠し、
バージョニングは [Semantic Versioning][semver] に従います。

## [Unreleased]

### Fixed

- **HTTP 200 で返る「PORTERS 以外の応答」を 0 件として扱わなくなりました**（[ADR-0051][adr51]）。
  Read 応答は**ルート要素名（`<Candidate>` などリソース名）と `<Code>` の両方**で同定します。
  どちらかを欠くボディは `PortersResourceError`（`category: "unknown"` ＋ `httpStatus: 200` ＋ 中間装置を疑う `hint`）で拒否します。
  - 従来は**キャプティブポータル・SSO のログイン画面・WAF の通知ページ**（いずれも HTTP 200）が
    `total: 0` の**正常な空ページ**として返っていました。`get(id)` は `undefined` を返すため、
    **「無ければ作る」コードが重複レコードを作りにいく**状態でした（データが無いのか届いていないのかを区別できない）。
  - メッセージは原因を名指しします — `resource response root is <html>, expected <Candidate>` ／
    `resource response has no <Code> (not a PORTERS envelope)`。**観測したルート名**が載るので切り分けできます。
  - **正しい PORTERS 応答に対する挙動は変わりません**（[エラーハンドリング ガイド][guide]に判定表を追加）。
  - ⚠️ **`createMockTransport` でモックを手書きしている場合**は、ボディに**リソース名のルート要素と `<Code>`** が
    必要です（例 `<Candidate Total="1" Count="1" Start="0"><Code>0</Code>…</Candidate>`）。
    実際の応答と同じ形にしていれば変更は不要です。

## [0.7.0] - 2026-08-13

エラーの見え方をまとめて是正した版です。**PORTERS の応答ではない HTTP エラー**が分類されるようになり、
**例外は常に reject で届き**、**アクセスポイントの設定ミスは接続前に落ちます**。公開 API の形（型・メソッド）は不変で、
既存コードは原則そのまま動きます（同期 throw を前提にしたテストだけ修正が要ります）。

### Added

- **アクセスポイントの scheme 設定**（[ADR-0047][adr47]）。`PortersClient` に **`scheme?: "https" | "http"`**（既定 `"https"`）を追加し、
  型 **`Scheme`** を公開。`host` の意味・`PORTERS_HOST` の運用・`porters.host` は不変です（ポートが要る場合は `host` に含める＝`localhost:4010`）。
  - ローカルのフェイクサーバーや信頼できるトンネルへ、**アプリを改造せず**（`transport` 差し替えなしで）向けられます。
  - `scheme: "http"` はトークンを含む全リクエストが**平文**で流れるため、**ループバックを含め毎プロセス 1 回**警告します。
    抑止は専用の環境変数 `PORTERS_SUPPRESS_INSECURE_HTTP_WARNING=1` のみ＝**許可（`scheme`）と沈黙（env）は別**です。
  - 既定は従来どおり `https` で、既存コードの挙動は変わりません。

### Fixed

- **アクセスポイントの書式を構築時に検証**（[ADR-0048][adr48]・[ADR-0049][adr49]）。`host` は
  **ホスト（＋必要ならポート）だけ**を表します。スキーム・パス・userinfo・空白を含む値は、
  **接続を試みる前に** `new PortersClient(...)` が `PortersConfigError`（`category: "config"` ＋ 直し方の `hint`）で拒否します。
  - 従来これらは**例外にならず**、`host: "https://xxxxx.example.com"` は `https` という**別ホスト宛の実リクエスト**に、
    `host: ""` は `v1` 宛になっていました。**App ID / App Secret が意図しない宛先へ送られる**か、
    名前が解決しなければ**設定ミスが `network` エラーとして延々リトライ**される状態でした。
  - **弾かれる例**: `https://a.test`／`""`／`a.test/`／`a.test/gw`／`user@a.test`／`a test`／`//a.test`／
    非 ASCII ホスト（**punycode** で渡してください）。
  - **通る例**: `a.test`／`a.test:8080`／`127.0.0.1:4010`／`[::1]:4010`／大文字ホスト — **既存の正しい設定は
    1 文字も変わりません**。**ポートはどれでも書けます**（冗長な `:443` も通ります）。
  - `scheme` も同じガードで検証します（型は `"https" | "http"` ですが、JS や `as` 越しの値を黙って組み立てないため）。

### Changed

- **HTTP ステータスをエラーモデルへ配線**（[ADR-0044][adr44]）。PORTERS の応答**ではない** HTTP エラー
  （ロードバランサ・プロキシ・WAF・メンテナンス画面が返す 4xx/5xx）が `category: "unknown"` に落ちず、
  分類されて表面化するようになりました。
  - **判定順は envelope 優先**: PORTERS の `<Code>` / `<Error>` を持つ応答は従来どおりその分類を採用し、
    `httpStatus` を添えます。envelope が無い場合だけ status から判定します
    （5xx → `server`／429 → `rateLimit`／408 → `network`／401・403 → `permission`／その他 4xx → `config`／
    上記以外 → `unknown`。いずれも `code` は `null`）。
  - **`PortersError.httpStatus` が実際に載る**ようになりました（応答を伴う失敗のみ。送信前ガードや接続失敗では `undefined`）。
  - **`category: "rateLimit"` が初めて produce されます**（HTTP 429 を観測できる環境＝プロキシ経由など。
    PORTERS 直結のレート超過は従来どおり強制切断＝`network`）。
  - retryable な 3 種（5xx / 429 / 408）は `PortersNetworkError` です。5xx は書き込みが適用されたか不明なため、
    **非冪等な `create` は自動再送しません**（既存の冪等性ガードがそのまま効きます）。
  - **200 以外の応答は、ボディが parse できても値を返しません**（プロキシの HTML エラーページが
    「空ページ」として通り、利用者に「0 件」と見えるのを防ぐため）。
  - 写像は**未確認の仮定**です（実 PORTERS がどの status を返すかは契約後に確認 — LV-9）。
  - **同じ判定が OAuth / Token のやり取りにも効きます**（[ADR-0050][adr50]）。トークン取得は全リクエストの
    前段なので、そこでゲートウェイの 5xx が起きると従来は `category: "unknown"`・再試行不可として
    **処理全体が止まって**いました。今後は `server`・retryable に分類され、**内蔵リトライで自動回復**しえます。
    認証経路が `PortersNetworkError` / `PortersConfigError` を投げうる点だけ、`catch` の分岐にご注意ください
    （いずれも `porters.auth.*` の JSDoc が挙げている系統です）。
- **Write 応答のルート `<Code>` を先読み**（[ADR-0045][adr45]）。**リクエストごと拒否された Write** の Result Code が
  失われなくなりました。
  - 従来は単件 `create` / `update` が **「write returned no result item」**（`category: "unknown"`）、
    `createMany` / `updateMany` が**件数不一致エラー**になり、原因のコードが消えていました。
  - 今後は本当の Result Code（例 `102` → `category: "validation"`）が `PortersResourceError` として表面化します
    （`context.operation: "write"` 付き）。Read（`<Code>`≠0）と同じ写像です。
  - **成功パスは不変**です（成功応答にルート `<Code>` は無く、あっても `0` なら従来どおり `<Item>` を読みます）。
  - エラー時にルート `<Code>` が返ること自体は**未確認の仮定**です（契約後に確認 — LV-11）。
- **例外の届き方を reject に統一**（[ADR-0046][adr46]）。**`Promise` を返す公開メソッドは、いかなる理由でも
  同期 throw しなくなりました**。設定ミス（`PortersConfigError`）も含め、すべて **reject** で届きます。
  - これまで **`keywords` 100 字超・`itemstate` の制限違反・Attachment 10MB 超**は Promise を返す**前に**
    同期 throw していたため、**`porters.candidate.search(q).catch(handler)` では捕まえられません**でした。
    今後は `.catch()` でも捕まえられます。
  - **ガードのロジックと実装位置は不変**です（送信前に弾く点・無駄な往復が起きない点は変わりません）。
    変わったのは例外の届き方だけです。
  - `await` ＋ try/catch で書いている場合は**影響ありません**。**同期 throw を前提にしたコード**
    （`expect(() => …).toThrow(…)` など）は `rejects` へ修正が必要です。
  - 対象は データ系（`search` / `get` / `create` / `update` / `createMany` / `updateMany`）・
    Attachment（`search` / `get` / `create` / `update`）・マスタ Read（`search` / `current`）・`auth.*` の Promise 系。
    **`Promise` を返さない API**（`new PortersClient(...)`・`defineFields`・`auth.authorizationUrl` /
    `auth.revokeUrl`）は**同期 throw のまま**です。
- 内部: `https://{host}/v1/...` を 10 箇所で組み立てていた URL 生成を **1 関数へ集約**（公開される挙動は不変）。

## [0.6.2] - 2026-07-19

### Changed

- **サプライチェーン強靭化（CI/CD）**: 全 GitHub Actions ワークフローの `uses:` を**タグから 40 桁コミット SHA にピン留め**（版コメント付きで Dependabot が SHA＋版を追従更新）。
  あわせて **OpenSSF Scorecard** ワークフロー（`scorecard.yml`）を追加し、結果を code scanning（SARIF）へ＋OpenSSF へ公開。いずれも **CI/リポジトリ側の変更で、公開される挙動・型には影響しません**。
- README に **OpenSSF Scorecard バッジ**を追加。

## [0.6.1] - 2026-07-19

### Changed

- **最低要求 `fast-xml-parser` を `^5.10.1` に引き上げ**（従来 `^5.9.2`）。5.10.1 は複数 DOCTYPE 宣言の拒否など
  パース面の硬化を含みます（公開 API は不変）。あわせて内部の Prettier 3.9.5 追従整形・CI（`actions/setup-node@7`）・
  開発依存の更新を取り込み。いずれも公開される挙動・型には影響しません。

## [0.6.0] - 2026-07-01

### Added

- **一括書き込み**（F-4 / ADR-0041・`CLAUDE.md`）。各データ系リソースに **`createMany`** / **`updateMany`** を追加。
  - `porters.candidate.createMany([...])` / `updateMany([{ id, fields }, ...])` で複数レコードをまとめて書き込み。
  - **1 リクエスト最大 200 件＋約 15000 文字**に自動分割（バッチを逐次送信）。1 件で上限超過は送信前に `PortersConfigError`。
  - **非アトミック**: 戻り値 **`BulkWriteResult`**（`results`＝送信順の per-item `{ index, id, code, ok }`／`failed`／`hasFailures`）で
    部分成功を返します（per-item の失敗は throw しません）。リクエスト全体の失敗のみ throw（バッチ途中の失敗は既書き込み件数を hint に付与）。
  - `createMany` はバッチ跨ぎで**非冪等**（全体の再実行は作成を重複させ得る）。Attachment は対象外（単件のみ）。
  - 新規 export 型 `BulkWriteResult` / `BulkWriteResultItem`。

## [0.5.0] - 2026-06-29

### Added

- **マルチテナント面**（F-3 / ADR-0040・ADR-0008/0021）。`porters.tenant(id)` で partition（Company DB）を
  束ねたアクセサ群 `TenantScope` を返します。`porters.tenant(123).candidate.search(...)` は `partition=123`
  を毎回付与し、未束ねの呼び出しは **client 既定 `partition`** を使います（解決は tenant スコープ／client 既定の 2 層）。
  - スコープは data（candidate/job/client/process/resume）＋ attachment ＋ master Read（user/field/option）を露出。
    `auth`（App 単位）・`partition` マスタ（発見専用・partition 非送信）・`tenant`（ネスト不可）は含みません。
  - partition 別トークンが必要な場合は**テナント別 `PortersClient`** を構築（ADR-0008 案3）。
  - 新規 export 型 `TenantScope`。`PortersClientOptions.partition` の JSDoc を更新（per-call 引数は設けない方針）。

## [0.4.0] - 2026-06-27

### Added

- **Read クエリ面の拡充**（F-2 / ADR-0038・ADR-0005 R-5）。データ系の `search` / `searchAll` が次を受けます。
  - `order` — 並び順 `[{ 項目: "asc" | "desc" }]`（数値・日時・System 型のみ）。
  - `keywords` — テキスト項目の AND キーワード検索（`string[]`・カンマ込み 100 文字まで。超過は送信前に `PortersConfigError`）。
  - `itemstate` — `"existing"`（既定）/ `"deleted"` / `"all"`。削除 API 非提供下で**削除済みデータを読む唯一の手段**
    （`condition` は `P_Id` / `P_UpdateDate` / `P_UpdatedBy` に限定・実行時ガード／更新日 90 日以内は PORTERS 側が自動付与）。
  - 新規 export 型 `Condition` / `Order` / `ItemState` / `SearchQuery`。

### Changed

- **（破壊的）`condition` を型安全化**。`{ "Person.P_Name:part": "山田" }`（loose な `Record<string,string>`）から
  **`{ P_Name: { part: "山田" } }`**（項目の Data Type が許す演算子だけを受ける型付き形・ADR-0038 案1a）へ変更。
  日時の値は ISO 8601（UTC `…Z`）で渡すと PORTERS 形式へ自動変換。**pre-1.0 のため minor**。
  - 移行: キーを `"Alias:suffix"` から**接頭辞なしの項目名**へ、値を `{ suffix: 値 }` へ。
    例 `{ "Person.P_Id:eq": "1" }` → `{ P_Id: { eq: 1 } }`。テキスト項目は `eq` 不可（`part` / `full`）。

## [0.3.0] - 2026-06-23

### Added

- **OAuth 公開面 `porters.auth.*`**（ADR-0007 SD-3/SD-6 ／ ADR-0034・F-1）。初回のブラウザ権限付与とトークン運用を補助します。
  - `authorizationUrl(opts)` / `revokeUrl(opts)` — ブラウザの `code` / `remove` グラント URL を生成（App Secret は URL に出さない）。
  - `exchangeAuthorizationCode(code)` — redirect の `?code=` をトークンに交換し内部保存（成功時 `void`・失敗時 throw）。
  - `clearTokens()` — ローカルの cache ＋ トークンストアを破棄。
  - `ensureAuthenticated()` / `getToken()` — トークンのウォームアップ／取得（Refresh Token は返さない）。カスタム auth ストラテジでも動作。
  - カスタムストラテジ下では credential 依存メソッドが `PortersConfigError`。新規 export 型 `AuthApi` / `AuthorizationUrlOptions` / `RevokeUrlOptions`。利用手順は [docs/guide/oauth.md][oauth-guide]。

### Fixed

- `PortersClientOptions.partition` の JSDoc 誤記（「overridable per call」）を訂正。per-call 上書きは未対応・予定（ADR-0033）で、partition は構築時に固定です（実行時の挙動変更なし）。

## [0.2.1] - 2026-06-22

メンテナンスリリース。**公開 API・実行コードの変更はありません**（`src/` 変更なし）。
主にリリース自動化・CI 整備とドキュメント拡充です。

### Fixed

- README の Node バッジ表記を `Node >= 18` → `Node >= 20` に修正（`engines` は 0.2.0 で既に `>=20`。バッジの追従漏れを解消し、以後は `check:release` でドリフトを検知）。

### Changed

- サポート方針を「最新の `0.1.x` のみ」から「**最新のリリース版のみ**」に更新（SECURITY.md）。
- リリースを半自動化：`main` マージで自動タグ（`tag.yml`）＋ GitHub Release 公開で OIDC publish（`release.yml`）（ADR-0029）。
- リリース前ゲートを CI に追加：version／CHANGELOG／README バッジのドリフト検査と版番号検証（`check:release`・ADR-0027／0031／0032）。
- 公開物の健全性検査 `check:publish`（publint／are-the-types-wrong）を追加。
- docs-only PR の CI を軽量化（ADR-0028）。

## [0.2.0] - 2026-06-20

### Changed

- **最低 Node を 20 に引き上げ**（`engines` を `>=20`、ビルド target を `node20`）。Node 18 は EOL かつ開発ツールチェーン（vitest / eslint）が非対応のため。利用には Node 20 以上が必要です。

## [0.1.1] - 2026-06-19

メンテナンスリリース。**公開 API・実行コードの変更はありません**（`src/` 変更なし）。
主に依存の更新とドキュメント整備です。

### Changed

- 依存 `fast-xml-parser` の下限を `^5.8.0` → `^5.9.2` に更新。
- README に npm バッジとインストール手順（npm / pnpm / yarn）を追加。

### Security

- 開発依存（推移的）の脆弱性 4 件を解消（`js-yaml` / `markdown-it` / `esbuild` / `qs` を `pnpm.overrides` でパッチ版に固定）。**開発・ビルド時のみの依存で、公開物（`dist/`）には影響しません。**

## [0.1.0] - 2026-06-19

初回リリース。PORTERS Connect API（旧 HRBC）を型安全・簡単に扱う**非公式** TypeScript ラッパー。
利用には PORTERS 契約＋ Connect API オプション契約が必要です。

### Added

- **`PortersClient`**: `host` / `appId` / `appSecret` / `scopes` / `partition` で初期化する型付きクライアント。
- **OAuth（独自仕様）**: `code_direct` でのトークン取得・キャッシュ・自動リフレッシュ、差し替え可能なトークンストア（既定インメモリ）。
- **リソース（MVP）**: Candidate / Job / Client / Process / Resume の Read（`search` / `searchAll` / `get`）＋ Write（`create` / `update`）、Attachment（Base64・専用アクセサ）、マスタ Read（Partition / User（＋`current()`）/ Field / Option）。
- **XML の隠蔽**: レスポンス XML → 型付きオブジェクト、入力 → XML を内部生成（Option は `string[]`、User / Reference は ID、DateTime / Date を正規化）。
- **型付き検索クエリ**（`field` / `condition` / `count` / `start`）＋ **自動ページング**（200 件刻みの `searchAll`）。
- **レート市民 ＆ リトライ**: 自前スロットリング＋指数バックオフ、送信前リクエストサイズガード（約 15000 文字・URL + body 合算）。
- **構造化エラー**: 基底 `PortersError` ＋ 系統別サブクラス（Auth / Resource / Network / Config）＋ `category`（11 種）。
- **日時**: ISO 8601（UTC）⇄ PORTERS 形式の正規化（業務タイムゾーン変換はしない）。
- **動的カスタム項目**: `defineFields` でテナント固有の `U_` / `A_` を宣言し、型安全に read / write（ADR-0023）。
- **評価用サンドボックス**: 公開モック `createMockTransport` で契約なし・オフライン動作（ADR-0024）。
- **エラー対処ガイド**: [docs/guide/error-handling.md][guide]（症状別早見表＋2 系統のコード対応表）。
- **配布**: ESM / Node.js 18+ / 型定義同梱 / MIT。`X-P-ConnectAPI-Version: 2` を既定送信（PORTERS 8.x・9.x 想定）。

[guide]: docs/guide/error-handling.md
[adr44]: docs/adr/0044-http-status-handling.md
[adr45]: docs/adr/0045-write-response-root-code.md
[adr46]: docs/adr/0046-guard-error-contract.md
[adr48]: docs/adr/0048-access-point-host-validation.md
[adr49]: docs/adr/0049-host-port-roundtrip.md
[adr50]: docs/adr/0050-auth-http-status-handling.md
[adr51]: docs/adr/0051-read-envelope-identification.md
[adr47]: docs/adr/0047-access-point-scheme.md
[oauth-guide]: docs/guide/oauth.md
[kac]: https://keepachangelog.com/en/1.1.0/
[semver]: https://semver.org/
[unreleased]: https://github.com/Joymerrevent/porters-connect/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/Joymerrevent/porters-connect/compare/v0.6.2...v0.7.0
[0.6.2]: https://github.com/Joymerrevent/porters-connect/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/Joymerrevent/porters-connect/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/Joymerrevent/porters-connect/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/Joymerrevent/porters-connect/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Joymerrevent/porters-connect/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Joymerrevent/porters-connect/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/Joymerrevent/porters-connect/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/Joymerrevent/porters-connect/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/Joymerrevent/porters-connect/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Joymerrevent/porters-connect/releases/tag/v0.1.0
