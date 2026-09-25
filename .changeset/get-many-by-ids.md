---
"@joymerrevent/porters-connect": minor
---

**複数の ID でまとめて読む `getMany(ids, { field?, expand?, image? })` を足しました**（Attachment を除くデータ系 11 種と Phase）。戻り値は渡した ID と同じ順の配列で、見つからない ID の位置は `undefined` です。ID は 1 回のリクエストで最大 200 件をまとめて送り、リクエストの長さの上限に収まるように自動で分けます。返ってきたレコードは渡した ID と突き合わせ、渡していない ID のレコードが返ってきたときは何も返さずに `PortersResourceError`（`category: "unknown"`）になります。あわせて、`get(id, { field })` で取得する項目を指定できるようにしました。`get` と `getMany` は、`field` に ID の項目が無くても ID を読みます。
