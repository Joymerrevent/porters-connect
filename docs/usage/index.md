# ドキュメント

`@joymerrevent/porters-connect` の使い方をまとめたドキュメントです。このページが入口で、
**上から順に読むと、PORTERS に繋ぐところから本番運用の勘所までを学べる**ように並べています<!-- 根拠: ADR-0088 -->。

## このライブラリについて

**PORTERS Connect API（旧 HRBC）を TypeScript から型安全に扱うための、非公式のラッパー**です。
ポーターズ株式会社とは無関係で、提供元は Joymerrevent です。

PORTERS Connect API は、応答が XML で、OAuth が独自仕様で、削除 API が無く、リクエストの長さと
1 分あたりの回数に上限があります。このライブラリはそれらを内側に引き受けます。

| ライブラリがすること                                                                   | しないこと（利用側の責務）                       |
| -------------------------------------------------------------------------------------- | ------------------------------------------------ |
| XML を型付きオブジェクトに変換し、入力も素直な JS の値で受ける                         | 業務ロジック（どの項目をどう突き合わせるか）     |
| 独自 OAuth を透過的に運用する（初回の権限付与のあとは無人でトークンを取り直す）        | 業務タイムゾーンへの変換（日時は UTC・ISO 8601） |
| レート上限を内蔵スロットルで自制し、一時的な失敗を再試行する                           | 月あたりのアクセス数の管理（契約条件）           |
| 長すぎるリクエストや上限超えを送信前に弾き、失敗を判別できる型（`PortersError`）で返す | 削除（PORTERS に削除 API が無い）                |

使うには **PORTERS の契約 ＋ Connect API オプション契約**と、API アプリの登録（ホスト名・App ID・App Secret の
通知）が要ります。実行環境は Node.js 22.12 以上です。

## このドキュメントで学べること

5 つの章があります。順に読むと、次のことができるようになります。

1. **導入** — 契約済みの状態から、自分のアプリを PORTERS に繋ぎ、読み書きして、本番に出す。
2. **主題別** — 認証・検索・書き込み・カスタム項目・上限といった主題ごとの規則と、その背景にある
   PORTERS 側の前提を理解する。
3. **リソース別** — Candidate や Job など 18 のリソースで、何が呼べて何に気をつけるかを引く。
4. **実践例** — 毎日の差分同期や複数テナントのような用途を、ライブラリのどの機能で組み立てるかを知る。
5. **リファレンス** — 公開 API の型・関数と、PORTERS API の事実を引く。

**はじめての人は 1 → 2 の順に上から読んでください。** 主題別も、上から読むと PORTERS 側の前提が
積み上がる順に並べています。3 以降は必要になったときに引く章です。急ぐ人のために、末尾に
「〜したい」から引ける索引を置いています。

## 1. 導入

**順に読む章です。** PORTERS と契約済みの人が、自分のアプリを繋ぐまでの順路で、6 ページあります。
各ページの先頭に「前提」と「次に読む」があるので、上から順に進めば迷いません。

| ページ                                            | 学べること                                                      |
| ------------------------------------------------- | --------------------------------------------------------------- |
| [始める前に — PORTERS 側で用意するもの][s-prereq] | 契約・アプリ登録・3 つの値・Company DB・スコープ。コードなし    |
| [インストールと、クライアントの構築][s-install]   | `npm i` と、受け取った 3 つの値の渡し方                         |
| [認証を通して、疎通を確認する][s-auth]            | 初回だけブラウザで 1 回。以降は無人。**繋がった**ことの確かめ方 |
| [はじめての読み取り][s-read]                      | `tenant(id)` で束ねる ／ `search` ／ `get` ／ `field` の効き方  |
| [はじめての書き込み][s-write]                     | `create` と `update`。`delete` が無いということ                 |
| [本番に出す前に][s-live]                          | 機密情報・Partition・トークン・上限・失敗・差分取得の確認       |

契約や権限付与を待っている間に書き始めたいなら、[契約なしでテストする][testing]から入れます。

## 2. 主題別

