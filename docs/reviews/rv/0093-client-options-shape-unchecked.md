# RV-93 🟢 `transport` / `throttle` / `tokenStore` の形を、構築時に確かめていない

- 重要度: 🟢 ／ 観点: 設定検証
- 状態: open

## 概要

`tokenProvider` だけは構築時に形を確かめるが、ほかは最初のリクエストで PortersError ではない TypeError になる。`scopes` に文字列、`appId` に数を渡しても受け付ける。

## 根拠

- `src/porters-client.ts:424` 付近。実測（サブエージェント）: `opts.transport.send is not a function` の TypeError で reject した。

## 影響

🟢。型で止まるのは TypeScript の利用者だけだが、エラーには気づける。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- 構築時に、関数を持つべきオプションの形を確かめる（`tokenProvider` と同じ扱い）。
- 止めどきの規則（Low だけになったら直さずに記録する）により、この回では直さずに記録する。

## 処置

—
