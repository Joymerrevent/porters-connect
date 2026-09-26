# 契約後に確認する項目（live verification）

PORTERS の挙動のうち、**契約環境が無いと断定できない**仮定をここに集約します。
ライブラリ側は該当箇所に `VERIFY(live)` コメントを置いてあり、grep で双方向に対応付けできます。

```sh
grep -rn "VERIFY(live)" src test
```

確認が取れたら、**コード側のコメントと下記エントリの両方を更新**（「状態」を確定に変え、「確認結果」に実機で得られた事実を記入。必要なら ADR へ昇格、fixture を実データへ差し替え）します。

## サマリー

| #     | 項目                                                     | 状態   |
| ----- | -------------------------------------------------------- | ------ |
| LV-1  | Option 末端 alias の接頭辞                               | 未確認 |
| LV-2  | OptionRoot ラッパーの有無                                | 未確認 |
| LV-3  | Attachment の get 条件                                   | 解消   |
| LV-4  | Attachment Read の既定項目                               | 解消   |
| LV-5  | リソース毎の create 必須項目                             | 確定   |
| LV-6  | Field `P_ReferTo` の入れ子形                             | 未確認 |
| LV-7  | User `current()` の実挙動                                | 未確認 |
| LV-8  | Partition Read の partition 非送信                       | 未確認 |
| LV-9  | 制約違反時の HTTP 応答（長さ/レート）                    | 未確認 |
| LV-10 | System[Reference] Read の入れ子タグ                      | 未確認 |
| LV-11 | Write 失敗時の Result Code（対象なし/200 件超）          | 未確認 |
| LV-12 | Field Read の P_Alias 表記と System 系の Field Type      | 未確認 |
| LV-13 | 1 App トークンで複数 partition を叩けるか                | 未確認 |
| LV-14 | `P_Deleted` の wire 形と出現条件                         | 未確認 |
| LV-15 | `itemstate=existing` を明示送信して受け付けられるか      | 未確認 |
| LV-16 | Candidate 参照を展開するときの alias 接頭辞              | 未確認 |
| LV-17 | Phase の User 項目を `()` 付きで要求できるか             | 未確認 |
| LV-18 | User Read で拡張 13 項目を field に並べられるか          | 未確認 |
| LV-19 | Link の User / Department 応答の入れ子形                 | 未確認 |
| LV-20 | Image のサブタグを field に括弧で並べる記法              | 未確認 |
| LV-21 | Link を condition / order に使えるか                     | 未確認 |
| LV-22 | Image の値を消す書き方                                   | 未確認 |
| LV-23 | レート上限は何単位か（App / 契約 / ホスト）              | 未確認 |
| LV-24 | Attachment Read の必須パラメータ                         | 未確認 |
| LV-25 | Phase Read に keywords / itemstate を送れるか            | 未確認 |
| LV-26 | Option マスタの `P_Alias` は XML Name に収まるか         | 未確認 |
| LV-27 | 複数人を持てる `User` 項目の応答形                       | 未確認 |
| LV-28 | Sales の `※` 依存連鎖が実際にどう判定されるか            | 未確認 |
| LV-29 | `System[Department]` は書けるか・書けるならどの形か      | 未確認 |
| LV-30 | Department Read で 6 項目すべてを `field` に並べられるか | 未確認 |
| LV-31 | 時分型の Read が秒 `00` 以外を返すことがあるか           | 未確認 |
| LV-32 | Write API は `P_Required=1` の項目の欠落を弾くか         | 未確認 |
| LV-33 | データ系の `P_Id` に `or` の条件が効くか                 | 未確認 |
| LV-34 | Read の応答の `Start` は、要求した `start` と同じか      | 未確認 |
| LV-35 | 条件の値の中のコロンは、値の一部として読まれるか         | 未確認 |

---

## LV-1 Option 末端 alias の接頭辞

- **現在の対応 / 仮定**: `Option.` 付き（例 `Option.P_PersonPhase_Applied`）を verbatim 返却
- **不確実な理由**: ライブ Read 例は `Option.P_Tokyo`、旧 fixture は接頭辞なしだった
- **コード箇所**: `src/xml/decode-field.ts`（`decodeOption`）
- **確認方法**: 実 Read レスポンスの `OptionRoot` 子タグ名
- **状態**: 未確認
- **確認結果**: —

## LV-2 OptionRoot ラッパーの有無

- **現在の対応 / 仮定**: あっても無くても動くよう**両対応**
- **不確実な理由**: ライブのテンプレは Root あり・サンプルは Root なし（ADR-0011 で保留）
- **コード箇所**: `src/xml/decode-field.ts`（`decodeOption`）
- **確認方法**: 実 Read に `OptionRoot` が出るか
- **状態**: 未確認
- **確認結果**: —

## LV-3 Attachment の get 条件

- **現在の対応 / 仮定**: ~~`Id:eq=<id>` で 1 件取得~~ → **`?id=<id>`**（出典の専用パラメータ）
- **不確実な理由**: ~~Attachment は接頭辞無し・条件 alias を実機未確認~~
- **コード箇所**: `src/resources/attachment.ts`（`get`）
- **状態**: 解消（[ADR-0081][a81]）
- **確認結果**: **確かめる必要が無くなった。** `condition` を送らなくなったので、
  「`Id:eq` 条件が通るか」という問い自体が消えた。1 件の指定は出典の `id` パラメータで行う
  （通るかどうかは LV-24 に含まれる）

## LV-4 Attachment Read の既定項目

- **現在の対応 / 仮定**: ~~`get` は 6 項目を明示要求~~ → **`field` を送らない**
- **不確実な理由**: ~~`field` 未指定時に `Content` を返すか未確認~~
- **コード箇所**: `src/resources/attachment.ts`（`get`）
- **状態**: 解消（[ADR-0081][a81]）
- **確認結果**: **確かめる必要が無くなった。** 本体の有無は `field` ではなく出典の
  `requestType`（`0` / `1`）で決まるので、「`field` 未指定時に何が返るか」は問いでなくなった

## LV-5 リソース毎の create 必須項目

- **現在の対応 / 仮定**: 各リソースの「新規必須」列どおり型で必須化（ADR-0019 W2）
- **不確実な理由**: 当初は「通常必須」止まりの推測で P_Owner のみにしていた
- **コード箇所**: `src/resources/*.ts`（`REQUIRED_ON_CREATE`）
- **確認方法**: docs/usage/reference `resources/*.md`「新規必須」列
- **状態**: 確定
- **確認結果**: reference で解決（Candidate=`P_Owner`／Job=+`P_Client`,`P_Recruiter`／Client=`P_Owner`／Process=関連6（`P_Client`/`P_Recruiter`/`P_Job`/`P_Candidate`/`P_Resume`）／Resume=+`P_Candidate`）。P_Id は System[Id]＝lib 供給で除外

