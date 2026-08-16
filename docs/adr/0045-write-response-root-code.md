# 45. Write 応答のルート `<Code>`（リクエスト単位の失敗）をどう扱うか

- Status: accepted
- Date: 2026-08-09
- Deciders: jun.shiromoto (Joymerrevent)
- Implemented: 0.7.0

> [findings][findings] **RV-14** の是正案。[ADR-0043][adr43] のフェイクサーバー実装中に、
> リクエスト単位で失敗した Write の Result Code が失われることが判明した。
> **ただし「エラー時にルート `<Code>` が出るのか」自体が未確認**（[live-verification][lv] LV-11）。
> **decider が案A を選択し `accepted`（2026-08-09）**＝ LV-11 の確認を待たず先回りで実装する。
> 実装は accept 後・別 PR。

## Context and Problem Statement

Write の成功応答は Read と非対称で、ルートに `Total`/`Count`/`Start` も `<Code>` も**無く**、
`<Item>` ごとに `<Id>` と個別の `<Code>` が返る（[write-format][ref-write]）。実装もその形だけを読む
（`src/xml/parser.ts:89-105`、`parseWriteResult` は `<Item>` のみ走査）。

問題は**リクエストごと失敗した場合**。200 件超・不正な XML・権限不足などで PORTERS が
`<Candidate><Code>102</Code></Candidate>` のような**ルート `<Code>` だけの応答**を返すと、`<Item>` は 0 件になり：

- 単件 write（`create`/`update`）→ `firstWriteResultId` が「write returned no result item」＝ `category: "unknown"`
  （`src/resources/resource.ts:137`）。**本当の Result Code（102 等）が消える**。
- 一括 write（`createMany`/`updateMany`）→ 「N results for M records」の件数不一致エラー
  （`src/resources/bulk-write.ts:149-154`）。同じく原因コードが消える。

一方、**エラー時の応答形は reference に書かれていない**。write-format は成功時の形しか示しておらず、
「エラー時は HTTP 200 以外、または該当 `<Item>` の `<Code>` が 0 以外」とあるだけで、
ルート `<Code>` の有無は不明。フェイクは暫定的にルート `<Code>` を返す実装にしてある（LV-11 として登録済み）。

問い: **`parseWriteResult` はルート `<Code>` を読むべきか。読むとして、`<Item>` が 1 件以上ある場合との優先順位は。
そして「未確認の形」に対してどこまで先回りするか。**

## Decision Drivers

- **接地**（[ADR-0002][adr2]）: reference が黙っている挙動を、確認前に「こうだ」と決め打たない。
- **フェイルセーフ**: 情報を失う（原因コードが消える）方が、多少の推測より有害。ただし**推測で誤分類**するのも有害。
- **エラーモデルの一貫性**（[ADR-0006][adr6]）: Read は既にルート `<Code>`≠0 を `resourceError(code)` に写像している。
  Write だけ非対称な扱いにする合理性があるか。
- **契約が無い現実**: 実機確認は LV-11 待ち。決定を待つ間もフェイクと実装が矛盾しない形にしたい。

## Considered Options

- **案A: ルート `<Code>` を先読みし、非 0 なら Read と同じく `resourceError(code)` を投げる**（推奨）
  `<Item>` の有無に関わらず、まずルート `<Code>` を見る。存在して非 0 ならリクエスト単位の失敗として throw。
  無ければ従来どおり `<Item>` を読む。Read と対称になる。
- **案B: `<Item>` が 0 件のときだけルート `<Code>` を見る**
  成功パスに一切影響しない最小変更。ただし「`<Item>` もあるがルート `<Code>` も非 0」という応答が来た場合に取りこぼす。
- **案C: 現状維持＋メッセージ改善のみ**
  parse は変えず、「write returned no result item」のメッセージに「リクエスト単位で拒否された可能性」を書く。
  LV-11 が確定してから実装する。
- **案D: LV-11 の確認まで `deferred`**
  何もしない。契約取得後に案A/B を選ぶ。

## Decision Outcome

採用: **案A（ルート `<Code>` を常に先読みし、非 0 なら `resourceError(code)` を投げる）**。decider が 2026-08-09 に選択。
**LV-11 の確認を待たず先回りで実装する**（`deferred` は採らない）。

