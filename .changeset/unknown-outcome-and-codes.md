---
"@joymerrevent/porters-connect": minor
---

**結果の分からない `create` の案内を広げ、Result Code の 5 と 113 を分類しました。**

- **送った後の `create` が、Code `1000`（処理失敗）・表に無いコード・HTTP 200 で本文が読めない応答で終わったときも、`hint` に「登録された可能性がある」ことが書かれます。** これまでは、再試行できる失敗（通信の失敗、Code `302` など）のときだけでした。元の `hint` があれば、その後ろに続きます。`retryable` は今までどおり `false` です。
- **Resource の Code `5`（ユーザー ID 無効）と、Authentication の Code `113`（登録アプリのサイトが無い）の `category` が、`unknown` から `auth` になります。** `category` でエラーを振り分けている場合は、振る舞いが変わります。再試行しないことは変わりません。