## LV-6 Field `P_ReferTo` の入れ子形

- **現在の対応 / 仮定**: Option-type は `<Field.P_ReferTo><Option.P_Area/></Field.P_ReferTo>`、空は `<Field.P_ReferTo/>`。Option 値と同形とみなし `decodeOption` で参照 alias を `string[]`（空→null）として返す（[ADR-0022][a22]）
- **不確実な理由**: Reference-type 項目（上位リソース参照）の `P_ReferTo` 入れ子形・複数要素の有無が実機未確認（doc サンプルは Option-type のみ）
- **コード箇所**: `src/resources/field.ts`（`FIELDS.P_ReferTo: "Option"`）
- **確認方法**: 実 Field Read で Option-type / Reference-type の `P_ReferTo` 出力
- **状態**: 未確認
- **確認結果**: —

## LV-7 User `current()` の実挙動

- **現在の対応 / 仮定**: `request_type=0`。`code_direct`（既定）では「ユーザー名＝アプリ名」の User（API アプリ自身）を 1 件返す（[ADR-0022][a22]）
- **不確実な理由**: doc 記述ベースで、実テナントでアプリ User が常に 1 件返るか・複数アプリ時の挙動が未確認
- **コード箇所**: `src/resources/user.ts`（`current`）
- **確認方法**: 実 `user?request_type=0`（code_direct トークン）
- **状態**: 未確認
- **確認結果**: —

## LV-8 Partition Read の partition 非送信

- **現在の対応 / 仮定**: Partition Read は `partition` パラメータを送らない（`request_type` のみ）。doc の Method/Sample に `partition` が無いため（[ADR-0022][a22]）
- **不確実な理由**: 実機で `partition` 無しのまま 200 で通るか未確認（他リソースは必須のため）
- **コード箇所**: `src/resources/partition.ts`（`buildParams`）
- **確認方法**: 実 `partition?request_type=1`（partition 未指定）
- **状態**: 未確認
- **確認結果**: —

## LV-9 制約違反時の HTTP 応答（リクエスト長 / レート超過）

- **現在の対応 / 仮定**: 約 15000 文字超は **HTTP 400 ＋ 非 XML ボディ**（フェイクは `request too long` を返す）。
  レート超過は **強制切断**（`PortersNetworkError`）＝ reference が「HTTP 429 / Retry-After の記載は無い・強制切断され得る」と言うため。
  フェイクは `rateLimit.mode: "http429"` で 429 を返す設定も持つ（もう一方の読み筋を試すため・既定は切断）。
  **月次クォータ（約15万）は「直近30日のローリング窓」** として数える＝暦月リセットかどうかは未確認
- **不確実な理由**: reference は上限値だけを示し、超過時の **HTTP ステータス・ボディ形状を書いていない**（旧 SPEC の「32KB で 400」は陳腐化）。
  月次クォータは API ドキュメントではなく**契約条件**として示されているため、超過時の挙動・集計単位も不明
- **コード箇所**: `test/fake/fake-transport.ts`（サイズガードの 400）／`test/fake/rate-limit.ts`（分・月の窓）／
  ライブラリ側は `src/http/requester.ts`（送信前ガードで到達させない・応答 status の分岐）・
  `src/errors/http-status-error.ts`（`httpStatusCategory` ＝ status→category の写像）・`src/http/throttle.ts`（上限の 90% で自制）
- **確認方法**: 15000 文字超のリクエストを実機に投げてステータス・ボディを記録／1 分あたり上限超のバーストで切断挙動を観測／
  月次クォータ超過時の応答と、カウントのリセット時期を確認
- **状態**: 未確認
- **確認結果**: —
- **関連**: HTTP ステータスをライブラリが見ていない件は [findings][findings] RV-13。
  **ADR-0044（accepted・案A）で status→category の写像を実装済み**＝本 LV の確認結果しだいでは写像を見直す
  （実装に `VERIFY(live)` を残してある）

## LV-10 System[Reference] Read の入れ子タグ

- **現在の対応 / 仮定**: 参照先レコードは `<Field><Reference><P_Id>id</P_Id></Reference></Field>` 相当の**中立なタグ**で表現（`decodeReference` は最初の record 型の子から `P_Id` を読むため通る）
- **不確実な理由**: 実際のタグは**参照先リソース名**（例 `<Candidate>`）のはずだが、Data Type カタログは参照先リソースを持たないため、フェイク側で正しい名前を決められない
- **コード箇所**: `test/fake/wire.ts`（`referenceInner`）／`src/xml/decode-field.ts`（`decodeReference`）
- **確認方法**: `Resume.P_Candidate` 等の実 Read レスポンスで入れ子タグ名と内側の alias（`Candidate.P_Id` か `P_Id` か）を確認
- **状態**: 未確認
- **確認結果**: —

## LV-11 Write 失敗時の Result Code（対象なし / 200 件超）

- **現在の対応 / 仮定**: 更新対象 ID が存在しない → **per-item `<Code>7`**（Resource が存在しない）。1 リクエスト 200 件超 → **ルート `<Code>102`**（パラメータが多すぎ）
- **不確実な理由**: reference は「200 件ずつ分割」とだけ書き、**超過時のコード**も、Write エラーが per-item か**ルート `<Code>`** かも明示していない（成功時の Write 応答にルート `<Code>` は無い）
- **コード箇所**: `test/fake/fake-transport.ts`（`writeItem` / `handleWrite`）／
  ライブラリ側は `src/xml/parse-write-result.ts`（`parseWriteResult` がルート `<Code>` を先読み）
- **確認方法**: 存在しない ID への update・201 件の一括 Write を実機に投げ、応答 XML の形（ルート `<Code>` の有無）とコードを記録
- **状態**: 未確認
- **確認結果**: —
- **関連**: ルート `<Code>` をライブラリが読まない件は [findings][findings] RV-14。
  **ADR-0045（accepted・案A）で「確認を待たず先読みを実装する」と決定し、実装済み**＝本 LV の確認結果次第では
  新 ADR で supersede する（実装には `VERIFY(live)` を残してある）

## LV-12 Field Read の `P_Alias` 表記と System 系の Field Type

- **現在の対応 / 仮定**: フェイクの Field Read は `P_Alias` を**接頭辞つき**（`Person.P_Name`）で返し、
  `P_Type` は [field-data-types][fdt] の Value を使う。Option 系（5/6/7）は代表して **7（Dropdown）**、
  Value が未公開の `System[DateTime]` / `System[Reference]` は **11（System）** を返す
- **不確実な理由**: reference の Field 項目表は Alias の表記例を持たず、System 系サブタイプの Field Type Value も
  公開されていない（Option は 3 サブタイプが同じ Data Type に畳まれる）
