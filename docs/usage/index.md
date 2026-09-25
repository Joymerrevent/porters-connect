# @joymerrevent/porters-connect の使い方

このライブラリを使うなら、このページから読み始めてください。上から順に読むと、
PORTERS に接続するところから本番で動かすところまでが分かります<!-- 根拠: ADR-0088 -->。

## このライブラリについて

**PORTERS Connect API（旧 HRBC）を TypeScript から扱うための、非公式のラッパー**です。提供元は Joymerrevent で、
ポーターズ株式会社とは無関係です。

XML の応答、PORTERS 独自の OAuth、1 分あたりの上限はライブラリが受け持つので、利用側は型の付いたオブジェクトで
PORTERS のデータを読み書きできます。項目の綴りや新規作成の必須項目の間違いは、実行する前にコンパイルで止まります。
PORTERS 側の仕様（データが Partition に分かれている、削除の API が無い、日時は UTC）はそのまま見える形で残し、
誤った使い方は型と送信前の検査で止めます。

対象は、PORTERS と契約している企業やその開発を請けている人が、Node.js（22.12 以上）と TypeScript で
自社のシステムと PORTERS を接続する用途です。

**ライブラリが引き受けること**

- XML の応答を型の付いたオブジェクトに変換して返します。渡す値もふつうの JavaScript の値です。
- PORTERS 独自の OAuth の手続きを行います。初回の権限付与のあとは、トークンの取得・更新を人の操作なしに行います。
- 1 分あたりの上限をスロットリングで守り、一時的な失敗は再試行します。
- 長すぎるリクエストなど送れないものは送る前に止め、失敗は種類を見分けられるエラー（`PortersError`）で返します。
- 日時は ISO 8601（UTC）でやり取りします。

**利用側に残ること**

- 初回の権限付与（Company DB ごとに 1 回、人がブラウザで承諾する）。
- 業務ロジック（どの項目をどう突き合わせるか）と、利用者・会社・Partition の対応。
- 業務タイムゾーン（JST など）への変換。
- 月あたりのアクセス数の管理（契約条件で、ライブラリは数えません）。
- 削除は PORTERS の画面で行います。Connect API に削除の API が無いので、このライブラリにも `delete()` はありません。

使うには **PORTERS の契約 ＋ Connect API オプション契約**と、PORTERS への API アプリの登録（ホスト名・App ID・
App Secret が通知されます）が要ります。実行環境は Node.js 22.12 以上です。

## このドキュメントで学べること

読み終えると、契約済みの状態から自分のアプリを PORTERS に接続して、データを読み書きし、本番で動かせるようになります。
そのうえで、なぜそう書くのか（Partition・項目の形・削除が無い・上限といった PORTERS 側の前提）を理解し、
リソースごとの違いを引き、毎日の差分同期や複数テナントのような用途を自分で組み立てられるようになります。

はじめての人は、1 と 2 を上から順に読んでください。3 以降は必要になったときに引く章です。
やりたいことが決まっているなら、末尾の「目的から探す」から直接そのページへ飛べます。

### 1. 導入

PORTERS と契約している人が、自分のアプリを PORTERS に繋いで、データを読み書きし、本番で動かせるようになる章です。
契約で受け取る値の扱い、初回の権限付与、最初の読み取りと書き込み、本番に出す前の確認を、6 ページで順に進めます。
各ページの先頭に「前提」と「次に読む」があるので、上から順に読んでください。

1. [始める前に — PORTERS 側で用意するもの][s-prereq] — 契約・アプリ登録・スコープなど、PORTERS 側で揃えておくものを確かめる（コードはまだ書かない）
2. [インストールと、クライアントの構築][s-install] — ライブラリを入れ、契約で受け取った 3 つの値からクライアントを作る
3. [認証を通して、疎通を確認する][s-auth] — 初回の権限付与を済ませ、自分の Company DB の一覧が返るところまで繋ぐ
4. [はじめての読み取り][s-read] — Company DB を指定し、条件で探し、1 件を取り、全件を読む
5. [はじめての書き込み][s-write] — 1 件を作って更新し、消せないことが書き方にどう影響するかを知る
6. [本番に出す前に][s-live] — 機密情報・トークンの置き場所・上限・失敗の扱いを確かめ、本番に出せる状態にする

