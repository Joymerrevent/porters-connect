# 75. Attachment に `searchAll` を足す（本体は一覧に流さない）

- Status: accepted
- Date: 2026-09-15
- Deciders: jun.shiromoto (Joymerrevent)

> [エンドポイント × 機能マトリクス][coverage]（V1）の表 D で見つかった [RV-45][rv45] の決着。
> **Read を持つ 17 エンドポイントのうち、置けるのに `searchAll` が無いのは Attachment だけ**で、
> 置かない判断をした記録も無い。
>
> **decider が案A を選択し `accepted`（2026-09-16）。** 実装は accept 後・別 PR。

## Context and Problem Statement

`searchAll`（オフセット式ページングの自動化）が無い Read エンドポイントは 2 つある。

| エンドポイント   | `start`  | `searchAll` | 無い理由           |
| ---------------- | -------- | ----------- | ------------------ |
| `/v1/option`     | 無し     | 無し        | ページングできない |
| `/v1/attachment` | **有り** | **無し**    | **記録なし**       |

Option は出典に `start` が無く、応答のルートに `Total` / `Count` / `Start` も付かない
（[ADR-0022][0022] 事実5）＝**原理的に置けない**。Attachment は違う。

**PORTERS 側は揃っている**（出典 `Attachment - Read`・取得 2026-06-12）。

```text
GET https://{host}/v1/attachment?partition=&requestType=&resource=&resourceId=&id=&count=&start=
```

- `count` は 1〜200（省略時 10）、`start` は 0 以上（省略時 0）。
- 応答のルート要素は `<Attachment Total="1" Count="1" Start="0">` — 記事のサンプルにもそのまま出る。

**ライブラリ側も揃っている。**

- `attachment.search` は既に `total` / `count` / `start` を返している（`src/resources/attachment.ts`）。
- `paginate` は `(count, start) => Promise<{ items, total }>` を取るだけの汎用品で、
  リソース固有の型に依存しない（`src/resources/read-core.ts`）。

**では、なぜ無いのか。** [ADR-0018][0018]（Attachment の設計）が挙げた公開メソッドは
`create` / `get` / `search` で、`searchAll` に触れていない。当時 `searchAll` は**どのリソースにも
無かった**（オフセット走査は後から汎用 factory に入った）ので、**横展開のときに素通りした**と見ている。
意図して外した記録はどこにも無い。

**PORTERS は複数件でも本体を返す。** 出典の `requestType` は**リクエスト単位のスイッチ**で、
`0` なら `<Content>` に Base64 が付き、`1` なら付かない。`count`（1〜200）とは独立していて、
「本体付きは 1 件だけ」といった制限は書かれていない。つまり `requestType=0&count=200` は
**200 件ぶんの本体**を 1 応答で返す（1 ファイル 10MB まで — Write 記事）。
**できないから塞ぐ、という話ではない。**

**危険はそこにある。** 本体付きの全件走査は、1 ページ 200 件 × 最大 ~14M 文字をページごとに
メモリへ載せる。[ADR-0041][0041] 軸5 が Attachment の一括書き込みを対象外にしたのと同じ形である。

ただし**同じ危険は今日の `search` にもある** — `search({ field: [… "Content"], count: 200 })` は
書ける。`searchAll` が新しく作る危険ではなく、**その繰り返しを自動化する**点が違う
（総ページ数を呼び出し側が決めない）。

### 200 件を本体付きで取ると何が起きるか（実測 2026-09-15）

応答は**丸ごと 1 本の文字列**になってから DOM ごとパースされる（`await res.text()` →
`fast-xml-parser`。ストリーミングは無い）。Node 24 / 64bit で計測した。

| 1 ファイル | 200 件の応答 | パース時間 | heapUsed | rss   |
| ---------- | ------------ | ---------- | -------- | ----- |
| 250KB      | 65MB         | 433ms      | 153MB    | 323MB |
| 500KB      | 130MB        | 802ms      | 378MB    | 521MB |

**山は応答の 2〜3 倍**（生の文字列 ＋ パース後の木）。ここから 4 つ出てくる。

1. **読めない大きさがある。** V8 の文字列上限は `MAX_STRING_LENGTH` = 536,870,888 文字（512MiB）。
   Base64 は元の約 4/3 なので、**1 ファイルが 2MB を超えると 200 件は文字列にできない**
   （`RangeError: Invalid string length`）。出典は 1 ファイル **10MB** まで許すので、
   上限に届く組み合わせは普通に作れる。
2. **メモリ。** 1MB のファイル 200 件（応答 267MB）で heap は 700MB 前後になる。
   1 プロセスで複数テナントを回すサーバーでは、1 回の一覧が他の処理を巻き込む。
3. **時間と既定のタイムアウト。** 既定の transport タイムアウトは 30 秒
   （`createFetchTransport`）。数百 MB を 30 秒で受け切るには 100Mbps 超の実効帯域が要る。
