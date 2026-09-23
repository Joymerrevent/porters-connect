# はじめての書き込み

- **前提**: [はじめての読み取り][s3]
- **次に読む**: [本番に出す前に][s5]

このページでは、1 件を作って更新します。書き込みは `create` / `update` と、まとめて書く `createMany` / `updateMany` で、
**`delete` はありません**（PORTERS Connect API に削除が無いからで、型の上でも用意していません。
[削除と削除済みデータ][no-delete]）。一括はこのページの終わりで触れ、詳しくは[書き込み][bulk-write]にあります。
終わると、消せないことが書き方にどう効くか、失敗をどう受け取るかが分かります。

## 作成する

必須項目を渡して、1 件作ります。

```ts
const newId = await t.candidate.create({
  P_Owner: 5, // 担当ユーザーの id。**新規作成では必須**
  P_Name: "山田 太郎",
  P_Mail: "taro@example.com",
});

console.log(newId); // 採番された P_Id
```

`P_Id` は渡しません（新規作成を表す値はライブラリが送ります）。返るのは**採番された id** です。

**必須項目を忘れるとコンパイルが通りません。** 実行して Result Code を見るまでもなく止まります。

<!-- doccheck: expect-error -->

```ts
await t.candidate.create({ P_Name: "山田 太郎" }); // ✗ P_Owner が無い
```

## 更新する

id と、変えたい項目だけを渡します。

```ts
await t.candidate.update(10001, { P_Mail: "new@example.com" });
```

渡した項目だけが更新されます。

**`P_RegistrationDate` / `P_UpdateDate` は書けません**（PORTERS が管理します）。入力型から
外してあるので、書こうとするとコンパイルが通りません。

## 書くときはかたちが変わる

読みで入れ子だったものは、**書くときは id だけ**です。

| 項目の型            | 読むと                             | 書くとき                 |
| ------------------- | ---------------------------------- | ------------------------ |
| `User`（`P_Owner`） | `{ P_Id, P_Type, P_Name, P_Mail }` | **数値の id だけ**       |
| 参照（`P_Client`）  | 参照先の id                        | **参照先の id だけ**     |
| 日時                | ISO 8601                           | ISO 8601（変換して送る） |

日時だけは**送る前に検査されます**。変換できない書式はライブラリが弾きます。

```ts
// PortersConfigError: P_PhaseDate: cannot write "2026/09/10" as DateTime
await t.candidate.update(10001, { P_PhaseDate: "2026-09-10T00:00:00Z" }); // ← これが正しい形
```

他の型はそのまま送って PORTERS に判断させます。**送る前の検査を厳しくしすぎると、PORTERS が受け付ける値を
ライブラリが弾いてしまう**からです。読みと書きで検査の厳しさが違うのは、意図したものです。

## 消せないことが効いてくる

作りすぎても**消せません**。消すには PORTERS の画面で操作するしかありません。そのため、次の 2 点に注意します。

- **二重に作らない工夫が要ります。** ネットワークが不安定なときに「届いたか分からない」まま
  再送すると、2 件できます。ライブラリは `create` を**自動で再送しません**（非冪等なので）。
  判断のしかたは[エラーと再試行][handle-failures]にあります。
- **重複を PORTERS が弾いてくれる場合もあります。** 例えば Process は Job × Resume で一意で、
  重複すると Result Code `301` が返ります。あとから消せない以上、**書けてしまうより弾かれるほうが
  安全**です。

## 200 件を超えるとき

1 リクエストは 200 件までです。`createMany` / `updateMany` は**自動で 200 件ずつに分割**し、
どれが成功してどれが失敗したかを返します（全部成功か全部失敗か、ではありません）。

部分成功の扱いは[書き込み][bulk-write]にあります。

## 失敗したとき

投げられるのは `PortersError` の系統で、`category` で場合分けできます。

```ts
try {
  await t.candidate.create({ P_Owner: 5, P_Name: "山田 太郎" });
} catch (err) {
  if (err instanceof PortersError) {
    console.error(err.category, err.message, err.hint);
  }
}
```

「止めるのか、続けるのか、再送していいのか」は[エラーと再試行][handle-failures]にまとめてあります。

## 次に読む

**[本番に出す前に][s5]** — 動くようになったので、本番に出す前の確認をします。

[bulk-write]: ../topics/write.md
[handle-failures]: ../topics/errors.md
[no-delete]: ../topics/deleted.md
[s3]: first-read.md
[s5]: going-live.md
