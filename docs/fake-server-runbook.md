# フェイクサーバー 手動確認 手順書（curl・ライブラリ不使用）

- ステータス: living（フェーズ6 時点の実装に対して**全コマンド実行検証済み**・2026-08-10）
- 位置づけ: ローカルのフェイク PORTERS サーバー（[ADR-0043][adr43]）を、**ライブラリを介さず curl だけ**で叩いて
  挙動を目視確認するための手順書。ワイヤ形状の正は [docs/reference][ref]、設計判断の正は ADR-0043、
  実装の進捗は [フェイクサーバー実装計画][plan]。
- 用途: 「ライブラリが悪いのか、フェイクが悪いのか、そもそも API の形がそうなのか」を切り分けるとき／
  MCP サーバー等の別プロセスから叩く前の疎通確認／新しいリソースを足したときの手触り確認。

---

## 0. 起動と停止

```bash
pnpm install          # 初回のみ
pnpm fake:serve       # 127.0.0.1:4010 で起動（PORT=5000 pnpm fake:serve で変更）
```

起動ログ:

```text
fake PORTERS server listening on http://127.0.0.1:4010
  auth      /v1/oauth (code_direct), /v1/token
  resources /v1/candidate, /v1/job, /v1/client, /v1/process, /v1/resume, /v1/attachment, /v1/partition, /v1/user, /v1/field, /v1/option
  seeded    2 candidates, 2 users, 1 option tree
```

- **停止は Ctrl-C**。状態は**インメモリのみ**なので、再起動＝初期状態に戻る（後片付け不要）。
- seed 済みデータ（`test/fake/serve.ts`）:
  - Candidate `10001` 山田 太郎（`P_Owner=5` / `P_Mail=taro@example.com`）・`10002` 佐藤 次郎（`P_Owner=5`）
  - User `1` API アプリ・`5` 採用 花子
  - Option ツリー `Option.P_PersonPhase`（候補者フェーズ）→ `_Applied`（応募）/ `_Screening`（書類選考）
- ID はリソースごとに **10001 から採番**。**削除 API は無い**（後述の 405）。

以降のコマンドは `$BASE` を前提にする:

```bash
BASE=http://127.0.0.1:4010
```

---

## 1. 共通のお約束（先に読む＝ハマりどころ）

- **ヘッダは 2 本**: `X-porters-hrbc-oauth-token: <Access Token>` と `X-P-ConnectAPI-Version: 2`。
  version ヘッダは省略可（送るなら `1` か `2`。それ以外は Result Code `146`）。
- **Write は POST ＋ `Content-Type: application/xml; charset=UTF-8`**、Read は GET ＋ クエリ。
- **クエリの日本語・記号は必ず percent-encode する**。生の UTF-8 をクエリに置くと **Node の HTTP パーサが
  400 Bad Request を返し、フェイクまで届かない**（フェイクの 400 と紛らわしい）。
  → `curl -G ... --data-urlencode "condition=Person.P_Name:part=鈴木"` を使う。
- **`partition=1` が必須**（唯一の例外は Partition Read＝そもそも partition を発見するための API）。
- **エラーは基本 HTTP 200 ＋ XML の中身**で表現される。HTTP ステータスで成否を判断しない:
  - Resource API → ルート直下 `<Code>` が 0 以外（[result-codes][codes]）
  - Authentication API → `<Authentication><Error>` が 0 以外（[認証エラー][autherr]）
- **HTTP 4xx/5xx が出たら、それはフェイク固有の合図**:
  - `400` … リクエスト長 ~15000 字超（本文 `request too long`）
  - `405` … PORTERS が使わない verb（DELETE 等）＝「削除 API は無い」を型で示す
  - `501` … **未実装 / そもそも PORTERS に無い**（ルート無し・マスタへの Write・ブラウザ必須の OAuth）。
    本文にフェイクからのメッセージが入る。**偽の成功を返さない**ためのフェイルセーフ。
  - **接続が切れる（curl exit code 52 / `http_code=000`）** … レート上限超過による**強制切断**（§6.3）
