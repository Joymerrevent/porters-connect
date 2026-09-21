# 76. Phase の Read クエリから `keywords` / `itemstate` を外す

- Status: accepted
- Date: 2026-09-15
- Deciders: jun.shiromoto (Joymerrevent)
- Implemented: 0.17.0

> [エンドポイント × 機能マトリクス][coverage]（V1）の表 B で見つかったずれ（[LV-25][lv]）の決着。
> **出典が挙げていないパラメータを、ライブラリが送れてしまう**という形。
>
> **decider が案A を選択し `accepted`（2026-09-15）。** 実装は accept 後・別 PR。

## Context and Problem Statement

`t.phase.of("client").search({ keywords: […] })` と `{ itemstate: "all" }` は**今は書けて、
そのまま URL に載る**。だが出典の `Phase - Read`（updated_at 2019-02-01）は、この 2 つを
**URL テンプレートにも Input Variables にも挙げていない**。

```text
GET https://{host}/v1/phase?partition=&resource=&resourceId=&id=&count=&start=&field=&condition=&order=
```

Input Variables は 9 つ（`partition` ● / `resource` ● / `resourceId` / `id` / `count` / `start` /
`field` / `condition` / `order`）。2019-12-10 の機能拡張記事も、増えたのは `field`（`Owner` /
`OwnerDepartment` などの項目）だけで、パラメータは増えていない。

**これは記事の書き漏らしではない。** 取得済みの Read 記事 17 本を数えると、記載の有無が
きれいに割れる（実測 2026-09-15・`tmp/porters-docs/txt/*-Read.md`）。

| 記事                                                                                                                   | `keywords` / `itemstate`                                           |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Candidate / Job / Client / Recruiter / Contact / Resume / Process / Activity / Contract / Sales / Opportunity（11 本） | **11 本すべてに記載**（URL テンプレートと Input Variables の両方） |
| Phase / Attachment / Partition / User / Field / Option（6 本）                                                         | **1 本も記載なし**                                                 |

11 / 11 対 0 / 6 なので、「共通パラメータだから各記事では省略した」という読み方は取れない。
**エンドポイントごとに取るものが違う**と読むのが自然で、マトリクスの表 A はそう起こしてある。

**なぜライブラリは送るのか。** Phase を専用実装にせず汎用 factory に載せた（[ADR-0061][0061] 案1a）
結果、`PhaseSearchQuery = SearchQuery<typeof FIELDS>` となり、共通の Read クエリ型が**まるごと**
付いてきた。`appendReadQuery` は渡されれば素直に `keywords=` / `itemstate=` を載せる。
**意図して開けた口ではなく、横展開に付いてきたもの**である。

**何が起きうるか。** PORTERS が黙って無視するなら実害はないが、Result Code `100`（パラメータが
無効）や `102`（パラメータが多すぎ）で弾かれると、**その Read 全体が失敗する**
（一部が無視されるのではない）。どちらかは契約環境でしか分からないので [LV-25][lv] に起票した。

**もう 1 つ、今日すでに壊れている点がある**（実測）。`itemstate` が `deleted` / `all` のとき
`condition` を 3 項目に制限するガードは、許可する綴りを `P_Id` / `P_UpdateDate` / `P_UpdatedBy` と
**接頭辞付きで持っている**（`src/resources/query.ts`）。Phase の alias は裸なので、
**許可されるはずの項目まで弾かれる**。

```text
t.phase.of("client").search({ itemstate: "all", condition: { Id: { eq: 1 } } })
→ PortersConfigError: condition field "Id" is not allowed when itemstate is "all"
```

そもそも Phase には `Deleted` に相当する項目が無い（`src/resources/phase.ts` の冒頭にそう書いてある）。
削除状態の検索は二重に成立していない。

問い: **契約を待たず、いま型から外すか。**

## Decision Drivers

- **フェイルセーフ**: 出典が挙げていないパラメータを送るのは、当たれば **Read ごと落ちる**側の賭け。
  外しておけば「送らない」方に倒れる。
- **型が嘘をつかない**: 公開型が受け取れると言う以上、送って通ることを主張している。
- **一貫性**: 同じく記載の無い Attachment は bespoke な `AttachmentSearchQuery` なので、
  もともと `keywords` / `itemstate` を持っていない。Phase だけが汎用型ゆえに持っている。
- **移行コスト**: 公開型の縮小＝破壊的変更。Phase は 0.12.0 から出ている。
- **待つ価値**: [LV-25][lv] の確定は契約後（＝ `1.0.0` の V5）。それまで送れる状態を続ける利得。

## Considered Options

- 案A: **型から外す**（`PhaseSearchQuery` / `searchAll` の両方）。**実行時は素通り**のまま
- 案B: 型から外し、**実行時も落とす**（キャストで渡しても URL に載せない）
- 案C: 現状維持（[LV-25][lv] として契約後に判断する）
- 案D: 型は残し、実行時だけ弾く

## Decision Outcome

採用: **案A**（型から外し、実行時は素通りのまま）。