**1 主題 1 ページ**です。各ページは **まず知ること（PORTERS 側の前提）→ 使い方 → 細かい規則** の順で
書いてあるので、冒頭だけ読んでも、そのページの前提は分かります。上から順に、データの置き場所 →
項目の形 → 読み書き → 認証と運用、と積み上がります。

| ページ                                 | 学べること                                                                              |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| [Partition とテナントスコープ][tenant] | データは Partition（Company DB）に分かれる。`tenant(id)` で束ねる。id の探し方          |
| [項目と値の形][fields]                 | alias の 3 種類（`P_` / `U_` / `A_`）・接頭辞は書かない・Data Type ごとの読みと書きの形 |
| [検索][query]                          | `field` ／ `expand` ／ `condition` ／ `order` ／ `keywords` ／ ページング               |
| [書き込み][write]                      | `create` ／ `update`・書くときの形・新規作成の必須・一括の分割と部分成功                |
| [削除と削除済みデータ][deleted]        | 消せない前提で書く。`itemstate` と `P_Deleted` で削除済みを読む                         |
| [日時と時分型][datetime]               | UTC・ISO 8601 で入出力する。変換できない値の扱い。時分型の変換関数                      |
| [カスタム項目][custom-fields]          | `defineFields` で `U_` ／ `A_` を宣言する。自動生成と、テナントとの突合                 |
| [認証とトークン][auth]                 | 初回の権限付与・無人運用・`tokenStore`・権限の削除・自前のトークン管理                  |
| [上限とレート][limits]                 | 長さ・件数・レート・時間の上限と、どこで弾かれるか                                      |
| [エラーと再試行][errors]               | エラーの型と `category`・届き方・自動再試行の範囲・コード対応表                         |
| [契約なしでテストする][testing]        | トランスポートを 1 箇所差し替える。モックし忘れは黙って通らない                         |

## 3. リソース別

**1 リソース 1 ページ**です。`porters.tenant(id)` で束ねたスコープ（`t`）の下にある 18 リソースを、
**同じ節構成**（呼べるメソッド → 固有の注意 → 新規作成の必須項目 → 項目と型）で置いています。
**呼べるメソッドは行ごとに違う**ので、まず [リソースと操作][resources] の表で確かめてください。

| データ系（読み書き）                                                                                                                                                                                                                                                                                                       | マスタ系（読み取り専用）                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [Candidate][r-candidate] ／ [Job][r-job] ／ [Client][r-client] ／ [Recruiter][r-recruiter] ／ [Contact][r-contact] ／ [Opportunity][r-opportunity] ／ [Activity][r-activity] ／ [Contract][r-contract] ／ [Sales][r-sales] ／ [Process][r-process] ／ [Resume][r-resume] ／ [Phase][r-phase] ／ [Attachment][r-attachment] | [Partition][r-partition] ／ [User][r-user] ／ [Department][r-department] ／ [Field][r-field] ／ [Option][r-option] |

## 4. 実践例

**用途に沿って組み立てる章です。** 各ページは **使う機能 → 組み立て → ライブラリの外（利用側の責務）** の
順で、ライブラリがどこまでを受け持つかの境界も分かります。

| ページ                       | 学べること                                                           |
| ---------------------------- | -------------------------------------------------------------------- |
| [毎日の差分同期][sync-batch] | 差分を取る → 書き戻す → 失敗からの再開。レートは自制される           |
| [複数テナント][multi-tenant] | テナントの登録・リクエストごとのスコープ・宣言の持ち方・認証・レート |

## 5. リファレンス

**細部を引く章です。**

| ページ                                    | 何の正典か                                           |
| ----------------------------------------- | ---------------------------------------------------- |
| [公開 API の全記号][api]                  | このライブラリの型・関数・メソッド（JSDoc から生成） |
| [PORTERS API の事実][reference]           | PORTERS 側の仕様のうち、使ううえで必要なもの         |
| [トラブルシューティング][troubleshooting] | 症状 → 原因 → 対処の早見表                           |
| [用語集][glossary]                        | PORTERS の用語と、画面名とリソース名の対応           |

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
