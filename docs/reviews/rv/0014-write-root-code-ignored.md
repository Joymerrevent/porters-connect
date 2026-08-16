# RV-14 🟡 Write のルート `<Code>` を読まない

- 重要度: 🟡 ／ 観点: エラーモデル / API 忠実性
- 状態: fixed

## 概要

`parseWriteResult` は `<Item>` だけを読み、ルート直下の `<Code>`（リクエスト単位のエラー）を見ない。Write がリクエストごと失敗した応答（`<Candidate><Code>102</Code></Candidate>` 等）は `<Item>` 0 件となり、単件 write では「write returned no result item」＝ `category: "unknown"`、一括 write では「N results for M records」に化ける。**本当の Result Code が失われる**

## 根拠

`src/xml/parser.ts:89-105`（`parseWriteResult` はルート `<Code>` を参照しない）/ `src/resources/resource.ts:137`（`write returned no result item`）/ `src/resources/bulk-write.ts:149-154`（件数不一致エラー）/ `docs/reference/resource-api/write-format.md`（Write 応答にルート `<Code>` は「無い」とあるが、**エラー時の形は未文書**）

## 検出経緯

RV-13 と同じく [ADR-0043][adr43] phase 1 実装中。なおエラー時のルート `<Code>` の有無自体が未確認のため [live-verification][lv] **LV-11** に登録済み（実機確認が先）

## 推奨

LV-11 の確認結果を待って対応を決める。ルート `<Code>` がありうるなら `parseWriteResult` で先読みし `resourceError(code)` を投げる（Read と対称）。**挙動変更＝要 ADR**

## 処置

[ADR-0045][adr45] を **accepted**（案A＝ルート `<Code>` を常に先読み・decider 2026-08-09）ののち**実装**。
`parseWriteResult` が `<Item>` の走査前にルート `<Code>` を読み、非 0 なら `resourceError(code)` を throw
（Read の `parseResourcePage` と同じ写像・`context.operation: "write"` 付き）。parse 段で throw するため、
単件は `firstWriteResultId` の「no result item」より手前、一括は `runBulkWrite` の件数不一致チェックより手前で表面化する。
成功応答にルート `<Code>` は無く `toInt` が 0 を返すため**成功パスは不変**（ルート `<Code>0` でも通ることをテストで固定）。
`test/fixtures/errors/write-root-102.xml` を追加しフェイクの出力と突き合わせ済み。
**LV-11 は未確認のまま**＝仮定は `VERIFY(live)` で残し、形が違うと判明したら新 ADR で supersede する

[adr43]: ../../adr/0043-local-fake-server.md
[adr45]: ../../adr/0045-write-response-root-code.md
[lv]: ../../live-verification.md