契約や権限付与を待っている間に書き始めたいなら、[契約なしでテストする][testing]から入れます。

### 2. ガイド

PORTERS を扱ううえで避けて通れない主題を、1 つずつ深く理解する章です。読み終えると、なぜそう書くのか
（PORTERS 側の前提）と、どこまでライブラリが行い、どこからが利用側の責任かが分かります。
上から順に、データの置き場所 → 項目の形 → 読み書き → 認証と運用、と積み上がる順に並べています。
各ページは冒頭の「まず知ること」だけ読んでも、そのページの前提はつかめます。

1. [Partition とテナントスコープ][tenant] — データがどこに分かれていて、読み書きの前にどう指定するか
2. [項目と値のかたち][fields] — 項目の名前（alias）と型（Data Type）で、読み書きする値のかたちがどう決まるか
3. [検索][query] — 取る項目・条件・並び順・ページングをどう書くか
4. [書き込み][write] — 1 件と一括をどう書き、何が必須で、部分成功をどう受け取るか
5. [削除と削除済みデータ][deleted] — 消せない前提でどう書き、削除済みをどう読むか
6. [日時と時分型][datetime] — 日時をどのかたちで渡し受け取るか、変換できない値はどうなるか
7. [カスタム項目][custom-fields] — テナント固有の項目をどう宣言し、実際の項目と合っているかをどう確かめるか
8. [認証とトークン][auth] — 初回の権限付与から無人運用まで、トークンをどう扱うか
9. [上限とレート][limits] — どんな上限があり、どこまでライブラリが止め、どこから利用側で守るか
10. [エラーと再試行][errors] — 失敗をどう受け取り、止めるか続けるか再送するかをどう決めるか
11. [契約なしでテストする][testing] — PORTERS に繋がずに、送信内容と失敗の経路をどうテストするか

### 3. クライアント

クライアントの作り方と、そこから呼べるものを調べる章です。クライアントの構築オプション、認証の操作のメソッド、
Partition を指定したスコープにぶら下がるものを、1 ページずつ引けます。構築オプションや呼べるメソッドの一覧を
確かめたいときに開いてください。

- [PortersClient][cl-client] — 構築オプションと、`tenant()` / `partition` / `auth`
- [auth][cl-auth] — 初回の権限付与・トークンの確認・権限の削除の 6 メソッド
- [tenant(id)][cl-tenant] — スコープにぶら下がるアクセサと `{ fields }`

### 4. リソース

Candidate や Job など、PORTERS の 18 のリソースそれぞれについて、何が呼べて、何に気をつけ、新規作成で何が必須かを
調べる章です。特定のリソースを扱うときに開いてください。呼べるメソッドはリソースごとに違うので、
まず[リソースと操作][resources]の表で確かめると早いです。

**マスタ系（読み取り専用）** — 先に押さえておくと、データ系の項目に入る値の意味が分かります。

- [Partition（Company DB）][r-partition] — データが分かれている単位。`tenant(id)` に渡す id はここで探す
- [User（ユーザー）][r-user] — PORTERS のユーザー。所有者（`P_Owner`）などユーザー型の項目の参照先
- [Department（部署）][r-department] — ユーザーの部署。部署型の項目の参照先
- [Field（項目定義）][r-field] — 各リソースの項目の定義。カスタム項目はここで見つける
- [Option（選択肢）][r-option] — 選択肢型の項目に入る alias の一覧

**データ系（読み書き）**

- [Candidate（個人連絡先）][r-candidate] — 求職者本人の連絡先
- [Job（JOB）][r-job] — 企業の求人
- [Client（企業）][r-client] — 取引先の企業
- [Recruiter（企業担当者）][r-recruiter] — 企業側の担当者
- [Contact（コンタクト）][r-contact] — 企業との接触の記録
- [Opportunity（商談管理）][r-opportunity] — 企業との商談
- [Activity（アクティビティ）][r-activity] — レコードに付く活動の記録
- [Contract（契約）][r-contract] — 企業との契約
- [Sales（成約・売上）][r-sales] — 成約（売上）の記録
- [Process（選考プロセス）][r-process] — レジュメと JOB を結ぶ選考の記録
- [Resume（レジュメ）][r-resume] — 個人連絡先に属する経歴
- [Phase（フェーズ履歴）][r-phase] — レコードのフェーズの変更履歴
- [Attachment（添付ファイル）][r-attachment] — レコードに付くファイル

