# 書き込みの制約 — ライブラリが弾くもの・PORTERS に委ねるもの

`create` / `update` には、**型で表せる制約**と**サーバーでしか判定できない制約**があります。
このガイドは**その境界**を書きます。「なぜ型が通ったのにエラーになるのか」「なぜここは型で止めないのか」の答えです。

方針は一貫しています — **手前で厳しくしすぎない**。
サーバーが受け付けるものをライブラリが落とすと、利用者には**回避手段がありません**。
サーバーが返すエラーなら型付きの [`PortersError`][error-handling] として受け取り、処置を選べます。
安全側に倒れるのは後者です。

## ライブラリが送信前に弾くもの

型（コンパイル時）か、送信前のガード（実行時）で止まります。

| 何を                             | いつ         | どうなる                                     |
| -------------------------------- | ------------ | -------------------------------------------- |
| 綴り間違い・未宣言の項目         | コンパイル時 | 型エラー（[ADR-0059][adr59]）                |
| **新規必須の項目の欠落**         | コンパイル時 | 型エラー（`create` の入力型が要求する）      |
| Data Type に合わない値           | コンパイル時 | 型エラー                                     |
| リクエスト長 **約 15000 文字**超 | 送信前       | `PortersConfigError`（URL ＋ body の合算）   |
| 一括書き込みの **200 件**超      | 送信前       | 200 件ずつに自動分割（[一括書き込み][bulk]） |
| `count` の範囲外（1–200）        | 送信前       | `PortersConfigError`                         |

## PORTERS に委ねるもの（型では止めません）

**条件付きの必須**や**レコード間の整合性**は、他のレコードの状態に依存するため、
呼び出し時点の型では判定できません。これらは送信し、サーバーの判定を受け取ります。

### Sales — 参照 6 項目の依存関係

`Sales` の `P_Client` / `P_Recruiter` / `P_Job` / `P_Contract` / `P_Candidate` / `P_Resume` は、
リファレンスで **`※`（条件付き必須）** と書かれています。実際の規則は依存の連鎖です。

```text
Sales.P_Job -> Sales.P_Recruiter -> Sales.P_Client <- Sales.P_Contract
（A -> B は「A は B の下位リソース」）
```

- **下位を指定するなら、その上位も同時に指定**する必要があります。
  `P_Job` を指定するなら `P_Recruiter` と `P_Client` も要ります。
- **クリアするときは逆向き**。上位をクリアするなら下位も一緒にクリアします。
- **`P_Candidate` と `P_Resume` は新規登録時に両方**指定し、整合性が検査されます。
  更新で片方だけ指定した場合は、指定した値と**更新前のもう一方の値**で検査されます。

ライブラリの `create` が必須にしているのは **`P_Owner` だけ**です。
6 項目を一律必須にすると、`P_Client` だけを指定する正当な呼び出しまで弾いてしまいます。

### Phase 関連項目の更新

`P_Phase` / `P_PhaseDate` / `P_PhaseMemo` は、**現在の最新フェーズに対する条件**を満たす必要があります
（フェーズ日付が最新より新しいこと、など）。同じフェーズなら上書き、違うフェーズなら追加になります。
新規登録時は既存フェーズが無いため実質制約はありませんが、**フェーズ日付・メモはフェーズとセット**で指定します。

### そのほか

- **Process は Job × Resume の組で一意**です。重複登録は Result Code 301 で返ります。
- **参照先の実在**（`P_Client: 99999` が本当にあるか）は検査しません。

## リソースごとの「新規必須」

型が要求する項目です。`P_Id` はライブラリが供給するため入力型には現れません。

| リソース      | `create` の必須                                                               |
| ------------- | ----------------------------------------------------------------------------- |
| `candidate`   | `P_Owner`                                                                     |
| `job`         | `P_Owner` / `P_Client` / `P_Recruiter`                                        |
| `client`      | `P_Owner`                                                                     |
| `recruiter`   | `P_Owner` / `P_Client`                                                        |
| `contact`     | `P_Owner` / `P_Client`                                                        |
| `opportunity` | `P_Owner` / `P_Client` / `P_Recruiter`                                        |
| `activity`    | `P_Owner` / `P_Title`                                                         |
| `contract`    | **`P_Client` のみ**（このリソースに `P_Owner` は無い）                        |
| `sales`       | `P_Owner` のみ（参照 6 項目は条件付き＝上記）                                 |
| `process`     | `P_Owner` / `P_Client` / `P_Recruiter` / `P_Job` / `P_Candidate` / `P_Resume` |
| `resume`      | `P_Owner` / `P_Candidate`                                                     |
| `phase`       | `ResourceId` のみ（`Id` はライブラリが、`Resource` は `of(...)` が埋める）    |

> **`contract` に `P_Owner` はありません**。他の全リソースが所有者を必須にしているので目を引きますが、
> PORTERS が公表している項目一覧に存在しないためです（無い項目を足していません）。

## 出典・関連

- API 事実: [Write API（XML 形式 / 新規・更新 / Phase）][write-format] ／ [リソース一覧][resources-list]
- エラーの受け取り方: [エラー処理ガイド][error-handling]
- 一括書き込み: [一括書き込みガイド][bulk]
- 決定: [ADR-0041][adr41]（一括書き込み）／[ADR-0045][adr45]（Write 応答のルート `<Code>`）／
  [ADR-0046][adr46]（送信前ガードは reject で届く）
- 契約後に実機確認する項目: [live-verification][lv]（`※` の正確な条件はドキュメント由来で未確認）

[write-format]: ../reference/resource-api/write-format.md
[resources-list]: ../reference/resource-api/resources-list.md
[error-handling]: error-handling.md
[bulk]: bulk-write.md
[adr41]: ../adr/0041-bulk-write-surface-impl.md
[adr45]: ../adr/0045-write-response-root-code.md
[adr46]: ../adr/0046-guard-error-contract.md
[adr59]: ../adr/0059-read-field-bare-alias.md
[lv]: ../live-verification.md
