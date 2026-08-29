# 契約後に確認する項目（live verification）

PORTERS の挙動のうち、**契約環境が無いと断定できない**仮定をここに集約します。
ライブラリ側は該当箇所に `VERIFY(live)` コメントを置いてあり、grep で双方向に対応付けできます。

```sh
grep -rn "VERIFY(live)" src test
```

確認が取れたら、**コード側のコメントと下記エントリの両方を更新**（「状態」を確定に変え、「確認結果」に実機で得られた事実を記入。必要なら ADR へ昇格、fixture を実データへ差し替え）します。

## サマリー

| #     | 項目                                                | 状態   |
| ----- | --------------------------------------------------- | ------ |
| LV-1  | Option 末端 alias の接頭辞                          | 未確認 |
| LV-2  | OptionRoot ラッパーの有無                           | 未確認 |
| LV-3  | Attachment の get 条件                              | 未確認 |
| LV-4  | Attachment Read の既定項目                          | 未確認 |
| LV-5  | リソース毎の create 必須項目                        | 確定   |
| LV-6  | Field `P_ReferTo` の入れ子形                        | 未確認 |
| LV-7  | User `current()` の実挙動                           | 未確認 |
| LV-8  | Partition Read の partition 非送信                  | 未確認 |
| LV-9  | 制約違反時の HTTP 応答（長さ/レート）               | 未確認 |
| LV-10 | System[Reference] Read の入れ子タグ                 | 未確認 |
| LV-11 | Write 失敗時の Result Code（対象なし/200 件超）     | 未確認 |
| LV-12 | Field Read の P_Alias 表記と System 系の Field Type | 未確認 |
| LV-13 | 1 App トークンで複数 partition を叩けるか           | 未確認 |
| LV-14 | `P_Deleted` の wire 形と出現条件                    | 未確認 |
| LV-15 | `itemstate=existing` を明示送信して受け付けられるか | 未確認 |
| LV-16 | Candidate 参照を展開するときの alias 接頭辞         | 未確認 |

---

## LV-1 Option 末端 alias の接頭辞

- **現在の対応 / 仮定**: `Option.` 付き（例 `Option.P_PersonPhase_Applied`）を verbatim 返却
- **不確実な理由**: ライブ Read 例は `Option.P_Tokyo`、旧 fixture は接頭辞なしだった
- **コード箇所**: `src/xml/decode.ts`（`decodeOption`）
- **確認方法**: 実 Read レスポンスの `OptionRoot` 子タグ名
- **状態**: 未確認
- **確認結果**: —

## LV-2 OptionRoot ラッパーの有無

- **現在の対応 / 仮定**: あっても無くても動くよう**両対応**
- **不確実な理由**: ライブのテンプレは Root あり・サンプルは Root なし（ADR-0011 で保留）
- **コード箇所**: `src/xml/decode.ts`（`decodeOption`）
- **確認方法**: 実 Read に `OptionRoot` が出るか
- **状態**: 未確認
- **確認結果**: —

## LV-3 Attachment の get 条件

- **現在の対応 / 仮定**: `Id:eq=<id>` で 1 件取得
- **不確実な理由**: Attachment は接頭辞無し・条件 alias を実機未確認
- **コード箇所**: `src/resources/attachment.ts`（`get`）
- **確認方法**: 実 Read で `Id` 条件が通るか
- **状態**: 未確認
- **確認結果**: —

## LV-4 Attachment Read の既定項目

- **現在の対応 / 仮定**: `get` は 6 項目を明示要求
- **不確実な理由**: `field` 未指定時に `Content` を返すか未確認
- **コード箇所**: `src/resources/attachment.ts`（`get`）
- **確認方法**: `field` 未指定時の出力
- **状態**: 未確認
- **確認結果**: —

## LV-5 リソース毎の create 必須項目

