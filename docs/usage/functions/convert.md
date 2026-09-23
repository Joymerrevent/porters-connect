# 値の変換

PORTERS の値と、コードで扱いやすい値を行き来する関数です。時分型の項目の時刻、リソースを表す数値、
画像や添付の本体（Base64）の 3 つを扱います。

- **import 元**: `@joymerrevent/porters-connect`
- **PORTERS を呼ぶもの**: なし（純粋な関数）
- **使う場面**: 読み書きの値を組み立てるとき・読んだ値を解釈するとき

## 呼べる関数

<!-- 根拠: ADR-0079（リソース番号）・ADR-0086（時分型）・ADR-0064（Image の Base64） -->

このページの関数と、使い方の例です。

| 関数                    | 何をするか                                                                                                                     | 失敗の届き方                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| `encodeTimeOfDay(time)` | `"HH:mm"` / `"HH:mm:ss"`（00:00〜47:59）を、時分型の項目に書く ISO 8601 に変える（[日時と時分型][datetime]）                   | 同期 throw（範囲外・書式違い）         |
| `decodeTimeOfDay(iso)`  | 時分型の項目から読んだ ISO 8601 を `"HH:mm"`（秒があれば `"HH:mm:ss"`）に戻す                                                  | 同期 throw（基準日以外・時計の範囲外） |
| `resourceValueOf(name)` | リソース名（`"candidate"` など）を、PORTERS がリソースを表す数値に変える。`P_Resource` を書く・絞るときに使う（[検索][query]） | 失敗しない（名前は型で限定される）     |
| `resourceNameOf(value)` | 読んだ数値をリソース名に戻す。知らない数値は数値のまま返す                                                                     | 失敗しない                             |
| `bytesToBase64(bytes)`  | バイト列を Base64 の文字列にする。画像や添付の本体を送るときに使う（[Attachment][r-attachment]）                               | 失敗しない                             |
| `base64ToBytes(b64)`    | Base64 の文字列をバイト列に戻す。添付の本体を受け取ったときに使う                                                              | 失敗しない                             |

```ts
import {
  encodeTimeOfDay,
  decodeTimeOfDay,
  resourceValueOf,
  resourceNameOf,
} from "@joymerrevent/porters-connect";

const startsAt = encodeTimeOfDay("09:00"); // "1970-01-01T09:00:00Z"（時分型の項目に書く値）
const clock = decodeTimeOfDay("1970-01-02T02:00:00Z"); // "26:00"
const candidate = resourceValueOf("candidate"); // 1（P_Resource に書く値）
const name = resourceNameOf(3); // "job"
```

## 固有の注意

これらの関数だけに当てはまる注意です。共通の規則（時分型・リソース番号・画像と添付の大きさ）は主題別のページにあります。

- **どの項目が時分型かは、ライブラリには分かりません。** テナントの管理者に確かめたうえで、その項目の読み書きにだけ `encodeTimeOfDay` / `decodeTimeOfDay` を当てます。
- **`encodeTimeOfDay` / `decodeTimeOfDay` は `Promise` を返さないので、失敗は同期 throw です。** 範囲外の時刻や基準日以外の日付は `PortersConfigError` になります。
- **`resourceNameOf` は知らない数値をエラーにしません。** PORTERS がリソースを増やしたときに壊れないよう、数値のまま返します。
- **`bytesToBase64` は大きさを検査しません。** 画像の 2MB や添付の 10MB の上限は、書き込みのときに送信前に検査されます（[上限とレート][limits]）。

## 型

このページで出てくる型と役割です。正確な定義は各リンク先（[公開 API リファレンス][api]）にあります。

| 型                                       | 役割                                                  |
| ---------------------------------------- | ----------------------------------------------------- |
| [`ResourceName`][t-ResourceName]         | `resourceValueOf` の引数・`resourceNameOf` が返す名前 |
| [`ImageContentType`][t-ImageContentType] | 画像の本体に付ける MIME の種類（4 種）                |

## 関連

- 主題: [日時と時分型][datetime]（時分型）／[項目と値のかたち][fields]（リソース番号の 2 つの現れ方）／[検索][query]（リソース種別で絞る）／[上限とレート][limits]（画像と添付の大きさ）
- 関数: [宣言と突合][fn-declare]／[上限と接続][fn-transport]
- ほかの目的から探す: [目次][index]

[index]: ../index.md
[api]: ../api/index.md
[datetime]: ../topics/datetime.md
[fields]: ../topics/fields.md
[query]: ../topics/query.md
[limits]: ../topics/limits.md
[r-attachment]: ../resources/attachment.md
[fn-declare]: declare.md
[fn-transport]: transport.md
[t-ResourceName]: ../api/type-aliases/ResourceName.md
[t-ImageContentType]: ../api/type-aliases/ImageContentType.md
