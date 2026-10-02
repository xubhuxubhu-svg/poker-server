# 牌神擂台（撲克牌遊戲平台）
遊戲製作：Eric Hu

## 上傳到 GitHub
所有檔案都在同一層，沒有子資料夾。全部選起來拖進 GitHub 上傳即可。

## 在 Render 建立服務
- 新增「Web Service」，連結 `poker-server` 儲存庫
- Build Command：`npm install`
- Start Command：`npm start`
- 環境變數：`DATABASE_URL` 填入和成語擂台、麻將相同的 Neon 資料庫連線字串
  （會自動建立新的資料表 `poker_users`，不會影響其他遊戲的資料）

## 檔案說明
- index.html、style.css：網頁與畫面
- core.js、audio.js、effects.js、kit.js、games.js、main.js：平台共用功能（帳號、音樂、語音、特效、大廳）
- tenhalf.js、blackjack.js、baccarat.js、shootgate.js、crazy8.js、ninetynine.js、oldmaid.js、slap.js、sevens.js、redpoint.js、bluff.js、niuniu.js、solitaire.js、ginrummy.js、thirteen.js、big2.js、hearts.js、spades.js、holdem.js、bridge.js：各款遊戲
- trick.js：四方牌桌（大老二、傷心小棧、黑桃王、橋牌共用）
- net.js：真人連線（房間、同步、文字聊天、即時語音）
- challenge.js：挑戰賽與能力銘牌
- bgm1.mp3～bgm6.mp3：背景音樂（來源：Pixabay、StockTune）
- server.js、package.json：伺服器

## 真人連線怎麼玩
1. 用 Render 上的網址開啟（單機試玩版不能連線）。
2. 選一款遊戲 →「👥 真人連線」→「＋ 建立房間」，把畫面上的 4 位數房號告訴家人。
3. 家人進入同一款遊戲的「真人連線」，輸入房號加入。
4. 房主按「開始遊戲」，空位會由電腦補上。
5. 房間裡可以文字聊天，也可以按「🎤 加入語音」即時通話。
