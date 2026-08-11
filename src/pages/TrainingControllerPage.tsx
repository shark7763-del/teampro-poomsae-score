import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { AppLogo } from '../components/AppLogo'
import { TvUrlHint } from '../components/TvUrlHint'
import { Button, Notice, Panel, TextField } from '../components/ui'
import { elapsedSeconds } from '../training/state'
import { useTrainingController } from '../training/useTrainingRealtime'
import type { DisplayMode } from '../training/types'

/** 訓練線的分數是「十分位整數」(20 = 2.0)，與比賽線的百分位不同，所以自己格式化。 */
function formatTenths(points: number): string {
  return (points / 10).toFixed(1)
}

function formatTime(totalSeconds: number): string {
  return `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, '0')}`
}

export function TrainingControllerPage({
  initialDisplayCode = '',
  autoConnect = false,
}: {
  initialDisplayCode?: string
  autoConnect?: boolean
}): React.ReactElement {
  const { sessionId } = useParams()
  const controller = useTrainingController(sessionId)
  const state = controller.session.state
  const recentDisplay = controller.recentDisplay
  const [displayCode, setDisplayCode] = useState(initialDisplayCode || controller.recentDisplay?.displayCode || '')
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState<'minor' | 'major' | 'reset' | ''>('')
  const autoConnectStarted = useRef(false)

  async function connect(): Promise<void> {
    try {
      setError('')
      await controller.connectDisplay(displayCode)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '連接失敗')
    }
  }

  useEffect(() => {
    if (!autoConnect || autoConnectStarted.current || !displayCode) return
    autoConnectStarted.current = true
    void connect()
  })

  async function setMode(mode: DisplayMode): Promise<void> {
    await controller.setDisplayMode(mode)
  }

  function pulse(kind: 'minor' | 'major' | 'reset'): void {
    setFeedback(kind)
    window.setTimeout(() => setFeedback(''), 180)
    if ('vibrate' in navigator) navigator.vibrate(kind === 'major' ? 70 : 40)
  }

  async function addMinorMistake(): Promise<void> {
    pulse('minor')
    await controller.updateTraining({
      minorMistakes: state.minorMistakes + 1,
      lastPenalty: { kind: 'minor', value: 1, label: '-0.1', at: Date.now() },
      latestPublicHint: '小失誤：確認步伐與手部位置',
    })
  }

  async function addMajorMistake(): Promise<void> {
    pulse('major')
    await controller.updateTraining({
      majorMistakes: state.majorMistakes + 1,
      lastPenalty: { kind: 'major', value: 3, label: '-0.3', at: Date.now() },
      latestPublicHint: '大失誤：重新確認動作路線',
    })
  }

  async function restart(): Promise<void> {
    pulse('reset')
    await controller.resetTraining()
  }

  return (
    <main className="judge-shell">
      <section className="judge-header">
        <div>
          <AppLogo />
          <h1>教練訓練控制</h1>
          <p className="subtitle">手機控制訓練，電視只顯示公開資訊</p>
        </div>
      </section>
      <TvConnectionBar
        status={controller.connectionStatus}
        displayName={controller.displaySession?.displayName ?? controller.recentDisplay?.displayName ?? '未連接'}
        mode={state.displayMode}
        transportKind={controller.displaySession?.transportKind ?? 'local'}
      />
      {error ? <Notice>{error}</Notice> : null}
      <Panel title="連接電視">
        <TvUrlHint />
        <div className="setup-grid">
          <TextField label="六碼代碼" value={displayCode} onChange={(value) => setDisplayCode(value.toUpperCase())} />
          <div className="button-row align-end">
            <Button onClick={() => void connect()}>連接電視</Button>
            {recentDisplay ? <Button tone="secondary" onClick={() => void controller.connectDisplay(recentDisplay.displayCode)}>最近使用</Button> : null}
            <Link className="ghost-link" to="/training-display">
              開啟電視頁
            </Link>
          </div>
          {/*
            同時跑兩個場地時，兩台電視畫面只差六碼，遠看分不出來。
            命名後電視會把名稱顯示在最上方。
          */}
          <TextField
            label="場地名稱（電視上會顯示）"
            value={state.displayName}
            onChange={(displayName) => void controller.renameDisplay(displayName)}
          />
        </div>
      </Panel>

      <Panel title="訓練資料">
        <div className="setup-grid">
          <TextField label="選手姓名" value={state.athleteName} onChange={(athleteName) => void controller.updateTraining({ athleteName })} />
          <TextField label="單位" value={state.teamName} onChange={(teamName) => void controller.updateTraining({ teamName })} />
          <TextField label="品勢" value={state.poomsaeName} onChange={(poomsaeName) => void controller.updateTraining({ poomsaeName })} />
          <TextField label="訓練目標" value={state.publicGoal} onChange={(publicGoal) => void controller.updateTraining({ publicGoal })} />
          <TextField label="演練階段" value={state.phase} onChange={(phase) => void controller.updateTraining({ phase })} />
          <TextField label="公開提示" value={state.latestPublicHint} onChange={(latestPublicHint) => void controller.updateTraining({ latestPublicHint })} />
        </div>
      </Panel>

      <Panel title="計時與正確性">
        <div className="score-readout">
          <span>計時</span>
          <strong>{formatTime(elapsedSeconds(state))}</strong>
        </div>
        <div className="judge-actions">
          <button className={`deduct minor ${feedback === 'minor' ? 'pressed' : ''}`} onClick={() => void addMinorMistake()}>
            小失誤 -0.1
          </button>
          <button className={`deduct major ${feedback === 'major' ? 'pressed' : ''}`} onClick={() => void addMajorMistake()}>
            大失誤 -0.3
          </button>
          <button className="deduct undo" onClick={() => void controller.updateTraining({ minorMistakes: Math.max(0, state.minorMistakes - 1) })}>
            復原小失誤
          </button>
          <button className={`deduct reset ${feedback === 'reset' ? 'pressed' : ''}`} onClick={() => void restart()}>
            重新開始
          </button>
        </div>
        <div className="button-row">
          <Button onClick={() => void controller.startTimer()}>開始</Button>
          <Button tone="secondary" onClick={() => void controller.pauseTimer()}>暫停</Button>
        </div>
      </Panel>

      <Panel title="表現性">
        <div className="component-list">
          {[
            ['speedPower', '速度與力量'],
            ['rhythmTempo', '節奏與速度控制'],
            ['energyExpression', '氣勢表現'],
          ].map(([key, label]) => {
            const typedKey = key as keyof typeof state.presentation
            const value = state.presentation[typedKey]
            return (
              <div className="component-row" key={key}>
                <span>{label}</span>
                <div className="stepper-row">
                  <Button tone="secondary" onClick={() => void controller.updateTraining({ presentation: { ...state.presentation, [typedKey]: Math.max(0, value - 1) } })}>-</Button>
                  <strong>{formatTenths(value)}</strong>
                  <Button tone="secondary" onClick={() => void controller.updateTraining({ presentation: { ...state.presentation, [typedKey]: Math.min(20, value + 1) } })}>+</Button>
                </div>
              </div>
            )
          })}
        </div>
      </Panel>

      <Panel title="電視控制">
        <div className="action-stack">
          <div className="segmented">
            {[
              ['athlete', '選手訓練'],
              ['live-score', '即時評分'],
              ['result', '結果講評'],
            ].map(([mode, label]) => (
              <button key={mode} className={state.displayMode === mode ? 'active' : ''} onClick={() => void setMode(mode as DisplayMode)}>
                {label}
              </button>
            ))}
          </div>
          <label className="toggle-line"><input type="checkbox" checked={state.options.showTimer} onChange={(event) => void controller.setOption('showTimer', event.target.checked)} /> 顯示計時</label>
          <label className="toggle-line"><input type="checkbox" checked={state.options.showAccuracy} onChange={(event) => void controller.setOption('showAccuracy', event.target.checked)} /> 顯示正確性</label>
          <label className="toggle-line"><input type="checkbox" checked={state.options.showMistakeCounts} onChange={(event) => void controller.setOption('showMistakeCounts', event.target.checked)} /> 顯示失誤數量</label>
          <label className="toggle-line"><input type="checkbox" checked={state.options.showIssueTags} onChange={(event) => void controller.setOption('showIssueTags', event.target.checked)} /> 顯示問題標籤</label>
          <label className="toggle-line"><input type="checkbox" checked={state.options.autoPublishResult} onChange={(event) => void controller.setOption('autoPublishResult', event.target.checked)} /> 完成後自動公布結果</label>
          <div className="button-row">
            <Button onClick={() => void controller.publishResult()}>公布結果</Button>
            <Button tone="secondary" onClick={() => void restart()}>重新開始</Button>
            <Button tone="secondary" onClick={() => void controller.resync()}>強制重新同步</Button>
            <Button tone="secondary" onClick={() => void controller.setOption('hidden', !state.options.hidden)}>
              {state.options.hidden ? '顯示電視畫面' : '隱藏電視畫面'}
            </Button>
            <Button tone="secondary" onClick={() => void controller.disconnect()}>中斷連線</Button>
          </div>
        </div>
      </Panel>
    </main>
  )
}

function TvConnectionBar({
  status,
  displayName,
  mode,
  transportKind,
}: {
  status: string
  displayName: string
  mode: string
  transportKind: string
}): React.ReactElement {
  return (
    <div className="tv-connection-bar">
      <span className={`connection-dot ${status === 'connected' ? 'online' : ''}`} />
      <strong>{displayName}</strong>
      <span>{status}</span>
      <span>{mode}</span>
      <span>{transportKind === 'supabase' ? '跨裝置' : '本機測試'}</span>
    </div>
  )
}
