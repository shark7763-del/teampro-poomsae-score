# CURRENT_STATE — TeamPro Poomsae Score 現況分析

盤點日期：2026-08-10
盤點對象：`main` @ `923fed1`、線上版 `https://shark7763-del.github.io/teampro-poomsae-score/`
規模：`src/` 共 3,167 行 TypeScript / TSX，29 個檔案

---

## 0. 最重要的一句話

**線上版現在完全無法跨裝置同步，而且不是程式寫錯，是根本沒有憑證。**

實測證據：

```
$ gh secret list
(空 — repo 沒有任何 Actions secret)

$ 抓線上 bundle index-BLvOzqL6.js
NO supabase.co URL in bundle
no anon key baked in
local fallback transport IS in bundle
```

`.github/workflows/deploy.yml` 建置時讀 `secrets.VITE_SUPABASE_URL` / `secrets.VITE_SUPABASE_ANON_KEY`，
但這兩個 secret 從未建立，所以 `import.meta.env.VITE_SUPABASE_URL` 是 `undefined`，
`getSupabaseClient()` 回傳 `null`（`src/lib/supabaseClient.ts:8`），
`createTrainingTransport()` 一律退回 `LocalTrainingTransport`（`src/training/transport.ts:307`）。

**結論：今天在正式網站上，五支手機掃 QR Code 進來，彼此看不到任何東西。**
這件事單靠改程式碼解不掉，需要一組 Supabase 專案憑證。詳見 §7 阻塞項。

---

## 1. 架構現況

專案裡其實有**兩套互不相通的子系統**，這是最大的結構性問題：

```
                    ┌─────────────────────────────────────────┐
  比賽/計分這條線    │  RoomPages.tsx (390 行，Host+Judge+       │
  （使用者驗收情境） │  Display 三個角色全塞在一個檔案)          │
                    │        ↓                                 │
                    │  useRoom.ts → BroadcastChannel           │
                    │              + localStorage              │
                    │  ❌ 沒有 Supabase，永遠只有同瀏覽器同步    │
                    └─────────────────────────────────────────┘

                    ┌─────────────────────────────────────────┐
  訓練顯示這條線     │  TrainingControllerPage / DisplayPage    │
  （後來才做的）     │        ↓                                 │
                    │  useTrainingRealtime.ts                  │
                    │        ↓                                 │
                    │  TrainingRealtimeTransport (介面)        │
                    │    ├─ SupabaseTrainingTransport ✅       │
                    │    │   private channel + RLS + snapshot   │
                    │    └─ LocalTrainingTransport (fallback)  │
                    └─────────────────────────────────────────┘
```

**好消息**：訓練那條線的 realtime 架構是認真做的 —— transport 介面抽象、
private channel、presence、snapshot 回補、序號去重、reconnect 都有
（`src/training/transport.ts`、`supabase/migrations/202608061_training_display_sync.sql`）。

**壞消息**：使用者驗收情境要的「5 裁判掃 QR → 送分 → Host 鎖定 → 電視公布 → 下一位」
走的是**另一條**線，那條線完全沒有接上這套 transport。

**所以 P0 不是「從零蓋 realtime」，是「把比賽房間搬到已經驗證過的 transport 模式上」** ——
這是 refactor，不是重寫，符合「不要砍掉重練」的要求。

---

## 2. 路由與角色

`src/App.tsx` 共 11 條路由，HashRouter（GitHub Pages 子路徑部署的正確選擇）。

| 路由 | 角色 | 現況問題 |
| --- | --- | --- |
| `/control/:roomCode` | Host | 無任何身分驗證 |
| `/judge/:roomCode/:slot` | Judge | **知道房號就能冒充任何裁判** |
| `/display/:roomCode` | Display | 無限制（唯讀，風險較低） |
| `/training`、`/tv/:code`、`/c/:code` | 訓練線 | 與比賽線資料不互通 |

### 權限是零

`/judge/ABC123/J1` 這種網址，`slot` 直接從 URL 參數取，沒有 token：

```ts
// RoomPages.tsx:219-221
const { roomCode, slot } = useParams()
return <JudgeRoom roomCode={roomCode.toUpperCase()} judgeSlot={slot.toUpperCase()} />
```

任何人只要看到電視上的房號，就可以打開 `/judge/ABC123/J3` 代替 J3 送分，
或反覆改 slot 把五個裁判分數全部灌完。使用者規格要求的
`hostToken` / `judgeToken` / `displayToken` **完全不存在**。

