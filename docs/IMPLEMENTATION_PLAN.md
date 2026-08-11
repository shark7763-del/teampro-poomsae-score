# IMPLEMENTATION_PLAN — TeamPro Poomsae Score

依據 [`CURRENT_STATE.md`](./CURRENT_STATE.md) 的盤點結果。
原則：**refactor 現有程式碼，不重寫**；每個階段結束都要 `lint / typecheck / test / build` 全綠才進下一階段。

---

## 進度標記

| 狀態 | 意義 |
| --- | --- |
| ✅ | 已完成並驗證（測試綠 + build 過） |
| 🚧 | 進行中 |
| ⬜ | 未開始 |
| 🔴 | 被阻塞（見 CURRENT_STATE §7） |

---

## P0 — 核心：真 Realtime、角色、計分可靠度

沒有 P0，這套系統就只是 demo。

### P0-1 Scoring Engine 重建 ✅

- [x] 內部精度從 ×10 改為 **×100**，可正確表達 `7.63`
- [x] `formatScore()` 支援 2 位小數；分項顯示維持可讀
- [x] `JudgeCount` 統一為 `1 | 3 | 5 | 7`（Training 1/3/5、WT Simulation 5/7）
- [x] Trimming 規則由 RuleProfile 驅動，支援 7 判
- [x] **Tie-break 引擎**：`higher_presentation` → `include_trimmed_scores` → `rematch_required`
- [x] **Typed procedure deduction**：`{ type: 'BOUNDARY', value: -30 }`，UI 不得硬編碼數值
- [x] 單元測試涵蓋：0.01 精度、1/3/5/7 判、去頭尾、同分三層判定、重複送出

**不需要 Supabase，可完全驗證。**

### P0-2 Room domain 重建 ✅

- [x] 修 `RESET` 摧毀 `lastSequence` / `appliedEventIds` 的 bug（含回歸測試）
- [x] 「下一位選手」保留 Room / 比賽設定 / 選手姓名，只清評分與程序扣分
- [x] `judgeCount` 型別統一為 `JudgeCount`，可容納 7 判
- [x] **選手 Queue**：`QUEUE_REPLACED` / `QUEUE_REORDERED` / `NEXT_ATHLETE` / `SKIP_ATHLETE`，
      換人自動帶入姓名/單位/品勢，重排時遺漏的人不會消失
- [x] 真正的 **idempotency**：`submissionId = slot:round`，狂按送出只會算一筆；
      退回該裁判時會清掉他的 submissionId，才補得回分數
- [x] **結構化 audit log**：`AuditEntry[]`，涵蓋 `ROOM_CREATED` / `ATHLETE_STARTED` /
      `JUDGE_SUBMITTED` / `JUDGE_REOPENED` / `SCORE_LOCKED` / `SCORE_REVEALED` /
      `ATHLETE_CHANGED` / `PENALTY_APPLIED` / `PENALTY_UNDONE` / `QUEUE_UPDATED` / `DENIED`

**不需要 Supabase，可完全驗證。**

### P0-3 角色與 Token ✅

- [x] `createRoom()` 產生 `hostToken` / `judgeTokens[J1..J7]` / `displayToken`
- [x] Token 用 `crypto.getRandomValues` 產生 128 bit hex，**不是 `J1`/`J2`**
- [x] 路由 `/judge/:roomCode/:slot?token=xxx`，QR Code 由主控端帶 token 發出
- [x] Reducer 驗證：JUDGE 只能送自己的 slot；HOST 不能代送分；DISPLAY 唯讀
- [x] 越權事件不推進 `lastSequence`（否則偽造大 sequence 就能卡死房間），並寫入 `DENIED`
- [x] Host token 存本機，重整後仍保有主控權；換裝置則明確拒絕
- [x] **token 絕不進入共享 snapshot**（`sanitizeRoomState`），資料庫只存 SHA-256 hash

### P0-4 Room Realtime Transport ✅（僅剩實體裝置斷網實測）

- [x] 抽 `RoomTransport` 介面（比照 `TrainingRealtimeTransport`）
- [x] `SupabaseRoomTransport`：RPC 寫入 + postgres_changes 訂閱 + 連線狀態回報
- [x] `LocalRoomTransport`：保留為 fallback，UI 明確標示「🟠 本機模式」
- [x] SQL migration `202608101_competition_rooms.sql`：
      `competition_rooms` / `competition_room_secrets` / `competition_room_events`
      + RLS + 三個 security definer 函式做伺服器端 token 驗證
