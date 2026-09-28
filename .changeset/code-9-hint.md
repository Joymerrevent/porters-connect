---
"@joymerrevent/porters-connect": patch
---

**Result Code 9（一時利用不可）のエラーに `hint` を付けました。**

- 再試行しても 9 が続くときに確かめる、呼び出し側の原因を案内します（プロキシが付ける `x-forwarded-for` ヘッダ、Google Apps Script や Cloudflare Workers からの呼び出し）。これまでは `hint` が無く、PORTERS の一時的な不調と見分けがつきませんでした。エラーの `category`（`transient`）と、再試行する挙動は変わりません。
- 使い方のドキュメントに、Number（Currency を含む）の値は小数 2 桁までで、3 桁目以下は PORTERS が切り捨てて保存することを書きました。