---

## 3. Scoring Engine

`src/poomsae/scoring.ts` + `src/rules/profiles/` —— 這部分是專案裡品質最好的地方。

**做對的事**：
- 規則抽成 `RuleProfile`，有 `id` / `effectiveDate` / `sources`（連 WT 條文出處都附了）
- 內部用整數（分數 ×10）避免浮點誤差
- 高低分去除（trimming）對 Accuracy / Presentation **分開計算**，這是 WT 的正確做法
- 重複 judgeSlot 會被過濾並回報 `duplicate_submission`

**缺陷**：

### 3.1 精度不足以表達 WT 分數（嚴重）

內部整數是 ×10，`formatScore()` 是 `(score/10).toFixed(1)`，
所以系統**最多只能表示到小數第一位**。

但使用者自己的規格範例寫的是：

```
TOTAL
7.63
```

`7.63` 這個數字目前的引擎**表示不出來**。5 位裁判去頭去尾後平均 3 個人，
`average()` 直接 `Math.round()`（`scoring.ts:124`），把 0.01 級距的資訊丟掉。
WT 公布成績是到小數第 2 位的 —— 這是**計分正確性**問題，不是顯示問題。

### 3.2 Tie-break 只是字串，沒有實作

`RuleProfile.tieBreak: ['higher_presentation', 'include_trimmed_scores', 'rematch_required']`
定義了，但整個 codebase **沒有任何地方讀它**。同分判定完全沒做。

### 3.3 程序扣分沒有型別

`RoomState.procedureDeductions: number` —— 只存 `-3`，不知道是出界、超時還是重新開始。
使用者明確要求存成 `{ type: "BOUNDARY", value: -0.3 }`，目前做不到，也無法做報表分析。

Host UI 更是直接硬寫 `±3`（`RoomPages.tsx:146,153`），繞過 RuleProfile：

```tsx
patch: { procedureDeductions: room.procedureDeductions - 3 }   // 硬編碼
```

### 3.4 裁判人數型別不一致

- `scoring.ts:3` — `export type JudgeCount = 1 | 3 | 5`
- `room.ts:10` — `judgeCount: 3 | 5`
- `types.ts:8` — `supportedJudgeCounts: Array<3 | 5>`

三處不一致。使用者要的 Training 1/3/5 + WT Simulation 5/7 都放不進去（**沒有 7**）。

---

## 4. 房間狀態機的實際 Bug

### 4.1 `RESET` 摧毀去重狀態（真實 bug）

```ts
// room.ts:100-101
case 'RESET':
  return { ...createRoom(state.roomCode), profileId: state.profileId, judgeCount: state.judgeCount }
```

這裡**丟掉了 `base`**，所以 `lastSequence` 歸零、`appliedEventIds` 清空。

後果：RESET 之後，一個延遲抵達的舊事件（例如 sequence 12 的 `SUBMIT_SCORE`）
不再被 `event.sequence <= state.lastSequence` 擋下，會被當成新事件套用到**下一位選手**身上。
現場網路一抖動就可能把上一位的分數灌到下一位。

### 4.2 「下一位選手」會清掉比賽設定

`RESET` 用 `createRoom()` 重建，只保留 `profileId` 和 `judgeCount`，
所以 `athleteName` 被重設成 `'選手 A'`、`teamName` 回到 `'TeamPro'`、`poomsaeName` 回到 `'太極八章'`。

使用者要求「按下下一位後，清空裁判評分，但保留 Room / 裁判連線 / 比賽設定 / 裁判身分」——
目前保留得不夠，而且沒有選手 Queue 可以自動帶入下一位。

### 4.3 沒有真正的 idempotency key

`SUBMIT_SCORE` 靠兩層防護：`appliedEventIds` 記最近 100 筆 eventId，
加上「該 slot 已有分數就忽略」。但 `eventId` 是送出當下才生成
（`room.ts:126`，`Date.now() + Math.random()`），
所以**同一個裁判連按兩次送出會產生兩個不同 eventId**，
只是剛好被「slot 已有分數」擋下。若中間夾一個 `RETURN_SCORE`，重送就會穿透。
使用者要求的 `submissionId` 語意不存在。

### 4.4 Audit log 是字串陣列