### 5. 関数

クライアントやスコープに属さず、`import` して呼ぶ関数を調べる章です。カスタム項目の宣言と突合、上限と接続の
差し替え、値の変換の 3 つの用途に分けて、何をする関数で、どう失敗するかを 1 ページずつ引けます。
使う関数は分かっていて、引数や注意を確かめたいときに開いてください。

- [宣言と突合][fn-declare] — `defineFields` / `generateFieldDecls` / `verifyFields` / `assertFieldsMatch` / `readCustomCatalog` / `rawValue`
- [上限と接続][fn-transport] — `createThrottle` / `createFetchTransport` / `createMockTransport`
- [値の変換][fn-convert] — `encodeTimeOfDay` / `decodeTimeOfDay` / `resourceValueOf` / `resourceNameOf` / `bytesToBase64` / `base64ToBytes`

### 6. 実践例

導入を終えて、実際の業務に載せるときに読む章です。毎日の差分同期や複数テナントの SaaS のような、
実務でよくある用途を題材に、ライブラリのどの機能をどう組み合わせるかを最初から最後まで通して示します。
読み終えると、自分の用途をどの機能で組み、どこを自分で用意する必要があるか（スケジューラ・状態の保存・
業務ルール・月次のアクセス数）を決められます。

- [毎日の差分同期][sync-batch] — 前回からの差分だけを取って書き戻し、失敗したところから再開するバッチをどう組むか
- [複数テナント][multi-tenant] — 複数の Company DB を 1 プロセスで扱うとき、テナントの登録・宣言・認証・レートをどう分けるか
- [トークンを DB に保存する][token-store-db] — 再起動してもトークンを使い回せるよう、`tokenStore` を ORM（Drizzle）と PostgreSQL で組む
- [中央のサービスからトークンを受け取る][central-token-service] — App Secret を中央だけに置き、各アプリは `tokenProvider` でトークンを受け取る

### 7. リファレンス

読み進める章ではなく、確かめたいことがあるときに開く章です。引数や戻り値の正確な形は「公開 API リファレンス」
（このライブラリ側の一次情報）で、項目の一覧・Result Code・書式は「PORTERS API の事実」（PORTERS 側の一次情報）で
引けます。エラーが出たときに症状から原因と対処を引く早見表と、PORTERS の用語集もここにあります。

- [公開 API リファレンス][api] — このライブラリの型・関数・メソッドの正確な定義を引く（JSDoc から生成）
- [PORTERS API の事実][reference] — 項目の一覧・Result Code・書式など、PORTERS 側の仕様を引く
- [トラブルシューティング][troubleshooting] — エラーの症状から、原因と対処を引く
- [用語集][glossary] — PORTERS の用語と、画面名とリソース名の対応を引く

## 付録: 目的から探す

やりたいことが決まっているときは、章を順に読まなくても、ここから直接そのページへ飛べます。
左の列で自分のやりたいことに近い行を探し、右の列のページ（節）を開いてください。
ここに無いことは、[ガイド][c-topics]の該当するページから探すのが早いです。

