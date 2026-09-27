# 81. Attachment の Read を出典の語彙に合わせる（[ADR-0018][adr18] の Read パラメータを改訂）

- Status: accepted
- Date: 2026-09-16
- Deciders: jun.shiromoto (Joymerrevent)
- Implemented: 0.18.0

> [ADR-0080][adr80] の議論から続いた論点。**decider が「出典に合わせる」を選択し `accepted`
> （2026-09-16）。** 実装は accept 後・別 PR（0.18.0）。
>
> **[LV-24][lv] は閉じない** — 合わせた形が実機で通るかは、契約後にしか確かめられない。

## Context and Problem Statement

`Attachment - Read` の Input Variables と、ライブラリが送っているものが**食い違っている**
（[エンドポイント × 機能][coverage] 表 B / 表 C・実測）。

| パラメータ    | 出典                              | ライブラリ                     |
| ------------- | --------------------------------- | ------------------------------ |
| `partition`   | ● 必須                            | 送る                           |
| `requestType` | ● 必須（`0` 本体あり / `1` なし） | **送らない**                   |
| `resource`    | ● 必須                            | **送らない**                   |
| `resourceId`  | 任意                              | 送らない（`condition` で代替） |
| `id`          | 任意                              | 送らない（`condition` で代替） |
| `count`       | 任意                              | 送る                           |
| `start`       | 任意                              | 送る                           |
| `field`       | **記載なし**                      | **送る**                       |
| `condition`   | **記載なし**                      | **送る**                       |

記事のサンプルも `?partition=999999&requestType=0&resource=17&resourceId=10006` で、必須 2 つを含む。

**ずれた経緯は追える。** [ADR-0018][adr18]（Attachment の設計）は **reference を整備する前**に書かれ、
他のリソースと同じ語彙（`field` / `condition`）で組み立てられた。2026-06 に出典を起こしたとき
Attachment だけ語彙が違うと分かり、[LV-24][lv] として記録された。**当時の判断が誤りだったのではなく、
突き合わせる相手がまだ無かった。**

**どちらの形も未検証だが、片方は出典に一致し、片方はしていない。**

- 出典どおりなら、**いまの `t.attachment.search()` は実環境で常に失敗する**（必須欠落 →
  Result Code 100 / 101）＝ 添付の読み取りが丸ごと使えない
- 出典が古く、いまの形でも通るなら、`resource` を要求することで**利用者に不要な束ねを強いる**

問い: **出典の語彙に合わせるか。**

## Decision Drivers

- **設計を実 API ドキュメントに接地する**（[ADR-0002][adr2]）。突き合わせる相手ができた以上、
  合わせない理由が要る。
- **出典が挙げていないものを送らない**（[ADR-0076][adr76] で Phase について立てた線）。
- **既に決めた規則を使い回す**（[ADR-0075][adr75]・[ADR-0080][adr80]）。新しい発明を増やさない。
- **未検証であること**: どちらに倒しても契約前には確かめられない。
- **移行コスト**: 公開サーフェスが変わる（破壊的）。

## Considered Options

- 案A: **出典の語彙に合わせる**（`requestType` / `resource` / `resourceId` / `id` を使い、
  `field` / `condition` をやめる）
- 案B: 現状維持（契約後に判断する）
- 案C: 部分的に合わせる（`requestType` だけ送る）

## Decision Outcome

採用: **案A**。

理由: **どちらも未検証なら、出典に一致するほうに倒すのがフェイルセーフ**（[ADR-0002][adr2]）。
いまの形は出典が挙げていないパラメータを 2 つ送っており、[ADR-0076][adr76] で Phase について
退けた形がそのまま残っている。案C は必須 2 つのうち 1 つを欠いたままなので、通るかどうかは変わらない。

**新しい設計判断は要らない。** 今日決めた 2 つの規則がそのまま降りてくる。

| 出典のパラメータ      | どうなるか                                                         | 根拠                   |
| --------------------- | ------------------------------------------------------------------ | ---------------------- |
| `resource` ●          | **`of()` で束ねる**（`t.attachment.of("resume")`）                 | [ADR-0080][adr80]      |
| `requestType` ●       | **メソッドで決まる** — 一覧は `1`（本体なし）／`get` は `0`        | [ADR-0075][adr75]      |
| `id`                  | `get(id)` が専用パラメータで送る（`condition` の当て込みをやめる） | 出典                   |
| `resourceId`          | `search({ resourceId })` で 1 レコードの添付に絞る                 | 出典                   |
| `field` / `condition` | **やめる**（出典に無い）                                           | [ADR-0076][adr76] の線 |

```ts
const files = t.attachment.of("resume"); // resource を 1 回束ねる
await files.search({ resourceId: 10006 }); // requestType=1・メタデータだけ
await files.searchAll({ resourceId: 10006 });
await files.get(900); // requestType=0・?id=900・本体つき
await files.create({ resourceId: 10006, contentType, fileName, content });
```

### Consequences