`auditLog: string[]`，而且**只有 `RETURN_SCORE` 會寫入**（`room.ts:91`）。
規格要求的 `ROOM_CREATED` / `ATHLETE_STARTED` / `JUDGE_SUBMITTED` / `SCORE_LOCKED` /
`SCORE_REVEALED` / `ATHLETE_CHANGED` 都沒有，也不是結構化資料，無法查詢。

---

## 5. UI / UX 現況

### 5.1 首頁

`ControlEntryPage` 一打開就是「房間碼輸入框 + 6 個 QR Code」，
沒有使用者要求的三個入口（快速訓練 / 模擬比賽 / 連接大螢幕）。
第一次使用的教練不知道該從哪裡開始。

### 5.2 Judge UI（`RoomPages.tsx:224-328`）

**做對的**：大按鈕、`navigator.vibrate` 觸覺回饋、sticky 送出列。

**問題**：
- Presentation 預設**滿分**（`useState` 初始值 `component.max`），裁判什麼都不做送出就是 6.0
- Presentation 用 `+ / -` stepper，每步 0.1，從 6.0 調到 4.3 要按 17 次
- 沒有顯示 `Minor × 1 / Major × 1` 統計，只有「最近一次」
- 沒有連線狀態指示，裁判不知道自己斷線了
- 送出後只能等 Host 退回，畫面沒有任何「已送出、等待中」的進度感

### 5.3 Display（`RoomPages.tsx:336-367`）

這是**一般網頁縮放版**，不是電視 scoreboard：
- 沒有 16:9 佈局假設
- 字級由 CSS class 決定，不是遠距離可讀的超大字
- 公布後沒有動畫，`ScoreSummary` 是四個小方塊
- 沒有 RANK

**唯一做對的**：公布前確實不洩漏個別裁判分數（`status === 'PUBLISHED'` 才渲染）。

### 5.4 Host

流程控制四顆按鈕（開始/鎖定/公布/下一位）都在，`disabled` 條件也正確。
但沒有選手 Queue、沒有裁判連線狀態（只有「已送出/等待中」，
無法分辨「裁判在線但還沒送」和「裁判手機掉線」）。

---

## 6. 測試現況

| 檔案 | 內容 | 評價 |
| --- | --- | --- |
| `scoring.test.ts` | 5 個 case：格式化、3 判平均、1 判、5 判去頭尾、重複送出 | 紮實，但**沒有 tie-break、沒有 7 判、沒有 0.01 精度** |
| `room.test.ts` | 3 個 case：完整流程、重複/過期事件、退回 | 覆蓋基本，**沒測到 §4.1 的 RESET bug** |
| `state.test.ts` / `transport.test.ts` | 訓練線 | 尚可 |
| `tests/e2e/training-tv-sync.spec.ts` | Playwright | **同一個 browser context 開兩個 page** |

E2E 那個問題要特別講：`browser.newContext()` 之後 `context.newPage()` 兩次，
兩個 page 共用同一個 origin 的 BroadcastChannel，所以**這個 E2E 就算 realtime 完全沒接上也會過**。
它驗證的是 UI 邏輯，不是跨裝置同步。這正是規格說的「只做假的 realtime demo」。

目前 18 個測試全綠，但**沒有一個測試會因為「跨裝置同步壞掉」而失敗**。

---

## 7. 阻塞項（需要你提供，我做不到）

### 🔴 BLOCKER-1：Supabase 專案憑證

沒有這個，P0 的 realtime **無法在正式站生效，也無法端對端驗證**。

需要你做（約 10 分鐘）：
1. 到 https://supabase.com 建免費專案，區域選 **Southeast Asia (Singapore)**
2. Project Settings → API，複製 **Project URL** 和 **anon public** key
3. 在 repo 設定兩個 Actions secret：
   ```
   gh secret set VITE_SUPABASE_URL   --body "https://xxxx.supabase.co"
   gh secret set VITE_SUPABASE_ANON_KEY --body "eyJhbGci..."
   ```
4. 本機 `.env` 也放同樣兩行（`.env` 已在 `.gitignore`）

⚠️ **只給 anon key，絕對不要給 service role key。** service role 會繞過 RLS，
進了前端 bundle 等於資料庫全公開。

我會把 SQL migration、RLS policy、token 機制全部寫好，你貼上憑證就能跑。

### 🟡 BLOCKER-2：真實跨裝置驗收

Playwright 可以用**多個獨立 browser context**模擬不同裝置（我會改寫 E2E），
但「手機斷 Wi-Fi 切 4G」「電視 refresh」這類情境，最終仍需要你拿實體裝置在道館試一次。

