# 日時は UTC で、ISO 8601 で入出力する

PORTERS の日時は**すべて UTC** です。ローカル時刻ではありません。

このライブラリは境界で **ISO 8601 に正規化**します。つまり**あなたのコードは ISO 8601 だけを
扱えばよく、PORTERS の書式を知らなくて済みます**。

## 変換の対応

| Data Type          | PORTERS の wire 形式         | このライブラリが渡す／受ける形               |
| ------------------ | ---------------------------- | -------------------------------------------- |
| `DateTime`         | `yyyy/mm/dd HH:MM:SS`（UTC） | `2026-09-11T12:00:00Z`（ISO・`Z` つき）      |
| `System[DateTime]` | 同上（登録日 / 更新日）      | 同上。**書き込み不可**                       |
| `Date`             | `yyyy/mm/dd`                 | `2026-09-11`（日付だけ・時刻もゾーンも無し） |
| `Age`              | `yyyy/mm/dd`                 | 同上（**値は生年月日**。下記）               |

```ts
const one = await t.candidate.get(10001);
one?.P_UpdateDate; // "2026-09-11T12:00:00Z" のような ISO 文字列

// Date 型の項目（Contract.P_StartDate）は日付だけ
await t.contract.update(500, { P_StartDate: "2026-04-01" });
// → PORTERS には 2026/04/01 として送られる
```

## `Age` は年齢ではなく生年月日

`Age` という Data Type は**年齢の数値を持ちません**。中身は `Date` と同じ生年月日で、
年齢は PORTERS が画面で計算します。だからこのライブラリも**日付として**扱います。

標準項目でこの型を持つのは `Resume.P_DateOfBirth`（生年月日）です。

```ts
await t.resume.update(200, { P_DateOfBirth: "1990-04-01" });
```

「年齢で絞りたい」ときは、年齢ではなく**生年月日の範囲**を条件にします。

## 業務タイムゾーンの変換はしません

**JST への変換はライブラリの仕事にしていません**（[要件][prd] R-10）。理由は、どのタイムゾーンで
見せたいかは利用側の事情であり、ライブラリが決めると必ず誰かの用途に合わないからです。

```ts
// JST で表示したいのは利用側の責務
const record = await t.candidate.get(10001);
const iso = record?.P_UpdateDate; // "2026-09-11T12:00:00Z"
if (iso) new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
```

ここで気をつけることが 1 つあります。**`Date` 型の項目には時刻もタイムゾーンもありません。**
`2026-09-11` は「その日」であって「日本時間の 0 時」ではありません。`new Date("2026-09-11")` は
UTC の 0 時として解釈されるので、タイムゾーンを足して表示すると**日付がずれることがあります**。
日付だけの項目は日付として扱ってください。

## 変換できない値は、送る前・読んだ直後に弾かれます

日時は**変換する**ので、変換できない値はそのまま送れません。

<!-- doccheck: fields -->

```ts
await t.candidate.update(1, { U_hiredOn: "2026/09/10" });
// PortersConfigError: U_hiredOn: cannot write "2026/09/10" as Date
//   category: "validation" / hint: ISO 8601 で渡す
```

これは**日時だけの扱い**です。他の Data Type はライブラリが変換しないので、書式を検査しません
（`Number` に `"abc"` を渡しても素通しし、PORTERS が弾きます）。**この非対称は意図したもの**で、
手前で厳しくするとサーバーが受け付ける値をライブラリが落としてしまうためです。詳しくは
[失敗の扱い][handle-failures]にあります。

**読み取りも同じです。** 変換できる形でなければ行き場が無いので、日時として読めない文字列が
返ってきたら `PortersResourceError`（`category: "validation"`）になります。実際にこれが出るのは、
たいてい日時でない項目を `f.date()` と宣言したときです（[カスタム項目][custom-fields]）。

```text
U_hiredOn: declared Date, but "社内候補" is not a PORTERS Date value
```

`condition` に書く日時も同じ経路を通ります。

```ts
await t.candidate.search({
  condition: { P_UpdateDate: { ge: "2026-09-01T00:00:00Z" } },
});
```

## 登録日 / 更新日は書けません

`P_RegistrationDate` と `P_UpdateDate`（Data Type は `System[DateTime]`）は PORTERS が管理します。
**書き込みの入力型から外してあります**ので、書こうとするとコンパイルが通りません。

