# 複数テナントを 1 プロセスで扱う（SaaS の組み立て）

複数の PORTERS 契約（Company DB）を 1 つのアプリケーションから扱う SaaS を組むときに読むページです。
テナントの登録、リクエストごとのスコープ、宣言の持ち方、認証を分けるか、レートの共有をどう組むかが分かります。
読み終えると、テナントが増えてもデータもトークンも混ざらないかたちで PORTERS を呼べます。

> [!NOTE]
> **利用者 ↔ 会社 ↔ Partition の対応は利用側（SaaS）の責務**です。ライブラリは業務ロジックを持ちません。
> 発見した Partition を保存し、リクエストごとにどの Partition かを決めるのは SaaS 側です。

## 使う機能

この用途で使うライブラリの機能と、それぞれの役割です。

| 機能                                              | 何に使うか                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| `porters.partition.search()`                      | テナント登録時に、アクセスできる Partition を発見する                    |
| `porters.tenant(id, { fields })`                  | リクエストごとに Partition とカスタム項目の宣言を指定する                |
| `defineFields` の spread 合成                     | App 共通（`A_`）とテナント固有（`U_`）の宣言を組み合わせる               |
| `TenantScope<typeof fields>` / `TenantOptions<…>` | 宣言したスコープを関数に渡すときの型                                     |
| `tokenStore` ／ client を分ける                   | 認証（トークン）をテナントごとに分けたいとき                             |
| `createThrottle` ／ 自前の `Throttle`             | 共有から降りて別の上限で走らせる／プロセスを跨いで協調する（自前の実装） |

## 組み立て

次の順に組みます。登録 → スコープ → 宣言 → 関数への受け渡し → 認証 → レート、の 6 段です。

### 1. テナントを登録する（Partition の発見）

初回のブラウザでの権限付与（[認証とトークン][auth]）の直後は、`exchangeAuthorizationCode` で得た
トークンが**ブラウザでログインした人のもの**なので、そのトークンが有効な間だけ `requestType: 0` で
「ログイン中の Partition / User」を引けます。発見した Partition を SaaS の DB に「会社 ↔ Partition」で
保存します。

```ts
const me = await porters.partition.search({ requestType: 0 }); // ログイン中 Partition（code 付与の直後だけ）
const user = await t.user.current(); // ログイン中 User（同上）
```

以降の無人運用（`code_direct` で取り直したトークン）ではこの呼び方は使えません。`requestType: 0` は
403 になり、`t.user.current()` はアプリ自身の User を返します（[Partition とテナントスコープ][tenant]）。
普段は `porters.partition.search()`（アクセスできる一覧）から選んでください。Company DB が複数あるなら、
権限付与も Company DB ごとに繰り返します。

### 2. リクエストごとにスコープを作る

`tenant(id)` は Partition を固定したアクセサ群（`TenantScope`）を返し、配下の呼び出しはすべてその Partition に
送られます。トークンは client が持ち、`tenant(id)` は Partition 付きのアクセサを作り直すだけなので、リクエストごとに作って構いません。

```ts
// SaaS の 1 リクエスト = 1 テナント
const partition = await lookupPartitionForUser(req.user); // ← SaaS の責務
const t = porters.tenant(partition, { fields: fieldsFor(partition) }); // 宣言も Partition と一緒に

await t.candidate.search(query); // partition=<partition> で送信
const job = await t.job.get(jobId);
await t.attachment.of("resume").create(file);
```

`fields` は**その Partition のカスタム項目の宣言**です。Partition と宣言の対応を持つのは SaaS 側で、
ライブラリは 2 つを同じ呼び出しで受け取るだけです。項目構成が同じテナント群なら、同じ宣言を渡します<!-- 根拠: ADR-0087 -->。

### 3. 宣言をテナントごとに持つ

宣言は **`tenant()` ごと**に渡します。カスタム項目は Partition ごとのものなので、Partition を指定する呼び出しが、
その Partition の項目の形も決めます。別のテナントの宣言が気づかないうちに適用される、という状態はありません。
`{ fields }` を渡し忘れたスコープで `U_` に触れば、コンパイルエラーです。

```ts
import type { PartitionId } from "@joymerrevent/porters-connect";

// SaaS: Partition ↔ 宣言の対応は自分の DB から引く（ライブラリの責務ではありません）
const t = porters.tenant(partition, { fields: fieldsFor(partition) });

// 項目構成が同じテナント群: 1 行包んで使い回す
const tenant = (p: PartitionId) => porters.tenant(p, { fields: myFields });
const t2 = tenant(2);
```

**`A_` を App 共通、`U_` をテナント固有にする**なら、共通部分を関数にして各テナントの宣言に spread します。
ライブラリは `A_` と `U_` を区別しません（出典はどちらも「テナント毎に異なる」としているため）。
書き方は[カスタム項目][custom-fields]の「テナントごとに宣言を渡す」にあります。