- **影響範囲が広がった**（2026-09-10・[ADR-0069][a69] 実装）: 以前はフェイクの都合だけだったが、
  いま `P_Alias` の表記は **利用者に見せる生成物（`generateFieldDecls`）と突合結果（`verifyFields`）の
  正しさ**に効く。**外れても壊れない設計にはしてある**（接頭辞つき・bare の両対応）が、
  確認の価値は上がった。System 系の Value は**宣言できない型**なので、外れても生成・突合は変わらない
- **コード箇所**: `src/porters/field-type.ts`（`FIELD_TYPES`＝Value ↔ Data Type の正典）／
  `src/fields/read-custom-catalog.ts`（`readCustomCatalog`＝`P_Alias` を接頭辞つき・bare の両対応で読む）／
  `test/fake/master-read.ts`（`readField`）
- **確認方法**: 実 `field?resource=1` レスポンスの `Field.P_Alias` と、登録日・参照項目の `Field.P_Type`
- **状態**: 未確認
- **確認結果**: —

## LV-13 1 つの App トークンで複数 partition を叩けるか

- **現在の対応 / 仮定**: **叩ける前提**。`porters.tenant(id)`（[ADR-0040][a40] / F-3）は**同一トークンのまま**
  `partition` クエリだけを差し替える。1 client = 1 トークンで複数テナントを扱える、という仮定の上に立つ実装
- **不確実な理由**: App 登録が App 単位である点は確定だが、**発行されたトークンのアクセス範囲が partition を跨ぐか**は未確認。
  [ADR-0008][a8] は両対応（跨げないなら案3＝テナントごとに専用 client を構築）なので**設計はブロックされない**が、
  `tenant(id)` の使い勝手は結論に左右される
- **コード箇所**: `src/porters-client.ts`（`tenant` / `buildScope`）／`src/accessor/build-read-params.ts`（`buildReadParams` が `partition` をクエリに載せる）
- **確認方法**: アクセス権を付与した 2 つの partition に対し、**同一の Access Token** で Read を投げて両方 200 ＋ `<Code>0`
  が返るか。片方が 403/404 なら案3（テナントごとに client）を推奨経路に格上げする
- **状態**: 未確認
- **確認結果**: —
- **関連**: PRD §8 から移送（2026-08-09）。旧記載は「PoC / ポーターズ確認」

## LV-14 `P_Deleted` の wire 形と出現条件

- **現在の対応 / 仮定**: `<Person.P_Deleted>0</Person.P_Deleted>` の**平文スカラー**で返る前提。
  カタログには **`P_Deleted: null`**（＝ PORTERS が Data Type を与えていない）と載せ、
  decode は**生の文字列**（`"0"` / `"1"`）のまま返す（[ADR-0056][a56]）。
  `field` 省略時の既定リストに入るので、**itemstate に関わらず毎回要求**している
- **不確実な理由**: reference は値の意味（0＝生存 / 1＝削除済み）と
  「Read の field でのみ指定可・Write 不可」だけを書き、**応答 XML の実例を載せていない**。
  Field Type / Data Type 欄がともに「ー」＝ネストの有無を決める型情報が無いので、
  平文である保証は取れていない
- **コード箇所**: `src/xml/decode-field.ts`（`decodeField` の `type === null` 分岐）／
  各カタログの `P_Deleted: null`（`src/resources/{candidate,job,client,process,resume}.ts`）
- **確認方法**: 実機で 3 点。
  1. `field` に `{Prefix}.P_Deleted` を含めた Read の応答 XML — 平文スカラーか、何かにネストするか
  2. **`itemstate` 省略（＝ `existing`）でも返るか**、`deleted` / `all` のときだけ返るか
  3. 値が **`0` / `1` 以外**を取りうるか（空・未設定を含む）
- **状態**: 未確認
- **確認結果**: —
- **関連**: 起票は [findings RV-26][findings]。ネストしていた場合は decode の分岐だけを直す
  （型は `null` のままでよい＝カタログの形は変わらない）。値域が 2 値でなかった場合も同じ

## LV-15 `itemstate=existing` を明示送信して受け付けられるか

- **現在の対応 / 仮定**: **受け付けられる前提**。[ADR-0057][a57]（案A）で、利用者が
  `itemstate: "existing"` と**明示指定したときは省略せず送る**ようにした
  （省略＝`undefined` のときだけサーバーの既定に委ねる）
- **不確実な理由**: reference の Read パラメータ表は `existing`（既定）/ `deleted` / `all` の 3 値を
  **値として明記**しているので仮定とまでは言えない。ただし **`existing` を明示送信した実績はゼロ**で、
  「既定を説明しているだけで、送るのは `deleted` / `all` のみ」という読み方も文面上は否定できない。
  外れたときの形が重く、**`existing` を明示指定した Read が全部 Result Code 133
  （itemstate 値が無効）で落ちる**
- **コード箇所**: `src/accessor/append-read-query.ts`（`appendReadQuery` の itemstate 分岐）
- **確認方法**: `itemstate=existing` を付けた Read を実機に投げ、**HTTP 200 ＋ ルート `<Code>0`** が返り、
  かつ**結果が `itemstate` 無しの Read と一致する**ことを確認する。133 が返るなら案A を撤回して
  [ADR-0038][a38] SD-4 の省略へ戻す（新しい ADR で [ADR-0057][a57] を supersede する）
- **状態**: 未確認
- **確認結果**: —
- **関連**: 削除済み読み取りの系列＝ LV-14（`P_Deleted` の wire 形）。
  この 2 つは**同じスモークでまとめて確認できる**

## LV-16 Candidate 参照を展開するときの alias 接頭辞

- **現在の対応 / 仮定**: **`Person.`** を送る。[ADR-0058][a58]（案D）の `expand` は
  `Process.P_Candidate` / `Resume.P_Candidate` の `()` の中を
  `Person.P_Id` / `Person.P_Name` … と組み立てる（参照先の alias 接頭辞は descriptor が持つ）。
  **実装済み**（0.11.0 予定）で、フェイクサーバーも同じ形で応答する
- **不確実な理由**: reference の例は `field=Job.P_Client(Client.P_Id,Client.P_Name)` ＝
  **接頭辞がリソース名と一致するケースしか示していない**。Candidate は alias 接頭辞が `Person` で
  リソース名と食い違う唯一の例。Field Type 記事が Write について
  「`Person.P_Id` の値のみを指定することができます」と書くので **Read の `()` も `Person.` と推定**しているが、
  Read 側の明示例は無い
- **コード箇所**: `src/accessor/apply-expand.ts`（`expandEntry` — `VERIFY(live)` 済み）・
  `src/resources/candidate.ts`（`prefix: "Person"`）・参照先の登録は各リソースの `REFERENCES`
