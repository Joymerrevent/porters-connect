# RV-95 🟢 `field: []` と `expand` / `image` を一緒に指定すると、`expand` / `image` が黙って落ちる

- 重要度: 🟢 ／ 観点: ドキュメント / DX
- 状態: fixed

## 概要

`field: []` のときは `field` のパラメータ自体を送らないので、`expand` / `image` も送られない。公開の説明には書かれていない。

## 根拠

- `src/accessor/field-param.ts:96`。実測（サブエージェント）。

## 影響

🟢。組み合わせがまれ。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- 拒否するか、公開の JSDoc に書く。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

**実施（2026-09-27・fix/accessor-low-review・`30cfcc3・7cbd5c7`）。** 推奨のうち「公開の JSDoc に書く」を採った。拒否は採らなかった。ADR-0096（accepted）が「`field: []` のときは `expand` / `image` も送られない」を前提に型を決めているため、拒否に変えるとその決定を変えることになる。公開の説明（`SearchQuery.field`）と利用者向け文書（`query.md`）に書いた。

## 検証

`docs/usage/api/type-aliases/SearchQuery.md` と `docs/usage/topics/query.md` の記述。振る舞いは `field-param.test.ts` の「sends nothing for []」が固定している。
