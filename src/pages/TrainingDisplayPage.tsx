import { Link, useParams } from 'react-router'
import { AppLogo } from '../components/AppLogo'
import { QrCode } from '../components/QrCode'
import { Notice } from '../components/ui'
import { elapsedSeconds, timerStatusText } from '../training/state'
import { useTrainingDisplay } from '../training/useTrainingRealtime'
import type { TrainingDisplayState } from '../training/types'

function appLink(path: string): string {
  return `${window.location.origin}${window.location.pathname}#${path}`
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function TrainingDisplayPage(): React.ReactElement {
  const { displayCode } = useParams()
  const { state, connectionStatus, transportKind } = useTrainingDisplay(displayCode?.toUpperCase())

  if (state === null) {
    return (
      <main className="training-tv-shell">
        <AppLogo />
        <h1>訓練顯示器啟動中</h1>
        <p className="display-meta">{connectionStatus}</p>
      </main>
    )
  }

  if (!displayCode) {
    return <TrainingDisplayWaiting state={state} transportKind={transportKind} />
  }

  if (state.options.hidden) {
    return (
      <main className="training-tv-shell">
        <AppLogo />
        <h1>顯示已隱藏</h1>
        <p className="display-meta">等待教練手機重新開啟畫面</p>
      </main>
    )
  }

  return <TrainingDisplayScreen state={state} connectionStatus={connectionStatus} transportKind={transportKind} />
}

function TrainingDisplayWaiting({
  state,
  transportKind,
}: {
  state: TrainingDisplayState
  transportKind: 'local' | 'supabase'
}): React.ReactElement {
  const connectUrl = appLink(`/training/connect/${state.displayCode}?sessionId=${state.sessionId}`)
  return (
    <main className="training-tv-shell">
      <section className="training-tv-wait">
        <div>
          <AppLogo />
          <h1>Training Display</h1>
          <p className="display-meta">等待教練手機連接</p>
        </div>
        <div className="tv-code">{state.displayCode}</div>
        <QrCode value={connectUrl} label="手機掃描連接" size={260} />
        {transportKind === 'local' ? <Notice>本機測試模式：只能同一台裝置的瀏覽器分頁同步。跨手機與電視請設定 Supabase。</Notice> : null}
        <Link className="ghost-link" to={`/training-display/${state.displayCode}`}>
          進入顯示畫面
        </Link>
      </section>
    </main>
  )
}

function TrainingDisplayScreen({
  state,
  connectionStatus,
  transportKind,
}: {
  state: TrainingDisplayState
  connectionStatus: string
  transportKind: 'local' | 'supabase'
}): React.ReactElement {
  const elapsed = elapsedSeconds(state)
  if (state.displayMode === 'result' && state.result !== null) {
    return (
      <main className="training-tv-shell">
        <section className="training-tv-result">
          <AppLogo />
          <h1>{state.athleteName}</h1>
          <p className="display-meta">
            {state.teamName} · {state.poomsaeName}
          </p>
          <div className="tv-score">{(state.result.total / 10).toFixed(1)}</div>
          <div className="tv-result-grid">
            <Metric label="正確性" value={(state.result.accuracy / 10).toFixed(1)} />
            <Metric label="速度與力量" value={(state.result.speedPower / 10).toFixed(1)} />
            <Metric label="節奏與速度控制" value={(state.result.rhythmTempo / 10).toFixed(1)} />
            <Metric label="氣勢表現" value={(state.result.energyExpression / 10).toFixed(1)} />
          </div>
          <div className="tv-issues">
            <h2>修正重點</h2>
            {(state.result.topIssues.length ? state.result.topIssues : ['保持重心穩定', '完成動作後再銜接下一動']).map((issue) => (
              <p key={issue}>{issue}</p>
            ))}
          </div>
          <p className="display-meta">下一次目標：{state.result.nextGoal}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="training-tv-shell">
      <section className="training-tv-live">
        <div>
          <AppLogo />
          <h1>{state.athleteName}</h1>
          <p className="display-meta">
            {state.teamName} · {state.poomsaeName} · {state.phase}
          </p>
        </div>
        <div className="tv-timer">{state.options.showTimer ? formatTime(elapsed) : timerStatusText(state.timerStatus)}</div>
        <div className="tv-goal">{state.publicGoal}</div>
        {state.displayMode === 'live-score' ? (
          <>
            {state.lastPenalty ? <PenaltyLamp kind={state.lastPenalty.kind} label={state.lastPenalty.label} /> : null}
            <div className="tv-result-grid">
              {state.options.showAccuracy ? <Metric label="正確性" value={((40 - state.minorMistakes - state.majorMistakes * 3) / 10).toFixed(1)} /> : null}
              {state.options.showMistakeCounts ? <Metric label="小失誤 -0.1" value={String(state.minorMistakes)} /> : null}
              {state.options.showMistakeCounts ? <Metric label="大失誤 -0.3" value={String(state.majorMistakes)} /> : null}
              <Metric label="狀態" value={timerStatusText(state.timerStatus)} />
            </div>
          </>
        ) : null}
        {state.options.showIssueTags && state.latestPublicHint ? <p className="tv-hint">{state.latestPublicHint}</p> : null}
        <p className="display-meta">
          {connectionStatus} · {transportKind === 'supabase' ? '跨裝置同步' : '本機測試'}
        </p>
      </section>
    </main>
  )
}

function PenaltyLamp({ kind, label }: { kind: 'minor' | 'major'; label: string }): React.ReactElement {
  return (
    <div className={`penalty-lamp ${kind}`}>
      <span>{kind === 'minor' ? '小失誤' : '大失誤'}</span>
      <strong>{label}</strong>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="tv-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
