# RV-4 🟡 publishConfig.access と npm メタデータが未設定

- 重要度: 🟡 ／ 観点: リリース準備
- 状態: fixed

## 概要

スコープ付き package（既定 private）に `publishConfig.access:"public"` が無く `npm publish` が失敗する。`repository`/`bugs`/`homepage`/`keywords`/`author` も未設定

## 根拠

`package.json:1-23`

## 推奨

`publishConfig.access:"public"` 追加、npm メタデータ補完（公開前）

## 処置

publishConfig.access=public ＋ npm メタデータ補完