- **確認方法**: Process Read に `field=Process.P_Candidate(Person.P_Id,Person.P_Name)` を投げ、
  **HTTP 200 ＋ ルート `<Code>0`** と入れ子の値が返ることを確認する。エラーになるなら
  `(Candidate.P_Id,…)` を試し、通ったほうを採る（descriptor の参照先接頭辞を直すだけで済む）
- **状態**: 未確認
- **確認結果**: —
- **関連**: 展開の**応答側**は LV-10（入れ子タグ）。decode はタグ名に依存しない実装なので、
  **外れても直すのは要求文字列だけ**。この 2 つは同じスモークでまとめて確認できる

## LV-17 Phase の User 項目を `()` 付きで要求できるか

- **現在の対応 / 仮定**: **`()` 付きで送る**。`User` 型の項目は汎用 factory が
  `Owner(User.P_Id,User.P_Type,User.P_Name,User.P_Mail)` と組み立てるので、Phase も 13 リソース中の
  1 つとして同じ形になる（[ADR-0061][a61] 案1a ＝ 汎用 factory に載せた結果）
- **不確実な理由**: PORTERS の Phase Read サンプルは **`field=Id,RegisteredBy,RegistrationDate,
UpdatedBy,UpdateDate,Memo,Owner,OwnerDepartment`** と**素の alias だけ**を並べており、
  この resource について `()` 付きの例が無い。応答の形（`<Owner><User><User.P_Id>…`）は
  どちらの要求でも同じなので、**要求が受け付けられるかだけが未確認**
- **コード箇所**: `src/accessor/field-param.ts`（`readFieldEntry` — `User` 型に `()` を付ける）・
  `src/resources/phase.ts`（`VERIFY(live)` 済み）
- **確認方法**: Phase Read に `resource=5&field=Owner(User.P_Id,User.P_Name)` を投げ、
  **HTTP 200 ＋ ルート `<Code>0`** と入れ子の値が返ることを確認する。エラーになるなら
  `field=Owner` と素で送る形に切り替える（`readFieldEntry` に Phase 用の分岐を足すだけで済む）
- **状態**: 未確認
- **確認結果**: —
- **関連**: `System[Department]` の 3 項目は素の alias で要求している（サンプルと同じ形）。
  応答形は 2019-12-10 の機能拡張記事のサンプルで確定しているので、そちらは LV 対象外

## LV-18 User Read で拡張 13 項目を `field` に並べられるか

- **現在の対応 / 仮定**: **並べて送る**。User のカタログは reference の全 17 項目を持ち、`field` 省略時は
  [ADR-0020][a20] どおり**カタログ全項目**を要求する（[ADR-0060][a60] D2）。`User` 型の 2 項目
  （`P_RegisteredBy` / `P_UpdatedBy`）は汎用の組み立てにより `()` 付きになる
- **不確実な理由**: 記事は「`field` に指定できる Field は User - Field List を参照」とし、**本 Parameter は
  HRBC Connect API 3.12.31 以降に利用可能**と但し書きする。指定できること自体は書かれているが、
  **17 項目すべてを 1 度に並べた例は無い**。加えて `User` 型項目の `()` 形は [LV-17][lv17] と同じ未確認点
  （あちらは Phase・こちらは User Read）。なお 13 項目は「Resource API での Read 時に**参照取得**できない」
  とされるもので、これは `Job.P_Owner(User.P_Telephone)` のような**参照経由**の話＝ User Read 自体の制約ではない
- **コード箇所**: `src/resources/user.ts`（`DEFAULT_FIELDS` ＝ カタログ全項目）・
  `src/accessor/field-param.ts`（`readFieldEntry` — `User` 型に `()` を付ける）
- **確認方法**: `GET /v1/user?partition=…&request_type=1&field=<17 項目>` を投げ、**HTTP 200 ＋ ルート
  `<Code>0`** と各項目の値が返ることを確認する。特定の項目で落ちるなら、その項目だけカタログから外すのではなく
  **`DEFAULT_FIELDS` から外して `field` 明示時のみ送る**か、reference の記述を疑って出典を当たり直す
- **状態**: 未確認
- **確認結果**: —
- **関連**: [LV-17][lv17]（`()` 形の可否）／`P_Department` は `System[Department]` で、
  応答形は 2019-12-10 の機能拡張記事のサンプルで確定（LV 対象外）

## LV-19 Link の User / Department 応答の入れ子形

- **現在の対応 / 仮定**: **`User` / `System[Department]` とまったく同じ入れ子**を想定してデコードする。
  スカラなら Contact の ID（数値）、`<User>` があれば `UserRef`、`<Department>` があれば `DepartmentRef`
  （[ADR-0064][a64] 案4a ＝ 形で判別する union）
- **不確実な理由**: reference は Link の値を「Contact の ID、またはユーザー型 / 部署型」とだけ書き、
  **User / Department 形の応答 XML を示していない**。`User` 型・`System[Department]` 型の入れ子形は
  それぞれ確定しているので同じ形だと見ているが、Link 経由でも同じかは未確認
- **コード箇所**: `src/xml/decode-field.ts`（`decodeLink` — `VERIFY(live)` 済み）
- **確認方法**: ユーザー型 / 部署型に設定した Link 項目を持つテナントで Read し、応答 XML を確認する。
  外れていたら `decodeLink` の判別（`"User" in outer` / `"Department" in outer`）を実形に合わせる。
  **判別できない形が来たら `null`** になるので、黙って別の型の値が入ることはない
- **状態**: 未確認
- **確認結果**: —
- **関連**: 入れ子形の出どころは [LV-10][lv10]（System[Reference]）と同系統の未確認点

## LV-20 Image のサブタグを field に括弧で並べる記法

- **現在の対応 / 仮定**: **`field=Resume.U_photo(FileName,Content)`** と、括弧の中に**素のサブタグ名**を
  並べて送る（[ADR-0064][a64] 案2a の `image` オプション）。省略時は素の alias だけを送り、
  PORTERS の既定（`FileName` のみ）に委ねる
- **不確実な理由**: reference は「既定は FileName のみ」「`ContentType` / `Content` は明示」と**散文で**書き、
  Write 形式の側にサブ要素名（`FileName` / `ContentType` / `Content`）があるだけで、
  **Read の `field` にどう書くかのサンプルが無い**。`User` 型の `()` 記法から類推している
- **コード箇所**: `src/accessor/apply-image.ts`（`applyImage` — `VERIFY(live)` 済み）
- **確認方法**: Image 項目を持つテナントで `field=<alias>(FileName,ContentType,Content)` を投げ、
  **HTTP 200 ＋ ルート `<Code>0`** と 3 つのサブタグが返ることを確認する。外れていたら
  `applyImage` の組み立てだけを直す（decode は**返ってきたサブタグを読む**実装なので影響しない）
