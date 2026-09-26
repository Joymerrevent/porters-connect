# 103. `create` の応答が Code 302 のときは自動で再送しない

- Status: proposed
- Date: 2026-09-26
- Deciders: jun.shiromoto (Joymerrevent)

> 起票元は `src` 全体のレビュー（2026-09-26）の [RV-78][rv78]。[ADR-0010][adr10] は「`create` の `302` は安全側で
> 非再試行」と決めたが、実装は `302` を再送している。reference の Result Code の表は `302` を「再試行する」としているので、
> 実装を ADR-0010 に合わせるのか、決定を変えるのかを決める。

## Context and Problem Statement

### 3 つの食い違い

| 出どころ                           | `302`（トランザクションエラー / 対象削除済み）の扱い                     |
| ---------------------------------- | ------------------------------------------------------------------------ |
| [ADR-0010][adr10]                  | Read と `update` は再試行。**`create` は安全側で非再試行（surface）**    |
| [result-codes.md][rc]（reference） | 「再試行: する」（操作の種類は区別していない）                           |
| 実装（`src/http/requester.ts`）    | `302` は `transient`。送信済みの `create` でも、通信エラー以外は再送する |

実測（[RV-78][rv78]）: `create` の応答を Code 302 にすると 4 回送った。

### なぜ `create` だけが問題か

`302` の意味は「トランザクションエラー / 対象削除済み」で、`create` が PORTERS 側で登録まで進んだかどうかは、この応答からは分からない。
`update` は同じ内容を何度書いても結果が同じ（冪等）なので再送してよいが、`create` の再送は、登録済みだった場合に重複を作る。
PORTERS には削除 API が無いので、重複は取り消せない。

### 問い

送信済みの `create` が Code 302 を返したとき、自動で再送するか。

## Decision Drivers

- **取り消せない重複を作らない**（フェイルセーフ）。
- **決定と実装を一致させる**: accepted の決定と違う動きを、黙って残さない。
- **reference を尊重する**: reference が再試行を勧めていることを、利用者が判断できる形で渡す。

## Considered Options

- **案A: ADR-0010 のとおり、`create`（非冪等な書き込み）の `302` は再送せず、表に出す**。
- 案B: 決定を変え、reference のとおり `create` の `302` も再送する。
- 案C: `create` の `302` は 1 回だけ再送する。

## Decision Outcome

推奨: **案A**（proposed。decider の判断待ち）。

- `302` の後に `create` が登録済みかは分からないので、再送は重複のおそれを伴う。取り消せない書き込みでは安全側に倒す（ADR-0010 と同じ理由）。
- reference の「再試行する」は操作を区別していない一般の案内で、`create` の冪等性までは述べていない。
- 利用者には、`retryable: false` と「登録された可能性あり。重複を確かめてから再実行を」という hint で届ける。
  送信済みの `create` が通信エラーで失敗したとき（[RV-65][rv65]・ADR-0010 の決定どおりに直す）と同じ届け方にそろえる。

### 決めること（案A）

- 送信済みの非冪等な書き込みでは、`recoveryFor`（`src/http/requester.ts`）が再送してよい Result Code を `9`（未処理が確定）だけにする。
  HTTP 429（処理される前に断られたと分かっている。[ADR-0063][adr63]）の再送は今までどおり。
- `302` を含む、それ以外の「結果が分からない」失敗は、`retryable: false` と hint を持つエラーにして投げる。
- Read と `update`（冪等）は、今までどおり `302` を再送する。

### Consequences

- Good: 取り消せない重複を自動で作らない。ADR-0010 と実装が一致する。
- Bad: 一時的な `302` で `create` が失敗として届く回数が増える。利用者が、重複を確かめてから再実行する手間が増える。
- Neutral: エラーの `category` は変えない（`transient`）。`retryable` は「ライブラリが自動で再送してよいか」ではなく
  「利用者がそのまま再送してよいか」を表すので、この場合は `false` にする。

## 信じている入力

| 値                 | 出どころ             | 誰が書けるか | 守り方                                    | 取れなかったら           | 誤っていたら                                      |
| ------------------ | -------------------- | ------------ | ----------------------------------------- | ------------------------ | ------------------------------------------------- |
| 応答の Result Code | PORTERS              | PORTERS      | 仕組み: 数字だけを受ける（[RV-70][rv70]） | 読めない応答としてエラー | 知らないコードは `unknown` で再送しない           |
| 書き込みの冪等性   | ライブラリの呼び出し | ライブラリ   | 仕組み: `create` は非冪等として送る       | —                        | —                                                 |
| `302` の意味       | reference            | PORTERS      | 散文: reference の表                      | —                        | 実機で `302` 後の登録の有無を確かめたら LV に記録 |

## Pros and Cons of the Options

### 案A

- Good: 重複を作らない。決定と実装が一致する。
- Bad: 回復できたかもしれない `create` を、利用者に返す。

### 案B

- Good: reference の案内どおり。一時的な `302` から自動で回復する。
- Bad: 登録済みだった場合に、取り消せない重複を作る。

### 案C

- Good: 回復の機会を 1 回だけ残す。
- Bad: 重複のおそれは案B と同じで、回数を減らすだけ。

## More Information

- 関連: [ADR-0010][adr10]（この ADR は ADR-0010 の決定を確かめ直すもので、置き換えない）、
  [ADR-0102][adr102]（スロットル）、[RV-65][rv65]、[RV-78][rv78]。

[adr10]: 0010-retry-throttle.md
[adr102]: 0102-throttle-any-minute-window.md
[adr63]: 0063-idempotency-guard-scope.md
[rc]: ../usage/reference/resource-api/result-codes.md
[rv65]: ../reviews/rv/0065-sent-create-failure-retryable.md
[rv70]: ../reviews/rv/0070-response-code-shape-not-checked.md
[rv78]: ../reviews/rv/0078-create-retries-code-302.md
