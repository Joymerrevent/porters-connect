---
"@joymerrevent/porters-connect": minor
---

Department マスタの Read（`t.department`）を追加しました。

PORTERS Connect API 8.2.1（2025/03）で足された **Department - Read** を、2026-09-20 の出典再取得で
取りこぼしていたことが分かり、実装しました。ユーザー部署型（Link）項目や `User.P_Department` が
指す部署を、Partition 単位で一覧できます。

```ts
const t = porters.tenant(123);
const page = await t.department.search(); // { total, count, start, items }
for await (const d of t.department.searchAll()) {
  d.P_Id;
  d.P_Name;
  d.P_Hidden;
  d.P_SortNo;
  d.P_RegistrationDate;
  d.P_UpdateDate;
}
```

- **読み取り専用**。PORTERS に Write API はありません（お知らせ記事が「read のみ」と明記）。
- クエリは `field` / `count` / `start` だけ。`condition` / `get(id)` / `request_type` はありません
  （出典が挙げないものは公開しない — 他のマスタと同じ）。
- **スコープは `user_r`** です。PORTERS は `department_r` を定義していません。
- `field` 省略時は 6 項目すべてを要求します（省略すると PORTERS は `P_Id` しか返さないため）。
  Link 参照からは読めない `P_Hidden` / `P_SortNo` / 登録日 / 更新日も、ここでは読めます。
- 型は `Department` / `DepartmentPage` / `DepartmentSearchQuery` / `DepartmentResource` を公開します。

フェイクサーバー（`createFakeTransport` / `pnpm fake:serve`）にも `departments` オプションと
`/v1/department` を足しました。
