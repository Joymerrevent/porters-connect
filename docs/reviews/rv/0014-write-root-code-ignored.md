# RV-14 🟡 Write 応答のルート `<Code>` を読まない

- 重要度: 🟡 ／ 観点: エラーモデル / API 忠実性
- 状態: fixed

## 概要

`parseWriteResult` は `<Item>` だけを読み、**ルート直下の `<Code>`**（リクエスト単位のエラー）を見ない。
Write がリクエストごと失敗した応答（`<Candidate><Code>102</Code></Candidate>` 等）は
`<Item>` 0 件となり、**本当の Result Code が失われる**。

## 根拠

- `src/xml/parser.ts:89-105` — `parseWriteResult` がルート `<Code>` を参照しない。
- `src/resources/resource.ts:137` — 単件 write では「write returned no result item」＝ `category: "unknown"`。
- `src/resources/bulk-write.ts:149-154` — 一括 write では「N results for M records」の件数不一致に化ける。
- `docs/reference/resource-api/write-format.md` — Write 応答にルート `<Code>` は「無い」とあるが、
  **エラー時の形は未文書**。

## 影響

**失敗の理由が消える**のが本質。利用者は Result Code（例: 102 = 200 件超）を見て対処できるはずが、
「結果が無い」「件数が合わない」という**原因と無関係なメッセージ**を受け取る。
書き込みの失敗は業務データに直結するため、診断可能性の欠落は軽くない。
ただし発火条件（リクエスト単位の失敗）が限定的なので 🟡。

## 検出経緯

[RV-13][rv13] と同じく [ADR-0043][adr43] phase 1 の実装中。
フェイクで Write のエラー応答を作ろうとして、「ライブラリはこれをどう読むのか」を確認して判明した。

## 推奨

**エラー時にルート `<Code>` が本当に出るのか自体が未確認**なので、
[live-verification][lv] **LV-11** の確認を先に行う。ありうるなら `parseWriteResult` で先読みし
`resourceError(code)` を投げる（Read と対称）。**挙動変更＝要 ADR**。

## 処置

[ADR-0045][adr45] を **accepted**（案A＝ルート `<Code>` を常に先読み）ののち実装。
`parseWriteResult` が `<Item>` の走査前にルート `<Code>` を読み、非 0 なら `resourceError(code)` を throw する
（Read の `parseResourcePage` と同じ写像・`context.operation: "write"` 付き）。
parse 段で throw するため、単件は `firstWriteResultId` の「no result item」より手前、
一括は `runBulkWrite` の件数不一致チェックより手前で表面化する。

## 検証

- **成功パスは不変**: 成功応答にルート `<Code>` は無く `toInt` が 0 を返すため。
  ルート `<Code>0` でも通ることをテストで固定した。
- `test/fixtures/errors/write-root-102.xml` を追加し、**フェイクサーバーの出力と突き合わせ済み**。
- **LV-11 は未確認のまま**＝仮定は `VERIFY(live)` で残してある。
  形が違うと判明したら新しい ADR で supersede する（仮定の上に実装したことを明示的に追跡）。

[adr43]: ../../adr/0043-local-fake-server.md
[adr45]: ../../adr/0045-write-response-root-code.md
[lv]: ../../live-verification.md
[rv13]: 0013-http-status-ignored.md