4. **失敗が再送される。** 1 と 3 はどちらも `PortersNetworkError`（`retryable: true`）になり、
   既定の `maxRetries: 3` で**最大 4 回**、毎回数百 MB を取り直してから同じ理由で落ちる。

**いま守りは無い。** 送信側は長さ（約 15000 文字）とアップロード本体（~14M 文字）を見ているが、
**応答側の大きさを見る仕組みはどこにも無い**。

再現方法（`tmp/` に置いて `node --max-old-space-size=3000` で実行）:

```js
import { XMLParser } from "fast-xml-parser";
const b64 = "A".repeat(Math.round((500 * 1024 * 4) / 3)); // 500KB のファイル 1 つ分
const item = `<Item><Id>1</Id><Content>${b64}</Content></Item>`;
const xml = `<Attachment Total="200" Count="200" Start="0"><Code>0</Code>${item.repeat(200)}</Attachment>`;
new XMLParser({ parseTagValue: false }).parse(xml); // 130MB -> ~800ms / heapUsed ~378MB
```

**本体の選び方は二択**（全件に付ける / 全件に付けない）で、「この 3 件だけ本体」は出典の語彙に無い。
なお**ライブラリは今 `requestType` を送っておらず**、`field` に `Content` を並べるかどうかで
決めている（[LV-24][lv]）。どちらが実際に効くかは未確認なので、本 ADR の案は
**語彙に依存しない形**（「本体を運ぶか運ばないか」）で書く。

問い: **`searchAll` を足すか。足すなら、本体付きの全件走査を許すか。**

## Decision Drivers

- **語彙の一貫性**: 17 エンドポイント中 15 が `searchAll` を持つ。使う側が Attachment でだけ
  例外を覚えることの費用。
- **フェイルセーフ**: 一覧に本体を流さない。既定の `field` が `Content` を外している
  （[ADR-0020][0020]）のも、`get` の JSDoc が「`Content` を頼むのは `get` のほう」と書いているのも
  同じ線で、**そこに穴を開けない**。
- **逃げ道が実際にあるか**: メタデータで走査 → 要る 1 件だけ `get(id)`、が書けること。
- **非破壊**: メソッドの追加は minor。既存の呼び出しに触れない。
- **未確定を抱え込まない**: [LV-24][lv]（`requestType` / `resource` が必須かどうか）は契約前に
  確定しない。確定したときに直す量が増えないこと。

## Considered Options

- 案A: **`searchAll` を足し、本体は運ばせない** — 走査は常に本体なし（出典の語彙なら `requestType=1`、
  いまの実装の語彙なら `field` から `Content` を外す）。本体を要求されたら実行時に `PortersConfigError`
  で `get(id)` へ誘導する
- 案B: `searchAll` を足す（制限なし）
- 案C: 足さない。理由を明文化する（[ADR-0041][0041] 軸5 と同じ「本体が巨大なので一気に扱わせない」）
- 案D: `searchAll` を足し、Attachment だけページサイズを小さくする（例 50 件）

## Decision Outcome

採用: **案A**（`searchAll` を足し、走査では本体を運ばせない）。

理由: PORTERS 側の前提（`start` ／ `Total`）が揃っていて、部品（`paginate`）も既にある以上、
「置けない」ではなく「置いていない」だけであり、語彙を 1 つ揃える利得が大きい。
同時に、**全件走査に本体を混ぜる**のは既定（[ADR-0020][0020]）と `get` の位置づけ
（[ADR-0064][0064]）に反するので、そこだけは弾く。`search` 単発を制限しないのは、
**件数を呼び出し側が決めている**ためで、`searchAll` との違いはそこにある。

### Consequences

- Good: Attachment が他の 15 エンドポイントと同じ語彙になる。200 件を超える添付を持つテナントで、
  呼び出し側が `start` を自分で回さなくてよくなる。
- Good: [RV-45][rv45] が閉じ、マトリクスの表 D から「理由の無い空白」が消える。
- Bad: 実行時ガードが 1 つ増える（[ADR-0064][0064] の `guardNoImageInBulk` と同じ形）。
  型では止まらない（`AttachmentSearchQuery.field` は bespoke ゆえ `string[]` のままなので、
  リテラル型に狭めるのは別の変更になる）。
- Neutral: 「本体を運ばない」という言い方は**語彙に依存しない**ので、[LV-24][lv] がどちらに
  転んでも決定は変わらない（実装が `field` を外すか `requestType=1` を送るかが変わるだけ）。
- Neutral: [LV-24][lv] が「出典どおり」と確定したら、`search` と `searchAll` は**一緒に**直る
  （`resource` を束ねる形になれば両方が同じ受け口を通る）。先に足しても直す量は増えない。

## 信じている入力