理由: 出典の割れ方（11/11 対 0/6）は、これが編集上の省略ではないことをほぼ決めている。
一方で「弾かれる」と確定したわけでもないので、**型では止めつつ、実行時の逃げ道は残す**のが、
[ADR-0074][0074] が `rawValue` で取った形と揃う。契約を得た人が実機で試す余地
（＝ [LV-25][lv] を確定させる手段）も、実行時を素通りにしておけば残る。

### Consequences

- Good: 出典に無いパラメータが**既定では飛ばなくなる**。Read ごと落ちる形を型で塞ぐ。
- Good: マトリクス表 B のずれ 2 セルが消え、Phase の行が出典と一致する。
- Good: 上記のガードの食い違い（裸 alias が弾かれる）は Phase から**到達不能**になる。
- Bad: **破壊的変更**。`keywords` / `itemstate` を Phase に渡しているコードはコンパイルエラーになる
  （実行時の挙動は変わらない）。0.x なので minor ＋ CHANGELOG の Breaking で扱う。
- Bad: 汎用 factory に「このエンドポイントは取らないキー」を表す仕組みが要る
  （`Resource<F, Req, R>` に省くキーの型引数を足す、など）。Phase 専用の型を手書きするより、
  **エンドポイントごとに違う事実**として書ける形にしたい。
- Neutral: [LV-25][lv] は消えず、問いが変わる（「送って通るか」→「通るなら型に戻すか」）。

## 信じている入力

| 値                              | 出どころ                   | 誰が書けるか | 守り方                                            | 取れなかったら                     | 誤っていたら                                   |
| ------------------------------- | -------------------------- | ------------ | ------------------------------------------------- | ---------------------------------- | ---------------------------------------------- |
| Phase - Read の Input Variables | PORTERS の記事（人が編集） | PORTERS 社   | 仕組み（マトリクス表 A ↔ reference の両方向検査） | 記事が消えたら検査が落ちる         | 17 本の横並びで確認（11/11 対 0/6）            |
| `keywords` / `itemstate` の可否 | 未確認（契約環境が要る）   | —            | 散文（[LV-25][lv]）。機械では確かめられない       | 未確認のまま＝**送らない側に倒す** | 確定したら型に戻す（非破壊）                   |
| 呼び出し側が渡すクエリ          | 人                         | —            | 仕組み（型）。案B ならさらに実行時                | 省略＝送らない                     | キャストで渡されたら案A は素通り、案B は落とす |

記事は**人が編集できる文書**なので、ここが変わったときに気づける形が要る。マトリクスの表 A は
reference と両方向で突き合わせてあるので、**出典が更新されて `keywords` が増えれば検査が落ちる**
（そこで型に戻す判断をする）。

## Pros and Cons of the Options

### 案A（型から外す・実行時は素通り）

- Good: 既定で安全側。型が出典と一致する。
- Good: 契約を持つ人が**キャストで実機を試せる**＝ LV-25 を確定させる道が残る。
- Bad: 破壊的変更。キャストすれば依然として送れる（型だけの保証）。

### 案B（型から外す・実行時も落とす）

- Good: いちばん固い。キャストでも出典に無いものは飛ばない。
- Bad: LV-25 を確かめる手段をライブラリ側で塞ぐ（実機で試すにはライブラリを直す必要がある）。
- Bad: 「実行時は寛容」という既存の線（[ADR-0074][0074]）から外れる。

### 案C（現状維持）

- Good: いま何も壊さない。確定してから 1 回だけ直せる。
- Bad: 確定は契約後＝ `1.0.0` の V5。それまで**出典に無いものを送れる型**を公開し続ける。
- Bad: ガードの食い違い（裸 alias が弾かれる）が生きたまま残るので、別途直す必要がある
  （＝現状維持のほうが作業が増える）。

### 案D（型は残し、実行時だけ弾く）

- Good: 破壊的変更にならない。
- Bad: **型が受け取ると言いながら実行時に落ちる**＝ ADR-0074 が潰したのと同じ非対称を新しく作る。

## More Information

- 発端: [LV-25][lv]（未確認）／ [エンドポイント × 機能マトリクス][coverage] 表 B
- 前提: [ADR-0061][0061]（Phase を汎用 factory に載せた）／ [ADR-0038][0038]（Read クエリの型）／
  [ADR-0057][0057]（`itemstate: existing` を明示送信する決定）／ [ADR-0074][0074]（型で塞ぎ、
  実行時は寛容にした先例）
- 関連する未確認: [LV-15][lv]（`itemstate=existing` を明示送信して受け付けられるか — 11 本の
  データ系についての問い。本 ADR は Phase だけを扱う）
- 反映（accept 後・別 PR）: `src/resources/resource.ts`（省くキーの型引数）、`src/resources/phase.ts`、
  co-located テスト、マトリクスの表 B、[LV-25][lv] の問いの書き換え、`docs/usage/` の該当箇所、
  CHANGELOG（Breaking）

[coverage]: ../design/endpoint-coverage.md
[lv]: ../live-verification.md
[0038]: 0038-read-query-surface-impl.md
[0057]: 0057-itemstate-existing-explicit.md
[0061]: 0061-phase-resource-surface.md
[0074]: 0074-custom-field-declaration-required.md
