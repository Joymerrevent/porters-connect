# 4. はじめての書き込み

- **前提**: [3. はじめての読み取り][s3]
- **次に読む**: [5. 本番に出す前に][s5]

書き込みは `create` と `update` の 2 つだけです。**`delete` はありません** — PORTERS Connect API
に削除が無いからで、型の上でも生やしていません（[削除 API が無いということ][no-delete]）。

## 作る

```ts
const newId = await t.candidate.create({
  P_Owner: 5, // 担当ユーザーの id。**新規作成では必須**
  P_Name: "山田 太郎",
  P_Mail: "taro@example.com",
});

console.log(newId); // 採番された P_Id
```

`P_Id` は渡しません（ライブラリが新規作成の印を送ります）。返るのは**採番された id** です。

**必須項目を忘れるとコンパイルが通りません。** 実行して Result Code を見るまでもなく止まります。

<!-- doccheck: expect-error -->

```ts
await t.candidate.create({ P_Name: "山田 太郎" }); // ✗ P_Owner が無い
```

## 更新する

```ts
await t.candidate.update(10001, { P_Mail: "new@example.com" });
```

渡した項目だけが更新されます。

**`P_RegistrationDate` / `P_UpdateDate` は書けません**（PORTERS が管理します）。入力型から
外してあるので、書こうとするとコンパイルが通りません。

## 書くときは形が変わる

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

他の型は素通しして PORTERS に判断させます。**手前で厳しくしすぎると、サーバーが受け付ける値を
ライブラリが落としてしまう**からです。この非対称は意図したものです。

## 消せないことが効いてくる

作りすぎても**消せません**。画面で消すしかありません。だから:

- **二重に作らない工夫が要ります。** ネットワークが不安定なときに「届いたか分からない」まま
  再送すると、2 件できます。ライブラリは `create` を**自動で再送しません**（非冪等なので）。
  判断のしかたは[失敗の扱い][handle-failures]にあります。
- **重複を PORTERS が弾いてくれる場合もあります。** 例えば Process は Job × Resume で一意で、
  重複すると Result Code `301` が返ります。消せない世界では、弾かれるのは親切な側です。

## 200 件を超えるとき

1 リクエストは 200 件までです。`createMany` / `updateMany` は**自動で 200 件ずつに分割**し、
どれが成功してどれが失敗したかを返します（全部成功か全部失敗か、ではありません）。

部分成功の扱いは[一括書き込み][bulk-write]にあります。

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

「落とすのか、続けるのか、再送していいのか」は[失敗の扱い][handle-failures]にまとめてあります。

## 次に読む

**[5. 本番に出す前に][s5]** — 動くようになったので、本番に出す前の確認をします。

[bulk-write]: ../howto/bulk-write.md
[handle-failures]: ../howto/handle-failures.md
[no-delete]: ../concepts/no-delete.md
[s3]: first-read.md
[s5]: going-live.md
