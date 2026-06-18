# エラーハンドリング（よくあるエラーと対処）

PORTERS への問い合わせを増やさず**自己解決**できるよう、本ライブラリのエラーは
「**何が・どの系統で・どう直すか・再試行してよいか**」を型に載せています。本ガイドは
症状からの早見表と、2 系統（認証 / リソース）のコード対応表をまとめます。

設計の根拠は [ADR-0006（エラーモデル）][adr-0006]、生コードの一次情報は
[リソース Result Code][result-codes] と [認証エラーコード][auth-errors] を参照してください。

## エラーの型

すべての PORTERS 由来エラーは基底 `PortersError` を継承し、発生**系統**でサブクラスが分かれます。

| クラス                 | 系統                             | `code` の空間     |
| ---------------------- | -------------------------------- | ----------------- |
| `PortersAuthError`     | OAuth / Token（認証 API）        | 認証 `<Error>`    |
| `PortersResourceError` | Resource API（Read / Write）     | リソース `<Code>` |
| `PortersNetworkError`  | 接続 / タイムアウト / 切断       | `null`            |
| `PortersConfigError`   | 設定・使い方の誤り（同期 throw） | `null`            |

> **2 系統は番号が重複し意味が違います**（例: `401` は認証では Refresh Token 失効、リソースでは
> Access Token 期限切れ）。`instanceof` で系統を大別してから `code` を見てください。

横断的な対処分岐には `category`（11 種）を使います。`PortersError` は次を持ちます。

```ts
e.category; // "auth" | "permission" | "validation" | "notFound" | "conflict" |
//             "rateLimit" | "transient" | "network" | "server" | "config" | "unknown"
e.code; // PORTERS の生コード（network / config は null）
e.retryable; // 再試行してよいか（構築時に算出）
e.hint; // 対処ヒント（既定は英語）
e.context; // { resource?, operation?, partition? }
```

## 基本の対処

基底 `PortersError` でまとめて捕捉し、`category`（横断）や `instanceof`（系統）で分岐します。

```ts
import {
  PortersError,
  PortersAuthError,
  PortersResourceError,
} from "@joymerrevent/porters-connect";

try {
  await porters.candidate.create({ P_Owner: 5, P_Name: "山田 太郎" });
} catch (e) {
  if (!(e instanceof PortersError)) throw e; // PORTERS 由来でないものは再 throw

  switch (e.category) {
    case "auth":
      // Refresh も失効 → 初回のブラウザ code 付与をやり直す
      break;
    case "permission":
      // スコープ不足 / データ権限なし / IP 制限
      break;
    case "validation":
      // 入力・書式・itemstate・version などの不備
      break;
    default:
      console.error(e.category, e.code, e.hint);
  }

  if (e instanceof PortersAuthError) {
    /* 認証系だけの分岐 */
  }
  if (e instanceof PortersResourceError) {
    /* リソース系だけの分岐 */
  }
}
```

## まず知っておく：ライブラリが自動で面倒を見ること

下記は**ライブラリ内部で処理**されるため、通常は利用者コードに現れません。現れたときは
「自動回復でも直らなかった」状態なので、ヒントに従って対処します。

- **トークン期限切れ → 自動リフレッシュ＋再試行**: リソース `401` / `402`・認証 `400`
  （Access Token 期限切れ）は内部で Refresh して自動再試行します。`PortersAuthError`
  （`category: "auth"`）が表に出るのは**Refresh も失効したとき**（認証 `401`）＝
  **初回のブラウザ `code` 付与をやり直す**必要がある場合だけです。
- **一時エラー・ネットワーク → 指数バックオフで自動リトライ**: リソース `9` / `302`（`transient`）と
  接続エラー（`network`）は再試行します。ただし**非冪等な `create`** はネットワーク不確実時に
  二重登録を避けるため再試行せず、握り潰さずに表面化します。
- **レート制限 → 自前スロットリングで超えない設計**: 1 分 Read 2000 / Write 500 を内蔵スロットルで
  分散します。超過時 PORTERS は判別可能なコードを返さず**接続を切る**ため、`PortersNetworkError`
  （`category: "network"`）として表面化します。`category: "rateLimit"` は将来配線用の予約値で、
  現状はどの分類も produce しません。
- **リクエストサイズ → 送信前ガード**: 全体 ~15000 文字を超える要求は、サーバの不透明な 400 を
  待たずに送信前へ `PortersConfigError`（`category: "config"`）で弾きます（`hint` に分割を提案）。

## category 一覧と対処方針

| category     | 意味                                       | 主な原因 / 対処                                             |
| ------------ | ------------------------------------------ | ----------------------------------------------------------- |
| `auth`       | 認証情報・トークン・コード                 | Refresh 失効 → 再認証（ブラウザ `code` 付与）／資格情報確認 |
| `permission` | スコープ・データ権限・IP 制限              | その Company DB へ権限付与／スコープ追加／IP 申請           |
| `validation` | 入力・パラメータ・書式・itemstate・version | 入力を見直す（後述の早見表）                                |
| `notFound`   | リソース / パーティションが無い            | id・partition・契約期間を確認                               |
| `conflict`   | 重複・子要素あり・被参照                   | 重複作成を避ける／依存関係を解消                            |
| `rateLimit`  | レート上限（予約・未 produce）             | 現状は `network` として表面化（上記参照）                   |
| `transient`  | 一時障害・トランザクション                 | 自動リトライ対象（再試行可）                                |
| `network`    | 接続・タイムアウト・レート切断             | 自動リトライ後も失敗なら時間をおく／回線・レートを確認      |
| `server`     | PORTERS 内部エラー                         | 時間をおいて再試行／継続するなら PORTERS へ報告             |
| `config`     | 設定・使い方の誤り（同期 throw）           | 呼び出し前の不正：宣言・オプション・サイズを修正            |
| `unknown`    | 未知（フェイルセーフ）                     | `code` と `hint` を確認／握り潰さず surface 済み            |

