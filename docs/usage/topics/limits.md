# 上限とレート

「型が通ったのにエラーになる」「なぜここは型で止めないのか」に答えるページです。長さ・件数・レート・時間の
上限のそれぞれについて、どこまでライブラリが弾き、どこから PORTERS の判定や利用側の運用に委ねるかが分かります。

## まず知ること

- **リクエスト長は約 15000 文字**（URL ＋ body）。超えると PORTERS は 400 を返すので、ライブラリは送信前に弾きます。
- **1 リクエストは 200 件まで**。`createMany` / `updateMany` が自動で分割します。
- **1 分あたり Read 2000 / Write 500**。内蔵のスロットルが待って収めます。
- **月 15 万アクセスは契約条件**で、ライブラリは数えません（プロセスを跨いだ累積は正しく数えられない）。
- **1 リクエスト 30 秒**でライブラリが打ち切ります。大きな添付では延ばせます。

方針は一貫しています — **手前で厳しくしすぎない**。
サーバーが受け付けるものをライブラリが落とすと、利用者には**回避手段がありません**。
サーバーが返すエラーなら型付きの [`PortersError`][error-handling] として受け取り、処置を選べます。
安全側に倒れるのは後者です。

## ライブラリが送信前に弾くもの

型（コンパイル時）か、送信前の検査（実行時）で止まります。

| 何を                                | いつ         | どうなる                                                  |
| ----------------------------------- | ------------ | --------------------------------------------------------- |
| 綴り間違い・未宣言の項目            | コンパイル時 | 型エラー                                                  |
| **新規必須の項目の欠落**            | コンパイル時 | 型エラー（`create` の入力型が要求する。**標準項目のみ**） |
| Data Type に合わない値              | コンパイル時 | 型エラー                                                  |
| リクエスト長 **約 15000 文字**超    | 送信前       | `PortersConfigError`（URL ＋ body の合算）                |
| 一括書き込みの **200 件**超         | 送信前       | 200 件ずつに自動分割（[書き込み][bulk]）                  |
| `count` の範囲外（1–200）           | 送信前       | `PortersConfigError`                                      |
| **画像が 2MB 超**                   | 送信前       | `PortersConfigError`（Base64 長から算出）                 |
| **画像のファイル名が 255 バイト超** | 送信前       | `PortersConfigError`（文字数ではなくバイト数）            |
| **画像の mime が 4 種以外**         | 送信前       | `PortersConfigError`                                      |
| **一括書き込みに画像が混ざる**      | 送信前       | `PortersConfigError`（単発 `create` / `update` へ）       |
| **alias が XML の名前として不正**   | 送信前       | `PortersConfigError`（選択肢 alias・項目 alias）          |
| **スロットルの上限が範囲外**        | 構築時       | `PortersConfigError`（`createThrottle`・下記の表）        |

<!-- 根拠:
- 「綴り間違い・未宣言の項目」の行: ADR-0059
-->

### 選択肢 alias・項目 alias の形

PORTERS は Option の値を**タグ名**として書きます（`<FieldAlias><OptionAlias/></FieldAlias>`）。
文字列が XML の構造そのものになる場所なので、**XML の名前として書ける形か**を送信前に検査します。

```ts
// フォーム・取り込み・ツール引数などから来た、信頼できない文字列
declare const userInput: string;

await t.candidate.update(10001, { P_Phase: ["Option.P_Applied"] }); // OK
await t.candidate.update(10001, { P_Phase: [userInput] }); // 不正なら PortersConfigError
```

- 通るのは **XML の `Name`**（英数字・`_`・`-`・`.`・日本語など。先頭に数字や `-` は置けない）。
  出典が alias の書式を定めていないので、**XML が許すものはすべて許します**。
- 選択肢 alias を**外から受け取る**なら（フォーム・取り込み・ツール引数）、この検査が
  最後の砦になります。検査が無いと、値が XML の構造として解釈され、
  **意図しないレコードが書き換わります**。
- 正しい alias の出どころは **Option マスタ**（`t.option`）か、リファレンスの選択肢一覧です。
- 同じ検査が**項目 alias**（書き込み入力のキー）にもかかります。`JSON.parse` した
  オブジェクトをそのまま渡す場合、型はキーを検査しきれないためです。

### 画像（`Image` 型のカスタム項目）

画像を含む書き込みだけ、**約 15000 文字のリクエスト長の検査を外します**。2MB の Base64 は
どうやってもその中に収まらないためです。ただし**外したぶんは別の検査で埋めます**<!-- 根拠: ADR-0064 -->。
送信前に見るのは 3 つです。

