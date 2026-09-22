# ドキュメント

`@joymerrevent/porters-connect` の使い方をまとめたドキュメントです。このページが入口で、
**上から順に読むと、PORTERS に繋ぐところから本番運用の勘所までを学べる**ように並べています<!-- 根拠: ADR-0088 -->。

## このライブラリについて

**PORTERS Connect API（旧 HRBC）を TypeScript から型安全に扱うための、非公式のラッパー**です。
ポーターズ株式会社とは無関係で、提供元は Joymerrevent です。

PORTERS Connect API は、応答が XML で、OAuth が独自仕様で、削除 API が無く、リクエストの長さと
1 分あたりの回数に上限があります。このライブラリはそれらを内側に引き受けます。

**ライブラリが引き受けること**

- XML の応答を型付きオブジェクトに変換し、入力も素直な JS の値で受けます。XML は外に出しません。
- 独自 OAuth を透過的に運用します。初回の権限付与のあとは、トークンの取得・更新を無人で行います。
- 1 分あたりのレート上限を内蔵スロットルで自制し、一時的な失敗は再試行します。
- 長すぎるリクエストや上限超えは送信前に弾き、失敗は判別できる型（`PortersError`）で返します。
- 日時は ISO 8601（UTC）に正規化して入出力します。

**利用側に残ること**

- 初回の権限付与（Company DB ごとに 1 回、人がブラウザで承諾する）。
- 業務ロジック（どの項目をどう突き合わせるか）と、利用者・会社・Partition の対応。
- 業務タイムゾーン（JST など）への変換。
- 月あたりのアクセス数の管理（契約条件で、ライブラリは数えません）。
- 削除。PORTERS に削除 API が無いので、`delete()` はありません。

使うには **PORTERS の契約 ＋ Connect API オプション契約**と、API アプリの登録（ホスト名・App ID・App Secret の
通知）が要ります。実行環境は Node.js 22.12 以上です。

## このドキュメントで学べること

5 つの章があります。**はじめての人は 1 → 2 の順に上から読んでください。** 導入で繋いで読み書きし、
主題別で主題ごとの規則と PORTERS 側の前提を理解します。3 以降は必要になったときに引く章です。
急ぐ人のために、末尾に「〜したい」から引ける索引を置いています。

### 1. 導入

PORTERS と契約している人が、自分のアプリを PORTERS に繋いで、データを読み書きし、本番で動かせるようになる章です。
契約で受け取る値の扱い、初回の権限付与、最初の読み取りと書き込み、本番に出す前の確認を、6 ページで順に進めます。
各ページの先頭に「前提」と「次に読む」があるので、上から順に読んでください。

1. [始める前に — PORTERS 側で用意するもの][s-prereq] — 契約・アプリ登録・3 つの値・Company DB・スコープ。コードなし
2. [インストールと、クライアントの構築][s-install] — `npm i` と、受け取った 3 つの値の渡し方
3. [認証を通して、疎通を確認する][s-auth] — 初回だけブラウザで 1 回。以降は無人。**繋がった**ことの確かめ方
4. [はじめての読み取り][s-read] — `tenant(id)` で束ねる ／ `search` ／ `get` ／ `field` の効き方
5. [はじめての書き込み][s-write] — `create` と `update`。`delete` が無いということ
6. [本番に出す前に][s-live] — 機密情報・Partition・トークン・上限・失敗・差分取得の確認

契約や権限付与を待っている間に書き始めたいなら、[契約なしでテストする][testing]から入れます。

### 2. 主題別

PORTERS を扱ううえで避けて通れない主題を、1 つずつ深く理解する章です。読み終えると、なぜそう書くのか
（PORTERS 側の前提）と、どこまでライブラリが面倒を見て、どこからが利用側の責任かが分かります。
上から順に、データの置き場所 → 項目の形 → 読み書き → 認証と運用、と積み上がる順に並べています。
各ページは冒頭の「まず知ること」だけ読んでも、そのページの前提はつかめます。

1. [Partition とテナントスコープ][tenant] — データは Partition（Company DB）に分かれる。`tenant(id)` で束ねる。id の探し方
2. [項目と値の形][fields] — alias の 3 種類（`P_` / `U_` / `A_`）・接頭辞は書かない・Data Type ごとの読みと書きの形
3. [検索][query] — `field` ／ `expand` ／ `condition` ／ `order` ／ `keywords` ／ ページング
4. [書き込み][write] — `create` ／ `update`・書くときの形・新規作成の必須・一括の分割と部分成功
5. [削除と削除済みデータ][deleted] — 消せない前提で書く。`itemstate` と `P_Deleted` で削除済みを読む
6. [日時と時分型][datetime] — UTC・ISO 8601 で入出力する。変換できない値の扱い。時分型の変換関数
7. [カスタム項目][custom-fields] — `defineFields` で `U_` ／ `A_` を宣言する。自動生成と、テナントとの突合
8. [認証とトークン][auth] — 初回の権限付与・無人運用・`tokenStore`・権限の削除・自前のトークン管理
9. [上限とレート][limits] — 長さ・件数・レート・時間の上限と、どこで弾かれるか
10. [エラーと再試行][errors] — エラーの型と `category`・届き方・自動再試行の範囲・コード対応表
11. [契約なしでテストする][testing] — トランスポートを 1 箇所差し替える。モックし忘れは黙って通らない

### 3. リソース別

Candidate や Job など、PORTERS の 18 のリソースそれぞれについて、何が呼べて、何に気をつけ、新規作成で何が必須かを
調べる章です。特定のリソースを扱うときに開いてください。呼べるメソッドはリソースごとに違うので、
まず[リソースと操作][resources]の表で確かめると早いです。

