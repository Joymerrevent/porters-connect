---
"@joymerrevent/porters-connect": minor
---

**User マスタが reference の全 17 項目を返すようになりました**（ADR-0060 D2）。

これまでカタログは 4 項目（`P_Id` / `P_Type` / `P_Name` / `P_Mail`）だけで、部署・電話・利用開始日・
登録者といった項目は型にも存在せず、読む手段がありませんでした。追加された 13 項目はこちらです。

`P_Department`（`System[Department]` — 入れ子で `P_Id` / `P_Name`）／ `P_Telephone` ／ `P_Mobile` ／
`P_MobileMail` ／ `P_UserName` ／ `P_TimeZone` ／ `P_Language` ／ `P_StartDate` ／ `P_EndDate` ／
`P_RegistrationDate` ／ `P_RegisteredBy` ／ `P_UpdateDate` ／ `P_UpdatedBy`

```ts
const page = await t.user.search();
page.items[0]?.P_Department; // { P_Id: number | null; P_Name: string | null } | null
page.items[0]?.P_StartDate; // ISO 8601（"2026-04-01"）
```

あわせて、**`field` を省略した User Read はカタログの全項目を要求するようになりました**（他のリソースと同じ
既定の扱い）。PORTERS は `field` 省略時に 4 項目しか返さないため、そのままでは型が約束する 13 項目が
黙って `null` になるからです。**4 項目だけで十分な場合は `field` に必要なものだけを並べてください**。
`field: []` は従来どおり「PORTERS 既定の 4 項目に委ねる」意味です。