- Good: 送るものが出典と一致する。マトリクスの表 B / 表 C のずれ（6 セル）が**すべて消える**。
- Good: **`create` から `resource` が消える** — [ADR-0080][adr80] の「束ねた値は権威」が効き、
  [ADR-0079][adr79] が型で止められないと引き受けた**取り返しの付かない間違い**が、
  Attachment に限っては構造的に起きなくなる。
- Good: `get(id)` が `?id=` になり、[LV-3][lv]（`Id:eq` 条件が通るか）という仮定が**不要になる**。
- Bad: **破壊的変更**。`t.attachment.search({ condition })` / `field` を書いているコードは直す。
  任意の条件で絞る手段は無くなる（出典が提供していないため）。
- Bad: **未検証の形を、別の未検証の形に置き換える**。出典が古ければ、不要な束ねを強いることになる。
- Neutral: [LV-24][lv] は残る（問いは「合わせた形が通るか」に変わる）。[LV-4][lv]（既定項目）は
  `field` が無くなるので不要になる。
- Neutral: フェイクサーバー（[ADR-0043][adr43]）も新しい語彙に合わせる。いまは `field` /
  `condition` を解釈しているので、そこを `requestType` / `resource` / `id` / `resourceId` に替える。

## 信じている入力

| 値                                   | 出どころ                  | 誰が書けるか | 守り方                                            | 取れなかったら   | 誤っていたら                       |
| ------------------------------------ | ------------------------- | ------------ | ------------------------------------------------- | ---------------- | ---------------------------------- |
| Attachment - Read の Input Variables | PORTERS の記事（2019）    | PORTERS 社   | 仕組み（マトリクス表 A ↔ reference の両方向検査） | —                | 記事が変われば検査が落ちる         |
| 合わせた形が実機で通ること           | **未確認**（[LV-24][lv]） | —            | 散文。契約環境でしか確かめられない                | 未確認のまま出荷 | 通らなければ実機の結果で決め直す   |
| `requestType` の意味（0/1）          | PORTERS の記事            | PORTERS 社   | 仕組み（メソッドと 1 対 1 に写す）                | —                | 本体の有無が逆なら一覧に本体が乗る |

**この決定は「記事が正しい」に賭けている。** 賭けを選んだ理由は、**外れたときに気づける**からである
（必須欠落も、本体の有無の取り違えも、実機で 1 回叩けば分かる）。気づけない誤りではない。

## Pros and Cons of the Options

### 案A（出典に合わせる）

- Good: 出典と一致し、マトリクスのずれが消える。既に決めた規則で説明できる。
- Good: `create` から `resource` が消え、取り返しの付かない間違いが構造的に減る。
- Bad: 破壊的変更。任意条件の絞り込みが無くなる。未検証の形への置き換えであることは変わらない。

### 案B（現状維持）

- Good: 何も壊さない。
- Bad: 出典どおりなら**添付の読み取りが使えないまま**出荷し続ける。
- Bad: 出典が挙げていないパラメータを送り続ける（ADR-0076 で退けた形）。

### 案C（`requestType` だけ送る）

- Good: 束ねを導入せずに本体制御だけ出典に寄せられる。
- Bad: **必須 2 つのうち 1 つを欠いたまま**なので、通るかどうかは案B と変わらない。
- Bad: 中途半端な語彙が残り、説明が増える。

## More Information

- 前提: [ADR-0018][adr18]（Attachment の設計 — **本 ADR は Read パラメータの部分だけを改訂**し、
  Base64 の扱い・10MB ガード・bespoke な入力型はそのまま）／ [ADR-0075][adr75]（本体は `get` だけ）／
  [ADR-0080][adr80]（URL パラメータのリソースは `of()`）／ [ADR-0002][adr2]（実 API ドキュメントへの接地）
- 未確定: [LV-24][lv]（合わせた形が通るか）。[LV-3][lv] / [LV-4][lv] は実装時に「不要になった」として整理する
- 反映（accept 後・別 PR）: `src/resources/attachment.ts`（`of()` / `requestType` / `id` /
  `resourceId`・`field` と `condition` の削除）、`test/fake/`（語彙の差し替え）、co-located テスト、
  マトリクスの表 B / C / D、`docs/usage/howto/attachments.md`、[ADR-0018][adr18] への改訂注記、
  CHANGELOG（**Breaking**）

## パスの注記

<!-- 決定の本文は書き換えない。本文に書いたパスが移ったり名前が変わったりしたら、ここに今の場所を足す。 -->

本文に書いたパスのうち、あとで移したもの・名前を変えたものの今の場所（本文は決定したときのまま）:

- `docs/usage/howto/attachments.md` → `docs/usage/resources/attachment.md`（2026-09-23・ADR-0088）

[adr18]: 0018-attachment-design.md
[adr75]: 0075-attachment-search-all.md
[adr76]: 0076-phase-read-query-surface.md
[adr79]: 0079-resource-by-name.md
[adr80]: 0080-resource-parameter-binding.md
[adr2]: 0002-ground-design-in-live-api-docs.md
[adr43]: 0043-local-fake-server.md
[coverage]: ../design/endpoint-coverage.md
[lv]: ../live-verification.md