理由: Read 側は既にルート `<Code>` を見て `resourceError` に写像しており、**同じ envelope 族で扱いを変える理由がない**。
ルート `<Code>` が実際には出ないなら案A のコードは単に発火しない（害がない）が、出るなら情報の消失を防げる＝
**外した場合のコストが非対称**（実装しておく方が安全側）。

実装時に守ること（accept 時の合意事項）:

1. **判定順**: `parseWriteResult` はまずルート `<Code>` を見る。**存在して非 0 なら** `resourceError(code)` を throw
   （Read の `parseResourcePage` と同じ写像）。`0` または不在なら従来どおり `<Item>` を読む＝**成功パスは不変**。
2. **単件・一括の両方で効かせる**: 単件は `firstWriteResultId` の「no result item」より**手前**で、
   一括は `runBulkWrite` の件数不一致チェックより**手前**で表面化させる（どちらも本当のコードを失わせない）。
3. **仮定であることを残す**: 実装に `VERIFY(live)` を付け [live-verification][lv] **LV-11** に紐づける
   （accept 時の条件）。エラー時の Write envelope を `test/fixtures/errors/**` に追加し、
   フェイクの出力と突き合わせる（フェーズ4 と同じ方式）。
4. **確認後に形が違ったら新 ADR**: LV-11 の実機確認で応答形が異なると判明した場合、本 ADR は**書き換えず**
   新しい ADR を起こして supersede する（ADR 運用ルール）。
5. **[ADR-0044][adr44] との境界**: 「HTTP 200 以外」は 0044、「HTTP 200 ＋ ルート `<Code>`≠0」は本 ADR。
   両方を満たす応答（200 以外 ＋ envelope）は 0044 の判定順（envelope 優先）に従うため、
   結果として本 ADR の写像が使われる。**実装順序は 0044 → 0045 を推奨**（判定順の土台が先）。

### Consequences

- Good: リクエスト単位の失敗が正しい Result Code ＋ `category` で表面化する（102 → `validation` など）。
  Read と Write でエラー経路の考え方が揃う。
- Bad: 未確認の応答形に対する実装が 1 つ増える（LV-11 が確定するまで「仮定を含むコード」を抱える）。
- Neutral: フェイクは既にこの形を返しているため、accept すれば**テストは既存のまま通る**
  （`test/fake/fake-transport.test.ts` の 102 テストが実クライアント経由でも意味を持つようになる）。

## Pros and Cons of the Options

### 案A: 常にルート `<Code>` を先読み

- Good: Read と対称。情報を失わない。取りこぼしが無い。
- Bad: 成功応答にもルート `<Code>` があった場合（`0`）に無害であることを確認する必要がある。

### 案B: `<Item>` 0 件のときだけ見る

- Good: 成功パスに一切触れない最小差分。
- Bad: 「一部 `<Item>` ＋ ルートエラー」という組み合わせを取りこぼす。非対称な特別扱いが残る。

### 案C: メッセージ改善のみ

- Good: 推測をコードに入れない。すぐできる。
- Bad: 原因コードは依然失われる。利用者は結局ログから推測することになる。

### 案D: `deferred`

- Good: 接地方針に最も忠実。
- Bad: 契約取得の見込みが立たない現状では、問題が長期間放置される。

## More Information

- 出典: [findings][findings] RV-14／[live-verification][lv] **LV-11**（更新対象なしの code・200 件超の code・
  そもそもルート `<Code>` が出るのか）。
- 影響範囲（accept 後の実装 PR）: `src/xml/parser.ts`（`parseWriteResult`）・`src/resources/resource.ts`（`firstWriteResultId`）・
  `src/resources/bulk-write.ts`（件数不一致の前段）・`test/fixtures/errors/**`（Write 版のエラー fixture）。
- 関連: [ADR-0006][adr6]（エラーモデル）／[ADR-0011][adr11]（XML パース）／[ADR-0041][adr41]（一括書き込み）／
  [ADR-0044][adr44]（HTTP ステータス。こちらは「HTTP 200 以外」側の話で、本 ADR は「200 ＋ ルート `<Code>`」側）。

[findings]: ../reviews/findings.md
[lv]: ../live-verification.md
[ref-write]: ../reference/resource-api/write-format.md
[adr2]: 0002-ground-design-in-live-api-docs.md
[adr6]: 0006-error-model.md
[adr11]: 0011-xml-parse-serialize.md
[adr41]: 0041-bulk-write-surface-impl.md
[adr43]: 0043-local-fake-server.md
[adr44]: 0044-http-status-handling.md