---

## 8. 技術債總表

| # | 項目 | 嚴重度 | 位置 |
| --- | --- | --- | --- |
| 1 | 線上版無 Supabase 憑證，跨裝置完全不通 | 🔴 致命 | deploy.yml / GH secrets |
| 2 | 比賽房間只有 BroadcastChannel | 🔴 致命 | `useRoom.ts` |
| 3 | 無角色 token，可冒充任意裁判 | 🔴 致命 | `RoomPages.tsx:219` |
| 4 | 分數精度只到 0.1，表達不出 7.63 | 🔴 高 | `scoring.ts:32,124` |
| 5 | `RESET` 摧毀去重狀態，舊事件可穿透 | 🔴 高 | `room.ts:100` |
| 6 | 程序扣分無型別，無法報表分析 | 🟡 中 | `room.ts:14` |
| 7 | Tie-break 定義了但沒實作 | 🟡 中 | `profiles/index.ts:35` |
| 8 | 裁判數型別三處不一致、缺 7 判 | 🟡 中 | `scoring.ts:3` / `room.ts:10` |
| 9 | Audit log 只是字串且只記一種事件 | 🟡 中 | `room.ts:91` |
| 10 | 無選手 Queue | 🟡 中 | 不存在 |
| 11 | Display 不是電視規格 | 🟡 中 | `RoomPages.tsx:336` |
| 12 | Judge Presentation 預設滿分、調整要按 17 次 | 🟡 中 | `RoomPages.tsx:228,287` |
| 13 | E2E 同 context，測不到跨裝置 | 🟡 中 | `training-tv-sync.spec.ts:4` |
| 14 | 三個角色擠在一個 390 行檔案 | 🟢 低 | `RoomPages.tsx` |
| 15 | 訓練線與比賽線資料不互通、無 History | 🟢 低 | 架構 |

---

## 9. 建議架構

保留現有的好東西（RuleProfile、transport 介面、整數計分、HashRouter），
把比賽線重構成與訓練線同構：

```
src/
  rules/                    規則層（唯一真相來源）
    profiles/               RuleProfile 定義 + 版本
    tiebreak.ts             ← 新增：同分判定引擎
  scoring/                  ← 由 poomsae/scoring.ts 升級
    engine.ts               0.01 精度、1/3/5/7 判、trimming
    penalties.ts            ← 新增：typed procedure deduction
  room/                     ← 由 poomsae/room.ts 升級
    model.ts                RoomState + 選手 Queue + 結構化 audit
    reducer.ts              事件 reducer（修 RESET bug、真 idempotency）
    tokens.ts               ← 新增：host/judge/display token 生成與驗證
    transport.ts            ← 新增：介面 + Supabase 實作 + Local fallback
    useRoom.ts              React 綁定
  pages/
    host/                   ← 由 RoomPages.tsx 拆出
    judge/
    display/
supabase/migrations/
    xxx_competition_rooms.sql   ← 新增：rooms/scores 表 + RLS + token 驗證
```

**不動**：`src/training/*`（已經能用，且是 transport 的參考實作）、`src/components/*`、路由結構。

---

## 10. 分數評估（規格的驗收表，現況）

| 項目 | 配分 | 現況 | 說明 |
| --- | --- | --- | --- |
| First-use UX | 10 | **3** | 首頁直接丟房號＋6 個 QR，無引導 |
| Training workflow | 10 | **5** | 訓練線可用，但無紀錄、無趨勢 |
| Judge UX | 10 | **5** | 大按鈕對了，Presentation 操作太慢、無連線狀態 |
| Host UX | 10 | **5** | 流程按鈕齊，無 Queue、無裁判在線狀態 |
| Display | 10 | **3** | 網頁縮放版，非電視 scoreboard |
| Realtime reliability | 15 | **2** | 線上版根本不通，只有同瀏覽器分頁 |
| Scoring correctness | 15 | **9** | 引擎品質好，但精度 0.1、無 tie-break |
| Mobile usability | 5 | **3** | 未針對 390/430 實測 |
| Security | 5 | **1** | 無 token、無資料層權限 |
| Maintainability | 5 | **3** | 規則層好，UI 層三角色擠一檔 |
| **總分** | **100** | **39** | |

目標：P0 完成後 realtime / security / scoring 拉到門檻以上。
