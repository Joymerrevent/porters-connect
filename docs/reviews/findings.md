# レビュー指摘台帳（findings register）

このファイルは `/project-review` が更新する、全レビュー横断の指摘台帳の**索引**です。
**各指摘の本体は [`rv/`][rv] に 1 件 1 ファイル**で置きます（[ADR-0052][adr52]）。

- **ID は不変・ファイルは消さない**。確定したら各ファイルの「状態」と「処置」を更新します
  （運用は [docs/live-verification.md][lv] と同じ思想＝処置が追える）。
- **状態・重要度・観点の正は各ファイル**で、本表はその写しです。
  ズレは **`pnpm check:index`** が検出して CI で落とします（人の注意でなく仕組みで守る）。
- **新しい指摘を起票したら、本表にも 1 行足す**（行が無いと検査が落ちます）。

凡例 — 重要度: 🔴 High（実用ブロッカー級）/ 🟡 Medium / 🟢 Low ・ 状態: open / fixed / wontfix / deferred

## 一覧

| ID              | 重要度 | 観点                            | 状態    | 概要                                                                                                 |
| --------------- | ------ | ------------------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| [RV-1][rv1]     | 🔴     | API 忠実性                      | fixed   | field 省略時の Read が主キーしか返さない                                                             |
| [RV-2][rv2]     | 🟡     | テスト厳密性                    | fixed   | field 無し search の fixture が本番と乖離                                                            |
| [RV-3][rv3]     | 🟡     | エラーモデル                    | fixed   | ErrorCategory の rateLimit が到達不能                                                                |
| [RV-4][rv4]     | 🟡     | リリース準備                    | fixed   | publishConfig.access と npm メタデータが未設定                                                       |
| [RV-5][rv5]     | 🟡     | API 忠実性                      | fixed   | 送信前ガードの非対称                                                                                 |
| [RV-6][rv6]     | 🟢     | テスト厳密性                    | fixed   | mock transport の既定 status 経路が未テスト                                                          |
| [RV-7][rv7]     | 🟢     | ドキュメント / DX               | fixed   | 未モック時エラーメッセージが冗長                                                                     |
| [RV-8][rv8]     | 🟢     | アーキテクチャ                  | fixed   | 依存方向：resources → fields                                                                         |
| [RV-9][rv9]     | 🟡     | アーキテクチャ / リリース       | fixed   | 単調増加チェックの baseline が back-merge ラグで誤検知                                               |
| [RV-10][rv10]   | 🟡     | アーキテクチャ / DX             | fixed   | per-call partition の JSDoc 偽宣言                                                                   |
| [RV-11][rv11]   | 🟡     | 認証                            | fixed   | refresh 失効時の挙動が doc と乖離                                                                    |
| [RV-12][rv12]   | 🟢     | ドキュメント                    | fixed   | roadmap/PRD の coverage 過大主張                                                                     |
| [RV-13][rv13]   | 🟡     | エラーモデル / API 忠実性       | fixed   | HTTP ステータスを一切見ていない                                                                      |
| [RV-14][rv14]   | 🟡     | エラーモデル / API 忠実性       | fixed   | Write のルート `<Code>` を読まない                                                                   |
| [RV-15][rv15]   | 🟢     | エラーモデル / DX               | fixed   | 送信前ガードが同期 throw する経路がある                                                              |
| [RV-16][rv16]   | 🟢     | ドキュメント                    | fixed   | 月次クォータを内蔵スロットルが守るかのような記述                                                     |
| [RV-17][rv17]   | 🟡     | フェイルセーフ / 設定検証       | fixed   | `host` の書式を検証せず、設定ミスが別ホストへの実リクエストになる                                    |
| [RV-18][rv18]   | 🟢     | ドキュメント / 計画             | fixed   | accepted 済み ADR-0044〜0046 の実装が roadmap に現れない                                             |
| [RV-19][rv19]   | 🟡     | エラーモデル / 認証             | fixed   | 認証 API 経路が HTTP ステータスを見ない                                                              |
| [RV-20][rv20]   | 🟡     | フェイルセーフ / API 忠実性     | fixed   | HTTP 200 ＋ 非 PORTERS ボディが「空ページ」として通る                                                |
| [RV-21][rv21]   | 🟢     | 設定検証 / 後方互換             | fixed   | 既定ポート `:443` 付きの `host` が弾かれる                                                           |
| [RV-22][rv22]   | 🟢     | リトライ / DX                   | fixed   | HTTP 429 の後、非冪等な `create` が自動再送されない                                                  |
| [RV-23][rv23]   | 🔴     | API 忠実性 / 型安全             | fixed   | Candidate の静的カタログが標準項目 4 件を欠く                                                        |
| [RV-24][rv24]   | 🟡     | ドキュメント / DX               | fixed   | `defineFields` の使い方がどこにも無い                                                                |
| [RV-25][rv25]   | 🟡     | フェイルセーフ / 設定検証       | fixed   | `partition` 未設定で無言のうちに `partition=0` を送る                                                |
| [RV-26][rv26]   | 🟡     | API 忠実性                      | fixed   | `P_Deleted` 未対応 ＝ 削除済みかを判別できない                                                       |
| [RV-27][rv27]   | 🟢     | ドキュメント / DX               | fixed   | F-2 だけトピック ガイドが無い                                                                        |
| [RV-28][rv28]   | 🟢     | API 忠実性 / フェイルセーフ     | fixed   | `count` の範囲を送信前に検証しない                                                                   |
| [RV-29][rv29]   | 🟢     | テスト厳密性 / プロセス         | fixed   | reference ↔ カタログの突合が自動化されていない                                                       |
| [RV-30][rv30]   | 🟢     | 型安全 / 公開サーフェス         | fixed   | 公開ジェネリクスの制約型が未 export                                                                  |
| [RV-31][rv31]   | 🟡     | API 忠実性 / 型安全             | fixed   | System[Reference] を展開して要求しても ID 以外が捨てられる                                           |
| [RV-32][rv32]   | 🟢     | フェイルセーフ / DX             | fixed   | searchAll のクエリを反復中に書き換えると次ページ以降が変わる                                         |
| [RV-33][rv33]   | 🟡     | プロセス / フェイルセーフ       | fixed   | back-merge が develop の保護ルールをバイパスして通る                                                 |
| [RV-34][rv34]   | 🟢     | フェイルセーフ / DX             | wontfix | 取り込み時の同一性チェックが 3 つの別原因を同じ文言で報告する                                        |
| [RV-35][rv35]   | 🟢     | フェイルセーフ                  | wontfix | 未来の検査時刻を弾くガードが 1 日未満の未来で発火しない                                              |
| [RV-36][rv36]   | 🟡     | エラーモデル / フェイルセーフ   | fixed   | 日時の変換だけが例外を投げ、それが PortersError でない（読み・書きの両方）                           |
| [RV-37][rv37]   | 🟡     | API 忠実性 / 機能網羅           | fixed   | Field Read が Process を選べず、同じ事実の対応表が 2 つに割れている                                  |
| [RV-38][rv38]   | 🟢     | ドキュメント / フェイルセーフ   | fixed   | リンク検査が inline リンクの一部を見ない                                                             |
| [RV-39][rv39]   | 🟢     | ドキュメント                    | fixed   | リンク検査が見出しアンカーの実在を見ない                                                             |
| [RV-40][rv40]   | 🟢     | ドキュメント / DX               | fixed   | リンク検査がインラインコードスパン内のリンクを誤検出する                                             |
| [RV-41][rv41]   | 🟢     | プロセス / テスト厳密性         | fixed   | 検証ハーネスが gitignore 下にあり、履歴が挙げる証拠を再現できない                                    |
| [RV-42][rv42]   | 🟢     | プロセス / DX                   | fixed   | 品質ゲートの一覧が 4 箇所に分散して腐る                                                              |
| [RV-43][rv43]   | 🟡     | フェイルセーフ / API 忠実性     | fixed   | スロットルが client 単位で、テナント別 client を作ると自制が分裂する                                 |
| [RV-44][rv44]   | 🟡     | テスト厳密性                    | fixed   | coverage / mutation が `src/fields/**` を除外したままで実ロジックが測られていない                    |
| [RV-45][rv45]   | 🟢     | 機能網羅 / ドキュメント         | fixed   | Attachment だけ `searchAll` が無く、無い理由も残っていない                                           |
| [RV-46][rv46]   | 🟡     | 公開サーフェス / フェイルセーフ | fixed   | 既定 30 秒のタイムアウトを公開 API から変えられない                                                  |
| [RV-47][rv47]   | 🟡     | フェイルセーフ / 型安全         | fixed   | `t.phase.of()` の束ねを、呼び出し側が上書きできる                                                    |
| [RV-48][rv48]   | 🔴     | API 忠実性 / フェイルセーフ     | fixed   | Option の選択肢 alias が検証されずタグ名になり、書き込み XML を注入できる                            |
| [RV-49][rv49]   | 🟡     | フェイルセーフ / 公開サーフェス | fixed   | `createThrottle` の上限値を検証せず、容量 0 で永久に待ち続ける                                       |
| [RV-50][rv50]   | 🟡     | プロセス / フェイルセーフ       | fixed   | LV と `VERIFY(live)` の対応が双方向で崩れ、未登録の仮定が残っている                                  |
| [RV-51][rv51]   | 🟢     | ドキュメント / DX               | fixed   | 生成した公開 API リファレンスに日本語が混ざる                                                        |
| [RV-52][rv52]   | 🟢     | ドキュメント / 計画             | fixed   | `1.0.0` の条件 V5 が定義上満たせず、LV の件数表記も実態とずれている                                  |
| [RV-53][rv53]   | 🟢     | テスト厳密性 / プロセス         | fixed   | `engines` の下限 22.12 を CI が一度も走らせていない                                                  |
| [RV-54][rv54]   | 🟡     | エラーモデル / API 忠実性       | fixed   | 予約名の alias は書けるのに読めず、その例外が PortersError の外に出る                                |
| [RV-55][rv55]   | 🟢     | API 忠実性 / フェイルセーフ     | fixed   | `decodeTimeOfDay` が 1 日目の時 24〜47・分秒 60 以上を弾かず、別の wire 値に往復する                 |
| [RV-56][rv56]   | 🟢     | ドキュメント / プロセス         | fixed   | ADR 索引の「実装」列が 0.8.0 以降更新されず、凡例が 21 本で事実と食い違う                            |
| [RV-57][rv57]   | 🟢     | プロセス / ドキュメント         | fixed   | RV-54 で保留した書き込み側の判断が ADR バックログにも roadmap にも無い                               |
| [RV-58][rv58]   | 🟢     | API 忠実性 / フェイルセーフ     | fixed   | `Number` の Read が数値でない文字列を `NaN` に黙って変換し、そのまま Write に戻る                    |
| [RV-59][rv59]   | 🟡     | テスト厳密性 / プロセス         | fixed   | `tenant(id, { fields })` の宣言配線を candidate 以外の 10 リソースで pin していない                  |
| [RV-60][rv60]   | 🟢     | ドキュメント / API 忠実性       | fixed   | 0.21.0 の CHANGELOG と ADR-0087 が 0.15.0 で直した「黙って `null`」を現在形で書く                    |
| [RV-61][rv61]   | 🟢     | ドキュメント / プロセス         | fixed   | roadmap が reference README の「再取得の手順」を指すが、その節は CONTRIBUTING に移動                 |
| [RV-62][rv62]   | 🟢     | DX / API 忠実性                 | fixed   | カスタム項目を `create` の必須として宣言できない（テナントの `P_Required` を型に写せない）           |
| [RV-63][rv63]   | 🟢     | DX / アーキテクチャ             | fixed   | トークンの「取得」だけを差し替えて「管理」をライブラリに任せる入口が無い                             |
| [RV-64][rv64]   | 🟢     | API 忠実性 / エラーモデル       | fixed   | 単件の `create` / `update` が、束ねた alias を渡されたときだけ同期 throw する（ADR-0046 の契約違反） |
| [RV-65][rv65]   | 🔴     | エラーモデル / フェイルセーフ   | fixed   | 送信済み create の通信失敗が retryable:true で届く                                                   |
| [RV-66][rv66]   | 🔴     | API 忠実性 / フェイルセーフ     | fixed   | スロットルが 1 分間に上限の約 1.8 倍を通す                                                           |
| [RV-67][rv67]   | 🔴     | フェイルセーフ / API 忠実性     | fixed   | update(-1) が新規作成になる                                                                          |
| [RV-68][rv68]   | 🔴     | API 忠実性 / フェイルセーフ     | fixed   | 条件の値のカンマが別の条件になる                                                                     |
| [RV-69][rv69]   | 🔴     | エラーモデル / フェイルセーフ   | fixed   | createMany の途中失敗で先のバッチの失敗が消える                                                      |
| [RV-70][rv70]   | 🟡     | API 忠実性 / フェイルセーフ     | fixed   | 応答の Code / Id の崩れを 0（成功）と読む                                                            |
| [RV-71][rv71]   | 🟡     | API 忠実性 / フェイルセーフ     | fixed   | searchAll が Total の無い応答で黙って止まる                                                          |
| [RV-72][rv72]   | 🟡     | API 忠実性 / フェイルセーフ     | fixed   | getMany が切れた応答を「存在しない」にする                                                           |
| [RV-73][rv73]   | 🟡     | API 忠実性 / フェイルセーフ     | fixed   | get が返ったレコードの id を確かめない                                                               |
| [RV-74][rv74]   | 🟡     | フェイルセーフ / 設定検証       | fixed   | start・id・空配列の条件を送信前に検査しない                                                          |
| [RV-75][rv75]   | 🟡     | 認証                            | fixed   | 同時の 401 で取り直しが何度も走る                                                                    |
| [RV-76][rv76]   | 🟡     | セキュリティ / フェイルセーフ   | fixed   | リダイレクト先へトークン・Secret を送る                                                              |
| [RV-77][rv77]   | 🟡     | 設定検証                        | fixed   | timeoutMs が 2^31 以上で即中断                                                                       |
| [RV-78][rv78]   | 🟡     | エラーモデル / フェイルセーフ   | fixed   | create の Code 302 を自動で再送する                                                                  |
| [RV-79][rv79]   | 🟡     | フェイルセーフ / 設定検証       | fixed   | defineFields が存在しない Data Type を受け付ける                                                     |
| [RV-80][rv80]   | 🟡     | フェイルセーフ / API 忠実性     | fixed   | 宣言できない項目の宣言で verifyFields が ok                                                          |
| [RV-81][rv81]   | 🟡     | フェイルセーフ                  | fixed   | attachment.create が undefined を送る                                                                |
| [RV-82][rv82]   | 🟡     | フェイルセーフ / DX             | fixed   | generateFieldDecls が項目名をエスケープしない                                                        |
| [RV-83][rv83]   | 🟡     | API 忠実性                      | fixed   | 値の前後の空白が消え、数値文字参照が残る                                                             |
| [RV-84][rv84]   | 🟡     | API 忠実性 / フェイルセーフ     | fixed   | 入れ子の P_Id が空で 0、文字で NaN                                                                   |
| [RV-85][rv85]   | 🟡     | フェイルセーフ                  | fixed   | 書き込みで NaN / Infinity を送る                                                                     |
| [RV-86][rv86]   | 🟡     | API 忠実性 / フェイルセーフ     | fixed   | Date の書き込みが前方一致だけで通す                                                                  |
| [RV-87][rv87]   | 🟡     | API 忠実性                      | fixed   | XML の属性が値に混ざる                                                                               |
| [RV-88][rv88]   | 🟢     | フェイルセーフ                  | fixed   | 時計が戻るとスロットルが止まる                                                                       |
| [RV-89][rv89]   | 🟢     | 認証                            | fixed   | ExpiresIn の欠けと非数の扱いが違う                                                                   |
| [RV-90][rv90]   | 🟢     | 認証 / フェイルセーフ           | fixed   | 認証応答の Error 欠けを成功と読む                                                                    |
| [RV-91][rv91]   | 🟢     | 認証                            | fixed   | token-manager の clear と読み込み失敗                                                                |
| [RV-92][rv92]   | 🟢     | 設定検証                        | fixed   | ホスト名の % と、スロットルの鍵の揺れ                                                                |
| [RV-93][rv93]   | 🟢     | 設定検証                        | fixed   | transport などの形を構築時に確かめない                                                               |
| [RV-94][rv94]   | 🟢     | API 忠実性                      | open    | field の重複で expand が崩れる                                                                       |
| [RV-95][rv95]   | 🟢     | ドキュメント / DX               | open    | field: [] で expand が落ちる                                                                         |
| [RV-96][rv96]   | 🟢     | アーキテクチャ                  | open    | applyExpand が qualify を使わない                                                                    |
| [RV-97][rv97]   | 🟢     | API 忠実性                      | open    | keywords の空要素と長さの単位                                                                        |
| [RV-98][rv98]   | 🟢     | フェイルセーフ                  | open    | Image の検査の迂回と改行入り Base64                                                                  |
| [RV-99][rv99]   | 🟢     | ドキュメント                    | open    | searchAll の取りこぼしが文書に無い                                                                   |
| [RV-100][rv100] | 🟢     | API 忠実性                      | open    | Number の読み込みが寛容で精度を落とす                                                                |
| [RV-101][rv101] | 🟢     | API 忠実性                      | open    | 日時の読み込みが不正な日付を通す                                                                     |
| [RV-102][rv102] | 🟢     | API 忠実性                      | open    | 型と形の食い違いが黙って通る                                                                         |
| [RV-103][rv103] | 🟢     | フェイルセーフ                  | open    | Image の Content: null を送る                                                                        |
| [RV-104][rv104] | 🟢     | フェイルセーフ                  | open    | Option の書き込みで null と x:y を通す                                                               |
| [RV-105][rv105] | 🟢     | API 忠実性                      | open    | 書き込みで接頭辞を二重に付ける                                                                       |
| [RV-106][rv106] | 🟢     | フェイルセーフ                  | open    | XML で使えない文字をそのまま送る                                                                     |
| [RV-107][rv107] | 🟢     | API 忠実性                      | open    | 日時の書き込みで年を 4 桁にしない                                                                    |
| [RV-108][rv108] | 🟢     | セキュリティ                    | open    | DOCTYPE の実体を展開する                                                                             |
| [RV-109][rv109] | 🟢     | ドキュメント / DX               | open    | 時分型のメッセージの範囲が実装と違う                                                                 |
| [RV-110][rv110] | 🟢     | エラーモデル                    | open    | base64ToBytes が DOMException を投げる                                                               |
| [RV-111][rv111] | 🟢     | API 忠実性                      | open    | 添付ファイルの上限の値と出典                                                                         |
| [RV-112][rv112] | 🟢     | 設定検証                        | open    | カスタム項目の alias の文字を確かめない                                                              |
| [RV-113][rv113] | 🟢     | 設定検証                        | fixed   | tenant の id と of の名前を確かめない                                                                |
| [RV-114][rv114] | 🟢     | エラーモデル                    | open    | コード 5 と 113 が表に無い                                                                           |
| [RV-115][rv115] | 🟢     | API 忠実性                      | open    | readCustomCatalog が接頭辞を突き合わせない                                                           |
| [RV-116][rv116] | 🟢     | ドキュメント / DX               | open    | Option の count の上限と hint                                                                        |
| [RV-117][rv117] | 🟢     | 型安全 / DX                     | open    | 制約の型を export していない                                                                         |
| [RV-118][rv118] | 🟢     | テスト厳密性                    | open    | 新規必須の突き合わせにテストが無い                                                                   |
| [RV-119][rv119] | 🟢     | ドキュメント                    | open    | 実装と合わないコメント 4 か所                                                                        |
| [RV-120][rv120] | 🟢     | エラーモデル / DX               | fixed   | 3xx のエラーの hint が一般的                                                                         |
| [RV-121][rv121] | 🟢     | 認証                            | fixed   | 読み込み中の cache() が上書きされる                                                                  |
| [RV-122][rv122] | 🟢     | エラーモデル                    | fixed   | asUnknownOutcome がクラスを変えうる                                                                  |
| [RV-123][rv123] | 🟢     | エラーモデル                    | open    | create の一部の失敗に hint が付かない                                                                |
| [RV-124][rv124] | 🟢     | 性能                            | fixed   | スロットルの shift が容量に比例                                                                      |
| [RV-125][rv125] | 🟢     | エラーモデル / DX               | open    | createMany の件ごとの 302 に案内が無い                                                               |
| [RV-126][rv126] | 🟢     | エラーモデル                    | open    | BigInt の id で TypeError が漏れる                                                                   |
| [RV-127][rv127] | 🟢     | ドキュメント                    | fixed   | 文字列の id の拒否が changeset に無い                                                                |
| [RV-128][rv128] | 🟢     | ドキュメント                    | fixed   | 一括書き込みの文書の言い方が実装と違う                                                               |
| [RV-129][rv129] | 🟢     | エラーモデル / DX               | open    | updateMany の再送の案内が紛らわしい                                                                  |
| [RV-130][rv130] | 🟢     | フェイルセーフ                  | open    | 添付ファイルの resourceId を検査しない                                                               |
| [RV-131][rv131] | 🟢     | エラーモデル                    | open    | 送る前の失敗を「書き込まれた可能性」と書く                                                           |
| [RV-132][rv132] | 🟢     | API 忠実性                      | open    | 空白だけの空の入れ子要素がエラーになる                                                               |
| [RV-133][rv133] | 🟢     | API 忠実性                      | open    | 空白付きの日時・属性・トークン                                                                       |
| [RV-134][rv134] | 🟢     | エラーモデル                    | open    | 0001〜0099 年の日付の弾き方                                                                          |
| [RV-135][rv135] | 🟢     | フェイルセーフ                  | open    | 残っている数の検査の抜け                                                                             |
| [RV-136][rv136] | 🟢     | フェイルセーフ                  | open    | 添付ファイルの空の update                                                                            |
| [RV-137][rv137] | 🟢     | フェイルセーフ                  | open    | constName の予約語                                                                                   |
| [RV-138][rv138] | 🟢     | フェイルセーフ                  | open    | prototype 経由の宣言                                                                                 |
| [RV-139][rv139] | 🟢     | ドキュメント                    | open    | 添付ファイルの検査の文書                                                                             |
| [RV-140][rv140] | 🟢     | エラーモデル                    | open    | 入力の渡し忘れが TypeError                                                                           |
| [RV-141][rv141] | 🟢     | エラーモデル                    | open    | hostname 未設定・BigInt で TypeError                                                                 |
| [RV-142][rv142] | 🟢     | 認証                            | open    | 保存中の clear() でトークンが戻る                                                                    |

