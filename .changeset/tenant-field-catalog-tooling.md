---
"@joymerrevent/porters-connect": minor
---

テナントの項目と宣言を突き合わせ、宣言を生成できるようにした（ADR-0069）。

`defineFields` はこれまで綴りの形（`U_`/`A_` 接頭辞・既知のリソース名）しか見ておらず、
宣言した項目がテナントに実在するか、宣言した Data Type が実物と合っているかは誰も確かめて
いなかった。ずれると**黙って壊れる** — 実物が Option の項目を `f.singlelineText()` と宣言すると、
読み取りは例外も警告も出さずに `null` を返し、「その項目は空だった」と区別が付かない。

追加した公開 API は 4 つ。いずれも opt-in で、呼ばなければ既存の挙動は変わらない
（`field_r` スコープが必要）。

- `readCustomCatalog(tenant, resource)` — テナントのカスタム項目を「alias → Data Type」で返す
- `verifyFields(tenant, fields)` — 宣言と実物を突き合わせ、5 区分のレポートを返す（**投げない**）
- `assertFieldsMatch(report)` — 落としたい運用のための 1 行（`PortersConfigError`）
- `generateFieldDecls(tenant, resources)` — `defineFields` の呼び出しをソース文字列で生成する

突合は `typeMismatch` / `missing` / `unverifiable` / `undeclared` / `undeclarable` に分ける。
読めなかったリソースを `missing` と混ぜないのが要点で、混ぜると偽の警報になりレポート全体が
読まれなくなる。生成は宣言できない型もコメントとして残す（消すと「テナントに無い」と読まれる）。

`active` の既定は用途で分けている。突合は `-1`（全件。`1` だと未使用の項目が `missing` と
誤報される）、生成は `1`（未使用の項目を雛形に並べる理由が無い）。

内部では Field Type Value ↔ Data Type の対応表を `src/resources/field-type.ts` に一本化した
（従来は逆方向のみがフェイクサーバー側にあった）。
