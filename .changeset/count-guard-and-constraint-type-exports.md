---
"@joymerrevent/porters-connect": minor
---

**Read の `count` が範囲外なら送信前に落ちるようになりました**（RV-28）: `count` は PORTERS 上 **1〜200**
（既定 10）ですが、これまでは範囲外の値をそのまま送っており、不透明なサーバー応答に倒れていました。
今後は `PortersConfigError`（`category: "config"` ＋ `searchAll()` を案内する `hint`）で**リクエストの前に**弾きます。
整数でない値（`1.5` など）も同様です。keywords の 100 文字・itemstate の condition 制限・リクエスト長 ~15000 字と
同じ「早く・明確に落とす」系列に揃いました。データ系・マスタ系・Attachment の**すべての Read 経路**に効きます。
`count` を省略した場合の挙動は変わりません（API 既定に委ねます）。

**公開ジェネリクスの制約型を export しました**（RV-30）: `DeclaredCatalogs` / `CustomFor` / `CustomFieldResource` を
追加で公開します。`PortersClient<C>` / `TenantScope<C>` は公開型なのに制約側が非公開で、
クライアントを引数に取るヘルパーの型を**名前で書けません**でした（`typeof porters` での回避のみ）。

```ts
import type { DeclaredCatalogs } from "@joymerrevent/porters-connect";

const withClient = <C extends DeclaredCatalogs>(porters: PortersClient<C>) => {
  /* … */
};
```

型の追加のみで、既存コードへの影響はありません。
