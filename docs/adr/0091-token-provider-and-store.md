# 91. トークンの取得（`tokenProvider`）と保存（`tokenStore`）を別々に受け取り、管理は `PortersClient` が受け持つ

- Status: proposed
- Date: 2026-09-24
- Deciders: jun.shiromoto (Joymerrevent)

> 起票元は [RV-63][rv63]（2026-09-23）。RV-63 は「実例が 1 件出たら ADR を起票する」条件付きだったが、
> stakeholder が 2026-09-24 に**条件を待たずに進める**と決めた。ガイドの図と実装例を先に直す案（RV-63 推奨 (b)(c)）は
> 見送り、この ADR から始める。
>
> 議論の経緯: 起票時の推奨は「取得の関数を受け取って `TokenProvider` を返す `createTokenProvider({ acquire })` を
> 公開する」（既存の入口は変えない）だった。decider との議論で、**取得と保存を `PortersClient` に別々に渡し、
> 管理は常にクライアントが受け持つ**形に改め、いまの「`getAccessToken` を丸ごと自前で書く」入口は無くすことにした。
> オプションの名前は `auth` から `tokenProvider` に変える。以下はその形で書き直したもの（decider の判断待ち）。
>
> [ADR-0007][adr07] 案4 の「自前＝独自ストラテジ（`getAccessToken` を丸ごと差し替える）」を**改める**。
> [ADR-0012][adr12]（既定のキャッシュと更新）の中身は、既定の取得にかぎらずすべての取得に広がる。

## Context and Problem Statement

### いまの 2 つの入口

| 入口                           | 差し替えるもの                | 取得・キャッシュ・更新の判断 |
| ------------------------------ | ----------------------------- | ---------------------------- |
| `tokenStore`                   | トークンの**保存先**だけ      | ライブラリ（既定の方式）     |
| `auth`（独自 `TokenProvider`） | `getAccessToken` を**丸ごと** | **すべて利用者**             |

既定の方式（`src/auth/token-provider.ts` の `createDefaultTokenProvider`）の中身は、2 つに分かれている。

- **取得**: `code_direct` でコードを取り、Token API で交換する（`acquire` / `exchange`）。Refresh Token での更新（`renew`）
- **管理**: メモリのキャッシュ、期限の 60 秒前に取り直す判断（`refreshMarginMs`）、`forceRefresh`、
  同時呼び出しを 1 本にまとめる（`inflight`）、`tokenStore` への読み書き

この組み立てはライブラリの中に閉じている。そのため次の 4 つが起きている。

1. **取得だけを別の仕組みにし、管理はライブラリのものを使う入口が無い**。PORTERS のトークンの取り方は
   `code_direct` の 1 通りなので、取得を差し替えるのは「別のサービスが発行したトークンを受け取る」場面
   （例: 社内の中央サービスがトークンを一括で管理し、各アプリはそこから受け取る）になる。
2. **独自 `TokenProvider` を渡すと、`tokenStore` は黙って無視される**（`src/client.ts` は既定の方式のときだけ使う）。
3. **管理を自前で書くと間違えやすい**。ガイド「認証とトークン」の「トークンを自前で管理するとき」にある実装例は、
   キャッシュと `forceRefresh` を扱うが、**期限の判定**と**同時呼び出しの 1 本化**が無い。期限切れのトークンを
   401 が返るまで使い続け、同時に呼ばれると何本も取り直す。ライブラリ自身が書いた例でも漏れた。
4. **構築オプションの `auth` と、クライアントのプロパティ `porters.auth`（権限付与・確認・削除の操作）が同じ名前**で、
   指すものが違う。

### 問い

トークンの取得・保存・管理を、利用者から見てどう分けるか。

## Decision Drivers

- **フェイルセーフ**: 期限の判定と同時呼び出しの扱いは、間違えても気づきにくい（動くが、無駄に取り直すか、
  期限切れで 1 回失敗する）。ライブラリが 1 か所で持つ。黙って無視される組み合わせ（上の 2）を無くす。