- **alias 接頭辞はリソースごとに違う**:

  | リソース   | path               | 接頭辞       | 例                    |
  | ---------- | ------------------ | ------------ | --------------------- |
  | Candidate  | `/v1/candidate`    | `Person`     | `Person.P_Name`       |
  | Job        | `/v1/job`          | `Job`        | `Job.P_Name`          |
  | Client     | `/v1/client`       | `Client`     | `Client.P_Name`       |
  | Process    | `/v1/process`      | `Process`    | `Process.P_Candidate` |
  | Resume     | `/v1/resume`       | `Resume`     | `Resume.P_Name`       |
  | Attachment | `/v1/attachment`   | **なし**     | `FileName`            |
  | マスタ4種  | `/v1/partition` 他 | 各リソース名 | `User.P_Name`         |

---

## 2. 認証（`code_direct` → Access Token）

### 2.1 code を取る

```bash
curl -s "$BASE/v1/oauth?app_id=demo-app&response_type=code_direct"
```

```xml
<?xml version="1.0" encoding="UTF-8"?><Authentication><Code>fake-code-1</Code><Error>0</Error><Message>Success</Message></Authentication>
```

- `code_direct` は `redirect_url` / `scope` **不要**（サーバ間直接）。
- **code の寿命は 30 秒・1 回限り**。すぐ交換する。
- `response_type=code`（ブラウザ grant）は **501**（オフラインでは答えようがないため、勝手に発行しない）。
- `app_id` 無し → `<Error>104</Error>`。

### 2.2 token に交換する（以降で使う変数を作る）

```bash
CODE=$(curl -s "$BASE/v1/oauth?app_id=demo-app&response_type=code_direct" \
  | sed -n 's/.*<Code>\([^<]*\)<\/Code>.*/\1/p')

RESP=$(curl -s -X POST "$BASE/v1/token" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "app_id=demo-app&secret=demo-secret&grant_type=oauth_code&code=$CODE")
echo "$RESP"

TOKEN=$(echo   "$RESP" | sed -n 's/.*<AccessToken>\([^<]*\)<\/AccessToken>.*/\1/p')
REFRESH=$(echo "$RESP" | sed -n 's/.*<RefreshToken>\([^<]*\)<\/RefreshToken>.*/\1/p')
echo "TOKEN=$TOKEN REFRESH=$REFRESH"
```

```xml
<?xml version="1.0" encoding="UTF-8"?><Authentication><AccessToken>fake-access-3</AccessToken><AccessTokenExpiresIn>1800000</AccessTokenExpiresIn><RefreshToken>fake-refresh-4</RefreshToken><RefreshTokenExpiresIn>7200000</RefreshTokenExpiresIn><Error>0</Error><Message>Success</Message></Authentication>
```

- **有効期限はミリ秒**（Access 30 分 / Refresh 2 時間）。秒ではない。
- App ID / Secret は**何でも通る**（空でなければよい）。フェイクは値を検証しない。

これ以降のコマンド用にヘッダを配列にしておくと楽:

```bash
A=(-H "X-porters-hrbc-oauth-token: $TOKEN" -H "X-P-ConnectAPI-Version: 2")
W=("${A[@]}" -H "Content-Type: application/xml; charset=UTF-8")
```

### 2.3 更新と失敗系

```bash
# Refresh Token で更新（code に Refresh Token を渡すのが PORTERS 仕様）
curl -s -X POST "$BASE/v1/token" -d "app_id=demo-app&secret=demo-secret&grant_type=refresh_token&code=$REFRESH"

# 同じ code を二度使う → 103（単回使用）
curl -s -X POST "$BASE/v1/token" -d "app_id=demo-app&secret=demo-secret&grant_type=oauth_code&code=$CODE"

# secret 無し → 105 ／ grant_type 不正 → 112
curl -s -X POST "$BASE/v1/token" -d "app_id=demo-app&grant_type=oauth_code&code=x"
curl -s -X POST "$BASE/v1/token" -d "app_id=demo-app&secret=s&grant_type=nope&code=x"
```

| `<Error>` | 意味                                     |
| --------- | ---------------------------------------- |
| `0`       | 成功                                     |
| `103`     | code が無効／期限切れ／使用済み          |
| `104`     | app_id 不正                              |
| `105`     | secret 不正                              |
| `107`     | Refresh Token 不正                       |
| `112`     | grant_type 不正                          |
| `401`     | Refresh Token 期限切れ（＝再取得の合図） |

---

## 3. Read（データ系リソース）

### 3.1 まずは素で叩く（`field` 省略＝主キーのみ）

```bash
curl -s "${A[@]}" "$BASE/v1/candidate?partition=1"
```

