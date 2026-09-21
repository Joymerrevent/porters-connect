---
"@joymerrevent/porters-connect": patch
---

`decodeTimeOfDay` が**時計の範囲にない時・分・秒**を通していたのをやめ、`encodeTimeOfDay` と同じく
`PortersConfigError`（`category: "validation"`）で止めるようにしました（RV-55）。

基準日（`1970-01-01` / `1970-01-02`）は見ていましたが、時・分・秒は 2 桁かどうかしか見ていなかったため、
`"1970-01-01T30:00:00Z"` を `"30:00"` として返し、それを `encodeTimeOfDay` に戻すと
`"1970-01-02T06:00:00Z"`＝**入力と別の値**になっていました。

```ts
decodeTimeOfDay("1970-01-01T30:00:00Z"); // PortersConfigError（以前は "30:00"）
decodeTimeOfDay("1970-01-01T09:60:00Z"); // PortersConfigError（以前は "09:60"）
decodeTimeOfDay("1970-01-02T02:00:00Z"); // "26:00"（変わらず）
```

- 時は各基準日で `00`〜`23`、分と秒は `00`〜`59`。それ以外は基準日違いと同じエラーで止まります。
- Read で得た ISO をそのまま渡しているコードは無変更です（ライブラリの日時 decode がそもそも
  不正な時分を通さないため）。エラーになるのは、手で組み立てた ISO を渡していた場合だけです。
