---
"@joymerrevent/porters-connect": minor
---

Field Read で Process の項目カタログを読めるようにした（RV-37）。

`t.field.search({ resource: "process" })` はこれまで型エラーで書けなかった。PORTERS の
Resource List は Process に Value 7 を与えており Process Field List の記事も存在するので、
非対応は判断ではなく書き落としだった。

原因は**同じ事実の対応表が 2 つあった**こと。`field.ts` が独自に持っていた 10 件の表から
Process が抜けており、正しい 11 件の表（`resource-list.ts`）とずれていた。表を後者に一本化し、
公開型 `ResourceType` は `ResourceName` の別名にした（同じ集合を指すため）。

`ResourceType` に `"process"` が増える**拡張**で、既存の指定は影響を受けない。
ずれた原因は片方にしか網羅テストが無かったことなので、Field Read 側にも
「Value を持つリソースを全部覆い、それ以外は含まない」検査を置いた。