- **分かりやすさ**: 「取得」「保存」「管理」がそれぞれ 1 つの場所にあり、利用者が差し替えるのは前の 2 つだけ。
- **出典に無いものを発明しない**: PORTERS の取得経路は `code_direct` の 1 通り。別のサービスが何を返すかは
  利用者の世界なので、受け取る形は最小にする。
- **1.0 前**: 破壊的変更を入れるなら今が最も安い（[ADR-0055][adr55]・[ADR-0087][adr87] と同じ判断）。

## Considered Options

### 論点1: 取得・保存・管理の分け方

- **案1a: 取得（`tokenProvider`）と保存（`tokenStore`）を `PortersClient` に別々に渡し、管理は常にクライアントが受け持つ** — decider が選択
- 案1b: 取得の関数から `TokenProvider` を作る `createTokenProvider({ acquire })` を公開し、既存の入口は変えない（起票時の推奨）
- 案1c: 現状維持（ガイドの実装例を直すだけ）

### 論点2: いまの「`getAccessToken` を丸ごと自前」の入口

- **案2a: 無くす** — decider が選択
- 案2b: 別のオプション名で残す
- 案2c: 同じオプションが両方の形を受ける

### 論点3: 取得で渡す形

- **案3a: `acquire()` と、省略可能な `refresh(current)` と `exchange(code)`** — decider が選択
- 案3b: `acquire()` だけ（更新は常に取り直し）
- 案3c: `acquire()` と `refresh()` の両方を必須

### 論点4: やり取りするトークンの形

- **案4a: `StoredTokens` を `accessToken` と省略可能な `refreshToken` に分け、それぞれを `{ token, expiresAt? }` にする** — decider が選択
- 案4b: いまの平たい形のまま、Refresh Token と 2 つの期限を任意にする
- 案4c: いまの `StoredTokens`（すべて必須）をそのまま返させる

### 論点5: 構築オプションの名前

- **案5a: `tokenProvider`（型 `TokenProvider`）** — decider が選択
- 案5b: `tokenSource`（型 `TokenSource`）
- 案5c: `auth` のまま

## Decision Outcome

（proposed。以下は decider が議論で選んだ案で、accepted は decider が行う。）

採用候補: **案1a ＋ 案2a ＋ 案3a ＋ 案4a ＋ 案5a**。

```ts
const porters = new PortersClient({
  hostname,
  // 取得: 別のサービスからトークンを受け取る（省略すると既定の code_direct）
  tokenProvider: {
    acquire: async () => {
      const t = await myTokenService.issue();
      return { accessToken: { token: t.token, expiresAt: t.expiresAt } };
    },
    // 更新の手段があれば（省略すると期限が近づいたときに acquire を呼び直す）
    refresh: async (current) => myTokenService.refresh(current),
  },
  // 保存: 省略するとメモリ
  tokenStore: redisTokenStore,
});
```

| 渡すもの             | 取得                                   | 保存       | 管理            |
| -------------------- | -------------------------------------- | ---------- | --------------- |
| どちらも渡さない     | 既定（`code_direct` と Refresh Token） | メモリ     | `PortersClient` |
| `tokenStore` だけ    | 既定                                   | 渡したもの | `PortersClient` |
| `tokenProvider` だけ | 渡したもの                             | メモリ     | `PortersClient` |
| 両方                 | 渡したもの                             | 渡したもの | `PortersClient` |

上 2 行はいまと同じ動き。下 2 行が新しい。

### 型

```ts
type StoredTokens = {
  accessToken: { token: string; expiresAt?: number }; // expiresAt はエポックミリ秒。無ければ「期限不明」
  refreshToken?: { token: string; expiresAt?: number }; // 持っていれば値と期限を組で
};

type TokenProvider = {
  acquire(): Promise<StoredTokens>;
  refresh?(current: StoredTokens): Promise<StoredTokens>;
  exchange?(code: string): Promise<StoredTokens>;
};
```

