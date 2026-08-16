# RV-30 🟢 公開ジェネリクスの制約型が未 export

- 重要度: 🟢 ／ 観点: 型安全 / 公開サーフェス
- 状態: open

## 概要

`PortersClient<C extends DeclaredCatalogs>` と `TenantScope<C extends DeclaredCatalogs>` は公開型なのに、
制約の `DeclaredCatalogs` と、メンバ型に現れる `CustomFor` が
**`src/index.ts` から export されていない**。

## 根拠

- `src/index.ts:42-48` — export は `CustomDataType` / `DefinedFields` / `FieldBuilder` /
  `FieldDecls` / `FieldDef` のみ。
- `dist/index.d.ts:724`（`type DeclaredCatalogs`）・`:740`（`type CustomFor`）— **型定義は出力されるが**
  `:904` の export リストには**無い**。
- `src/client.ts:46,93,110` — 公開型の制約に使用している。

## 影響

利用者が**クライアントを引数に取るヘルパーの型を名前で書けない**。

```ts
// これができない
const helper = (porters: PortersClient<DeclaredCatalogs>) => {
  /* … */
};
```

`const porters = new PortersClient({...}); type MyClient = typeof porters;` で回避できるため
実害は小さく 🟢。ただし公開ジェネリクスの制約が名前で参照できないのは、
公開サーフェスとして中途半端（型は出力されているのに使えない）。

## 検出経緯

[2026-08-16-01][run816]。**ビルド成果物 `dist/index.d.ts` の export リストを実際に読んで**確認した。
`src/index.ts` を読むだけでは「型定義は出ているが export されていない」状態は見えない。

## 推奨

`DeclaredCatalogs` / `CustomFor`（必要なら `CustomFieldResource`）を `src/index.ts` に追加する。
**追加のみ＝破壊的でない**（semver minor）。2 行で解消する。

## 処置

—

[run816]: ../2026-08-16-01.md