```xml
<?xml version="1.0" encoding="UTF-8"?><Candidate Total="2" Count="2" Start="0"><Code>0</Code><Item><Person.P_Id>10001</Person.P_Id></Item><Item><Person.P_Id>10002</Person.P_Id></Item></Candidate>
```

- ルート属性 `Total`（条件に一致した総数）/ `Count`（このページの件数）/ `Start`（オフセット）。
- ルート直下の `<Code>0</Code>` が成功の印。

### 3.2 項目を指定する

```bash
curl -s "${A[@]}" \
  "$BASE/v1/candidate?partition=1&field=Person.P_Id,Person.P_Name,Person.P_Mail&count=10&start=0"
```

```xml
<Item><Person.P_Id>10001</Person.P_Id><Person.P_Name>山田 太郎</Person.P_Name><Person.P_Mail>taro@example.com</Person.P_Mail></Item>
<Item><Person.P_Id>10002</Person.P_Id><Person.P_Name>佐藤 次郎</Person.P_Name><Person.P_Mail /></Item>
```

- **値が無い項目は空要素**（`<Person.P_Mail />`）で返る。ライブラリはこれを `null` にする。

### 3.3 絞り込み・並び・ページング（日本語を含むので `-G --data-urlencode`）

```bash
# condition: 部分一致
curl -s -G "${A[@]}" "$BASE/v1/candidate" -d partition=1 \
  --data-urlencode "field=Person.P_Id,Person.P_Name" \
  --data-urlencode "condition=Person.P_Name:part=山田"

# order + ページング（count は最大 200）
curl -s -G "${A[@]}" "$BASE/v1/candidate" -d partition=1 \
  --data-urlencode "field=Person.P_Id,Person.P_Name" \
  --data-urlencode "order=Person.P_Id:desc" -d count=1 -d start=0

# keywords（複数はカンマ区切りの AND）
curl -s -G "${A[@]}" "$BASE/v1/candidate" -d partition=1 \
  --data-urlencode "field=Person.P_Id,Person.P_Name" --data-urlencode "keywords=佐藤"

# itemstate=deleted は「削除済みとして seed したレコード」だけを返す。
# リクエスト経由では何も削除できない（PORTERS も削除は画面側＝API の外）ので、
# 削除済みを試したいときは seed に P_Deleted: "1" を入れて起動する。
# all で読むと生存と混ざるため、判別は Person.P_Deleted（"0" / "1"）で行う（ADR-0056）。
curl -s -G "${A[@]}" "$BASE/v1/candidate" -d partition=1 \
  --data-urlencode "field=Person.P_Id,Person.P_Deleted" -d itemstate=all
```

`condition` の演算子: `full`（完全一致）/ `part`（部分一致）/ `eq` `gt` `ge` `le` `lt`（比較）/
`or` `and`（`:` 区切りの集合。Option alias や ID 群に使う）。
※ フェイクの一致判定は**素朴な文字列／数値比較**（PORTERS の関連度・照合順序は業務ロジックなので浅く実装＝ADR-0043 の方針）。

### 3.4 項目型ごとの見え方（Read と Write は非対称）

```bash
curl -s -G "${A[@]}" "$BASE/v1/candidate" -d partition=1 \
  --data-urlencode "field=Person.P_Id,Person.P_Owner,Person.P_Phase,Person.P_RegistrationDate"
```

- **User 型**（`P_Owner`）… ID で書いて、**入れ子で読む**:

  ```xml
  <Person.P_Owner><User><User.P_Id>5</User.P_Id><User.P_Type>0</User.P_Type><User.P_Name>採用 花子</User.P_Name><User.P_Mail>hanako@example.com</User.P_Mail></User></Person.P_Owner>
  ```

  サブ選択で絞れる: `--data-urlencode "field=Person.P_Owner(User.P_Id,User.P_Name)"`

- **Option 型**（`P_Phase`）… 裸の alias で書いて、`<OptionRoot>` の下に **id ＋ 表示名付きで読む**:

  ```xml
  <Person.P_Phase><OptionRoot><Option.P_PersonPhase_Applied><Option.P_Id>1</Option.P_Id><Option.P_Name>P_PersonPhase_Applied</Option.P_Name></Option.P_PersonPhase_Applied></OptionRoot></Person.P_Phase>
  ```

  ここの `Option.P_Name` が **alias の末尾セグメント**なのは仕様どおり: フェイクはラベルマスタを持たず、
  ライブラリも **alias しか往復させない**（ADR-0017）。人が読むラベル（「応募」）は `/v1/option`（§5）側にある。