### 4. 宣言したスコープを関数に渡す

アプリが育つと、`tenant(id, { fields })` のスコープを**引数に取る関数**を切り出したくなります。
そのとき型をどう書くかで、**カスタム項目が残るかどうか**が変わります。

```ts
import { defineFields, PortersClient } from "@joymerrevent/porters-connect";
import type {
  DeclaredCatalogs,
  TenantScope,
} from "@joymerrevent/porters-connect";

const fields = defineFields({
  candidate: (f) => ({ U_score: f.number() }),
});

const porters = new PortersClient({
  hostname: process.env.PORTERS_HOST ?? "",
  appId: process.env.PORTERS_APP_ID ?? "",
  appSecret: process.env.PORTERS_APP_SECRET ?? "",
});

// (1) 自分の宣言で受ける — カスタム項目が型付きのまま
const topScorers = async (t: TenantScope<typeof fields>) => {
  const page = await t.candidate.search({ field: ["P_Name", "U_score"] });
  return page.items.filter((c) => (c.U_score ?? 0) > 80);
};

// (2) どの宣言のスコープでも受ける — 標準項目（P_）だけを触る共通処理
const countCandidates = async (t: TenantScope<DeclaredCatalogs>) =>
  (await t.candidate.search({ field: [] })).total;

// client を受ける関数は、型引数なしの PortersClient（client は宣言を持ちません）
const listPartitions = (client: PortersClient) => client.partition.search();

// 呼ぶ側
const t = porters.tenant(123, { fields });
for (const c of await topScorers(t)) {
  console.log(c.P_Name, c.U_score); // string | null | undefined / number | null | undefined
}
console.log(await countCandidates(t));

const partitions = await listPartitions(porters);
console.log(partitions.items.map((p) => p.P_Name));
```

**(2) はカスタム項目が返り値の型に出ません。** `DeclaredCatalogs` は「何か宣言されているかも
しれない」としか言っていないので、読み取り結果は標準項目（`P_`）だけになります。`field` に
書くことはできる（`U_` / `A_` で始まる alias は常に要求できます）のに、受け取る側で型が
付かない、という形です。

<!-- doccheck: expect-error -->

```ts
import type {
  DeclaredCatalogs,
  TenantScope,
} from "@joymerrevent/porters-connect";

const wide = async (t: TenantScope<DeclaredCatalogs>) => {
  const page = await t.candidate.search({ field: ["U_score"] }); // 要求はできる
  return page.items[0]?.U_score; // ✗ 型エラー：宣言が分からないので型には出ない
};
```

使い分けはこうなります。

| 書き方                          | 受けられるスコープ | カスタム項目の型      |
| ------------------------------- | ------------------ | --------------------- |
| `TenantScope<typeof fields>`    | その宣言のものだけ | **付く**              |
| `TenantScope<DeclaredCatalogs>` | どれでも           | 付かない（`P_` のみ） |

**カスタム項目を触る関数は (1)、触らない共通処理は (2)** です。1 リソース分の宣言だけ
取り出したいときは `CustomFor<typeof fields, "candidate">` が使えます（名前の一覧は
`CustomFieldResource`）。

`typeof t` で書く手もありますが、**値が先に無いと書けません**。関数を別ファイルに
切り出すなら、上の型名で書くほうが素直です。

#### 宣言が違うスコープは渡せません

`TenantScope<typeof fields>` は**その宣言のスコープだけ**を受け取ります。`U_score` を宣言して
いないスコープを渡すと型エラーです。

<!-- doccheck: expect-error -->

```ts
import { defineFields, PortersClient } from "@joymerrevent/porters-connect";
import type { TenantScope } from "@joymerrevent/porters-connect";

const fields = defineFields({ candidate: (f) => ({ U_score: f.number() }) });
const other = defineFields({
  candidate: (f) => ({ U_memo: f.singlelineText() }),
});

const topScorers = async (t: TenantScope<typeof fields>) => {
  const page = await t.candidate.search({ field: ["U_score"] });
  return page.items[0]?.U_score;
};

const porters = new PortersClient({ hostname, appId, appSecret });
void topScorers(porters.tenant(1, { fields: other })); // ✗ 型エラー：U_score を宣言していない
```

宣言した項目の alias が `field` / `condition` / `order` / 書き込みの型を決めているので、**項目が違えば
スコープの型も違います**<!-- 根拠: ADR-0074 D1 -->。(2) の `TenantScope<DeclaredCatalogs>` が
どの宣言でも受け取れるのは、そちらが「何か宣言されているかもしれない」＝**受け付ける宣言の範囲が広い**から
です。狭いものは広いほうへ渡せる、という向きだけが通ります。