**マスタ系（読み取り専用）** — 先に押さえておくと、データ系の項目に入る値の意味が分かります。

- [Partition（Company DB）][r-partition] — `tenant(id)` に渡す id を探す。client 直下の唯一の読み取り
- [User（ユーザー）][r-user] — `P_Owner` などユーザー型項目の参照先。`current()` で自己同定
- [Department（部署）][r-department] — ユーザーの部署。絞り込み無し
- [Field（項目定義）][r-field] — カスタム項目の発見。先に `of("candidate")` で束ねる
- [Option（選択肢）][r-option] — 選択肢の alias を知る。`searchAll` は無い

**データ系（読み書き）**

- [Candidate（個人連絡先）][r-candidate] — 求職者本人の連絡先。Staffing ではスタッフ連絡先。項目の接頭辞が `Person.`
- [Job（JOB）][r-job] — 求人。Staffing では案件。企業と企業担当者に必ず紐づく
- [Client（企業）][r-client] — 取引先の企業。担当者・JOB・契約・コンタクト・商談がここに紐づく
- [Recruiter（企業担当者）][r-recruiter] — 企業側の担当者
- [Contact（コンタクト）][r-contact] — 企業との接触の記録
- [Opportunity（商談管理）][r-opportunity] — 企業との商談
- [Activity（アクティビティ）][r-activity] — レコードに付く活動の記録。付け先のリソースは数値で持つ
- [Contract（契約）][r-contract] — 企業との契約。所有者（`P_Owner`）の項目が無い
- [Sales（成約・売上）][r-sales] — Staffing では個別契約。参照 6 項目に依存の規則がある
- [Process（選考プロセス）][r-process] — 個人連絡先と JOB を結ぶ選考。Staffing では引当 / 就業管理。JOB × レジュメで一意
- [Resume（レジュメ）][r-resume] — 個人連絡先に属する経歴。Staffing ではスタッフ
- [Phase（フェーズ履歴）][r-phase] — フェーズの変更履歴。先に `of("candidate")` で束ねる
- [Attachment（添付ファイル）][r-attachment] — レコードに付くファイル。先に `of("resume")` で束ねる。本体は `get` だけ

### 4. 実践例

毎日の差分同期や複数テナントの SaaS のような、実務でよくある用途をどう組み立てるかを示す章です。
ライブラリのどの機能を組み合わせるか、どこからが利用側の責務（スケジューラ・状態の保存・業務ルール）かが分かります。

- [毎日の差分同期][sync-batch] — 差分を取る → 書き戻す → 失敗からの再開。レートは自制される
- [複数テナント][multi-tenant] — テナントの登録・リクエストごとのスコープ・宣言の持ち方・認証・レート

### 5. リファレンス

型・関数の正確な定義と、PORTERS API の仕様上の事実を引く章です。エラーが出たときに症状から引く早見表と、
PORTERS の用語集もここにあります。

- [公開 API の全記号][api] — このライブラリの型・関数・メソッド（JSDoc から生成）
- [PORTERS API の事実][reference] — PORTERS 側の仕様のうち、使ううえで必要なもの
- [トラブルシューティング][troubleshooting] — 症状 → 原因 → 対処の早見表
- [用語集][glossary] — PORTERS の用語と、画面名とリソース名の対応

## 付録: 目的から探す

読む順に関係なく、「〜したい」から引く索引です。

| 〜したい                                     | 読む場所                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| 契約はあるので、まず繋ぎたい                 | [始める前に][s-prereq] から順に                                          |
| 契約や権限付与を待つ間に書き始めたい         | [契約なしでテストする][testing]                                          |
| 初回の権限付与をアプリに組み込みたい         | [認証とトークン][auth] の「初回の権限付与」                              |
| トークンを Redis や DB に置きたい            | [認証とトークン][auth] の「トークンの永続化」                            |
| 条件でレコードを探したい                     | [検索][query]                                                            |
| 参照先の項目もまとめて読みたい               | [検索][query] の「`expand`」                                             |
| 全件を回したい                               | [検索][query] の「`count` / `start`」（`searchAll`）                     |
| 削除済みのレコードを読みたい                 | [削除と削除済みデータ][deleted]                                          |
| 1 件作りたい・更新したい                     | [書き込み][write]                                                        |
| 200 件を超えてまとめて書きたい               | [書き込み][write] の「まとめて書く」                                     |
| 新規作成で何が必須か知りたい                 | [書き込み][write] の「新規作成の必須項目」                               |
| テナント固有の項目（`U_` / `A_`）を使いたい  | [カスタム項目][custom-fields]                                            |
| 宣言がテナントの実物と合っているか確かめたい | [カスタム項目][custom-fields] の「宣言がテナントと合っているか確かめる」 |
| 添付ファイルを付けたい・取りたい             | [Attachment][r-attachment]                                               |
| 失敗したとき落とすか続けるか決めたい         | [エラーと再試行][errors]                                                 |
| このエラーは何か、症状から引きたい           | [トラブルシューティング][troubleshooting]                                |
| レートや長さの上限を知りたい                 | [上限とレート][limits]                                                   |
| 日時をどう渡せばよいか知りたい               | [日時と時分型][datetime]                                                 |
| 複数の Company DB を 1 プロセスで扱いたい    | [複数テナント][multi-tenant]                                             |
| 毎日の差分同期を組みたい                     | [毎日の差分同期][sync-batch]                                             |
| あるリソースで何が呼べるか知りたい           | [リソースと操作][resources]                                              |

---

開発・保守のための資料（ADR・設計・ロードマップ・台帳）は [docs/README.md][docs-readme] にまとめてあります。

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