- **System[Reference] 型**（`Process.P_Candidate` 等）… ID で書いて、入れ子の `P_Id` で読む:

  ```xml
  <Process.P_Candidate><Reference><P_Id>10001</P_Id></Reference></Process.P_Candidate>
  ```

  ※ 実機では外側タグが参照先リソース名（`<Candidate>` 等）の可能性があり**未確認**（LV-10・[live-verification][lv]）。

- **日時**は PORTERS 形式 `2026/08/10 00:08:00`（ISO 変換はライブラリの仕事）。

### 3.5 Read の失敗系

```bash
# トークン無し → 402 ／ 期限切れ → 401
curl -s -H "X-P-ConnectAPI-Version: 2" "$BASE/v1/candidate?partition=1"
# 知らない partition → 404
curl -s "${A[@]}" "$BASE/v1/candidate?partition=9"
# 未対応の API version → 146
curl -s -H "X-porters-hrbc-oauth-token: $TOKEN" -H "X-P-ConnectAPI-Version: 9" "$BASE/v1/candidate?partition=1"
```

```xml
<?xml version="1.0" encoding="UTF-8"?><Candidate><Code>402</Code><Message>Invalid Access Token</Message></Candidate>
```

---

## 4. Write（作成・更新・一括）

### 4.1 作成（`P_Id` に `-1`）

```bash
curl -s -X POST "$BASE/v1/candidate?partition=1" "${W[@]}" --data-binary @- <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<Candidate>
  <Item>
    <Person.P_Id>-1</Person.P_Id>
    <Person.P_Owner>5</Person.P_Owner>
    <Person.P_Name>鈴木 三郎</Person.P_Name>
    <Person.P_Mail>saburo@example.com</Person.P_Mail>
    <Person.P_Phase><Option.P_PersonPhase_Applied/></Person.P_Phase>
  </Item>
</Candidate>
XML
```

```xml
<?xml version="1.0" encoding="UTF-8"?><Candidate><Item><Id>10003</Id><Code>0</Code></Item></Candidate>
```

- **Write のレスポンスは Read と非対称**: ルート属性も ルート直下 `<Code>` も無く、
  送った `<Item>` と**同順・同数**で `<Id>` と**件ごとの `<Code>`** が返る。
- `P_RegistrationDate` / `P_UpdateDate` はサーバが打刻（Write 不可）。`P_RegisteredBy` / `P_UpdatedBy` は
  省略時のみ自動割当（既定 User `1`）。

### 4.2 更新（ID 指定）＋ 存在しない ID

```bash
curl -s -X POST "$BASE/v1/candidate?partition=1" "${W[@]}" --data-binary @- <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<Candidate>
  <Item><Person.P_Id>10003</Person.P_Id><Person.P_Mail>saburo+updated@example.com</Person.P_Mail></Item>
  <Item><Person.P_Id>99999</Person.P_Id><Person.P_Mail>nobody@example.com</Person.P_Mail></Item>
</Candidate>
XML
```

```xml
<?xml version="1.0" encoding="UTF-8"?><Candidate><Item><Id>10003</Id><Code>0</Code></Item><Item><Id>99999</Id><Code>7</Code></Item></Candidate>
```

- **1 リクエストに新規と更新を混在できる**。**件ごとに成否が独立**（片方だけ失敗する）。
- 存在しない ID の更新に返す code は実機**未確認**（LV-11）。フェイクは近い意味の `7` を返す。

### 4.3 他リソースも同じ形（接頭辞だけ違う）

```bash
curl -s -X POST "$BASE/v1/job?partition=1" "${W[@]}" --data-binary \
  '<?xml version="1.0" encoding="UTF-8"?><Job><Item><Job.P_Id>-1</Job.P_Id><Job.P_Owner>5</Job.P_Owner><Job.P_Name>バックエンドエンジニア</Job.P_Name></Item></Job>'

curl -s -X POST "$BASE/v1/process?partition=1" "${W[@]}" --data-binary \
  '<?xml version="1.0" encoding="UTF-8"?><Process><Item><Process.P_Id>-1</Process.P_Id><Process.P_Owner>5</Process.P_Owner><Process.P_Candidate>10001</Process.P_Candidate><Process.P_Job>10001</Process.P_Job></Item></Process>'
```

