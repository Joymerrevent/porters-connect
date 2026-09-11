# 削除 API が無いということ

**PORTERS Connect API には削除がありません。** データも添付も、API から消す方法は提供されていません
（PORTERS 自身が「提供予定なし」と書いています）。

これは制約であると同時に、設計の前提になります。

## `delete()` は生えていません

このライブラリは `delete()` を**型の上でも持ちません**。「実行すると失敗するメソッド」を置くと、
**呼べると思わせてしまう**からです。無い操作は無いままにしてあります。

<!-- doccheck: expect-error -->

```ts
// ✗ そんなメソッドは無い（コンパイルが通らない）
await t.candidate.delete(10001);
```

消す必要があるときは PORTERS の画面で操作します。API の役目ではありません。

## 削除済みのデータは「読める」

消せませんが、**画面で消されたデータは読めます**。`itemstate` で状態を選びます。

| `itemstate` | 読むもの             |
| ----------- | -------------------- |
| `existing`  | 生きているデータ     |
| `deleted`   | **削除済みのデータ** |
| `all`       | 両方                 |

```ts
const gone = await t.candidate.search({ itemstate: "deleted" });
```

削除済みを読むときは**条件が絞られます**。`condition` に使えるのは
**`P_Id` / `P_UpdateDate` / `P_UpdatedBy` の 3 つだけ**で、それ以外を書くと**送信前に弾かれます**
（PORTERS に送れば 400 になるので、待たずに落とします）。

このとき 2 つの項目の意味が変わります。**`P_UpdateDate` は削除された時刻**、
**`P_UpdatedBy` は最後に編集した人**です。加えて PORTERS が
**「更新から 90 日以内」の条件を自動で足します** — つまり古い削除は引けません。

## 省略と `existing` は同じではありません

`itemstate` を**省略する**のと `"existing"` を**明示する**のは、このライブラリでは別の意味です
（[ADR-0057][adr57]）。

- **省略** → 何も送らない。PORTERS 自身の既定（今は `existing`）に任せる
- **`"existing"`** → そう送る。「生きているものだけが欲しい」と明示する

今はどちらも同じ結果ですが、**PORTERS が既定を変えたときに違いが出ます**。生きているデータだけで
なければ困る処理なら、明示しておいてください。

## 削除済みかどうかは `P_Deleted` で分かる

`all` で読むと生きているものと削除済みが混ざります。区別は `P_Deleted` で付けます
（[ADR-0056][adr56]）。

```ts
const page = await t.candidate.search({
  itemstate: "all",
  field: ["P_Id", "P_Name", "P_Deleted"],
});
```

この項目は**変わり者**です。PORTERS が Data Type を与えていないので、**生の文字列**のまま返ります
（`"0"` / `"1"`）。`0` や `false` に変換していないのは、どう変換すべきかを**こちらで決めると
発明になる**からです。

そして `field` でしか使えません。`condition` / `order` / 書き込みでは PORTERS が拒否するので、
**型の上でも書けません**。

> `P_Deleted` の wire 形と出現条件は実機で未確認です（[ライブ検証][lv] LV-14）。
> `field` に明示して読む使い方が、いまのところ最も確実です。

## 設計への影響

削除が無いことは、使い方にいくつか波及します。

- **同じデータを二重に作らない工夫が要ります。** 作ってしまっても消せません。`create` は
  非冪等なので、ライブラリは**結果が不明な場合に自動で再送しません**（[失敗の扱い][handle-failures]）
- **Process は Job × Resume で一意**です。重複して作ろうとすると PORTERS が Result Code `301` を
  返します（消せないので、弾かれるのは親切な側です）
- **テスト環境のデータも消せません。** 契約なしで動かす[フェイクサーバー][fake]が用意してあるのは、
  これも理由の 1 つです

## 関連

- 決定: [ADR-0056][adr56]（`P_Deleted` の型）／[ADR-0057][adr57]（`itemstate` の明示送信）／
  [ADR-0063][adr63]（冪等性ガードの範囲）
- 手順: [検索][search-records]（`itemstate` の指定）／[失敗の扱い][handle-failures]（再送の判断）
- API 事実: [gotchas][gotchas]（削除 API は無い）／[Result Code][codes]（`301` 重複）

[adr56]: ../adr/0056-deleted-flag-typing.md
[adr57]: ../adr/0057-itemstate-existing-explicit.md
[adr63]: ../adr/0063-idempotency-guard-scope.md
[codes]: ../reference/resource-api/result-codes.md
[fake]: ../fake-server-runbook.md
[gotchas]: ../reference/gotchas.md
[handle-failures]: ../howto/handle-failures.md
[lv]: ../live-verification.md
[search-records]: ../howto/search-records.md