| 何を          | 上限                                                        |
| ------------- | ----------------------------------------------------------- |
| `Content`     | decode 後 **2MB**（Base64 の長さから算出します）            |
| `FileName`    | 拡張子込み **255 バイト**（多バイト文字は 1 文字 3 バイト） |
| `ContentType` | `image/jpeg` / `image/gif` / `image/png` / `image/bmp` のみ |

**一括書き込み（`createMany` / `updateMany`）では画像を送れません**。一括は「1 リクエスト
約 15000 文字」を前提に 200 件ずつへ分割しており、画像はその前提を桁で壊します。黙って
PORTERS に蹴られるより、**何件目が画像を持つか**を添えて送信前に落とし、単発の `create` /
`update` へ誘導します（そちらは画像に対応しています）。

`Image` の値は 3 つのサブ要素すべてが必須です。**値を消す書き方は用意していません**
（空要素を送ると消えるのか、reference に記載が無いため）<!-- 根拠: LV-22 -->。
項目を省略すれば値は変わりません。

## レート — 待つもの、数えないもの

上限は 2 つあり、**ライブラリが面倒を見るのは分あたりだけ**です。

| 上限                           | 誰が見るか                                     |
| ------------------------------ | ---------------------------------------------- |
| 1 分 **Read 2000 / Write 500** | **ライブラリ**（内蔵スロットリングが自制する） |
| 月 **約 15 万アクセス**        | **利用側**（契約条件。ライブラリは数えません） |

### 分あたりは、待って収める

トークンバケットで自制します<!-- 根拠: ADR-0010 -->。既定では上限の **90%** までしか使いません
（Read 1800 / Write 450 相当）。手前で使い切ったら**待ちます** — 例外にはしません。
バーストは容量まで許し、平均が上限を下回るようにしてあります。

**数えているのはホスト 1 つ分です**<!-- 根拠: ADR-0073 -->。クライアントの数ではありません。
トークンを分けるためにクライアントを分けても（[複数テナント][multi-tenant]の §3）、同じホストを
向いている限り**バケットは 1 つ**で、合計が上限に収まります。
ローカルのフェイクは別ホストなので、本番向けの枠を食いません。

**プロセスを跨ぐと協調しません。** 複数インスタンスで動かすなら、PORTERS から見た合計は
その足し算になります。そこまで守りたいなら、`Throttle` を自分で実装して渡します。

```ts
import { createThrottle, PortersClient } from "@joymerrevent/porters-connect";

// 共有から降りる／別の上限で走らせる
const porters = new PortersClient({
  hostname: process.env.PORTERS_HOST ?? "",
  appId: process.env.PORTERS_APP_ID ?? "",
  appSecret: process.env.PORTERS_APP_SECRET ?? "",
  throttle: createThrottle({ readPerMin: 500 }),
});
```

`Throttle` は `take(write: boolean): Promise<void>` の 1 メソッドだけなので、Redis などに載せれば
**プロセスを跨いだ協調**も書けます。ライブラリはそこまでやりません（月次と同じ線引き）。

#### 指定できる値

**範囲外は `createThrottle()` を呼んだ時点で `PortersConfigError`** になります（待たされません）。

| オプション                   | 範囲                                 | 既定       | 弾かれる例                         |
| ---------------------------- | ------------------------------------ | ---------- | ---------------------------------- |
| `readPerMin` / `writePerMin` | **正の整数**                         | 2000 / 500 | `0` ／ `-1` ／ `10.5` ／ `NaN`     |
| `safety`                     | **0 より大きく 1 以下**              | 0.9        | `0` ／ `-1` ／ `1.5`               |
| （組み合わせ）               | **`floor(上限 × safety)` が 1 以上** | —          | `{ readPerMin: 1 }`（既定 safety） |

最後の行が曲者です。**`readPerMin: 1` も `safety: 0.9` も単体ではおかしくないので、
積を見ないと捕まりません。**

```ts
createThrottle({ readPerMin: 1 }); // PortersConfigError（floor(1 × 0.9) = 0）
createThrottle({ readPerMin: 2 }); // OK（floor(1.8) = 1）
createThrottle({ readPerMin: 1, safety: 1 }); // OK（floor(1) = 1）
```

容量 0 のバケットは 1 トークンも溜まらないため、弾かなければ**すべての呼び出しが永久に待ちます**。
各オプションの詳細は [`ThrottleOptions`][api-throttle-options] を参照してください。