- **状態**: 未確認
- **確認結果**: —
- **関連**: `()` 記法の可否という点で [LV-17][lv17] と同型

## LV-21 Link を condition / order に使えるか

- **現在の対応 / 仮定**: **どちらにも出さない**（[ADR-0064][a64] 案6a）。condition は Data Type ごとの表
  `ConditionOf` に **`Link: never` と書き下して**あり、order は `OrderableKeys` が列挙なので載っていない
  （ADR-0064 は「両方とも自動的に外れる」と書いているが、condition 側の機構は表引きに変わった。
  決定は同じで、ADR 側にも訂正を注記済み）
- **不確実な理由**: reference は **Image については condition 不可と明記**するが、**Link には記載が無い**。
  一方 Read 概要の演算子表には「Link（ユーザー型/部署型）: `or` / `and`（値は ID のみ）」という行があり、
  **使える可能性がある**。「不可」ではなく「不明」なので、**狭い側に倒してある**
- **コード箇所**: `src/accessor/query.ts`（`ConditionOf` の `Link: never` — `VERIFY(live)` 済み。
  order 側の `OrderableKeys` は列挙なので Link を載せていないだけ）
- **確認方法**: Link 項目に `condition` を付けた Read を投げ、受け付けられるか確認する。
  使えると分かったら `ConditionOf` の `Link` を実際の演算子オブジェクトに差し替える＝**緩めるだけなので後方互換**
- **状態**: 未確認
- **確認結果**: —
- **関連**: Image は reference が不可と明記＝ LV 対象外（確定した制約）

## LV-22 Image の値を消す書き方

- **現在の対応 / 仮定**: **消せない**。`ImageWriteValue` は 3 つのサブ要素すべてを必須にしてあり、
  項目を省略（`null` / `undefined`）すれば**値は変わらない**。テキスト項目の `""` に当たる書き方は用意していない
- **不確実な理由**: reference の Write 形式は `<FieldAlias><FileName/><ContentType/><Content/></FieldAlias>` を
  示すだけで、**空要素を送ると消えるのか・エラーになるのか**を書いていない。推測で「消す」形を用意すると、
  外れたときに**消えたと思って消えていない**（またはその逆）になるので、用意しないほうが安全側
- **コード箇所**: `src/xml/write-value.ts`（`ImageWriteValue` — 3 つとも必須）
- **確認方法**: 空の `<FileName/><ContentType/><Content/>` を書き込み、値が消えるか確認する。
  消えると分かったら「消す」表現（例: `null` とは別の明示的な値）を足す
- **状態**: 未確認
- **確認結果**: —
- **関連**: テキスト項目は `""` で消える（実装済み・確定）

## LV-23 レート上限は何単位か（App / 契約 / ホスト）

- **現在の対応 / 仮定**: 1 分あたりの自制バケットを**ホスト単位**で共有している（[ADR-0073][adr73]）。
  同じホストを向くクライアントは、いくつ作っても 1 つの上限を分け合う
- **不確実な理由**: reference は「1 分あたり Read 2000 / Write 500・超過すると強制切断され得る」と
  書くだけで、**それが App ごとなのか・契約ごとなのか・ホストごとなのか**を書いていない。
  ホストは契約ごとに払い出されるので「ホスト ≒ 契約」と仮定している
- **コード箇所**: `src/http/shared-throttle.ts`（`createThrottleRegistry` / `sharedThrottle`）
- **確認方法**: 同じホストに対して 2 つの App ID で並行に叩き、切断が**合算で**起きるか、
  App ごとに独立して起きるかを見る
- **状態**: 未確認
- **確認結果**: —
- **関連**: 仮定が外れた場合の倒れ方は**安全側**（広く共有＝叩きすぎない）。App 単位だと判明したら、
  鍵にホスト＋App ID を採る改定になる。超過側へは倒れない

## LV-24 Attachment Read の必須パラメータ（`requestType` / `resource`）

- **現在の対応 / 仮定**: **出典どおりに送る**（[ADR-0081][a81]）。`search` / `searchAll` は
  `partition` / `requestType=1` / `resource` [/ `resourceId`] / `count` / `start`、`get` は
  `partition` / `requestType=0` / `resource` / `id`。`field` と `condition` は送らない
- **不確実な理由**: Attachment - Read の Input Variables（[reference の Read パラメータ節][ref-attachment]）は
  2019 年の記事で、**そのとおりに送って通るかを実機で確かめていない**。合わせる前の形
  （`field` / `condition`）も未検証だったので、**未検証の形を、出典に一致する未検証の形に
  置き換えた**のが現状。記事が古ければ、必要のない `of()` の束ねを利用者に強いていることになる
- **コード箇所**: `src/resources/attachment.ts`（`buildAttachmentReadUrl` / `search` / `get`）
- **確認方法**: 実 Read に (1) いまの形、(2) `field` / `condition` を足した形 を投げ、
  どちらが通るか（必須が欠けると Result Code 100 / 101 が返るか）を見る。あわせて
  `requestType=0` が本当に `Content` を載せ、`1` が載せないことを確かめる
- **状態**: 未確認
- **確認結果**: —
- **関連**: 出典に合わせたことで [LV-3][lv3]（`Id:eq` 条件）／[LV-4][lv4]（既定項目）は
  問いごと消えた。倒れ方は**安全側ではない** — 記事が正しければ通り、古ければ通らないので、
  実機で 1 回叩けば必ず分かる（気づけない誤りではない）

## LV-25 Phase Read に `keywords` / `itemstate` を送れるか

- **現在の対応 / 仮定**: **送らない**。Phase の公開型からこの 2 つを外した（[ADR-0076][a76]）。
  汎用 factory に「このエンドポイントは取らないキー」を表す型引数を足し、Phase に適用してある。
  **実行時は素通りのまま**なので、cast すれば送れる（`src/resources/phase.test.ts` に固定）
- **不確実な理由**: Phase - Read の Input Variables は `partition` / `resource` / `resourceId` /
  `id` / `field` / `condition` / `order` / `count` / `start` を挙げ、**`keywords` と `itemstate` を
  挙げていない**（[reference の Read パラメータ節][ref-phase]）。出典どおりなら、渡した呼び出しは
  無視されるか Result Code で弾かれる。**どちらなのかは実機でしか分からない**
- **コード箇所**: `src/resources/phase.ts`（`PhaseSearchQuery` / `PhaseResource`）
- **確認方法**: cast して `keywords=` / `itemstate=` を付けた Read を投げ、結果が変わるか・
  Result Code（100 / 102 / 133 など）が返るかを見る
