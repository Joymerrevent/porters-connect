---
"@joymerrevent/porters-connect": patch
---

**`itemstate: "existing"` を明示指定したとき、省略せずそのまま送る**ようになりました
（[ADR-0057][adr57]）。**返るデータは変わりません** — 変わるのは送信 URL だけです。

これまでは `existing` が API の既定であることを理由に、明示指定でも param を省いていました。
しかし**省略と明示は別の意思表示**です。

| 指定                    | 意味                         | 送信                 |
| ----------------------- | ---------------------------- | -------------------- |
| 省略                    | PORTERS の既定に委ねる       | （載せない）         |
| `itemstate: "existing"` | **生存レコードのみが欲しい** | `itemstate=existing` |

いま結果が同じなのは「PORTERS の既定が `existing`」だからで、**もし将来この既定が変われば、
生存のみを求めて `existing` と書いたコードに削除済みが混ざり始めます**。例外も Result Code も
出ず、レコードが増えるだけなので気づけません。

明示された指定をそのまま送ることで、既定が変わっても `"existing"` と書いたコードは
**生存のみを受け取り続けます**。省略した場合はこれまでどおり API の既定に従います。

生存のみであることが業務上重要なら、省略せず `itemstate: "existing"` と書いてください。

```ts
// 「生存のみ」を要求する（既定が変わっても効き続ける）
await t.candidate.search({ itemstate: "existing" });

// 既定に委ねる（従来どおり）
await t.candidate.search();
```

なお `itemstate=existing` を実機に送った実績はまだありません（reference には値として明記
されています）。契約後に確認する項目として [live-verification][lv] LV-15 に登録しています。

[adr57]: docs/adr/0057-itemstate-existing-explicit.md
[lv]: docs/live-verification.md
