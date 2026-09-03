# Steam → Discord おすすめゲームBot

[![Tests](https://github.com/broRYU/steam-discord-recommender/actions/workflows/daily.yml/badge.svg)](https://github.com/broRYU/steam-discord-recommender/actions/workflows/daily.yml)

Steamの「人気の近日登場」ランキングから、もうすぐリリースされる注目ゲームを選び、Discordの指定チャンネルへ画像付きで投稿する小さなBotです。Discord BotトークンやSteam APIキーは不要で、DiscordのIncoming Webhookを使います。

## 必要なもの

- Node.js 20以上
- 投稿先Discordチャンネルの「ウェブフックの管理」権限

## セットアップ

1. Discordで投稿先チャンネルの「チャンネルの編集」→「連携サービス」→「ウェブフック」→「新しいウェブフック」を開き、Webhook URLをコピーします。
2. `.env.example` を `.env` にコピーします。
3. `.env` の `DISCORD_WEBHOOK_URL` をコピーしたURLに変更します。このURLはパスワード同様に扱い、Gitへコミットしないでください。
4. 動作確認します。

```powershell
npm test
npm run dry-run
npm start
```

`npm run dry-run` はDiscordへ投稿せず、生成されるJSONだけを表示します。`npm start` は実際に1回投稿します。依存パッケージがないため `npm install` は不要です。

## 推薦条件

`.env` で変更できます。

| 変数 | 初期値 | 内容 |
| --- | ---: | --- |
| `RECOMMENDATION_MODE` | `upcoming` | `upcoming`は近日登場、`popular`は売れ筋・セール・新作 |
| `MAX_PRICE_YEN` | `5000` | 税込価格の上限（`popular`モードのみ） |
| `MIN_DISCOUNT_PERCENT` | `0` | 最低割引率（0〜100） |
| `POST_COUNT` | `1` | 1回に紹介する本数（1〜10） |
| `ALLOW_FREE_GAMES` | `true` | 無料ゲームを候補に含める |
| `ALLOW_MATURE_GAMES` | `false` | 年齢制限付きゲームを候補に含める |
| `EXCLUDE_APP_IDS` | 空 | 除外するApp ID（カンマ区切り） |

投稿済み作品は `data/history.json` に最大100件保存され、直近100件は候補から除外されます。条件に合う未投稿作品がなくなった場合は、重複投稿せずその回を終了します。

## 60分ごとに自動投稿する

`.github/workflows/daily.yml` は60分ごと（日本時間の毎時47分）に起動します。公開直後の誤投稿を防ぐため、初期状態では処理をスキップします。

自動投稿を有効にする場合は、リポジトリの「Settings」→「Secrets and variables」→「Actions」で次の2項目を登録してください。

- Repository secret: `DISCORD_WEBHOOK_URL` にDiscordのWebhook URL
- Repository variable: `ENABLE_DISCORD_POSTING` に `true`

実行時刻を変える場合はworkflowのcronをUTCで変更します。GitHub Actionsのscheduleは混雑時に遅れる場合があります。

## 注意

- 価格やセール状況は投稿時点のSteamストア情報です。購入前に必ずストアで確認してください。
- Steamストアの公開エンドポイントを利用しているため、Steam側の仕様変更時には取得処理の調整が必要になることがあります。
- Webhook URLが漏れた場合はDiscord側でWebhookを削除し、新しく作り直してください。