> RV-10〜12 は横断監査（[2026-06-22-03][run3]）で検出したドリフト群。受け入れ済み ADR が定めた v1 公開 API の**未実装サーフェス**（OAuth `porters.auth.*` / Read クエリ `order`・`keywords`・`itemstate` / `tenant(id)`＋per-call `partition` / 200 件一括書き込み）は finding 化せず [ADR-0033][adr33] 案F（先行フェーズ）で扱う。

[adr52]: ../adr/0052-findings-register-layout.md
[rv]: rv
[adr33]: ../adr/0033-post-mvp-direction.md
[lv]: ../live-verification.md
[run3]: 2026-06-22-03.md
[rv1]: rv/0001-read-field-default-missing.md
[rv2]: rv/0002-fieldless-search-fixture-drift.md
[rv3]: rv/0003-unreachable-ratelimit-category.md
[rv4]: rv/0004-npm-publish-metadata.md
[rv5]: rv/0005-request-size-guard-read-url.md
[rv6]: rv/0006-mock-transport-default-status.md
[rv7]: rv/0007-mock-transport-route-message.md
[rv8]: rv/0008-resources-fields-dependency.md
[rv9]: rv/0009-monotonic-baseline-backmerge-lag.md
[rv10]: rv/0010-per-call-partition-jsdoc.md
[rv11]: rv/0011-refresh-expiry-behavior-drift.md
[rv12]: rv/0012-coverage-overclaim-docs.md
[rv13]: rv/0013-http-status-ignored.md
[rv14]: rv/0014-write-root-code-ignored.md
[rv15]: rv/0015-sync-throw-guards.md
[rv16]: rv/0016-monthly-quota-wording.md
[rv17]: rv/0017-host-format-unvalidated.md
[rv18]: rv/0018-roadmap-missing-adr-impl.md
[rv19]: rv/0019-auth-path-http-status.md
[rv20]: rv/0020-non-porters-body-empty-page.md
[rv21]: rv/0021-default-port-rejected.md
[rv22]: rv/0022-ratelimit-create-no-retry.md
[rv23]: rv/0023-candidate-catalog-missing-fields.md
[rv24]: rv/0024-define-fields-undocumented.md
[rv25]: rv/0025-partition-default-zero.md
[rv26]: rv/0026-deleted-flag-unsupported.md
[rv27]: rv/0027-read-query-guide-missing.md
[rv28]: rv/0028-count-range-unvalidated.md
[rv29]: rv/0029-reference-catalog-check-missing.md
[rv30]: rv/0030-generic-constraint-types-unexported.md
[rv31]: rv/0031-reference-expansion-discarded.md
[rv32]: rv/0032-searchall-query-mutation.md
[rv33]: rv/0033-backmerge-bypasses-branch-protection.md
[rv34]: rv/0034-merge-identity-failure-reason.md
[rv35]: rv/0035-future-timestamp-guard-boundary.md
[rv36]: rv/0036-write-value-validation-partial.md
[rv37]: rv/0037-field-read-missing-process.md
[rv38]: rv/0038-link-check-inline-forms.md
[rv39]: rv/0039-link-check-ignores-anchors.md
[rv40]: rv/0040-link-check-inline-code-spans.md
[rv41]: rv/0041-verification-harness-not-committed.md
[rv42]: rv/0042-quality-gate-list-drift.md
[rv43]: rv/0043-throttle-scoped-per-client.md
[rv44]: rv/0044-fields-excluded-from-coverage.md
[rv45]: rv/0045-attachment-search-all-absent.md
[rv46]: rv/0046-fetch-timeout-not-configurable.md
[rv47]: rv/0047-phase-binding-overridable.md
[rv48]: rv/0048-option-alias-xml-injection.md
[rv49]: rv/0049-throttle-options-unvalidated.md
[rv50]: rv/0050-live-verification-traceability-broken.md
[rv51]: rv/0051-japanese-in-generated-api-reference.md
[rv52]: rv/0052-lv-gate-definition-unsatisfiable.md
[rv53]: rv/0053-engines-floor-untested.md
[rv54]: rv/0054-reserved-tag-name-read-throws.md
[rv55]: rv/0055-time-of-day-decode-hour-unchecked.md
[rv56]: rv/0056-adr-implemented-column-stale.md
[rv57]: rv/0057-deferred-decision-not-in-backlog.md
[rv58]: rv/0058-number-decode-nan-unchecked.md
[rv59]: rv/0059-tenant-fields-threading-unpinned.md
[rv60]: rv/0060-changelog-stale-silent-null-premise.md
[rv61]: rv/0061-roadmap-points-to-moved-section.md
[rv62]: rv/0062-custom-field-required-declaration.md
[rv63]: rv/0063-token-provider-acquire-store-split.md
[rv64]: rv/0064-single-write-sync-throw-on-bound-alias.md
[rv65]: rv/0065-sent-create-failure-retryable.md
[rv66]: rv/0066-throttle-exceeds-minute-limit.md
[rv67]: rv/0067-update-negative-id-creates.md
[rv68]: rv/0068-condition-comma-injects-and.md
[rv69]: rv/0069-create-many-loses-earlier-failures.md
[rv70]: rv/0070-response-code-shape-not-checked.md
[rv71]: rv/0071-search-all-trusts-total.md
[rv72]: rv/0072-get-many-trusts-truncated-page.md
[rv73]: rv/0073-get-does-not-match-id.md
[rv74]: rv/0074-paging-and-id-values-unchecked.md
[rv75]: rv/0075-token-refresh-not-single-flight.md
[rv76]: rv/0076-fetch-follows-redirect-with-credentials.md
[rv77]: rv/0077-timeout-over-int32-aborts.md
[rv78]: rv/0078-create-retries-code-302.md
[rv79]: rv/0079-define-fields-data-type-unchecked.md
[rv80]: rv/0080-verify-fields-undeclarable-ok.md
[rv81]: rv/0081-attachment-create-sends-undefined.md
[rv82]: rv/0082-generate-field-decls-unescaped.md
[rv83]: rv/0083-xml-text-trimmed-and-refs.md
[rv84]: rv/0084-nested-id-number-unchecked.md
[rv85]: rv/0085-write-number-not-finite.md
[rv86]: rv/0086-iso-date-prefix-match.md
[rv87]: rv/0087-xml-attributes-leak-into-values.md
[rv88]: rv/0088-throttle-clock-backwards.md
[rv89]: rv/0089-token-expires-in-inconsistent.md
[rv90]: rv/0090-auth-error-missing-read-as-success.md
[rv91]: rv/0091-token-manager-state-edges.md
[rv92]: rv/0092-access-point-percent-and-throttle-key.md
[rv93]: rv/0093-client-options-shape-unchecked.md
[rv94]: rv/0094-field-duplicate-breaks-expand.md
[rv95]: rv/0095-empty-field-drops-expand.md
[rv96]: rv/0096-apply-expand-bypasses-qualify.md
[rv97]: rv/0097-keywords-empty-and-length-unit.md
[rv98]: rv/0098-image-guard-cast-paths.md
[rv99]: rv/0099-search-all-shrinking-total-undocumented.md
[rv100]: rv/0100-number-decode-lenient.md
[rv101]: rv/0101-date-decode-accepts-invalid.md
[rv102]: rv/0102-decode-shape-mismatch-silent.md
[rv103]: rv/0103-image-content-null-written.md
[rv104]: rv/0104-option-write-null-and-prefix.md
[rv105]: rv/0105-write-alias-double-prefix.md
[rv106]: rv/0106-xml-invalid-chars-sent.md
[rv107]: rv/0107-date-year-not-padded.md
[rv108]: rv/0108-doctype-entity-expanded.md
[rv109]: rv/0109-time-of-day-message-range.md
[rv110]: rv/0110-base64-throws-domexception.md
[rv111]: rv/0111-attachment-limit-and-source.md
[rv112]: rv/0112-custom-alias-chars-unchecked.md
[rv113]: rv/0113-tenant-id-and-of-names-unchecked.md
[rv114]: rv/0114-result-codes-unmapped.md
[rv115]: rv/0115-custom-catalog-prefix-unmatched.md
[rv116]: rv/0116-option-count-hint.md
[rv117]: rv/0117-public-constraint-types-unexported.md
[rv118]: rv/0118-required-on-create-untested.md
[rv119]: rv/0119-stale-comments-2026-09-26.md
[rv120]: rv/0120-redirect-hint-generic.md
[rv121]: rv/0121-token-cache-during-load-overwritten.md
[rv122]: rv/0122-unknown-outcome-rewraps-base-error.md
[rv123]: rv/0123-create-nonretryable-unknown-without-hint.md
[rv124]: rv/0124-throttle-window-shift-linear.md
[rv125]: rv/0125-create-many-per-record-302-no-guidance.md
[rv126]: rv/0126-record-id-bigint-typeerror.md
[rv127]: rv/0127-string-id-now-refused-undocumented.md
[rv128]: rv/0128-write-doc-bulk-failure-wording.md
[rv129]: rv/0129-update-many-resend-hint-confusing.md
[rv130]: rv/0130-attachment-resource-id-unchecked.md
[rv131]: rv/0131-bulk-write-unsent-first-batch-may-have.md
[rv132]: rv/0132-padded-empty-nested-record-errors.md
[rv133]: rv/0133-padded-dates-and-attributes.md
[rv134]: rv/0134-early-year-date-message.md
[rv135]: rv/0135-remaining-lenient-number-paths.md
[rv136]: rv/0136-attachment-empty-update.md
[rv137]: rv/0137-generate-field-decls-reserved-const-name.md
[rv138]: rv/0138-tenant-fields-prototype.md
[rv139]: rv/0139-attachment-checks-undocumented.md
[rv140]: rv/0140-attachment-undefined-input-type-error.md
[rv141]: rv/0141-client-options-type-error-paths.md
[rv142]: rv/0142-token-save-cleared-during-store-set.md
