---
"@joymerrevent/porters-connect": minor
---

アクセスポイントを **`hostname` と `port` に分けた**（ADR-0078）。**`host` は無くなります。**

```ts
// これまで
new PortersClient({ host: "xxxxx.example.com", appId, appSecret });
new PortersClient({ host: "127.0.0.1:4010", scheme: "http" });

// これから
new PortersClient({ hostname: "xxxxx.example.com", appId, appSecret });
new PortersClient({ hostname: "127.0.0.1", port: 4010, scheme: "http" });
```

**契約で渡される値にポートは無い**からです。PORTERS の記事は `{Request Host}` を「該当の
**サーバー名**を入れてください」と説明し、ポート表記はどの記事にも出てきません（scheme も常に
`https`）。一方 URL 仕様では `host` は**ポートを含む**名前で、含まないのが `hostname` です。
名前と中身を揃えました。

- **`hostname` にポートを書くと構築時に落ちます**（`PortersConfigError`）。素通しすると
  「指定したつもりで既定ポートに送られる」ので、黙って落とさずに弾きます
- **`port` は 1〜65535 の整数**。省略すれば scheme の既定ポートです。使うのはローカルの
  フェイクサーバーやプロキシに向けるときだけで、PORTERS には要りません
- **IPv6 は角括弧付き**で渡します（`hostname: "[::1]"`）
- `PortersClient` のゲッターも `host` → **`hostname` / `port`** の 2 本になります
- スロットルのバケット（ADR-0073）は**宛先ごと**になりました。同じ名前でもポートが違えば
  別のバケットです