## 症状 → 原因 → 対処（早見表）

| 症状                                      | 系統 / code                | category     | 対処                                                                       |
| ----------------------------------------- | -------------------------- | ------------ | -------------------------------------------------------------------------- |
| `PortersAuthError` が出て処理が止まる     | 認証 `401`                 | `auth`       | Refresh Token 失効。**初回ブラウザ `code` 付与**をその Company DB で再実施 |
| 認証で `app_id` / `secret` 系のエラー     | 認証 `104` / `105`         | `auth`       | App ID / App Secret を確認（`.env`・ハードコード禁止）                     |
| データ取得で権限エラー                    | リソース `403`             | `permission` | 対象 Company DB へ権限付与（初回 `code` 付与）／スコープを確認             |
| `partition` が見つからない                | リソース `404`             | `notFound`   | partition id と契約期間（未開始 / 解約）を確認                             |
| 作成・更新で値が弾かれる                  | リソース `100`〜`116`      | `validation` | パラメータ・書式・型・日時・Option を見直す                                |
| 宣言したカスタム項目で `validation`       | リソース `100`             | `validation` | その partition に項目が実在するか `porters.field.search` で確認            |
| `itemstate` / `version` 不正              | リソース `133` / `146`     | `validation` | 値を見直す（itemstate・ConnectAPI Version）                                |
| 重複・依存で作成/削除できない             | リソース `301`/`303`/`304` | `conflict`   | 重複作成を避ける／子要素・被参照を解消                                     |
| IP 制限 / アプリ権限不足                  | リソース `406` / `601`     | `permission` | IP アドレス申請／アプリ権限の申請                                          |
| 登録最大件数超過                          | リソース `500`             | `validation` | 件数を減らす／200 件以下のバッチに分割                                     |
| `PortersConfigError`（送信前）            | サイズ超過                 | `config`     | field / condition を絞る／write を 200 件以下に分割（~15000 字上限）       |
| `PortersConfigError`（`defineFields` 等） | 宣言・オプション不正       | `config`     | alias は `U_`/`A_`・既知リソースキー・オプションを修正                     |
| `PortersNetworkError` が断続的に出る      | —（切断 / タイムアウト）   | `network`    | 自動リトライ後も失敗なら時間をおく／レート・回線を確認                     |

## コード対応表（2 系統）

> 一次情報は [リソース Result Code][result-codes]・[認証エラーコード][auth-errors]。本ライブラリの
> `code → category` マッピングは [ADR-0006][adr-0006] に接地しています。

### 認証系（`PortersAuthError` ＝ `<Authentication><Error>`）

| code                                          | 意味（要約）                                           | category               |
| --------------------------------------------- | ------------------------------------------------------ | ---------------------- |
| `400`                                         | Access Token 期限切れ                                  | `auth`（自動 Refresh） |
| `401`                                         | Refresh Token 期限切れ → 再認証                        | `auth`                 |
| `103` / `106` / `117` / `109` / `114` / `107` | code / Token / セッション / ユーザー無効               | `auth`                 |
| `104` / `105`                                 | app_id / secret が無効                                 | `auth`                 |
| `100` / `101` / `102` / `110` / `112`         | redirect_url / scope / response_type / grant_type 無効 | `validation`           |
| `111` / `115` / `116` / `402`                 | 権限なし・アクセス拒否                                 | `permission`           |
| `108`                                         | 認証サーバー内部エラー                                 | `server`               |
| 上記以外                                      | 未対応コード                                           | `unknown`              |

### リソース系（`PortersResourceError` ＝ `<{Resource}><Code>`）

| code                                                               | 意味（要約）                        | category     | retryable |
| ------------------------------------------------------------------ | ----------------------------------- | ------------ | --------- |
| `9` / `302`                                                        | 一時利用不可 / トランザクション     | `transient`  | ✅        |
| `401` / `402`                                                      | Access Token 期限切れ / 無効        | `auth`       | 自動回復  |
| `6` / `400` / `403` / `406` / `601`                                | 権限なし / データ権限 / IP / アプリ | `permission` | ❌        |
| `7` / `404`                                                        | Resource / partition が無い         | `notFound`   | ❌        |
| `301` / `303` / `304`                                              | 重複 / 子要素 / 被参照              | `conflict`   | ❌        |
| `8` / `100`〜`116` / `124` / `126` / `127` / `133` / `146` / `500` | 入力・書式・範囲・件数              | `validation` | ❌        |
| `1000`                                                             | 処理失敗（内部）                    | `server`     | ❌        |
| 上記以外（例 `5`）                                                 | 未対応コード                        | `unknown`    | ❌        |

## 関連

- 設計判断: [ADR-0006（エラーモデル）][adr-0006]
- 一次情報: [リソース Result Code][result-codes] ／ [認証エラーコード][auth-errors]
- 認証フロー: [認証 API のフロー][auth-flow]

[adr-0006]: ../adr/0006-error-model.md
[result-codes]: ../reference/resource-api/result-codes.md
[auth-errors]: ../reference/authentication-api/errors.md
[auth-flow]: ../reference/authentication-api/README.md