- **現在の対応 / 仮定**: 各リソースの「新規必須」列どおり型で必須化（ADR-0019 W2）
- **不確実な理由**: 当初は「通常必須」止まりの推測で P_Owner のみにしていた
- **コード箇所**: `src/resources/*.ts`（`REQUIRED_ON_CREATE`）
- **確認方法**: docs/reference `resources/*.md`「新規必須」列
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
- **コード箇所**: `src/resources/partition.ts`（`buildUrl`）
- **確認方法**: 実 `partition?request_type=1`（partition 未指定）
- **状態**: 未確認
- **確認結果**: —

## LV-9 制約違反時の HTTP 応答（リクエスト長 / レート超過）

- **現在の対応 / 仮定**: 約 15000 文字超は **HTTP 400 ＋ 非 XML ボディ**（フェイクは `request too long` を返す）。
  レート超過は **強制切断**（`PortersNetworkError`）＝ reference が「HTTP 429 / Retry-After の記載は無い・強制切断され得る」と言うため。
  フェイクは `rateLimit.mode: "http429"` で 429 を返す設定も持つ（もう一方の読み筋を試すため・既定は切断）。
  **月次クォータ（約15万）は「直近30日のローリング窓」**として数える＝暦月リセットかどうかは未確認
- **不確実な理由**: reference は上限値だけを示し、超過時の **HTTP ステータス・ボディ形状を書いていない**（旧 SPEC の「32KB で 400」は陳腐化）。
  月次クォータは API ドキュメントではなく**契約条件**として示されているため、超過時の挙動・集計単位も不明
- **コード箇所**: `test/fake/fake-transport.ts`（サイズガードの 400）／`test/fake/rate-limit.ts`（分・月の窓）／
  ライブラリ側は `src/http/requester.ts`（送信前ガードで到達させない・応答 status の分岐）・
  `src/errors/classify.ts`（`httpStatusCategory` ＝ status→category の写像）・`src/http/throttle.ts`（上限の 90% で自制）
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
- **コード箇所**: `test/fake/wire.ts`（`referenceInner`）／`src/xml/decode.ts`（`decodeReference`）
- **確認方法**: `Resume.P_Candidate` 等の実 Read レスポンスで入れ子タグ名と内側の alias（`Candidate.P_Id` か `P_Id` か）を確認
- **状態**: 未確認
- **確認結果**: —

## LV-11 Write 失敗時の Result Code（対象なし / 200 件超）

- **現在の対応 / 仮定**: 更新対象 ID が存在しない → **per-item `<Code>7`**（Resource が存在しない）。1 リクエスト 200 件超 → **ルート `<Code>102`**（パラメータが多すぎ）
- **不確実な理由**: reference は「200 件ずつ分割」とだけ書き、**超過時のコード**も、Write エラーが per-item か**ルート `<Code>`** かも明示していない（成功時の Write 応答にルート `<Code>` は無い）
- **コード箇所**: `test/fake/fake-transport.ts`（`writeItem` / `handleWrite`）／
  ライブラリ側は `src/xml/parser.ts`（`parseWriteResult` がルート `<Code>` を先読み）
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
- **コード箇所**: `test/fake/master-read.ts`（`FIELD_TYPE_VALUE` / `readField`）
- **確認方法**: 実 `field?resource=1` レスポンスの `Field.P_Alias` と、登録日・参照項目の `Field.P_Type`
- **状態**: 未確認
- **確認結果**: —

## LV-13 1 つの App トークンで複数 partition を叩けるか

- **現在の対応 / 仮定**: **叩ける前提**。`porters.tenant(id)`（[ADR-0040][a40] / F-3）は**同一トークンのまま**
  `partition` クエリだけを差し替える。1 client = 1 トークンで複数テナントを扱える、という仮定の上に立つ実装
- **不確実な理由**: App 登録が App 単位である点は確定だが、**発行されたトークンのアクセス範囲が partition を跨ぐか**は未確認。
  [ADR-0008][a8] は両対応（跨げないなら案3＝テナントごとに専用 client を構築）なので**設計はブロックされない**が、
  `tenant(id)` の使い勝手は結論に左右される