- 本文（リクエストボディ）は URL と違い **percent-encode 不要**。日本語をそのまま書ける。
- 書き込みで使った User ID / Option alias は**マスタに自動登録**される（§5 で読み返せる＝
  「書いた値が消えない」フェイルセーフ）。

### 4.4 Attachment（接頭辞なし・Base64）

```bash
CONTENT=$(printf '職務経歴書のダミー' | base64)

curl -s -X POST "$BASE/v1/attachment?partition=1" "${W[@]}" --data-binary \
  "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Attachment><Item><Id>-1</Id><Resource>1</Resource><ResourceId>10001</ResourceId><FileName>resume.txt</FileName><ContentType>text/plain</ContentType><Content>$CONTENT</Content></Item></Attachment>"

curl -s -G "${A[@]}" "$BASE/v1/attachment" -d partition=1 \
  --data-urlencode "field=Id,ResourceId,FileName,ContentType,Content" \
  --data-urlencode "condition=ResourceId:eq=10001"
```

```xml
<?xml version="1.0" encoding="UTF-8"?><Attachment Total="1" Count="1" Start="0"><Code>0</Code><Item><Id>10001</Id><ResourceId>10001</ResourceId><FileName>resume.txt</FileName><ContentType>text/plain</ContentType><Content>6IG35YuZ57WM5q205pu444Gu44OA44Of44O8</Content></Item></Attachment>
```

- **接頭辞が無い**（`<FileName>`。`<Attachment.FileName>` ではない）。主キーも `P_Id` ではなく **`Id`**。
- `Resource` は添付先リソースの数値コード（candidate=1 / job=3 / client=5 / resume=17）、`ResourceId` はその ID。
- `Content` は **Base64**。§6.1 の ~15000 字上限は **Attachment だけ免除**される。

---

## 5. マスタ Read（4 種・それぞれ語彙が違う）

マスタは `condition` も `get(id)` も無く、**API ごとに専用のパラメータ**を取る（[ADR-0022][adr22]）。

```bash
# Partition: partition を送らない唯一の API（partition を発見するための API だから）
curl -s "${A[@]}" "$BASE/v1/partition?request_type=1"

# request_type=0（ログイン partition）は code_direct では権限が無い → 403
curl -s "${A[@]}" "$BASE/v1/partition?request_type=0"

# User: user_type = -1 全員 / 0 システム管理者 / 1 一般ユーザー
curl -s "${A[@]}" "$BASE/v1/user?partition=1&request_type=1&user_type=-1"

# request_type=0 は「アプリ自身のユーザー」＝自己同定（code_direct の場合）
curl -s "${A[@]}" "$BASE/v1/user?partition=1&request_type=0"

# Field: resource は数値セレクタ（candidate=1 / job=3 / client=5 / resume=17）
curl -s "${A[@]}" "$BASE/v1/field?partition=1&resource=1&active=-1"

# Option: 再帰ツリー。alias で部分木、level で深さ（-1 全部 / 0 その節のみ / n 世代）
curl -s "${A[@]}" "$BASE/v1/option?partition=1&level=-1"
curl -s -G "${A[@]}" "$BASE/v1/option" -d partition=1 --data-urlencode "alias=Option.P_PersonPhase" -d level=0
```

見どころ:

- **Field のデータ源はライブラリのカタログそのもの**。`resource=1` なら Candidate の 18 項目が
  `Field.P_Alias` = `Person.P_Id` … の形で並ぶ＝**ライブラリの型定義を API 越しに覗いている**ことになる。
  `RESOURCE_VALUE` に無い値（例 `9`）や Process は **Result Code 100**（Field Read の対象外）。
- **Option だけ封筒が違う**: `Total`/`Count`/`Start` 属性が無く、`<Code>` ＋ 子を `<Items>` で**再帰的に**入れ子にする。
- マスタへの **POST は 501**（PORTERS にマスタの Write API は無い＝呼び出し側のバグとして落とす）。

---

## 6. 制約と異常系（curl だけで再現できるもの）

### 6.1 リクエスト長 ~15000 字 → HTTP 400