それでも**宣言はプロジェクトに 1 か所置いて export する**のが素直です
（`generateFieldDecls` の出力先がその置き場になります）。テナントごとに宣言が違うなら、
宣言とそれを受ける関数を同じモジュールに閉じます。

#### `tenant()` の引数を切り出すときも同じ

`tenant()` の第 2 引数の型は `TenantOptions` です。これも型引数を取るので、**宣言つきの引数を
関数や別ファイルに切り出すなら、型引数も渡します**。

```ts
import type { TenantOptions } from "@joymerrevent/porters-connect";

const fields = defineFields({
  candidate: (f) => ({ U_score: f.number() }),
});

const options: TenantOptions<typeof fields> = { fields };
const t = porters.tenant(1, options);
```

型引数を省いて `TenantOptions` とだけ書いても**代入は通ります**（`fields` は受け取れます）。
エラーになるのはそのあとで、**作ったスコープからカスタム項目が消えます** — 注釈が
`EmptyCatalog` に固定するためです。

<!-- doccheck: expect-error -->

```ts
import type { TenantOptions } from "@joymerrevent/porters-connect";

const fields = defineFields({
  candidate: (f) => ({ U_score: f.number() }),
});

const bare: TenantOptions = { fields }; // 代入は通る

const score = async () => {
  const page = await porters
    .tenant(1, bare)
    .candidate.search({ field: ["U_score"] });
  return page.items[0]?.U_score; // ✗ 型引数を省いたので、型からは消えている
};
```

### 5. 認証を分けるか

既定では `tenant(id)` は client のトークンを**共有**します（トークンは 1 つで、Partition だけを切り替える）。
**Partition ごとに別トークン**で運用したい場合は、テナント別に `PortersClient` を構築します。
client を分ける理由は**これだけ**です。カスタム項目が違うだけなら `tenant(id, { fields })` で足ります。

```ts
// Partition ごとに別のトークン置き場を与える＝トークンが混ざらない
const clientFor = (tokenStore: TokenStore) =>
  new PortersClient({ hostname, appId, appSecret, tokenStore });

const t = clientFor(tokenStore).tenant(partition);
```

> [!NOTE]
> 「1 つの App トークンで複数 Partition にアクセスできるか」は実機未確認です<!-- 根拠: LV-13 -->。
> 共有トークンで不都合があればテナント別 client に切り替えてください（どちらでも動くようにしてあります）。

### 6. レートは全テナントで 1 つ

1 分あたりの上限（Read 2000 / Write 500）を自制するバケットは **ホストごと**です<!-- 根拠: ADR-0073 -->。
client を分けても、同じ PORTERS を向く client は何個作っても合計が上限に収まります。
テナントが増えても上限は増えません。1 テナントの一括処理が他のテナントの応答を遅らせるなら、
`createThrottle` で共有から降りるか、別の上限で走らせます。

```ts
import { createThrottle, PortersClient } from "@joymerrevent/porters-connect";

// バッチ用の client は別枠にする
const batch = new PortersClient({
  hostname,
  appId,
  appSecret,
  throttle: createThrottle({ readPerMin: 500, writePerMin: 100 }),
});
```

**プロセスを跨ぐと協調しません。** 複数インスタンスで動かすなら、PORTERS から見た合計はその足し算です。
そこまで守りたいなら `Throttle`（`take(write): Promise<void>` の 1 メソッド）を自分で実装して渡します
（[上限とレート][limits]）。

## ライブラリの外（利用側の責務）

この用途で自分で用意するものです。ライブラリは持ちません。

- 利用者 ↔ 会社 ↔ Partition の対応を保存し、リクエストごとに引くこと
- Refresh Token の置き場所（`tokenStore`）の安全性
- 月 15 万アクセスの累積（契約条件。テナントの合計で数える）
- プロセスを跨いだレートの協調

## 関連

- 主題: [Partition とテナントスコープ][tenant]／[認証とトークン][auth]（Company DB ごとの権限付与・`tokenStore`）／
  [カスタム項目][custom-fields]（宣言の書き方・自動生成・突き合わせ）／[上限とレート][limits]
- リソース別: [Partition][r-partition]／[User][r-user]
- 実践例: [毎日の差分同期][sync-batch]（バッチだけ枠を分ける）
- ほかの目的から探す: [目次][index]

<!-- 根拠:
- 決定: ADR-0008（マルチテナント）／ADR-0040（実装）／ADR-0055（client から partition を外す）／
  ADR-0073（スロットルの共有単位）／ADR-0074 D1（宣言でスコープの型が決まる）／ADR-0087（宣言も `tenant()` で渡す）
-->

[auth]: ../topics/auth.md
[custom-fields]: ../topics/custom-fields.md
[tenant]: ../topics/tenant.md
[limits]: ../topics/limits.md
[r-partition]: ../resources/partition.md
[r-user]: ../resources/user.md
[index]: ../index.md
[sync-batch]: sync-batch.md