- **コード箇所**: `src/client.ts`（`tenant` / `buildScope`）／`src/resources/resource.ts`（`partition` をクエリに載せる）
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
- **コード箇所**: `src/xml/decode.ts`（`decodeField` の `type === null` 分岐）／
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
- **コード箇所**: `src/resources/query.ts`（`appendReadQuery` の itemstate 分岐）
- **確認方法**: `itemstate=existing` を付けた Read を実機に投げ、**HTTP 200 ＋ ルート `<Code>0`** が返り、
  かつ**結果が `itemstate` 無しの Read と一致する**ことを確認する。133 が返るなら案A を撤回して
  [ADR-0038][a38] SD-4 の省略へ戻す（新しい ADR で [ADR-0057][a57] を supersede する）
- **状態**: 未確認
- **確認結果**: —
- **関連**: 削除済み読み取りの系列＝ LV-14（`P_Deleted` の wire 形）。
  この 2 つは**同じスモークでまとめて確認できる**

## LV-16 Candidate 参照を展開するときの alias 接頭辞

- **現在の対応 / 仮定**: **`Person.`** を送る前提。[ADR-0058][a58]（案D）で `System[Reference]` の
  展開（`expand`）を実装するとき、`Process.P_Candidate` / `Resume.P_Candidate` の `()` の中は
  `Person.P_Id` / `Person.P_Name` … と組み立てる（参照先の alias 接頭辞は descriptor が持つ）
- **不確実な理由**: reference の例は `field=Job.P_Client(Client.P_Id,Client.P_Name)` ＝
  **接頭辞がリソース名と一致するケースしか示していない**。Candidate は alias 接頭辞が `Person` で
  リソース名と食い違う唯一の例。Field Type 記事が Write について
  「`Person.P_Id` の値のみを指定することができます」と書くので **Read の `()` も `Person.` と推定**しているが、
  Read 側の明示例は無い
- **コード箇所**: `src/resources/resource.ts`（`expand` の field 組み立て）・`src/resources/candidate.ts`（`prefix: "Person"`）
- **確認方法**: Process Read に `field=Process.P_Candidate(Person.P_Id,Person.P_Name)` を投げ、
  **HTTP 200 ＋ ルート `<Code>0`** と入れ子の値が返ることを確認する。エラーになるなら
  `(Candidate.P_Id,…)` を試し、通ったほうを採る（descriptor の参照先接頭辞を直すだけで済む）
- **状態**: 未確認
- **確認結果**: —
- **関連**: 展開の**応答側**は LV-10（入れ子タグ）。decode はタグ名に依存しない実装なので、
  **外れても直すのは要求文字列だけ**。この 2 つは同じスモークでまとめて確認できる

## 運用

- 新たに「契約しないと確定しない」仮定が出たら、**コードに `VERIFY(live)` コメント**（`LV-N` 参照付き）を置き、エントリを追加する（「確認結果」は `—`）。
- 確定しても**エントリは削除しない**。「状態」を `確定` に変え、「確認結果」に実機で得られた事実を記入する。
- 確定したらコード側は通常コメントへ戻す（`VERIFY(live)` トークンは外し、`LV-N` への参照は残してトレースを保つ）。仕様が重い確定は ADR 化し、このエントリからリンクする。

## 関連

- 接地方針: [ADR-0002][a2]（v1 設計を実 PORTERS API ドキュメントに接地）
- XML 内部: [ADR-0011][a11]（接頭辞・ラッパーの揺れは実/サンプル XML を fixture 化して確定する方針）

[findings]: reviews/findings.md
[fdt]: reference/resource-api/field-data-types.md
[a2]: adr/0002-ground-design-in-live-api-docs.md
[a8]: adr/0008-multitenancy-partition.md
[a40]: adr/0040-multitenancy-surface-impl.md
[a11]: adr/0011-xml-parse-serialize.md
[a22]: adr/0022-master-read-query-surface.md
[a38]: adr/0038-read-query-surface-impl.md
[a56]: adr/0056-deleted-flag-typing.md
[a57]: adr/0057-itemstate-existing-explicit.md
[a58]: adr/0058-reference-expansion-read.md
