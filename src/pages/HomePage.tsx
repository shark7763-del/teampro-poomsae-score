import { NonCertifiedNotice, Panel } from '../components/ui'
import { USATKD_RECOGNIZED_2026_01_01, WT_RECOGNIZED_2024_06_14 } from '../rules/profiles'

export function HomePage(): React.ReactElement {
  return (
    <div className="safe-area mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-4 p-4">
      <header className="pt-4">
        <p className="text-sm font-bold tracking-[0.2em] text-emerald-400">TEAMPRO</p>
        <h1 className="text-3xl font-black tracking-tight">跆拳道品勢計分系統</h1>
        <p className="mt-1 text-sm text-slate-400">
          TeamPro Poomsae Score · 公認品勢評分核心建置中
        </p>
      </header>

      <NonCertifiedNotice />

      <section className="grid gap-3 sm:grid-cols-2">
        <Panel title="目前可驗證">
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-slate-300">
            <li>WT 2024-06-14 公認品勢 Rule Profile。</li>
            <li>USATKD 2026-01-01 公認品勢 Rule Profile。</li>
            <li>三裁判平均與五裁判分別刪除最高、最低分。</li>
            <li>正確性、表現性、程序扣分與同分判定純函式。</li>
            <li>AutoResearch 固定 evaluation harness。</li>
          </ul>
        </Panel>

        <Panel title="下一階段">
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-slate-300">
            <li>建立品勢專用 Training、Control、Judge、Display 頁面。</li>
            <li>建立品勢房間事件模型與 LocalDemoTransport。</li>
            <li>接上 QR Code、房間碼、裁判席位與公布流程。</li>
            <li>加入手機與電視 viewport 測試。</li>
          </ul>
        </Panel>
      </section>

      <Panel title="已建立的規則版本">
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          {[WT_RECOGNIZED_2024_06_14, USATKD_RECOGNIZED_2026_01_01].map((profile) => (
            <div key={profile.id} className="rounded-lg border border-line bg-panel-2 p-3">
              <p className="font-bold text-white">{profile.name}</p>
              <p className="mt-1 text-slate-400">{profile.organization}</p>
              <p className="mt-1 text-slate-400">生效日：{profile.effectiveDate}</p>
              <p className="mt-1 text-slate-400">支援裁判數：{profile.supportedJudgeCounts.join(' / ')}</p>
            </div>
          ))}
        </div>
      </Panel>

      <footer className="pb-6 text-center text-xs text-slate-600">
        TeamPro Poomsae Score · 訓練、模擬賽及賽事輔助工具
      </footer>
    </div>
  )
}