| 〜したい                                             | 読む場所                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| 契約済みで、まず繋ぎたい                             | [始める前に][s-prereq] から順に                                          |
| 契約や権限付与を待つ間に書き始めたい                 | [契約なしでテストする][testing]                                          |
| Partition の id を知りたい                           | [Partition とテナントスコープ][tenant] の「Partition を発見する」        |
| 項目の値がどんなかたちで返るか知りたい               | [項目と値のかたち][fields]                                               |
| 条件でレコードを探したい                             | [検索][query]                                                            |
| 参照先の項目もまとめて読みたい                       | [検索][query] の「`expand`」                                             |
| 全件を読みたい                                       | [検索][query] の「ページング」                                           |
| 1 件作りたい・更新したい                             | [書き込み][write]                                                        |
| 200 件を超えてまとめて書きたい                       | [書き込み][write] の「まとめて書く」                                     |
| 新規作成で何が必須か知りたい                         | [書き込み][write] の「新規作成の必須項目」                               |
| 削除済みのレコードを読みたい                         | [削除と削除済みデータ][deleted]                                          |
| 日時をどう渡せばよいか知りたい                       | [日時と時分型][datetime]                                                 |
| テナント固有の項目（`U_` / `A_`）を使いたい          | [カスタム項目][custom-fields]                                            |
| 宣言がテナントの実際の項目と合っているか確かめたい   | [カスタム項目][custom-fields] の「宣言がテナントと合っているか確かめる」 |
| 初回の権限付与をアプリに組み込みたい                 | [認証とトークン][auth] の「初回の権限付与」                              |
| トークンを Redis や DB に置きたい                    | [認証とトークン][auth] の「トークンの永続化」                            |
| レートや長さの上限を知りたい                         | [上限とレート][limits]                                                   |
| 失敗したとき止めるか続けるか決めたい                 | [エラーと再試行][errors]                                                 |
| あるリソースで何が呼べるか知りたい                   | [リソースと操作][resources]                                              |
| クライアントの構築オプションを知りたい               | [PortersClient][cl-client] の「構築オプション」                          |
| `porters.auth` で何が呼べるか知りたい                | [auth][cl-auth]                                                          |
| `tenant(id)` の下に何があるか知りたい                | [tenant(id)][cl-tenant]                                                  |
| `defineFields` や `verifyFields` を引きたい          | [宣言と突合][fn-declare]                                                 |
| `createThrottle` や `createMockTransport` を引きたい | [上限と接続][fn-transport]                                               |
| 時分型の時刻やリソース番号を変換したい               | [値の変換][fn-convert]                                                   |
| 添付ファイルを付けたい・取りたい                     | [Attachment][r-attachment]                                               |
| 毎日の差分同期を組みたい                             | [毎日の差分同期][sync-batch]                                             |
| 複数の Company DB を 1 プロセスで扱いたい            | [複数テナント][multi-tenant]                                             |
| トークンを DB に保存したい                           | [トークンを DB に保存する][token-store-db]                               |
| アプリに App Secret を持たせたくない                 | [中央のサービスからトークンを受け取る][central-token-service]            |
| このエラーは何か、症状から引きたい                   | [トラブルシューティング][troubleshooting]                                |

---

開発・保守のための資料（ADR（設計判断の記録）・設計・ロードマップ・台帳）は [docs/README.md][docs-readme] にまとめてあります。

[c-topics]: #2-ガイド
[cl-client]: client/client.md
[cl-auth]: client/auth.md
[cl-tenant]: client/tenant-scope.md
[fn-declare]: functions/declare.md
[fn-transport]: functions/transport.md
[fn-convert]: functions/convert.md
[api]: api/index.md
[auth]: topics/auth.md
[tenant]: topics/tenant.md
[query]: topics/query.md
[write]: topics/write.md
[custom-fields]: topics/custom-fields.md
[fields]: topics/fields.md
[deleted]: topics/deleted.md
[errors]: topics/errors.md
[limits]: topics/limits.md
[datetime]: topics/datetime.md
[testing]: topics/testing.md
[s-auth]: start/authenticate.md
[s-install]: start/install.md
[s-live]: start/going-live.md
[s-prereq]: start/prerequisites.md
[s-read]: start/first-read.md
[s-write]: start/first-write.md
[reference]: reference/README.md
[troubleshooting]: reference/troubleshooting.md
[glossary]: reference/glossary.md
[docs-readme]: ../README.md
[sync-batch]: recipes/sync-batch.md
[multi-tenant]: recipes/multi-tenant.md
[token-store-db]: recipes/token-store-db.md
[central-token-service]: recipes/central-token-service.md
[resources]: resources/README.md
[r-candidate]: resources/candidate.md
[r-job]: resources/job.md
[r-client]: resources/client.md
[r-recruiter]: resources/recruiter.md
[r-contact]: resources/contact.md
[r-opportunity]: resources/opportunity.md
[r-activity]: resources/activity.md
[r-contract]: resources/contract.md
[r-sales]: resources/sales.md
[r-process]: resources/process.md
[r-resume]: resources/resume.md
[r-phase]: resources/phase.md
[r-attachment]: resources/attachment.md
[r-partition]: resources/partition.md
[r-user]: resources/user.md
[r-department]: resources/department.md
[r-field]: resources/field.md
[r-option]: resources/option.md