- **状態**: 未確認
- **確認結果**: —
- **関連**: **受け付けられると分かったら型に戻す**（追加なので非破壊）。弾かれると分かったら
  現状のままでよい。[LV-15][lv15] は `itemstate=existing` を明示送信できるかという別の問い
  （共通語彙の 11 リソースについて）。マトリクスの該当セルは
  [エンドポイント × 機能][coverage] の表 B

## LV-26 Option マスタの `P_Alias` は XML Name の範囲に収まるか

- **現在の対応 / 仮定**: **収まる前提**。[ADR-0085][a85] で、Option の選択肢 alias が
  **XML の `Name` として妥当か**を送信前に検証して弾くようにした。正規の alias はすべて通る、
  という前提の上に立っている
- **不確実な理由**: 選択肢 alias には**出どころが 2 つ**あり、片方にしか保証が無い。
  **Read の応答**から来た値は入れ子タグの名前そのもの（`decodeOption` は `Object.keys` を返す）
  なので、定義上 `Name` である。いっぽう **Option マスタ**（`t.option` の `P_Alias`）は
  **スカラのテキスト**として読まれるので、同じ保証が効かない。
  出典は alias の書式をどこにも定義していない（[LV-1][lv1] は接頭辞すら未確定）ため、
  **テナントが作った選択肢の alias が `Name` から外れうるか**が分からない
- **コード箇所**: `src/util/xml-name.ts`（判定）／`src/xml/assert-tag-name.ts`（`assertTagName`）／
  `src/resources/option.ts`（`P_Alias` を `SinglelineText` として読む側）
- **確認方法**: 実テナントの Option マスタを `t.option.search()` で全件読み、
  `P_Alias` が 1 件残らず `isXmlName` を通るかを確かめる。**記号や空白を含む alias を
  作れるかも併せて見る**（UI 側で作れてしまうなら、その alias を持つレコードは書けない）
- **状態**: 未確認
- **確認結果**: —
- **関連**: 外れた場合、**倒れ方は安全側**（書けないだけで、壊れたデータは送らない）。
  ただし「書けない正規の選択肢がある」ことになるので、そのときは検証の範囲ではなく
  **PORTERS がその alias をどう wire に載せているか**を調べ直す。
  なお [LV-1][lv1] が確定しても本件は解けない（接頭辞の有無と文字集合は別の問い）

## LV-27 複数人を持てる `User` 項目の応答形

- **現在の対応 / 仮定**: **先頭 1 人だけ読む**。`Activity.P_EventParticipants`（参加者）は `User` 型だが、
  UI では複数人を入れられる。decoder は他の `User` 型項目と同じく入れ子の `<User>` を 1 つ読む
  （`src/xml/decode-field.ts` の `decodeUser`）
- **不確実な理由**: 出典は `User` 型の応答形を「`User.P_Id` / `P_Type` / `P_Name` / `P_Mail` の 4 つ」と
  書くだけで、**複数人のときに `<User>` が繰り返されるのか、別の包みが付くのかを書いていない**。
  繰り返すなら現在の実装は**2 人目以降を黙って捨てる**ことになり、
  「値が欠けている」ことが呼び出し側から見えない
- **コード箇所**: `src/resources/activity.ts`（`P_EventParticipants`）／`src/xml/decode-field.ts`（`decodeUser`）
- **確認方法**: 参加者を **2 人以上**入れた Activity を作り、`field=Activity.P_EventParticipants(User.P_Id,…)`
  で読んで応答 XML の生の形を見る。繰り返すなら読み取り値を配列に変えるのが筋
  （`Option` が `string[]` なのと同じ形＝[ADR-0017][a17] の前例がある）
- **状態**: 未確認
- **確認結果**: —
- **関連**: 倒れ方が**安全側ではない**（黙って欠ける）ので、LV のうち優先度は高い。
  配列に変えるのは公開型の変更＝破壊的

## LV-28 Sales の `※` 依存連鎖が実際にどう判定されるか

- **現在の対応 / 仮定**: **型では止めず、PORTERS に判定させる**（[ADR-0083][a83]）。`●`（無条件必須）だけを
  `create` の必須にし、`※`（条件付き必須）は optional のまま送る
- **不確実な理由**: 出典が書く依存連鎖
  （`P_Job` → `P_Recruiter` → `P_Client` ← `P_Contract`、および `P_Candidate` と `P_Resume` は同時指定）は
  **散文だけ**で、違反したときに**どの Result Code が返るか**が書かれていない。
  [ADR-0083][a83] は「PORTERS が調停する」と決めたが、その調停が**判別可能なエラーとして返る**のか、
  **黙って一部だけ書かれる**のかは未確認
- **コード箇所**: `src/resources/sales.ts`（`REQUIRED_ON_CREATE` ＝ `P_Owner` のみ）
- **確認方法**: 連鎖を満たさない組み合わせ（例: `P_Job` だけ指定）で `create` し、
  返る Result Code と、レコードが実際に作られたかを見る
- **状態**: 未確認
- **確認結果**: —
- **関連**: 判別可能なコードが返るなら [ADR-0006][a6] の分類に足せる。
  黙って通るなら [ADR-0083][a83] の前提（PORTERS が調停する）が崩れるので、
  型で止める案（0083 の案B）を再検討する

## LV-29 `System[Department]` は書けるか・書けるならどの形か

- **現在の対応 / 仮定**: **書けないことにしておく**。`WritableDataType` から除外し、公開の Write 入力に
  出さない（[ADR-0061][a61] 案3a の注意）
- **不確実な理由**: PORTERS はこの型を Phase / User で**読み**に出すだけで、
  **書けるのか・書けるとしてどの形（`Department.P_Id`？ `User` と同じ ID のみ？）かを公表していない**。
  推測した形を送るより書けないことにしておくほうが安全側だが、**書けるのに塞いでいる**なら
  機能の欠落になる
- **コード箇所**: `src/xml/write-value.ts`（`WritableDataType` の `Exclude`）
- **確認方法**: `System[Department]` 型の項目（Phase の `OwnerDepartment` 等）に対して、
  `<OwnerDepartment>123</OwnerDepartment>` と `<OwnerDepartment><Department.P_Id>123</Department.P_Id></OwnerDepartment>`
  の両方を cast 経由で送り、Result Code を比べる
- **状態**: 未確認
- **確認結果**: —
- **関連**: 書けると分かったら型に足す（追加なので**非破壊**）。書けないと分かったら現状のままでよい。
  「意図的に塞いだ穴」として[エンドポイント × 機能][coverage]の表に ADR 番号つきで載っている

## LV-30 Department Read で 6 項目すべてを `field` に並べられるか

