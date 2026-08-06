# TeamPro Poomsae Score

TeamPro 跆拳道品勢計分系統。這是獨立的品勢系統，不是「TeamPro 跆拳道簡易計分系統」的部署頁，也不覆蓋原本對練計分系統。

線上版：

https://shark7763-del.github.io/teampro-poomsae-score/

## 產品聲明

本系統為訓練、模擬賽及賽事輔助工具，並非 World Taekwondo 認證電子計分設備。正式賽事仍應依主辦單位最新競賽規程及認可設備辦理。

不得宣稱本系統為 WT 官方認證、WT 指定系統，或可直接取代正式國際賽認證設備。

## 目前可用功能

- 獨立首頁建立品勢房間碼。
- 主控端可設定規則版本、3/5 位裁判、選手、單位、指定品勢、程序扣分。
- 主控端顯示 Display 與 J1-J5 裁判端 QR Code。
- 裁判端手機可輸入小失誤、大失誤、復原、三項表現性，並送出鎖定。
- 公開顯示端在公布前只顯示選手資訊、階段、J1-J5 送出狀態，不顯示分數。
- 主控端鎖定後公布成績，顯示正確性、表現性、程序扣分及最終總分。
- 單機訓練模式 `#/training` 可直接計算 3/5 裁判品勢分數。

## 路由

- `#/control`：建立房間。
- `#/control/:roomCode`：主控端。
- `#/judge/:roomCode/:slot`：裁判端，例如 `#/judge/ABC234/J1`。
- `#/display/:roomCode`：公開顯示端。
- `#/training`：單機訓練模式。

## 規則版本

第一版內建：

- `WT_RECOGNIZED_2024_06_14`：WT 公認品勢規則公開版本，生效日 2024-06-14。
- `USATKD_RECOGNIZED_2026_01_01`：USA Taekwondo 2026 Poomsae Rules，生效日 2026-01-01。

重要差異：

- 不把 USATKD 2026 誤稱為 WT 2026。
- 若 WT 最新公開版本仍為 2024，文件中明確標示為 2024。
- 台灣版本尚未在程式中啟用，除非找到並核對官方文件。

## 計分核心

分數內部使用整數單位，避免 JavaScript 浮點誤差：

- `10.0` 儲存為 `100`
- `4.0` 儲存為 `40`
- `0.1` 儲存為 `1`
- `0.3` 儲存為 `3`

公認品勢第一版：

- 總分 10.0。
- 正確性最高 4.0。
- 表現性最高 6.0。
- 表現性三項各最高 2.0：速度與力量、節奏與速度控制、氣勢表現。
- 小失誤扣 0.1。
- 大失誤扣 0.3。
- 5 位裁判時，正確性與表現性分別刪除一個最高分與一個最低分後平均。
- 3 位裁判時不刪除最高最低。
- 程序扣分在裁判平均後扣除。

## 連線方式

目前 MVP 使用 `BroadcastChannel + localStorage` 的 Local Demo Transport：

- 同一台裝置的多個分頁可即時同步。
- 裁判端送出後不能再次修改，需由主控端退回。
- eventId 去重，sequence 防止舊事件覆蓋新狀態。
- 重新整理後從 localStorage 恢復房間狀態。

跨手機的雲端 Realtime Transport 尚未接上；目前不會用 localStorage 假裝已完成跨裝置同步。

## 本機執行

```bash
cd "D:\TeamPro Poomsae Score"
npm install
npm run dev
```

Vite 會顯示本機網址，通常是：

```text
http://localhost:5173/
```

## 驗證指令

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run evaluate
```

目前驗證結果：

- TypeScript：通過。
- ESLint：通過。
- Vitest：2 個測試檔、7 個測試通過。
- Build：通過。
- Evaluation：75/100。

## 部署

```bash
git push origin main
```

GitHub Actions 會建置並部署到：

https://shark7763-del.github.io/teampro-poomsae-score/

## 未完成項目

- 真正跨裝置 Realtime Transport。
- Supabase RLS / 裁判席位 token / 房間有效期限。
- Cut-off 排名模式完整 UI。
- 單淘汰模式完整 UI。
- Playwright 手機與顯示端視覺測試。
- 台灣官方品勢規則來源核對與 Rule Profile。
