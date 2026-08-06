import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { QrCode } from '../components/QrCode'
import { Button, Notice, Panel, TextField } from '../components/ui'
import type { JudgeScoreInput } from '../poomsae/scoring'
import { computeJudgeScore, formatScore } from '../poomsae/scoring'
import { generateRoomCode, judgeSlots, scoreRoom } from '../poomsae/room'
import { useRoom } from '../poomsae/useRoom'
import { RULE_PROFILES, WT_RECOGNIZED_2024_06_14 } from '../rules/profiles'

function appLink(path: string): string {
  return `${window.location.origin}${window.location.pathname}#${path}`
}

export function ControlEntryPage() {
  const [roomCode, setRoomCode] = useState(generateRoomCode())

  return (
    <main className="page-shell">
      <section className="hero-row">
        <div>
          <p className="brand">TEAMPRO</p>
          <h1>跆拳道品勢計分系統</h1>
          <p className="subtitle">獨立品勢系統。控制端建立房間後，裁判以 QR Code 加入。</p>
        </div>
        <Link className="ghost-link" to="/training">
          單機訓練模式
        </Link>
      </section>

      <Notice>本系統供訓練、模擬賽及賽事輔助使用，並非 WT 認證競賽設備。</Notice>

      <Panel title="建立房間">
        <div className="setup-grid">
          <TextField label="房間碼" value={roomCode} onChange={(value) => setRoomCode(value.toUpperCase())} />
          <div className="button-row align-end">
            <Button tone="secondary" onClick={() => setRoomCode(generateRoomCode())}>
              重新產生
            </Button>
            <Link className="primary-link" to={`/control/${roomCode}`}>
              進入主控端
            </Link>
          </div>
        </div>
      </Panel>
    </main>
  )
}

export function ControlPage() {
  const { roomCode } = useParams()
  if (!roomCode) return <Navigate to="/control" replace />
  return <ControlRoom roomCode={roomCode.toUpperCase()} />
}

