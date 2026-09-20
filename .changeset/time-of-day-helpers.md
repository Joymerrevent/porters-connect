---
"@joymerrevent/porters-connect": minor
---

時分型（PORTERS 9.3.0）の項目を扱う変換関数 `decodeTimeOfDay` / `encodeTimeOfDay` を追加しました（[ADR-0086]）。

時分型は時刻だけ（`00:00`〜`47:59`）を持つカスタム項目ですが、API 上は年月日時分型と同じ
`DateTime`（Field Type 12）で、`1970/01/01` を基準日にした日時として運ばれます（`26:00` は
`1970/01/02 02:00:00`）。Field Read からも区別できないため、ライブラリは**型を増やさず**、
時分型の項目も `f.dateTime()` のまま宣言して ISO で読み書きします。基準日の規則は、
その項目が時分型だと知っているところで変換関数に任せます。

```ts
const job = await t.job.get(1);
const start =
  job?.U_startTime == null ? null : decodeTimeOfDay(job.U_startTime); // "09:00"
await t.job.update(1, { U_startTime: encodeTimeOfDay("26:00") }); // → 1970/01/02 02:00:00
await t.job.search({
  condition: { U_startTime: { ge: encodeTimeOfDay("15:00") } },
});
```

- `encodeTimeOfDay` は `"HH:mm"` / `"HH:mm:ss"`（00:00〜47:59）以外を `PortersConfigError`
  （`category: "validation"`）で**送る前に**止めます（PORTERS の Code 103 / Code 100 を手前で）。
- `decodeTimeOfDay` は基準日以外の ISO を同じエラーで止めます（その項目はたぶん時分型ではない、
  というヒント付き）。秒が `00` でなければ `"HH:mm:ss"` で保持します。
- `generateFieldDecls` は Field Type 12 の行に「時分型なら変換関数を」の注記を出すようになりました。
- 既存の型・宣言・読み書きは変わりません。変換を呼ぶかどうかは利用者の責務です。

[ADR-0086]: https://github.com/Joymerrevent/porters-connect/blob/main/docs/adr/0086-time-of-day-fields.md