- [x] 權威模型：Host 跑 reducer 寫 snapshot，計分規則只有 TypeScript 一份
- [x] Host 重整後由本機 token 復原主控權
- [x] **端對端驗收**：憑證已設定，資料層授權由外部 REST 實測通過
      （讀 rooms 200／讀 secrets 401／繞過函式 INSERT 401／偽造 token 送分 401）
- [x] Display refresh 後代碼不變（多裝置 E2E 覆蓋）
- [ ] Reconnect 實測：手機切 4G、鎖屏（需實體裝置）

### P0-5 三角色 UI 拆分與重做 ⬜

- [ ] `RoomPages.tsx` 拆成 `pages/host/` `pages/judge/` `pages/display/`
- [ ] Judge：Minor/Major/Undo 大按鈕 + `Minor × N / Major × N` 即時統計 + 連線燈號
- [ ] Judge：Presentation 改為快速扣分而非 17 次 stepper
- [ ] Host：選手 Queue + 裁判在線/送分狀態 + Penalty 快捷 + 超大「下一位」
- [ ] Display：16:9、超大字、公布動畫、RANK
- [ ] 連線狀態燈號 🟢🟡🔴 三端都要有

### P0-6 誠實的離線提示 ⬜

- [ ] 沒有 Supabase 憑證時，首頁明確顯示「本機模式，跨裝置不會同步」
- [ ] 離線時顯示「目前離線，等待重新連線」，**不得假裝已同步**

### P0-7 測試升級 🚧

- [x] E2E 改用**多個獨立 browser context** 模擬不同裝置
      （`tests/e2e/multi-device-venues.spec.ts`，playwright 新增 `multi-device` project）
- [x] 兩個場地並行不互相污染：代碼不同、選手與扣分不會跨場地外洩
- [x] 電視重整保持自己的代碼
- [x] 守門測試：偵測到「本機模式」就失敗，避免退回假 realtime 還以為測過了
- [ ] 情境：Host 建房 → 5 Judge 加入 → 送分 → Lock → Reveal → Next Athlete
- [ ] 壓力：1 Host + 7 Judge + 1 Display，驗證無 race condition / duplicate / score lost
- [ ] Reconnect 測試：中途 reload judge page，身分與已送分數還在

---

## P1 — 訓練價值

### P1-1 訓練紀錄資料庫 ⬜
Athletes / Sessions / Scores 三張表，記錄選手、日期、品勢、Accuracy、Presentation、Penalty、Total、Minor、Major。

### P1-2 訓練結果畫面 ⬜
本次 vs 上次對比、進步幅度（`+0.30`）。

### P1-3 弱項分析 ⬜
Accuracy / Presentation 趨勢，最近 5 次平均，指出主要弱項。**規則式，不接 AI API。**

### P1-4 訓練建議 ⬜
規則式文案（Minor 過多 → 設定下次目標 ≤ 4）。介面預留 AI 插槽。

### P1-5 History 頁 ⬜
列表 + 明細（各裁判分數、Accuracy / Presentation / Penalty）。

### P1-6 成績卡輸出 ⬜
PNG 優先、PDF 次之。含 TeamPro Logo、選手、日期、品勢、總分、分項。適合 LINE 分享。

### P1-7 PWA 補完 ⬜
確認 installable / offline shell。離線時 realtime 功能明確標示不可用。

---

## P2 — 賽事延伸

### P2-1 Cut-off ⬜
Preliminary / Semifinal / Final、排名、晉級。

### P2-2 Tournament Mode ⬜
Chung vs Hong 對戰，Display 顯示 `CHUNG VS HONG`，依 scoring 自動判勝。

### P2-3 進階分析 ⬜
跨選手、跨時間的統計。

---

## 每階段驗收指令

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e   # 需先 npx playwright install
```

失敗就直接修，不只回報。

---

## 最終驗收情境（P0 完成的定義）

教練拿 iPad 建立 5 人裁判品勢測驗 → 系統產生 J1–J5 QR →
5 位裁判用**各自的手機**掃描 → 電視開 Display →
王小明上場 → 五位裁判評分 → Host 即時看到 5 個 ✅ →
Host 鎖定並公布 → 電視立即顯示 →
Host 點「下一位」→ 陳小華 → **五支手機不用重新加入**，直接評下一輪。

這串流程在**不同實體裝置**上跑通，P0 才算完成。