function ControlRoom({ roomCode }: { roomCode: string }) {
  const { state: room, publish } = useRoom(roomCode)
  const result = scoreRoom(room)
  const profile = RULE_PROFILES[room.profileId] ?? WT_RECOGNIZED_2024_06_14
  const slots = judgeSlots(room.judgeCount)
  const completeCount = slots.filter((slot) => room.judgeScores[slot]).length

  return (
    <main className="page-shell">
      <section className="hero-row">
        <div>
          <p className="brand">CONTROL</p>
          <h1>主控端 {room.roomCode}</h1>
          <p className="subtitle">{room.status}</p>
        </div>
        <div className="button-row">
          <Link className="ghost-link" to={`/display/${room.roomCode}`}>
            顯示端
          </Link>
          <Link className="ghost-link" to="/training">
            訓練模式
          </Link>
        </div>
      </section>

      <Panel title="賽事設定">
        <div className="setup-grid">
          <label className="field">
            <span>規則版本</span>
            <select
              value={room.profileId}
              onChange={(event) => publish({ type: 'UPDATE_SETTINGS', patch: { profileId: event.target.value } })}
            >
              {Object.values(RULE_PROFILES).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.effectiveDate}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span>裁判數</span>
            <div className="segmented">
              {[3, 5].map((count) => (
                <button
                  key={count}
                  className={room.judgeCount === count ? 'active' : ''}
                  onClick={() => publish({ type: 'UPDATE_SETTINGS', patch: { judgeCount: count as 3 | 5 } })}
                >
                  {count} 位裁判
                </button>
              ))}
            </div>
          </div>
          <TextField
            label="選手姓名"
            value={room.athleteName}
            onChange={(athleteName) => publish({ type: 'UPDATE_SETTINGS', patch: { athleteName } })}
          />
          <TextField
            label="單位"
            value={room.teamName}
            onChange={(teamName) => publish({ type: 'UPDATE_SETTINGS', patch: { teamName } })}
          />
          <TextField
            label="指定品勢"
            value={room.poomsaeName}
            onChange={(poomsaeName) => publish({ type: 'UPDATE_SETTINGS', patch: { poomsaeName } })}
          />
          <div className="field">
            <span>程序扣分</span>
            <div className="stepper-row">
              <Button
                tone="secondary"
                onClick={() => publish({ type: 'UPDATE_SETTINGS', patch: { procedureDeductions: room.procedureDeductions - 3 } })}
              >
                -0.3
              </Button>
              <strong>{formatScore(room.procedureDeductions)}</strong>
              <Button
                tone="secondary"
                onClick={() => publish({ type: 'UPDATE_SETTINGS', patch: { procedureDeductions: room.procedureDeductions + 3 } })}
              >
                +0.3
              </Button>
            </div>
          </div>
        </div>
      </Panel>

      <div className="two-column">
        <Panel title="房間 QR Code">
          <div className="qr-list">
            <div className="qr-card">
              <QrCode value={appLink(`/display/${room.roomCode}`)} />
              <strong>公開顯示端</strong>
            </div>
            {slots.map((slot) => (
              <div className="qr-card" key={slot}>
                <QrCode value={appLink(`/judge/${room.roomCode}/${slot}`)} />
                <strong>{slot} 裁判端</strong>
                <span>{room.judgeScores[slot] ? '已送出' : '未送出'}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="流程控制">
          <div className="action-stack">
            <Button onClick={() => publish({ type: 'START_SCORING' })}>開始評分</Button>
            <Button disabled={completeCount < room.judgeCount} onClick={() => publish({ type: 'LOCK_SCORES' })}>
              鎖定成績
            </Button>
            <Button disabled={room.status !== 'SCORES_LOCKED'} onClick={() => publish({ type: 'PUBLISH_SCORES' })}>
              公布成績
            </Button>
            <Button tone="secondary" onClick={() => publish({ type: 'RESET' })}>
              下一位選手
            </Button>
          </div>
          <div className="status-grid">
            {slots.map((slot) => (
              <div className="status-pill" key={slot}>
                <span>{slot}</span>
                <strong>{room.judgeScores[slot] ? '已送出' : '等待中'}</strong>
                {room.judgeScores[slot] && room.status !== 'PUBLISHED' ? (
                  <Button tone="secondary" onClick={() => publish({ type: 'RETURN_SCORE', judgeSlot: slot })}>
                    退回
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="主控成績">
        <p className="muted">
          {profile.name} · 已送出 {completeCount}/{room.judgeCount}
        </p>
        {room.status === 'PUBLISHED' ? <ScoreSummary result={result} /> : <p>公布前不顯示個別裁判分數與暫時計算總分。</p>}
      </Panel>
    </main>
  )
}

export function JudgePage() {
  const { roomCode, slot } = useParams()
  if (!roomCode || !slot) return <Navigate to="/control" replace />
  return <JudgeRoom roomCode={roomCode.toUpperCase()} judgeSlot={slot.toUpperCase()} />
}

function JudgeRoom({ roomCode, judgeSlot }: { roomCode: string; judgeSlot: string }) {
  const { state: room, publish } = useRoom(roomCode)
  const profile = RULE_PROFILES[room.profileId] ?? WT_RECOGNIZED_2024_06_14
  const [deductions, setDeductions] = useState<number[]>([])
  const [presentation, setPresentation] = useState<Record<string, number>>(() =>
    Object.fromEntries(profile.scoring.presentationComponents.map((component) => [component.id, component.max])),
  )
  const locked = room.judgeScores[judgeSlot] !== undefined
  const draft = useMemo<JudgeScoreInput>(
    () => ({
      judgeSlot,
      minorMistakes: deductions.filter((value) => value === profile.deductions.minorMistake).length,
      majorMistakes: deductions.filter((value) => value === profile.deductions.majorMistake).length,
      presentation,
      submittedAt: 0,
    }),
    [deductions, judgeSlot, presentation, profile.deductions.majorMistake, profile.deductions.minorMistake],
  )
  const score = computeJudgeScore(profile, draft)

  function applyDeduction(value: number) {
    if (locked) return
    if (navigator.vibrate) navigator.vibrate(25)
    setDeductions((items) => [...items, value])
  }

  return (
    <main className="judge-shell">
      <section className="judge-header">
        <div>
          <p className="brand">JUDGE</p>
          <h1>{judgeSlot} 裁判端</h1>
          <p className="subtitle">
            房間 {room.roomCode} · {room.athleteName} · {room.poomsaeName}
          </p>
        </div>
      </section>
      {locked ? <Notice>此裁判分數已送出並鎖定。若需修改，請由主控端退回。</Notice> : null}
      <Panel title="正確性">
        <div className="score-readout">
          <span>目前分數</span>
          <strong>{formatScore(score.accuracy)}</strong>
        </div>
        <div className="judge-actions">
          <button className="deduct minor" disabled={locked} onClick={() => applyDeduction(profile.deductions.minorMistake)}>
            小失誤 -0.1
          </button>
          <button className="deduct major" disabled={locked} onClick={() => applyDeduction(profile.deductions.majorMistake)}>
            大失誤 -0.3
          </button>
          <button className="deduct undo" disabled={locked || deductions.length === 0} onClick={() => setDeductions((items) => items.slice(0, -1))}>
            復原
          </button>
        </div>
        <p className="muted">最近一次：{deductions.length ? `-${formatScore(deductions[deductions.length - 1] ?? 0)}` : '尚無扣分'}</p>
      </Panel>
      <Panel title="表現性">
        <div className="component-list">
          {profile.scoring.presentationComponents.map((component) => {
            const value = presentation[component.id] ?? component.max
            return (
              <div className="component-row" key={component.id}>
                <span>{component.name}</span>
                <div className="stepper-row">
                  <Button
                    tone="secondary"
                    disabled={locked}
                    onClick={() => setPresentation((current) => ({ ...current, [component.id]: Math.max(0, value - component.step) }))}
                  >
                    -
                  </Button>
                  <strong>{formatScore(value)}</strong>
                  <Button
                    tone="secondary"
                    disabled={locked}
                    onClick={() =>
                      setPresentation((current) => ({
                        ...current,
                        [component.id]: Math.min(component.max, value + component.step),
                      }))
                    }
                  >
                    +
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
        <div className="score-readout">
          <span>表現性小計</span>
          <strong>{formatScore(score.presentation)}</strong>
        </div>
      </Panel>
      <div className="sticky-submit">
        <Button
          disabled={locked || room.status !== 'WAITING_FOR_SUBMISSIONS'}
          onClick={() => publish({ type: 'SUBMIT_SCORE', score: { ...draft, submittedAt: Date.now() } })}
        >
          確認送出
        </Button>
      </div>
    </main>
  )
}

export function DisplayPage() {
  const { roomCode } = useParams()
  if (!roomCode) return <Navigate to="/control" replace />
  return <DisplayRoom roomCode={roomCode.toUpperCase()} />
}

function DisplayRoom({ roomCode }: { roomCode: string }) {
  const { state: room } = useRoom(roomCode)
  const result = scoreRoom(room)
  const slots = judgeSlots(room.judgeCount)

  return (
    <main className="display-shell">
      <section>
        <p className="brand">TEAMPRO</p>
        <h1>{room.athleteName}</h1>
        <p className="display-meta">
          {room.teamName} · {room.poomsaeName} · {room.status}
        </p>
      </section>
      <section className="display-status">
        {slots.map((slot) => (
          <div className="display-judge" key={slot}>
            <span>{slot}</span>
            <strong>{room.judgeScores[slot] ? '已送出' : '等待'}</strong>
          </div>
        ))}
      </section>
      {room.status === 'PUBLISHED' ? (
        <section className="published-score">
          <ScoreSummary result={result} />
        </section>
      ) : (
        <Notice>評分期間僅顯示裁判連線與送出狀態，公布前不顯示分數。</Notice>
      )}
    </main>
  )
}

function ScoreSummary({ result }: { result: ReturnType<typeof scoreRoom> }) {
  return (
    <div className="score-summary">
      <div>
        <span>正確性</span>
        <strong>{formatScore(result.accuracy)}</strong>
      </div>
      <div>
        <span>表現性</span>
        <strong>{formatScore(result.presentation)}</strong>
      </div>
      <div>
        <span>程序扣分</span>
        <strong>{formatScore(result.procedureDeductions)}</strong>
      </div>
      <div className="final">
        <span>最終總分</span>
        <strong>{formatScore(result.total)}</strong>
      </div>
    </div>
  )
}