- `acquire`: 最初の取得。`refresh`: 更新。`exchange`: 権限付与のリダイレクトで戻ってきた `code` をトークンに交換する。
- 既定の取得は、この形の 1 つとして組み直す（`acquire` = `code_direct` と Token API の交換、`refresh` = Refresh Token での
  交換、`exchange` = `code` を Token API で交換）。既定の方式の動き（保存・更新・`porters.auth` の 6 メソッド）は変えない。
- `exchange` を渡す場面の例: 中央のサービスが `appSecret` を持ち、各アプリは持たない構成で、アプリに戻ってきた `code` を
  中央のサービスへ送って交換してもらう。アプリは `appSecret` を持たないまま、`porters.auth` の権限付与の流れを使える。
  PORTERS の `code` の有効期限は発行から 30 秒なので、`exchange` の中で時間のかかる処理をしない（ガイドに書く）。

### 管理（`PortersClient` が受け持つ）

- **キャッシュ**: 取得したトークンをメモリに持ち、`tokenStore` に書く。起動後の最初の取得では `tokenStore` から読む。
- **期限の判断**: `accessToken.expiresAt` があれば、その 60 秒前（既定の余裕。オプションで変えられる）を過ぎたら
  取り直す。**無ければ期限不明として扱い、PORTERS が 401 / 402 を返したときに 1 回だけ取り直す**（いまもある仕組み）。
- **取り直しの手段**: `refresh` が無ければ `acquire`。`refresh` があれば、`refreshToken` が無いとき（Refresh Token を
  使わない更新の方式）と、`refreshToken` があってその期限内（期限が無ければ使えるものとして扱う）のときは `refresh`、
  `refreshToken` の期限が切れていれば `acquire`。
- **同時呼び出しの 1 本化**: 取り直し中の呼び出しは、同じ取り直しの結果を待つ。
- **失敗**: `acquire` / `refresh` の失敗はそのまま届ける（繰り返さない）。同期で throw しても reject で届く
  （Promise を返す公開メソッドは同期で throw しない、の約束）。`accessToken.token` が空・文字列でないときは
  `PortersConfigError`（送る前に分かる誤りは送らない）。

### 論点2: 案2a の帰結（無くす入口と移行）

- 丸ごと自前でしか書けなかったのは、キャッシュと更新の判断そのものを自分の方針で持つこと
  （例: 複数プロセスでの更新を Redis のロックで協調させる）。当面は無くす。`refresh` の中でロックを取れば
  ある程度は代わりになる。足りない実例が出たら、別の ADR で逃げ道を足す（足すのは非破壊）。
- **古い書き方は黙って動かさない**。
  - 構築オプション `auth` は無くす。型では `auth?: never` で弾き、JavaScript から渡されたら構築時に
    `PortersConfigError`（`hint` で `tokenProvider` を示す）。0.21.0 のコンストラクタの `fields` と同じ扱い。
  - `tokenProvider` に古い形（`getAccessToken` だけを持ち `acquire` が無い）を渡したら、構築時に `PortersConfigError`。
  - 移行は短い: `auth: { getAccessToken: async () => t() }` → `tokenProvider: { acquire: async () => ({ accessToken: { token: await t() } }) }`。
- 「丸ごと自前」でしか使わなかった `GetAccessTokenOptions`（`forceRefresh`）は公開 API から外す。

### `porters.auth` の 6 メソッド

