---
"@joymerrevent/porters-connect": patch
---

PORTERS 以外が返した HTTP エラー（`category: "config"`）の `hint` に、0.18.0 で廃止した
オプション名 `host` が残っていました。現在の `hostname` / `port` / `scheme` を指すように直しました。
挙動は変わりません（説明文だけの変更）。