**「1 件も通さない」を表現したいなら、そのための `Throttle` を自分で渡してください**
（`take()` が解決しない実装）。上限 0 を黙って受け付けて待ち続けるのは、
「許可した」と「黙った」を混ぜる形なので避けています。

### 超えたときに何が返るか

**PORTERS はレート超過を判別できるコードで返さず、接続を切ります。** そのため表に出るのは
`PortersNetworkError`（`category: "network"`）です。`category: "rateLimit"` になるのは、
プロキシ経由などで **HTTP 429 を観測できた場合だけ**です（[エラーと再試行][failures]）<!-- 根拠: ADR-0044 -->。

### 月次は数えません

月あたりのアクセス数は**契約条件**であって、API が教えてくれる値ではありません。プロセスを
跨いだ累積をライブラリが正しく数えることはできない（再起動・複数インスタンス・別アプリ）ので、
**利用側の運用責務**にしてあります。

**認証のリクエストも 1 アクセスとして数えられます。** トークンを永続化する（`tokenStore`）と
取り直しが減ります（[認証とトークン][authenticate]）。差分取得やキャッシュも同じ方向に効きます。

## 時間 — 1 リクエスト 30 秒で打ち切ります

**ライブラリ側のタイムアウトです。** PORTERS はサーバー側のタイムアウト秒数を公表しておらず、
この 30 秒は「どれくらい待つか」をライブラリが決めた既定値です。

**接続から本文を受け取り終わるまで**が対象です。応答ヘッダが早く返ってきても、**本文の
ダウンロードが遅ければそこで打ち切られます**（`AbortSignal` が fetch 全体に効く）。
中断は `PortersNetworkError`（`category: "network"`・retryable）になるので、
[エラーと再試行][failures]の分岐はそのまま使えます。

**数え方は 1 リクエストごと**です。自動リトライは既定で最大 3 回なので、通らないリクエストは
最悪 4 回 × 30 秒 ＋ バックオフかかります。**レートの待ち時間は含みません**（スロットルは
タイムアウトの外側で、実際に送る直前からタイマーが回ります）。

**効いてくるのは大きな添付です。** 添付の本体は最大 10MB（[添付ファイル][attachments]）で、
細い回線では 30 秒に収まらないことがあります。**延ばせます** — 既定の transport を自分で組んで
渡してください。

```ts
import {
  PortersClient,
  createFetchTransport,
} from "@joymerrevent/porters-connect";

const porters = new PortersClient({
  hostname,
  appId,
  appSecret,
  transport: createFetchTransport({ timeoutMs: 120_000 }), // 2 分
});
```

`timeoutMs` は**正の整数（ミリ秒）**だけを受けます。`0` は「無制限」ではなく**即中断**なので、
構築時に `PortersConfigError` で弾かれます。短くすることもできます（対話的なツールで待たせたく
ないときなど）。

## 関連

- 主題: [書き込み][write]（200 件分割・必須の規則）／[エラーと再試行][errors]（レート超過・タイムアウトの受け取り方）／
  [認証とトークン][auth]（トークンの永続化でアクセス数を減らす）／[カスタム項目][custom-fields]（画像）
- リソース別: [Attachment][attachments]（10MB・本体は `get` だけ）／[リソースと操作][resources]
- 実践例: [毎日の差分同期][sync-batch]（レートの自制と差分取得）／[複数テナント][multi-tenant]（スロットルの共有）
- リファレンス: [Write API（XML 形式 / 新規・更新 / Phase）][write-format]／[リソース一覧][resources-list]／[運用上の落とし穴][gotchas]
- ほかの目的から探す: [目次][index]

<!-- 根拠:
- 決定: ADR-0041（一括書き込み）／ADR-0045（Write 応答のルート `<Code>`）／
  ADR-0046（送信前ガードは reject で届く）／ADR-0083（`※` は型で止めない）
- 契約後に実機確認する項目: live-verification（`※` の正確な条件はドキュメント由来で未確認）
-->

[write-format]: ../reference/resource-api/write-format.md
[resources-list]: ../reference/resource-api/resources-list.md
[error-handling]: errors.md
[errors]: errors.md
[write]: write.md
[resources]: ../resources/README.md
[auth]: auth.md
[sync-batch]: ../recipes/sync-batch.md
[gotchas]: ../reference/gotchas.md
[bulk]: write.md
[attachments]: ../resources/attachment.md
[failures]: errors.md
[authenticate]: auth.md
[multi-tenant]: ../recipes/multi-tenant.md
[custom-fields]: custom-fields.md
[api-throttle-options]: ../api/type-aliases/ThrottleOptions.md
[index]: ../index.md