`searchAll` はページを跨いで**応答の数値を信じ続ける**ので、その値を洗い出す。

| 値                        | 出どころ         | 誰が書けるか     | 守り方                                                       | 取れなかったら                             | 誤っていたら                                       |
| ------------------------- | ---------------- | ---------------- | ------------------------------------------------------------ | ------------------------------------------ | -------------------------------------------------- |
| ルート属性 `Total`        | PORTERS の応答   | 第三者は書けない | 仕組み（`parseResourcePage` が数値化。非数値は 0）           | 0 として読む ＝ **1 ページで止まる**       | 空ページで止める既定があるので無限ループにならない |
| 1 ページの `items` 件数   | PORTERS の応答   | 第三者は書けない | 仕組み（`paginate` は実際に返った件数だけ `start` を進める） | 0 件 ＝ 走査終了                           | 進まない／重複は `start >= total` で止まる         |
| `field`（`Content` 有無） | 呼び出し側（人） | —                | 案A なら**仕組み**（実行時ガード）／案B なら散文の注意だけ   | 省略 ＝ メタデータのみ（[ADR-0020][0020]） | 巨大応答としてメモリに現れる                       |
| 本体のサイズ              | PORTERS の応答   | テナントの利用者 | 仕組みは無い（応答の大きさは事前に分からない）               | —                                          | 既定で要求しないことが唯一の守り                   |

**「取れなかった」と「0 件」は別**という原則はここでも同じで、`Total` が読めないときに
「全部読み終えた」と解釈する形（＝黙って途中で止まる）は既に `paginate` の既定である。
本 ADR はその既定を変えない。

## Pros and Cons of the Options

### 案A（足す ＋ 本体は運ばせない）

- Good: 語彙が揃い、かつ「一覧に本体を流さない」線が破れない。
- Good: エラーメッセージで `get(id)` へ誘導できる（塞ぐだけで終わらない）。
- Bad: 実行時ガードが 1 つ増える。型では止まらないので、コンパイル時には気づけない。

### 案B（足す・制限なし）

- Good: 実装が最小。`paginateOnce` を呼ぶだけ。
- Bad: `searchAll({ field: [… "Content"] })` が**書けてしまう**。総ページ数を呼び出し側が
  決めないので、落ちるとしたらメモリで落ちる。ADR-0041 が避けた形をそのまま Read に持ち込む。

### 案C（足さない）

- Good: 記録が残り、[RV-45][rv45] は閉じる。実装の変更はゼロ。
- Bad: 「置けるのに置かない」理由が**本体を要求したときにしか成り立たない**。既定
  （メタデータのみ）で走らせる限り危険は無いので、根拠として弱い。
- Bad: 使う側は結局 `start` を手で回す。ライブラリが引き受けるべき退屈さを押し返している。

### 案D（足す ＋ ページサイズを小さく）

- Good: 本体付きでも 1 ページのメモリが減る。
- Bad: `Content` を要求しない**通常の走査でリクエスト数が 4 倍**になる（レート上限にも効く）。
  危険なのは本体を要求したときだけなので、全員に負担を課す形が合っていない。
- Bad: Attachment だけ違うページサイズという定数が増える。

## More Information

- 発端: [RV-45][rv45]（open）／ [エンドポイント × 機能マトリクス][coverage] 表 D
- 前提: [ADR-0018][0018]（Attachment の bespoke な設計）／ [ADR-0020][0020]（Read `field` の既定）／
  [ADR-0041][0041] 軸5（Attachment の一括書き込みは対象外）／ [ADR-0064][0064]（Image の既定と
  一括書き込みの拒否）／ [ADR-0022][0022]（Option に `start` が無いこと）
- 未確定: [LV-24][lv]（`requestType` / `resource` は必須か ＝ 本体の選び方が `field` か `requestType` か）／
  [LV-4][lv]（Read の既定項目）
- フォローアップ（**未決**）: `search` 単発の本体付き 200 件にも同じ危険がある（上記の実測は
  `searchAll` 固有ではない）。警告を出すか、件数に上限を設けるかは**本 ADR では決めていない**。
  必要になったら別に起票する。
- 反映（accept 後・別 PR）: `src/resources/attachment.ts`（`searchAll` ＋ 案A ならガード）、
  co-located テスト、`docs/usage/index.md` の表、`docs/usage/howto/attachments.md`、
  マトリクスの表 D、[RV-45][rv45] の処置、CHANGELOG（minor・追加）

[coverage]: ../design/endpoint-coverage.md
[rv45]: ../reviews/rv/0045-attachment-search-all-absent.md
[lv]: ../live-verification.md
[0018]: 0018-attachment-design.md
[0020]: 0020-read-field-default.md
[0022]: 0022-master-read-query-surface.md
[0041]: 0041-bulk-write-surface-impl.md
[0064]: 0064-link-image-types.md
