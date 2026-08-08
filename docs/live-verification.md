# 契約後に確認する項目（live verification）

PORTERS の挙動のうち、**契約環境が無いと断定できない**仮定をここに集約します。
ライブラリ側は該当箇所に `VERIFY(live)` コメントを置いてあり、grep で双方向に対応付けできます。

```sh
grep -rn "VERIFY(live)" src test
```

確認が取れたら、**コード側のコメントと下記エントリの両方を更新**（「状態」を確定に変え、「確認結果」に実機で得られた事実を記入。必要なら ADR へ昇格、fixture を実データへ差し替え）します。

## サマリー

| #     | 項目                                            | 状態   |
| ----- | ----------------------------------------------- | ------ |
| LV-1  | Option 末端 alias の接頭辞                      | 未確認 |
| LV-2  | OptionRoot ラッパーの有無                       | 未確認 |
| LV-3  | Attachment の get 条件                          | 未確認 |
| LV-4  | Attachment Read の既定項目                      | 未確認 |
| LV-5  | リソース毎の create 必須項目                    | 確定   |
| LV-6  | Field `P_ReferTo` の入れ子形                    | 未確認 |
| LV-7  | User `current()` の実挙動                       | 未確認 |
| LV-8  | Partition Read の partition 非送信              | 未確認 |
| LV-9  | 制約違反時の HTTP 応答（長さ/レート）           | 未確認 |
| LV-10 | System[Reference] Read の入れ子タグ             | 未確認 |
| LV-11 | Write 失敗時の Result Code（対象なし/200 件超） | 未確認 |

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
  レート超過は **強制切断**（`PortersNetworkError`）＝ reference が「HTTP 429 / Retry-After の記載は無い・強制切断され得る」と言うため
- **不確実な理由**: reference は上限値だけを示し、超過時の **HTTP ステータス・ボディ形状を書いていない**（旧 SPEC の「32KB で 400」は陳腐化）
- **コード箇所**: `test/fake/fake-transport.ts`（サイズガードの 400）／ライブラリ側は `src/http/requester.ts`（送信前ガードで到達させない）
- **確認方法**: 15000 文字超のリクエストを実機に投げてステータス・ボディを記録／1 分あたり上限超のバーストで切断挙動を観測
- **状態**: 未確認
- **確認結果**: —
- **関連**: HTTP ステータスをライブラリが見ていない件は [findings][findings] RV-13

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
- **コード箇所**: `test/fake/fake-transport.ts`（`writeItem` / `handleWrite`）
- **確認方法**: 存在しない ID への update・201 件の一括 Write を実機に投げ、応答 XML の形（ルート `<Code>` の有無）とコードを記録
- **状態**: 未確認
- **確認結果**: —
- **関連**: ルート `<Code>` をライブラリが読まない件は [findings][findings] RV-14

## 運用

- 新たに「契約しないと確定しない」仮定が出たら、**コードに `VERIFY(live)` コメント**（`LV-N` 参照付き）を置き、エントリを追加する（「確認結果」は `—`）。
- 確定しても**エントリは削除しない**。「状態」を `確定` に変え、「確認結果」に実機で得られた事実を記入する。
- 確定したらコード側は通常コメントへ戻す（`VERIFY(live)` トークンは外し、`LV-N` への参照は残してトレースを保つ）。仕様が重い確定は ADR 化し、このエントリからリンクする。

## 関連

- 接地方針: [ADR-0002][a2]（v1 設計を実 PORTERS API ドキュメントに接地）
- XML 内部: [ADR-0011][a11]（接頭辞・ラッパーの揺れは実/サンプル XML を fixture 化して確定する方針）

[findings]: reviews/findings.md
[a2]: adr/0002-ground-design-in-live-api-docs.md
[a11]: adr/0011-xml-parse-serialize.md
[a22]: adr/0022-master-read-query-surface.md
