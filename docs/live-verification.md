# 契約後に確認する項目（live verification）

PORTERS の挙動のうち、**契約環境が無いと断定できない**仮定をここに集約します。
ライブラリ側は該当箇所に `VERIFY(live)` コメントを置いてあり、grep で双方向に対応付けできます。

```sh
grep -rn "VERIFY(live)" src test
```

確認が取れたら、**コード側のコメントと下表の両方を更新**（必要なら ADR へ昇格、fixture を実データへ差し替え）します。

## 一覧

| #    | 項目                       | 現在の対応 / 仮定                                                   | 不確実な理由                                                          | コード箇所                             | 確認方法                                   |
| ---- | -------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------ |
| LV-1 | Option 末端 alias の接頭辞 | `Option.` 付き（例 `Option.P_PersonPhase_Applied`）を verbatim 返却 | ライブ Read 例は `Option.P_Tokyo`、旧 fixture は接頭辞なしだった      | `src/xml/decode.ts`（`decodeOption`）  | 実 Read レスポンスの `OptionRoot` 子タグ名 |
| LV-2 | OptionRoot ラッパーの有無  | あっても無くても動くよう**両対応**                                  | ライブのテンプレは Root あり・サンプルは Root なし（ADR-0011 で保留） | `src/xml/decode.ts`（`decodeOption`）  | 実 Read に `OptionRoot` が出るか           |
| LV-3 | Attachment の get 条件     | `Id:eq=<id>` で 1 件取得                                            | Attachment は接頭辞無し・条件 alias を実機未確認                      | `src/resources/attachment.ts`（`get`） | 実 Read で `Id` 条件が通るか               |
| LV-4 | Attachment Read の既定項目 | `get` は 6 項目を明示要求                                           | `field` 未指定時に `Content` を返すか未確認                           | `src/resources/attachment.ts`（`get`） | `field` 未指定時の出力                     |

## 運用

- 新たに「契約しないと確定しない」仮定が出たら、**コードに `VERIFY(live)` コメント**（`LV-N` 参照付き）を置き、この表に 1 行追加する。
- 確定したら表から削除し、コメントを通常コメントへ。仕様が重いものは ADR 化する。

## 関連

- 接地方針: [ADR-0002][a2]（v1 設計を実 PORTERS API ドキュメントに接地）
- XML 内部: [ADR-0011][a11]（接頭辞・ラッパーの揺れは実/サンプル XML を fixture 化して確定する方針）

[a2]: adr/0002-ground-design-in-live-api-docs.md
[a11]: adr/0011-xml-parse-serialize.md
