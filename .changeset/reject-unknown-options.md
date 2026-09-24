---
"@joymerrevent/porters-connect": minor
---

**（破壊的）`new PortersClient(options)` と `porters.tenant(id, options)` は、定義していないオプションのキーを渡すと `PortersConfigError`（`category: "config"`）になります**。これまでは打ち間違い（`hostName` など）や存在しないオプションを黙って無視していました。値が `undefined` のキーは未指定と同じ扱いです。エラーの `hint` に使えるキーの一覧が出ます。アプリの設定オブジェクトを丸ごと渡している場合は、使うキーだけを取り出して渡してください。あわせて、`PortersClientOptions` の型から `auth` と `fields`（どちらも使えない項目）を外しました。
