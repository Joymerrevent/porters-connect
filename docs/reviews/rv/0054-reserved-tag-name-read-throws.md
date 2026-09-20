# RV-54 🟡 予約名の alias は書けるのに読めず、その例外が PortersError の外に出る

- 重要度: 🟡 ／ 観点: エラーモデル / API 忠実性
- 状態: open

## 概要

`prototype` / `constructor` / `__proto__` を選択肢 alias に持つ項目は、**書き込みは通るのに
読み取りが例外になる**。しかもその例外は `fast-xml-parser` が投げる素の `Error` で、
**`PortersError` の系統に属さない**＝エラーハンドリングのガイドが「これで分岐してください」と
書いている型に引っかからない。

## 根拠

**実測**（`src` を直接呼んで確認）:

| alias         | `isXmlName` | Write    | Read                                                                                |
| ------------- | ----------- | -------- | ----------------------------------------------------------------------------------- |
| `prototype`   | true        | **通る** | **throws** `[SECURITY] Invalid name: "prototype" is a reserved JavaScript keyword…` |
| `constructor` | true        | 通る     | 同上                                                                                |
| `__proto__`   | true        | 通る     | 同上                                                                                |
| `toString`    | true        | 通る     | ok（予約リストに入っていない）                                                      |
| `Option.P_OK` | true        | 通る     | ok                                                                                  |

投げているのは `fast-xml-parser`（`src/xml/parser.ts` が呼ぶ `XMLParser.parse`）で、
プロトタイプ汚染対策として**タグ名を拒否**する。エラーの実体:

```text
class          : Error
PortersError?  : false
message        : [SECURITY] Invalid name: "prototype" is a reserved JavaScript keyword that could cause prototype pollution
```

`PortersError` の外に出る点が本体。[ADR-0006][adr6] は判別可能なエラー型を定め、
[エラーハンドリングのガイド][guide]は `PortersError` で分岐するよう案内している。
**これは [RV-36][rv36] と同じ形**（日時変換の `RangeError` が系統の外に出ていた）。

**接頭辞が付く経路は無事**。`<Person.prototype>` のように `.` を含むタグ名は予約名と一致しない
ので読める（実測で確認）。危ないのは**入れ子の中の裸のタグ名**＝ Option の `<OptionRoot>` の
子（選択肢 alias）と、同じ形で入れ子になる値。

なお [ADR-0085][adr85] の XML Name 検証は**これを弾かない**（予約名はどれも妥当な XML Name）。
弾くべきかどうかは別の判断で、下記「推奨」のとおり。

## 影響

**今日の実害は小さい。** 選択肢 alias は PORTERS 側の命名で、`prototype` という alias を
作るテナントは考えにくい（出典の例はすべて `Option.P_*`）。だから 🔴 ではない。

効いてくるのは 2 点:

- **倒れ方が契約から外れている。** 利用者が `catch (e) { if (e instanceof PortersError) … }` と
  書いていると、この例外だけ素通りしてアプリ側の最上位まで飛ぶ。ライブラリの外に
  「知らない形の例外」が出ることは、[ADR-0006][adr6] が塞いだはずの穴。
- **`__proto__` は現実に起こりうる**。`prototype` とは違い、ライブラリ側で
  **自分が組み立てた XML を読み戻す**経路（フェイクサーバー・評価用のモック）でも踏みうる。

発火は **latent**（テナントがその alias を持つ場合のみ）だが、踏んだときに
**原因がライブラリの外に見える**のが問題。

## 検出経緯

[RV-48][rv48] の実装で、property-based テストに `fc.string()` を流したときに
`fast-xml-parser` が `prototype` を拒否して落ちた。そのときは「パーサ自身の都合が
不変条件をぼやけさせる」として**テスト側を生の文字列で数える形に変えて回避**したが、
**回避しただけで、ライブラリの挙動としての非対称は残っていた**。
本 finding はその残りを起票したもの。

## 推奨

**まず (a) だけで足りる可能性が高い。**（b）は挙動変更なので要 ADR。

- (a) **読み取り側で `PortersError` に包む**（推奨・挙動変更なし）。`src/xml/parser.ts` の
  `parse` 呼び出しを `try/catch` し、`PortersResourceError`（`category: "unknown"`）に
  変換する。[RV-36][rv36] の処置とまったく同じ形で、**系統の外に例外を出さない**という
  既存の決定を適用するだけ。これだけで「原因がライブラリの外に見える」問題は消える。
- (b) **書き込み側でも弾く**（要 ADR）。読めない値を書けてしまう非対称自体を無くす案。
  ただし **PORTERS が受け付ける値を、このライブラリの都合（JS パーサの制約）で拒否する**
  ことになるので、[ADR-0002][adr2]（正典に無いことを発明しない）との兼ね合いを判断する必要がある。
  (a) を先に入れれば、踏んだときに何が起きたか分かるので、(b) は実例が出てから決めてよい。
- (c) パーサの設定で予約名の拒否を無効化する — **取らない**。プロトタイプ汚染対策を
  外すことになり、安全側と逆に倒れる。

## 処置

—

[adr2]: ../../adr/0002-ground-design-in-live-api-docs.md
[adr6]: ../../adr/0006-error-model.md
[adr85]: ../../adr/0085-option-alias-validation.md
[guide]: ../../usage/howto/handle-failures.md
[rv36]: 0036-write-value-validation-partial.md
[rv48]: 0048-option-alias-xml-injection.md
