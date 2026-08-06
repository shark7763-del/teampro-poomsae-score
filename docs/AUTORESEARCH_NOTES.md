# AutoResearch Notes for TeamPro Poomsae Score

## 原始目的

Andrej Karpathy 的 AutoResearch 是讓 AI agent 在小型但真實的 LLM 訓練專案中自動做研究：固定資料準備與評估函式，只允許修改指定範圍，跑固定時間訓練，讀固定指標，改善就保留，不改善就回復，並把每次結果寫入 TSV。

本專案移植的是這套可重複、可比較、可審查的工程循環，不是無限制產生程式。

## 核心循環

1. 先讀完整上下文與不可修改的評估工具。
2. 先跑原始 baseline。
3. 每次提出一個明確假設。
4. 每輪只改最小必要範圍。
5. 用相同條件跑測試與評估。
6. 改善且無硬性閘門失敗就 `keep`。
7. 沒改善、倒退或不值得的複雜度就 `discard`。
8. build、型別、測試崩潰則記為 `crash`。
9. 所有結果寫入 `experiments/results.tsv`。
10. keep 後提交 Git commit；discard 只回復本輪修改。

## 可移植到 Web App 開發的方法

- 固定 `evaluation/` 作為不隨實驗更動的評估工具。
- 把品勢計分正確性、流程成功率、同步可靠性、韌性、操作性與維護性量化。
- 每次實驗用同一組指令比較：`npm run typecheck`、`npm run lint`、`npm run test`、`npm run build`、`npm run evaluate`。
- 用 Git commit 邊界讓每輪差異可審查。
- 把規則來源與 Rule Profile 鎖在資料化結構，不讓 UI 自行計算。
- 將崩潰、找不到官方來源、尚待人工核對的規則也記錄，避免默默變成產品假設。

## 不能直接照搬的部分

- 原始任務只有一個 metric：`val_bpb`。Web App 有多個硬性門檻，尤其規則與安全性不能用總分平均掩蓋。
- 原始 repo 只允許修改 `train.py`。本專案需要新增規則、文件、測試、UI 與 transport abstraction，因此限制方式改為「每輪只改一個主要假設」。
- 原始流程可無限迴圈。本專案限制最多 12 輪。
- 原始評估可用固定 5 分鐘訓練，本專案每輪最多 15 分鐘。

## 固定評估工具

固定目錄為 `evaluation/`，實驗中不得為提高分數修改。第一版工具包含：

- `evaluation/scoring-fixtures/`
- `evaluation/workflow-tests/`
- `evaluation/realtime-tests/`
- `evaluation/accessibility-tests/`
- `evaluation/visual-viewports.json`
- `evaluation/evaluate.ts`
- `evaluation/baseline.json`

正式指令：

- `npm run test:scoring`
- `npm run test:workflow`
- `npm run test:realtime`
- `npm run test:e2e`
- `npm run build`
- `npm run evaluate:baseline`
- `npm run evaluate`

## 允許改動範圍

- `src/rules/profiles/`：Rule Profile 與來源 metadata。
- `src/poomsae/`：純函式計分、有限狀態、賽制與資料模型。
- `src/transport/`：`RoomTransport` abstraction 與 adapters。
- `src/pages/`、`src/components/`：品勢專用 Display、Control、Judge、Training UI。
- `tests/` 與 `src/**/*.test.ts`：新測試與既有行為保護。
- `docs/`、`README.md`：研究、架構與產品聲明。

## 禁止改動範圍

- 不得修改 `evaluation/` 來提高表面分數。
- 不得把規則數字寫進 React 元件。
- 不得把 USATKD 2026 規則稱為 WT 2026 規則。
- 不得建立未完成驗證的台灣 Rule Profile 並預設啟用。
- 不得在前端放入 service role key、管理金鑰或私密憑證。
- 不得用 `localStorage` 假裝跨裝置同步完成。
- 不得在公布前顯示個別裁判分數或暫時計算總分。

## keep / discard / crash 判定

- `keep`：評估總分提升或硬性能力從無到有，且 typecheck、lint、test、build 全通過，沒有安全或規則來源倒退。
- `discard`：總分未提升、造成需求倒退、複雜度不值得，或規則來源不明卻試圖預設啟用。
- `crash`：build 失敗、TypeScript 失敗、lint 失敗、計分測試失敗、測試工具崩潰或超過 15 分鐘仍無可驗證結果。
