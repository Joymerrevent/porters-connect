---
"@joymerrevent/porters-connect": minor
---

参照型（`System[Reference]`）の項目を展開して読めるようにしました（ADR-0058 / RV-31）。

これまでは `Job.P_Client` のような参照項目から**参照先の ID だけ**を取り出し、
入れ子で返ってきた残りを黙って捨てていました。型付きの `expand` を追加し、
**要求されたものを返せる**ようにしています。

```ts
const page = await t.job.search({ expand: { P_Client: ["P_Id", "P_Name"] } });
page.items[0]?.P_Client; // { P_Id: number | null; P_Name: string | null } | null
```

- 参照先の接頭辞はライブラリが付けます（Candidate なら `Person.`）。
- **`expand` を書いた項目だけ**戻り型が変わります。基底の型は `number | null` のままなので、
  展開を使わないコードは無変更です。
- `search` / `searchAll` / `get(id, { expand })` で使えます。
- 展開できるのは参照先をライブラリが実装している項目だけです
  （`P_Recruiter` とカスタム項目の参照型は対象外＝従来どおり ID として読めます）。
- `field` に `"Job.P_Client(Client.P_Id)"` のような展開文字列を書くと、
  送信前に `PortersConfigError` で止まり `expand` を案内します。

併せて、参照 ID の読み取りを **bare alias 一致**に直しました。入れ子の包みタグはリソース名なのに
中の alias は接頭辞付きで、Candidate（`<Candidate>` に `Person.P_Id`）では従来の照合が外れて
`null` になっていました。

`FieldValue` に `ReferenceRecord`（展開された参照の値）が加わります。