これは差分取得に使えます。「前回から更新されたものだけ」は `P_UpdateDate` の条件で引けます。

## 時分型は日時ではありません（変換関数で扱います）

PORTERS 9.3.0（2026/08）で足された項目タイプ **「時分型」** は、**時刻だけ**（`00:00`〜`47:59`）を持つ
カスタム項目です。ただし API 上は **年月日時分型と同じ `DateTime`（Field Type 12）** で、
`1970/01/01` を基準日にした日時として運ばれます — `09:00` は `1970/01/01 09:00:00`、`26:00` は
`1970/01/02 02:00:00`。UTC でもありません（タイムゾーン変換は行われません）。

**どの項目が時分型かは、API からは分かりません**（Field Read でも `12` としか返りません）。
分かるのはテナントの管理者だけです。そこでこのライブラリは型を増やさず、時分型の項目も
**`f.dateTime()` のまま宣言し、値は ISO のまま読み書き**します。基準日の規則は、あなたが
「この項目は時分型だ」と知っているところで**変換関数**に任せます（[ADR-0086][adr86]）。

<!-- doccheck: -->

```ts
import {
  PortersClient,
  decodeTimeOfDay,
  defineFields,
  encodeTimeOfDay,
} from "@joymerrevent/porters-connect";

const fields = defineFields({
  job: (f) => ({ U_startTime: f.dateTime() }), // 時分型でも dateTime() のまま
});
const porters = new PortersClient({
  hostname: process.env.PORTERS_HOST ?? "",
  appId: process.env.PORTERS_APP_ID ?? "",
  appSecret: process.env.PORTERS_APP_SECRET ?? "",
  fields,
});
const t = porters.tenant(1);

// 読む: ISO で届く値を時刻に戻す
const job = await t.job.get(10001);
const start =
  job?.U_startTime == null ? null : decodeTimeOfDay(job.U_startTime); // "09:00" / "26:00"

// 書く・検索する: 時刻を ISO にしてから渡す
await t.job.update(10001, { U_startTime: encodeTimeOfDay("26:00") }); // → 1970/01/02 02:00:00
await t.job.search({
  condition: { U_startTime: { ge: encodeTimeOfDay("15:00") } },
});
```

- `encodeTimeOfDay` は `"HH:mm"` か `"HH:mm:ss"`（`00:00`〜`47:59`）だけを受け付け、それ以外は
  `PortersConfigError`（`category: "validation"`）で**送る前に**止まります。PORTERS は基準日以外の
  値を Write では Code 103、`condition` では Code 100（**検索が実行されない**）で返すので、
  手前で止めるほうが「0 件だった」との取り違えを防げます。
- `decodeTimeOfDay` は基準日（`1970-01-01` / `1970-01-02`）の ISO だけを受け付けます。別の日付が
  来たら、その項目はたぶん時分型ではありません — エラーのヒントにそう書いてあります。
  秒が `00` でなければ `"HH:mm:ss"` で保持します（黙って落としません）。
- **変換を呼ぶかどうかはあなたの責務**です。呼ばずにオフセット付きの ISO（`+09:00`）を書くと、
  既存の日時の契約どおり UTC に換算されて**黙ってずれます**。`Z` 付きなら値は通ります。
- 管理者が時分型の項目を足すと、既存の連携が普通の日時を書いて Code 103 で落ちることがあります。
  `generateFieldDecls` は Field Type 12 の行にその注意を出します（[カスタム項目][custom-fields]）。

## 関連

- 要件: [R-10][prd]（ISO 8601・UTC で正規化し、業務タイムゾーン変換はしない）
- 決定: [ADR-0011][adr11]（変換を型駆動デコーダに集約）／[ADR-0016][adr16]（Data Type の粒度）／
  [ADR-0086][adr86]（時分型は型を増やさず変換関数で扱う）
- 手順: [検索][search-records]（`condition` の書き方）／[失敗の扱い][handle-failures]
- API 事実: [Field Type / Data Type][fdt]（wire 形式の一次情報）

[adr11]: ../../adr/0011-xml-parse-serialize.md
[adr16]: ../../adr/0016-field-type-granularity.md
[adr86]: ../../adr/0086-time-of-day-fields.md
[fdt]: ../reference/resource-api/field-data-types.md
[handle-failures]: ../howto/handle-failures.md
[prd]: ../../design/requirements.md
[custom-fields]: ../howto/custom-fields.md
[search-records]: ../howto/search-records.md
