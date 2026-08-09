# Supabase 設定（P0-4 跨裝置同步）

做完這份文件，五支手機 + 電視 + iPad 才會真的互通。
在此之前系統一律是「本機模式」—— 只有同一台裝置的分頁會同步，這是設計上的 fallback，不是 bug。

預計 10 分鐘。全程只會用到 **anon key**。

---

## ⚠️ 唯一一條紅線

**絕對不要把 `service_role` key 貼到任何地方。**

它會繞過所有 RLS。只要進了前端 bundle，等於把整個資料庫公開到網路上，
而前端 bundle 是任何人都下載得到的。你只需要 **anon public** 那一把。

---

## 步驟 1：建立專案

1. 到 https://supabase.com 註冊 / 登入
2. New project
   - Name：`teampro-poomsae-score`
   - Database Password：自己設一組並存起來（之後改 schema 會用到）
   - Region：**Southeast Asia (Singapore)** ← 台灣連過去延遲最低
3. 等 2–3 分鐘建置完成

## 步驟 2：套用 schema

1. 左側 **SQL Editor** → New query
2. 打開專案裡的 `supabase/migrations/202608101_competition_rooms.sql`，
   把**整個檔案**貼進去
3. 按 **Run**

預期結果：`Success. No rows returned`。

如果最後兩行 `alter publication supabase_realtime add table ...` 報
`relation is already member of publication`，那是正常的，代表已經加過了，可以忽略。

> 訓練電視（`/tv`）那條線是另一份 migration：`202608061_training_display_sync.sql`。
> 如果你也要跨裝置的訓練電視，同樣貼進 SQL Editor 跑一次。

## 步驟 3：確認 Realtime 有開

左側 **Database → Replication**，確認 `supabase_realtime` 這個 publication 裡有：

- `competition_rooms`
- `competition_room_events`

沒有的話手動勾選。**這一步沒做，畫面不會即時更新，只有重新整理才看得到變化。**

## 步驟 4：取得憑證

左側 **Project Settings → API**：

| 欄位 | 對應環境變數 |
| --- | --- |
| Project URL（`https://xxxx.supabase.co`） | `VITE_SUPABASE_URL` |
| Project API keys → **anon public** | `VITE_SUPABASE_ANON_KEY` |

再說一次：**不要**複製 `service_role`。

## 步驟 5：設定線上版

在專案目錄執行（把值換成你的）：

```bash
gh secret set VITE_SUPABASE_URL --body "https://xxxx.supabase.co"
gh secret set VITE_SUPABASE_ANON_KEY --body "eyJhbGciOi..."
```

確認有進去：

```bash
gh secret list
```

然後**重新觸發一次部署**（secret 只在建置時讀取，不重建不會生效）：

```bash
gh workflow run "Build and Deploy"
```

## 步驟 6：設定本機開發

專案根目錄建立 `.env`（已在 `.gitignore`，不會被提交）：

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

```bash
npm run dev
```

---

## 驗收：確認真的跨裝置了

1. iPad 開 `/#/control`，按「進入主控端」
2. 畫面上的連線狀態應該從 🟠 本機模式 變成 **🟢 已連線**
   - 還是顯示本機模式 → 憑證沒讀到，回步驟 5／6
3. 用**另一支手機**（關掉 Wi-Fi 走 4G 更能證明）掃 J1 的 QR Code
4. iPad 的 J1 狀態應該在 1 秒內變成「已送出」

第 4 步成功 = P0-4 完成。

---

## 這套安全模型在做什麼

值得花兩分鐘看懂，因為它決定了「裁判能不能互相亂改分數」。

```
房號 ABC123          → 會出現在電視上，不是機密，不能拿來授權
Token（128 bit）     → 只存在 QR Code 連結裡
資料庫存的           → 只有 token 的 SHA-256 hash
```

- `competition_room_secrets`（存 hash 的表）**anon 完全沒有權限**，連 select 都沒有
- anon 對所有表**沒有任何直接寫入權限**
- 所有寫入都走 `security definer` 函式，由 PostgreSQL 在伺服器端比對 hash：
  - `submit_room_event` — J1 的 token 送 J2 的分數會被拒絕（錯誤碼 42501）
  - `save_room_snapshot` — 只有 host token 能寫 snapshot
- snapshot 進資料庫前會被 `sanitizeRoomState()` 拿掉 token；
  萬一前端忘了，SQL 函式裡還有第二道 `raise exception 'snapshot must not carry tokens'`

**為什麼計分規則不寫在資料庫**：去頭去尾與 tie-break 在 `RuleProfile`（TypeScript）裡。
再寫一份 SQL 版本，兩邊遲早不同步、算出不同分數。所以 Host 跑 reducer、把結果寫回 snapshot，
規則永遠只有一份。代價是 Host 必須在線 —— 那是教練的 iPad，本來就在現場。

---

## 常見狀況

**「找不到本機測試顯示器，跨裝置請設定 Supabase。」**
就是這份文件要解決的問題。手機和電視是不同裝置，本機 fallback 走的是 localStorage，
另一台裝置當然找不到。

**「這個房間不是由本裝置建立，無法取得主控權限。」**
主控 token 只存在建房的那台裝置。換裝置當主控要重新建一間房。
（這是刻意的：否則知道房號的人就能搶走主控權。）

**手機顯示「送出失敗：unauthorized actor for room」**
QR Code 的 token 過期或不對。房間預設 12 小時後過期，重新從主控端發一次 QR。

**成本**
免費方案（500MB 資料庫、200 併發 Realtime 連線）對單一道館的用量綽綽有餘。
房間有 12 小時 TTL，`purge_expired_competition_rooms()` 會清掉過期資料。
建議在 Database → Cron 排每小時跑一次。