```bash
{ printf '<?xml version="1.0" encoding="UTF-8"?><Candidate><Item><Person.P_Id>-1</Person.P_Id><Person.P_Owner>5</Person.P_Owner><Person.P_Name>'
  head -c 15000 /dev/zero | tr '\0' 'x'
  printf '</Person.P_Name></Item></Candidate>'; } > /tmp/big.xml

curl -s -i -X POST "$BASE/v1/candidate?partition=1" "${W[@]}" --data-binary @/tmp/big.xml | head -1
# HTTP/1.1 400 Bad Request  ／ 本文 "request too long"
```

- 上限は **URL ＋ボディの合計**（`MAX_REQUEST_LENGTH = 15000`）。**Read でも `field`/`condition` が長いと踏む**。
- 応答の形は実機**未確認**（LV-9）。フェイクは素の 400 を返す。
- **Attachment だけ免除**（ファイル本体には別途 10MB 制限があるため・ADR-0018）。
- ライブラリ経由なら送信前ガードが**そもそもリクエストを出さない**（この 400 は curl だからこそ見える）。

### 6.2 1 リクエスト 200 件超 → Result Code 102

```bash
{ printf '<?xml version="1.0" encoding="UTF-8"?><Candidate>'
  for i in $(seq 201); do printf '<Item><Person.P_Id>-1</Person.P_Id></Item>'; done
  printf '</Candidate>'; } > /tmp/many.xml

curl -s -X POST "$BASE/v1/candidate?partition=1" "${W[@]}" --data-binary @/tmp/many.xml
```

```xml
<?xml version="1.0" encoding="UTF-8"?><Candidate><Code>102</Code><Message>201 records exceed the 200-record limit</Message></Candidate>
```

- 現実には**先に 15000 字上限が効く**ことが多い（1 件 ≒ 110 字なら 130 件程度で頭打ち）。
  200 件バウンドに届くのは、上のような ID だけの極小レコードのとき。

### 6.3 レート上限 → **強制切断**（curl exit 52）

既定は reference どおり毎分 Read 2000 / Write 500（＋ローリング 30 日で 15 万）。Write を 520 回連射する:

```bash
printf '<?xml version="1.0" encoding="UTF-8"?><Candidate><Item><Person.P_Id>-1</Person.P_Id><Person.P_Owner>5</Person.P_Owner></Item></Candidate>' > /tmp/one.xml

for i in $(seq 520); do
  curl -s -o /dev/null -w "%{http_code} %{exitcode}\n" -X POST "$BASE/v1/candidate?partition=1" \
    "${W[@]}" --data-binary @/tmp/one.xml
done | sort | uniq -c
```

```text
  21 000 52     ← 上限超過：接続を切られた（curl exit 52 = Empty reply from server）
 499 200 0
```

- **429 ではなく切断**が既定。reference は「429 の記載は無く、強制的に切断され得る」としか言っていないため
  （LV-9）。もう一方の読み筋（429）を見たい場合は §7 の `mode: "http429"`。
- 認証 API（`/v1/oauth` `/v1/token`）は**数えない**（上限は Resource API のもの）。
- ライブラリ経由なら上限の 90% で自制するので、通常利用では踏まない。
- 実行後は store に候補者が 500 件増えるので、**サーバを再起動して初期化**するとよい。

### 6.4 「そもそも無い」系

```bash
curl -s -X DELETE "$BASE/v1/candidate?partition=1" "${A[@]}"   # 405: DELETE is not a PORTERS method
curl -s "${A[@]}" "$BASE/v1/activity?partition=1"              # 501: no route for GET /v1/activity
curl -s -X POST "$BASE/v1/user?partition=1" "${A[@]}" -d x     # 501: User is read-only
curl -s "$BASE/v1/oauth?app_id=a&response_type=code"           # 501: needs a browser
```

`/v1/activity` などは **PORTERS には在るがフェイクが未実装**（フェーズ 2〜3 の対象外リソース）。
「空の結果」ではなく 501 で落ちるのは意図的（半分できたフェイクを green に見せない）。

---

## 7. 注入・トークン失効（curl だけでは出せないもの）

フォールト注入（`control.failNext`）とトークン失効は**インプロセスの API** で、HTTP には出していない。
curl から試したいときは、**標準入力で操作できる起動スクリプト**を使い捨てで置く（`tmp/` は .gitignore 済み）:

```bash
cat > tmp/fake-control.ts <<'TS'
// commands: expire | fail <code> | items <code,...> | net | 429 | reset | quit
import { createInterface } from "node:readline";

import { startFakeServer } from "../test/fake/http-server";

const server = await startFakeServer({
  port: Number(process.env.PORT ?? 4011),
  rateLimit: { readPerMinute: 5, writePerMinute: 3 }, // curl で試しやすいよう下げる
  users: [{ P_Id: 5, P_Name: "採用 花子", P_Mail: "hanako@example.com" }],
  seed: { candidate: [{ P_Name: "山田 太郎", P_Owner: "5" }] },
});

console.log(`fake (control) on ${server.url}`);

createInterface({ input: process.stdin }).on("line", (line) => {
  const [cmd, arg] = line.trim().split(/\s+/);
  switch (cmd) {
    case "expire": server.control.expireAccessTokens(); break;
    case "fail":   server.control.failNext({ kind: "resultCode", code: Number(arg) }); break;
    case "items":  server.control.failNext({ kind: "writeItemCodes", codes: (arg ?? "").split(",").map(Number) }); break;
    case "net":    server.control.failNext({ kind: "network" }); break;
    case "429":    server.control.failNext({ kind: "http", status: 429 }); break;
    case "reset":  server.control.reset(); break;
    case "quit":   void server.close().then(() => process.exit(0)); return;
    default: console.log(`? ${line}`); return;
  }
  console.log(`ok: ${line}`);
});
TS

pnpm exec tsx tmp/fake-control.ts     # 127.0.0.1:4011 で起動。別ターミナルで curl
```

このターミナルにコマンドを打つと、次の**該当**リクエストに効く（注入は「次のリクエスト」ではなく
**次の該当リクエスト**で消費される＝最初の OAuth 往復に食われて的を外さない）:

| 入力          | 効果                                     | curl から見えるもの                       |
| ------------- | ---------------------------------------- | ----------------------------------------- |
| `fail 403`    | 次の Resource 呼び出しに Result Code 403 | `<Candidate><Code>403</Code>…`            |
| `items 0,127` | 次の Write の件ごとの code               | 1 件目 `0` / 2 件目 `127`（片側だけ失敗） |
| `expire`      | 発行済み Access Token を全部失効         | `<Code>401</Code>`（＝更新すべき合図）    |
| `429`         | 次のリクエストに素の HTTP 429            | `http_code=429`                           |
| `net`         | 次のリクエストで接続を切る               | curl exit 52 / `http_code=000`            |
| `reset`       | レコード・マスタ・トークン・注入を初期化 | seed 済み状態に戻る                       |

読み書きの上限を下げてあるので、レート超過（§6.3）も **6 回読むだけ**で再現できる。

---

## 8. ライブラリ経由に戻すとき

同じサーバに、**アプリ側は設定 2 つだけ**で繋がる（[ADR-0047][adr47]・コード変更不要）:

```ts
new PortersClient({
  host: "127.0.0.1:4010",
  scheme: "http",
  appId: "a",
  appSecret: "s",
  partition: 1,
});
```

`scheme: "http"` はプロセスごとに 1 回警告する（抑止は env `PORTERS_SUPPRESS_INSECURE_HTTP_WARNING=1` のみ）。
設定に触れないアプリ向けには `createForwardingTransport`（transport 差し替え）も残っている。

---

## 関連

- 決定: [ADR-0043][adr43]（フェイクサーバー設計）／[ADR-0047][adr47]（アクセスポイント・scheme）／[ADR-0022][adr22]（マスタ Read）
- 進捗: [フェイクサーバー実装計画][plan]
- API 事実: [docs/reference][ref]／[Result Code 一覧][codes]／[認証エラー][autherr]／[Write フォーマット][writefmt]
- 契約後に実機確認する項目: [live-verification][lv]（LV-9 長さ・レート超過の応答／LV-10 Reference の入れ子／LV-11 Write 失敗の code／LV-12 Field Read の表記）

[adr43]: adr/0043-local-fake-server.md
[adr47]: adr/0047-access-point-scheme.md
[adr22]: adr/0022-master-read-query-surface.md
[plan]: design/fake-server-plan.md
[ref]: reference/README.md
[codes]: reference/resource-api/result-codes.md
[autherr]: reference/authentication-api/errors.md
[writefmt]: reference/resource-api/write-format.md
[lv]: live-verification.md