- **現在の対応 / 仮定**: **並べて送る**。Department のカタログは reference の全 6 項目を持ち、`field`
  省略時は [ADR-0020][a20] どおり**カタログ全項目**を要求する（User の [LV-18][lv18] と同じ形）
- **不確実な理由**: 記事は「指定できる Field は Department - Field List を参照」とするが、サンプルは
  `Department.P_Id,Department.P_Name` の 2 項目だけ。残る 4 項目（`P_Hidden` / `P_SortNo` /
  `P_RegistrationDate` / `P_UpdateDate`）は Field List が「Resource API での Read 時に、参照取得することは
  できません」と注記するもので、これは Link／`User.P_Department` の **参照経由**の話＝ Department Read
  自体の制約ではないと読んでいる（User の拡張 13 項目と同じ読み方）。**6 項目を 1 度に並べた例は無い**
- **コード箇所**: `src/resources/department.ts`（`DEFAULT_FIELDS` ＝ カタログ全項目）
- **確認方法**: `GET /v1/department?partition=…&field=<6 項目>` を投げ、**HTTP 200 ＋ ルート `<Code>0`** と
  各項目の値が返ることを確認する。特定の項目で落ちるなら **`DEFAULT_FIELDS` から外して `field` 明示時のみ
  送る**（カタログからは外さない）
- **状態**: 未確認
- **確認結果**: —
- **関連**: [LV-18][lv18]（User の同型）／ スコープが `user_r` で足りるか（出典の Scope 節は `user_r` だけを
  挙げる）は同じ呼び出しで一緒に分かる

## LV-31 時分型の Read が秒 `00` 以外を返すことがあるか

- **現在の対応 / 仮定**: **秒を落とさない**。`decodeTimeOfDay` は秒が `00` なら `"HH:mm"`、それ以外なら
  `"HH:mm:ss"` を返す（[ADR-0086][a86]）。どちらに転んでも値が欠けない側に倒してある
- **不確実な理由**: 出典（[時分型のお知らせ][src-tod]）は「`[yyyy/mm/dd HH:MM:SS]` の書式で出力されます」と
  秒付きの書式を示すが、画面の入力は時分だけ（00:00〜47:59）。**秒が常に `00` か**は書かれていない。
  常に `00` なら `"HH:mm"` だけを返す単純な契約にできるが、断定せずに保持している
- **コード箇所**: `src/util/time-of-day.ts`（`decodeTimeOfDay` の秒の分岐）
- **確認方法**: 時分型のカスタム項目を持つ環境で、画面から入力した値を Read し、秒が `00` 以外で返る例が
  あるか（API で `1970/01/01 09:00:30` を Write したときに保持されるかも含む）を確かめる
- **状態**: 未確認
- **確認結果**: —
- **関連**: 常に `00` と分かっても契約は変えない（`"HH:mm:ss"` の分岐が単に通らなくなるだけ）。
  `00` 以外があると分かれば、ガイドに「秒が付くことがある」を明記する

## LV-32 Write API は `P_Required=1` の項目の欠落を弾くか

- **現在の対応 / 仮定**: **前提にしない**。テナントが入力必須にした項目（Field Read の `P_Required=1`）は、
  宣言で `required: true` と書いたときだけ `create` の入力型で必須にする（型だけ・実行時の検査はしない）。
  `generateFieldDecls` は `P_Required=1` の項目に `{ required: true }` を出し、`verifyFields` は宣言との
  食い違いを `requiredMismatch` で報告する（[ADR-0089][a89]）
- **不確実な理由**: 出典（[Field の項目][ref-field]）は `P_Required` を「項目の必須設定状態」とだけ書き、
  **Write API がその設定を強制するか**（欠けていたら Result Code で弾くのか、空のまま登録するのか）は
  書かれていない。画面の入力必須と API の検査が同じとは限らない
- **コード箇所**: `src/fields/read-custom-catalog.ts`（`required` を読むところ）
- **確認方法**: カスタム項目を入力必須にした環境で、その項目を渡さずに `create` を送り、Result Code で
  弾かれるか・空のまま登録されるかを確かめる。標準項目の「新規必須」列の `●` と同じ扱いかも見る
- **状態**: 未確認
- **確認結果**: —
- **関連**: どちらに転んでも型の振る舞いは変えない（弾くなら「PORTERS より手前で止める」、弾かないなら
  「PORTERS が止めない欠落を止める」）。変わるのはガイド「カスタム項目」の説明だけ

## LV-33 データ系の `P_Id` に `or` の条件が効くか

- **現在の対応 / 仮定**: **効くと仮定し、効かなければエラーで止める**。`getMany` は ID を `{idAlias}:or=<id>:<id>:…` で
  束ねて読み、返ってきたレコードの ID と応答の `Total` を頼んだ ID と突き合わせる。頼んでいないレコードが混じったら、
  何も返さずに `PortersResourceError` で止める（[ADR-0095][a95]）。`search` の `condition` でも `P_Id: { or }` を書ける
- **不確実な理由**: 出典の記述が割れている。Read - Condition の記事（[Read パラメータ][ref-read]）の `or` の行は
  「Phase API の Id および Resource Id にしか使用できません」と書き、同じ行の例は `Job.P_Id:or=10003:43405`。
  Job Read と Opportunity Read の記事の例も `P_Id:or=1234:1235` で、Job Read の応答例は 2 件とも返している。
  Phase の `Id` は Phase Read の記事が明記している
- **コード箇所**: `src/accessor/read-many.ts`（`recordsById` の突き合わせ）
- **確認方法**: データ系（Candidate など）で `condition=Person.P_Id:or=<存在する ID>:<存在する ID>` を送り、2 件だけが
  返るか（`Total` も 2 か）を確かめる。条件がエラーで返るか、条件を無視して先頭から返るかも見分ける
- **状態**: 未確認
- **確認結果**: —
- **関連**: 効かないと分かったら、`getMany` の送り方を「ID ごとに `get` と同じリクエストを送る」に替える
  （ADR-0095 案1b。公開 API の形は変わらない）。それまでは突き合わせで、誤ったレコードを返さずにエラーになる

## LV-34 Read の応答の `Start` は、要求した `start` と同じか

- **現在の対応 / 仮定**: **同じと仮定し、違えば止める**。`searchAll` はページごとに、応答の `Start` が要求した `start` と
  同じかを確かめ、違えば `PortersResourceError`（`category: "unknown"`）で止める。同じレコードを繰り返し返したり、
  抜かしたりしないため
- **不確実な理由**: reference（[Read パラメータ][ref-read]）は `start` を「取得開始インデックス（0 始まり）」、応答の `Start` を
  「今回の開始インデックス」と書いている。原典の Read 記事のサンプルのうち Candidate / Contract / Activity / Sales の 4 つは、
  要求の URL に `start` が無いのに応答が `Total="12" Count="2" Start="10"` になっている。12 件中 10 件目からの 2 件として数は
  合うので、要求の URL が `start=10` を書き落としたと読んでいるが、確かめてはいない
