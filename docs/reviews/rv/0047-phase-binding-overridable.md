# RV-47 🟡 `t.phase.of()` の束ねを、呼び出し側が上書きできる

- 重要度: 🟡 ／ 観点: フェイルセーフ / 型安全
- 状態: open

## 概要

`t.phase.of("client")`（Client = `5`）で束ねたアクセサから、**Job（`3`）の Phase が書ける**。
[ADR-0061][adr61] 案2a が約束したのは「`resource` を**忘れられない**」ことで、
「**矛盾させられない**」は達成できていなかった。

## 根拠

実測（2026-09-16）。

```ts
await t.phase.of("client").create({ ResourceId: 20001, Resource: 3 });
// <Phase><Item><Resource>3</Resource><ResourceId>20001</ResourceId><Id>-1</Id></Item></Phase>
await t.phase.of("client").update(10014, { Resource: 3 });
// <Phase><Item><Resource>3</Resource><Id>10014</Id></Item></Phase>
```

**型でも通る。** `Resource` は書き込み可能なカタログ項目（`Number`）なので、`CreateInput` /
`UpdateInput` に optional で残っている。`REQUIRED_ON_CREATE` から外してあるのは「必須ではない」
という意味で、「書けない」ではない。

**実行時も呼び出し側が勝つ。** `src/resources/resource.ts`:

```ts
// Spread first so a caller can never shadow the binding they did not choose.
const withDefaults = (item: WriteItem): WriteItem => ({
  ...config.writeDefaults,
  ...item,
});
```

コメントは「呼び出し側は上書きできない」と書いているが、**スプレッドの順序が逆**で、
後に置いた `item` が勝つ。`src/resources/phase.test.ts:152` の
「The binding comes first and cannot be shadowed by the caller」も、実際には XML の**並び順**を
見ているだけで、上書きを検査していない。

## 影響

**中くらい。** 意図して `Resource` を書く人は少ないが、**読んだレコードを展開して作り直す**形で
自然に踏む。

```ts
const phase = (await t.phase.of("client").get(10014))!;
await t.phase.of("client").create({ ...phase, Date: "2026-09-16T00:00:00Z" });
// 読みのレコードは `Resource` を持つので、束ねた値が黙って上書きされる
```

踏むと**間違ったリソースに Phase が付く**。Phase に削除 API は無いので、作ったものは残る。

## 検出経緯

[ADR-0080][adr80]（URL パラメータのリソースを `of()` で束ねる）の議論で、「`of()` が束ねるものの
重さ」を説明しようとして実装を読み直したときに見つけた。**ADR の Consequences を書くために
コードを確かめたら、前提のほうが崩れていた**という経路。

## 推奨

**束ねた値を権威にする。** [ADR-0080][adr80] の実装で一緒に塞ぐ。

1. **入力の型から外す** — `CreateInput` / `UpdateInput` から `writeDefaults` が埋める alias を
   `Omit` する（`t.phase.of("client").create({ Resource: 3 })` はコンパイルエラー）
2. **実行時も弾く** — キャストで渡されたら `PortersConfigError`。**黙って捨てない**
   （捨てると「書いたのに効かない」＝ [RV-10][rv10] と同じ形になる）
3. 併せて `resource.ts` のコメントと `phase.test.ts` のコメントを実装に合わせて直し、
   **上書きを試すテスト**を足す（いまは並び順しか見ていない）

[adr61]: ../../adr/0061-phase-resource-surface.md
[adr80]: ../../adr/0080-resource-parameter-binding.md
[rv10]: 0010-per-call-partition-jsdoc.md
