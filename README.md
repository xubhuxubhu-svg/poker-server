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