- **コード箇所**: `src/accessor/paginate.ts`（`paginate`）
- **確認方法**: 201 件以上あるリソースで `count=200&start=200` を送り、応答の `Start` が `200` かを確かめる
- **状態**: 未確認
- **確認結果**: —
- **関連**: 違う値（1 始まりなど）を返すと分かったら、突き合わせる値をそれに合わせる。それまでは、違えば止まる（黙って
  重複や抜けを返さない）

## LV-35 条件の値の中のコロンは、値の一部として読まれるか

- **現在の対応 / 仮定**: **読まれると仮定し、拒否しない**。条件の値のカンマと、`or` / `and` の値の中のコロンは送る前に拒否する
  （区切りとして読まれるため）。テキストと日時の値の中のコロンは拒否せず、そのまま送る
- **不確実な理由**: reference（[Read パラメータ][ref-read]）は `condition=[Alias]:[suffix]=[value]` と書くだけで、値の中のコロンの
  扱いを書いていない。日時の値は `yyyy/mm/dd HH:MM:SS` でコロンを含み、送らないわけにいかないので、PORTERS は最初の `:` で
  区切っているとみている
- **コード箇所**: `src/accessor/append-read-query.ts`（`serializeConditionValue`）
- **確認方法**: テキスト項目に `12:00` を含む値のレコードを用意し、`Person.P_Name:part=12:00` で見つかるかを確かめる。日時の条件
  （`P_UpdateDate:ge=2026/09/26 00:00:00`）が効くかも確かめる
- **状態**: 未確認
- **確認結果**: —
- **関連**: 値の一部として読まれないと分かったら、テキストの値のコロンも送る前に拒否する

## 状態の意味

**3 値。`未確認` だけが「まだやることが残っている」状態**で、残る 2 つはどちらも終端です。

| 状態     | 意味                                                   | コード側の `VERIFY(live)` |
| -------- | ------------------------------------------------------ | ------------------------- |
| `未確認` | 実機で確かめていない。**契約後にやることが残っている** | **必要**（検査が強制）    |
| `確定`   | 実機で確かめ、事実を「確認結果」に書いた               | 外す（`LV-N` 参照は残す） |
| `解消`   | **仮定そのものが無くなった**（ADR で設計が変わった等） | 外す                      |

**`解消` は「確認して合っていた」ではありません。** 確認する対象が消えた、という別の事実です
（例: [LV-3][lv3] / [LV-4][lv4] は [ADR-0081][a81] が Attachment の Read を出典の語彙に直したことで、
確かめるべき仮定そのものが無くなりました）。**どちらも `未確認` には戻らない**ので、
進捗を数えるときは **`未確認` の残数**を見ます（[roadmap][rm] の V5 もその形）。

区別を保つ理由: 混ぜると「実機で裏が取れた」と「設計が変わって無関係になった」が同じ列に見え、
**契約後にどれを確かめるべきかが分からなくなります**。

## 運用

- 新たに「契約しないと確定しない」仮定が出たら、**コードに `VERIFY(live)` コメント**（`LV-N` 参照付き）を置き、エントリを追加する（「確認結果」は `—`）。
- **`VERIFY(live)` には必ず `LV-N` を書く。** 番号の無いマーカーは、対応するエントリが無くても
  気づけない（[RV-50][rv50] で実際に 4 件そうなっていた）。`pnpm check:lv` が両方向を検査する:
  マーカーに番号があるか、`未確認` のエントリが 1 箇所以上から参照されているか。
- 確定しても**エントリは削除しない**。「状態」を `確定` に変え、「確認結果」に実機で得られた事実を記入する。
- 確定したらコード側は通常コメントへ戻す（`VERIFY(live)` トークンは外し、`LV-N` への参照は残してトレースを保つ）。仕様が重い確定は ADR 化し、このエントリからリンクする。

## 関連

- 接地方針: [ADR-0002][a2]（v1 設計を実 PORTERS API ドキュメントに接地）
- XML 内部: [ADR-0011][a11]（接頭辞・ラッパーの揺れは実/サンプル XML を fixture 化して確定する方針）

[findings]: reviews/findings.md
[fdt]: usage/reference/resource-api/field-data-types.md
[a2]: adr/0002-ground-design-in-live-api-docs.md
[a8]: adr/0008-multitenancy-partition.md
[a40]: adr/0040-multitenancy-surface-impl.md
[a11]: adr/0011-xml-parse-serialize.md
[a22]: adr/0022-master-read-query-surface.md
[a69]: adr/0069-tenant-field-catalog-tooling.md
[a38]: adr/0038-read-query-surface-impl.md
[a56]: adr/0056-deleted-flag-typing.md
[a57]: adr/0057-itemstate-existing-explicit.md
[a58]: adr/0058-reference-expansion-read.md
[a61]: adr/0061-phase-resource-surface.md
[a76]: adr/0076-phase-read-query-surface.md
[a20]: adr/0020-read-field-default.md
[a60]: adr/0060-full-resource-coverage-direction.md
[lv17]: #lv-17-phase-の-user-項目を--付きで要求できるか
[lv10]: #lv-10-systemreference-read-の入れ子タグ
[a64]: adr/0064-link-image-types.md
[adr73]: adr/0073-throttle-sharing.md
[a81]: adr/0081-attachment-read-parameters.md
[ref-attachment]: usage/reference/resource-api/resources/attachment.md
[lv3]: #lv-3-attachment-の-get-条件
[lv4]: #lv-4-attachment-read-の既定項目
[ref-phase]: usage/reference/resource-api/resources/phase.md
[lv15]: #lv-15-itemstateexisting-を明示送信して受け付けられるか
[coverage]: design/endpoint-coverage.md
[a85]: adr/0085-option-alias-validation.md
[lv1]: #lv-1-option-末端-alias-の接頭辞
[a6]: adr/0006-error-model.md
[rm]: roadmap.md
[rv50]: reviews/rv/0050-live-verification-traceability-broken.md
[a17]: adr/0017-option-read-shape.md
[a83]: adr/0083-conditionally-required-fields.md
[lv18]: #lv-18-user-read-で拡張-13-項目を-field-に並べられるか
[a86]: adr/0086-time-of-day-fields.md
[src-tod]: https://hrbcapi.porters.jp/hc/ja/articles/60022630729497
[a89]: adr/0089-custom-field-required-on-create.md
[ref-field]: usage/reference/resource-api/resources/field.md
[a95]: adr/0095-get-many-by-ids.md
[ref-read]: usage/reference/resource-api/README.md