| メソッド                    | 既定の取得 | 渡した取得（`tokenProvider`）                                                                                                                             |
| --------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ensureAuthenticated`       | 動く       | 動く（`acquire` を呼ぶ）                                                                                                                                  |
| `getToken`                  | 動く       | 動く                                                                                                                                                      |
| `clearTokens`               | 動く       | 動く（メモリのキャッシュと `tokenStore` を消す。発行側のトークンは残る）                                                                                  |
| `authorizationUrl`          | 動く       | 動く（URL を組み立てるだけ。`appId` が要る点は既定と同じ）                                                                                                |
| `revokeUrl`                 | 動く       | 動く（同上）                                                                                                                                              |
| `exchangeAuthorizationCode` | 動く       | `exchange` を渡していれば動く（返ったトークンをキャッシュと `tokenStore` に保存する）。無ければ `PortersConfigError`（`hint` で `exchange` の実装を示す） |

規則は「**必要なものを渡していれば、どのメソッドも動く**」の 1 つで、既定の取得かどうかでは分けない。
`clearTokens` は既定の取得でも「手元のトークンを消すだけで、PORTERS 側の権限は残る」ので、意味がそろう。
`exchangeAuthorizationCode` のトークンも同じ `tokenProvider` が出すので、更新（`refresh`）に別の発行元のトークンが混ざらない。

### 論点ごとの理由

- **案1a**: 取得・保存・管理がそれぞれ 1 か所にあり、利用者が差し替えるのは前の 2 つだけになる。黙って無視される
  組み合わせ（独自の取得 ＋ `tokenStore`）が無くなる。案1b は入口が 3 つになり、`tokenStore` との関係が別に要る。
- **案2a**: 入口が「取得」と「保存」の 2 つに収まる。案2b / 案2c は「丸ごと自前」を残す代わりに、どちらの形を
  渡したかで `tokenStore` や `clearTokens` の動きが変わる説明が要る。
- **案3a**: 発行側が更新の手段（Refresh Token や更新用の API）を持っていれば、取り直しより軽い更新を使える。
  `exchange` があれば、`appSecret` を持たないアプリでも権限付与の流れ（`exchangeAuthorizationCode`）を使える。
  持っていなければ省略できる。
- **案4a**: 値と期限が必ず組になり、「Refresh Token は無いのに、その期限だけはある」組み合わせを型で作れない。
  Refresh Token を持っているかは `refreshToken` の有無 1 か所で分かる。受け取るだけの場面は
  `{ accessToken: { token } }` で書ける。案4b は 2 つの項目がばらばらに欠けうる。案4c は持っていない値の埋め草を
  書かせ、埋め草の期限（`0` など）で「更新できない」と判断されうる。
  既定の取得は、これまでどおりすべてを埋めて保存する。
- **案5a**: 「取ってくる関数を渡し、キャッシュと期限切れ前の取り直しは SDK が受け持つ」形は、AWS SDK for JavaScript の
  credential provider と同じで、JavaScript の利用者になじみがある。`porters.auth` と名前が重ならなくなる。

### Consequences

- Good: 別のサービスからトークンを受け取るアプリが、管理の部分を書かずに済む。期限切れのトークンを使い続ける・
  同時に何本も取り直す、という自前の実装で起きやすい失敗が無くなる。
- Good: `tokenStore` がどの取得でも使われる。黙って無視される組み合わせが無くなる。`porters.auth` の 6 メソッドが、必要なものを渡していればどの取得でも動く。
- Good: 管理の部分が 1 か所に集まり、既定の取得と渡した取得で同じテストが効く。
- Bad: **破壊的変更**。`auth` オプションと、`getAccessToken` の形の `TokenProvider` を使っているコードは書き換えが要る
  （0.x の minor で出し、CHANGELOG に移行を書く）。「丸ごと自前」でしかできなかったことはできなくなる。
- Bad: `StoredTokens` の形が変わる（平たい 4 項目 → `accessToken` と `refreshToken` の入れ子）。自前の `tokenStore` は
  型を合わせる必要がある（保存先はトークンを丸ごと JSON にするだけのことが多く、書き換えはほとんど要らない見込み）。
- Bad: 0.23.0 までの既定の方式が `tokenStore` に保存したデータは平たい形のまま残る。上げた直後に読むと形が合わないので、
  「読めない値は無いものとして取り直す」（下の「信じている入力」）により、**最初の 1 回だけ `code_direct` で取り直す**
  （権限付与が生きていれば人手は要らない）。古い形を読み替える変換は書かない。CHANGELOG に書く。
- Bad: このリポジトリのテストとガイドの多くが `auth: { getAccessToken: … }` で認証を省いているので、実装の PR が大きくなる
  （機械的に書き換えられる）。
- Neutral: 期限不明のトークンは、401 / 402 を受けたときの 1 回の取り直しで回復する。発行側が取り消したトークンを
  `tokenStore` から読み戻して使った場合も同じ。

## 信じている入力

| 値                                    | 出どころ                             | 誰が書けるか   | 守り方                                                                  | 取れなかったら       | 誤っていたら                                                       |
| ------------------------------------- | ------------------------------------ | -------------- | ----------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------ |
| `acquire` / `refresh` の Access Token | 利用者の関数（別のサービス）         | 利用者・発行側 | 空・文字列でなければ `PortersConfigError`                               | 失敗をそのまま届ける | PORTERS が 401 / 402 → 1 回だけ取り直し、それでも駄目ならエラー    |
| 期限（`expiresAt`・任意）             | 利用者の関数（別のサービス）         | 利用者・発行側 | 有限の数値でなければ「期限不明」として扱う                              | 期限不明として扱う   | 早すぎれば無駄に取り直すだけ。遅すぎれば 401 を受けて 1 回取り直す |
| `tokenStore` から読んだトークン       | 利用者の保存先（他のプロセスも書く） | 利用者         | 読んだ値も上の 2 行と同じ検査を通す。読めない値は「無い」として取り直す | 取り直す             | 取り消されたトークンなら 401 を受けて 1 回取り直す                 |

期限を信用しすぎないのが要点で、期限が誤っていても、失効の応答を受けたときの取り直しで回復する。

## Pros and Cons of the Options

- 案1a — Good: 取得・保存・管理が 1 か所ずつ。Bad: 既定の方式の組み直しが要る。
- 案1b — Good: 非破壊。Bad: 入口が 3 つになり、`tokenStore` の関係が別に要る。
- 案1c — Good: 何も増えない。Bad: 上の 4 つの問題が残る。
- 案2a — Good: 入口が 2 つに収まる。Bad: 破壊的。丸ごと自前でしかできないことが無くなる。
- 案2b / 案2c — Good: 逃げ道が残る。Bad: 渡した形で `tokenStore` や `clearTokens` の動きが変わる。
- 案3a — Good: 更新と `code` の交換の手段があれば使え、無ければ省ける。案3b — Bad: 軽い更新を使えない。案3c — Bad: 受け取るだけの場面で書けない。
- 案4a — Good: 値と期限が組になり、ありえない組み合わせを作れない。Bad: 形が大きく変わり、保存済みのデータは上げた直後に 1 回取り直す。
- 案4b — Good: 形の変わり方が小さい。Bad: 項目がばらばらに欠けうる。案4c — Bad: 埋め草の値を書かせ、ライブラリの判断がそれに引きずられる。
- 案5a — Good: なじみがあり、`porters.auth` と重ならない。Bad: 型の名前 `TokenProvider` が違う形で残る（古い形は構築時に止める）。
- 案5b — Good: `tokenStore` と語呂が合う。Bad: JavaScript ではなじみが薄い。案5c — Bad: `porters.auth` と紛らわしいまま。

## More Information

- 起票元: [RV-63][rv63]
- 改める決定: [ADR-0007][adr07] 案4 の「自前＝`getAccessToken` を丸ごと差し替える」（accepted になったら ADR-0007 に参照の注記を足す）
- 関連: [ADR-0012][adr12]（既定のキャッシュと更新）／[ADR-0034][adr34]（`porters.auth` の 6 メソッド）
- 実装は accepted 後・別 PR（管理の部分の切り出し・既定の取得の組み直し・`tokenProvider` と `auth` の拒否・`StoredTokens`・
  `porters.auth`・テストの書き換え・ガイド「認証とトークン」「契約なしでテストする」とクライアントの章）

[rv63]: ../reviews/rv/0063-token-provider-acquire-store-split.md
[adr07]: 0007-oauth-public-surface.md
[adr12]: 0012-token-cache-refresh.md
[adr34]: 0034-oauth-public-surface-impl.md
[adr55]: 0055-partition-binding-guard.md
[adr87]: 0087-tenant-scoped-field-declarations.md
