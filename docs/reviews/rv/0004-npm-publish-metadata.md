# RV-4 🟡 publishConfig.access と npm メタデータが未設定

- 重要度: 🟡 ／ 観点: リリース準備
- 状態: fixed

## 概要

スコープ付きパッケージ（`@joymerrevent/…`）は npm の既定が **private** なので、
`publishConfig.access: "public"` が無いと `npm publish` が**失敗する**。
併せて `repository` / `bugs` / `homepage` / `keywords` / `author` も未設定だった。

## 根拠

`package.json:1-23`（当時）— `publishConfig` が無く、npm レジストリ向けメタデータも欠けていた。
`version: "0.0.0"` は未公開段階として妥当だった。

## 影響

**初回公開の瞬間まで発火しない**が、発火したら公開そのものが止まる（latent なリリースブロッカー）。
メタデータ欠落のほうは公開できてしまうぶん厄介で、npm のページに
リポジトリ・Issue・キーワードが出ず、**発見性が落ちたまま既成事実になる**。
「収益化より多くの実利用者に使われること」を最優先目標に置いている以上、ここは効く。

## 検出経緯

初回クロスレビュー（[2026-06-17-01][run1] Run 1）の観点8（リリース準備）。
公開前チェックとして `package.json` を npm の要件と突き合わせた。

## 推奨

`publishConfig.access: "public"` を追加し、npm メタデータ（`repository` / `bugs` / `homepage` /
`keywords` / `author` / `license`）を補完する。**公開前に**対応する。

## 処置

`publishConfig.access: "public"` を追加し、npm メタデータ一式を補完した。
`exports` / `files` / `types` / `sideEffects: false` も併せて整備。

## 検証

[2026-06-17-01][run1] Run 2 で `package.json` の各項目を確認。
生成物（`dist` / `coverage` / `reports` / `tmp`）が git 非追跡であることも併せて確認した。
以降 **0.1.0〜0.8.0 の全 12 版が同じ設定で公開できている**＝実運用で裏が取れている。

[run1]: ../2026-06-17-01.md
