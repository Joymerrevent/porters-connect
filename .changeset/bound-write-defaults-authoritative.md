---
"@joymerrevent/porters-connect": minor
---

**アクセサが束ねた項目は、書き込み入力から外れます**（RV-47）。

`t.phase.of("client")` は「このアクセサは企業の Phase を扱う」という宣言です。これまでは
`Resource` を書き込み入力に渡せてしまい、**束ねた値を上書きできました** — `of("client")` から
JOB（`3`）の Phase が書ける状態でした。

```ts
await t.phase.of("client").create({ ResourceId: 20001, Resource: 3 });
//                                                     ^^^^^^^^ 型エラーになります
```

**現実的に踏むのは、読んだレコードを展開して作り直す形**です。

```ts
const phase = (await t.phase.of("client").get(10014))!;
await t.phase.of("client").create({ ...phase, Date: "2026-09-17T00:00:00Z" });
// 読みのレコードは `Resource` を持つため、これまでは束ねた値が黙って上書きされていました
```

型で外したうえ、キャストで渡した場合も**送信前に** `PortersConfigError` で止めます（黙って
捨てません）。Phase に削除 API は無いので、間違ったリソースに付いた履歴は消せません。
