import { Link, Navigate, useParams } from 'react-router'
import { ActionButton, NonCertifiedNotice, Panel } from '../components/ui'
import { QrCode } from '../components/QrCode'
import { roomLink, shortHostUrl } from '../room/links'
import { RECOGNIZED_RULE_PROFILES, WT_RECOGNIZED_2024_06_14 } from '../rules/profiles'
import { computeJudgeScore, formatScore, type JudgeScoreInput } from '../poomsae/scoring'
import {
  activeJudgeSlots,
  computeRoomResult,
  generateRoomCode,
  type PoomsaeRoomState,
} from '../poomsae/roomSession'
import { usePoomsaeRoom } from '../poomsae/usePoomsaeRoom'
import { useState } from 'react'

export function ControlEntryPage(): React.ReactElement {
  return <Navigate to={`/control/${generateRoomCode()}`} replace />
}

export function ControlPage(): React.ReactElement {
  const roomCode = useParams().roomCode?.toUpperCase()
  if (roomCode === undefined) return <ControlEntryPage />
  return <ControlRoomPage roomCode={roomCode} />
}

function ControlRoomPage({ roomCode }: { roomCode: string }): React.ReactElement {
  const { state, publish } = usePoomsaeRoom(roomCode)
  const slots = activeJudgeSlots(state.judgeCount)
  const allSubmitted = slots.every((slot) => state.judgeScores[slot] !== undefined)

  return (
    <Shell title="主控端" roomCode={roomCode}>
      <NonCertifiedNotice />
      <p className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-sm text-sky-200">
        LocalDemoTransport：目前支援同一瀏覽器多分頁示範。跨手機即時同步是下一階段。
      </p>

      <section className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <Panel title="場次設定">
          <div className="grid gap-3 md:grid-cols-2">
            <TextInput
              label="選手姓名"
              value={state.athleteName}
              onChange={(athleteName) =>
                publish({ type: 'UPDATE_SETTINGS', roomCode, patch: { athleteName } })
              }
            />
            <TextInput
              label="單位"
              value={state.teamName}
              onChange={(teamName) => publish({ type: 'UPDATE_SETTINGS', roomCode, patch: { teamName } })}
            />
            <TextInput
              label="指定品勢"
              value={state.poomsaeName}
              onChange={(poomsaeName) =>
                publish({ type: 'UPDATE_SETTINGS', roomCode, patch: { poomsaeName } })
              }
            />
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              規則版本
              <select
                value={state.profileId}
                onChange={(event) =>
                  publish({
                    type: 'UPDATE_SETTINGS',
                    roomCode,
                    patch: { profileId: event.target.value },
                  })
                }
                className="min-h-[48px] rounded-lg border border-line bg-panel-2 px-3 text-white"
              >
                {Object.values(RECOGNIZED_RULE_PROFILES).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[3, 5].map((count) => (
                <ActionButton
                  key={count}
                  onClick={() =>
                    publish({
                      type: 'UPDATE_SETTINGS',
                      roomCode,
                      patch: { judgeCount: count as 3 | 5 },
                    })
                  }
                  tone={state.judgeCount === count ? 'primary' : 'neutral'}
                >
                  {count} 裁判
                </ActionButton>
              ))}
            </div>
            <div className="grid grid-cols-[1fr_80px_1fr] gap-2">
              <ActionButton
                onClick={() =>
                  publish({
                    type: 'UPDATE_SETTINGS',
                    roomCode,
                    patch: { procedureDeductions: Math.max(0, state.procedureDeductions - 3) },
                  })
                }
              >
                -0.3
              </ActionButton>
              <div className="flex items-center justify-center rounded-lg bg-panel-2 text-xl font-black">
                {formatScore(state.procedureDeductions)}
              </div>
              <ActionButton
                onClick={() =>
                  publish({
                    type: 'UPDATE_SETTINGS',
                    roomCode,
                    patch: { procedureDeductions: state.procedureDeductions + 3 },
                  })
                }
              >
                +0.3
              </ActionButton>
            </div>
          </div>
        </Panel>

        <Panel title="加入連結">
          <div className="grid gap-2">
            <QrCode value={roomLink(`/display/${roomCode}`)} label="顯示端" size={132} />
            <p className="text-center text-xs text-slate-400">
              {shortHostUrl()}#/display/{roomCode}
            </p>
          </div>
        </Panel>
      </section>

      <Panel title="裁判狀態">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {slots.map((slot) => (
            <div key={slot} className="rounded-lg border border-line bg-panel-2 p-3">
              <p className="text-xl font-black">{slot}</p>
              <p className="mt-1 text-sm text-slate-300">
                {state.judgeScores[slot] === undefined ? '未送出' : '已送出'}
              </p>
              <div className="mt-3 grid gap-2">
                <Link
                  to={`/judge/${roomCode}/${slot}`}
                  className="flex min-h-[44px] items-center justify-center rounded-lg border border-line bg-panel px-2 text-sm font-bold"
                >
                  開啟裁判端
                </Link>
                <ActionButton
                  onClick={() => publish({ type: 'RETURN_JUDGE_SCORE', roomCode, judgeSlot: slot })}
                  disabled={state.judgeScores[slot] === undefined}
                >
                  退回重評
                </ActionButton>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="成績控制">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr]">
          <ActionButton onClick={() => publish({ type: 'START_SCORING', roomCode })} tone="primary">
            開始評分
          </ActionButton>
          <ActionButton
            onClick={() => publish({ type: 'LOCK_SCORES', roomCode })}
            disabled={!allSubmitted}
          >
            鎖定成績
          </ActionButton>
          <ActionButton
            onClick={() => publish({ type: 'PUBLISH_SCORES', roomCode })}
            disabled={state.status !== 'SCORES_LOCKED'}
            tone="primary"
          >
            公布成績
          </ActionButton>
          <ActionButton onClick={() => publish({ type: 'RESET_PERFORMANCE', roomCode })}>下一位</ActionButton>
        </div>
        <ScoreSummary state={state} />
      </Panel>
    </Shell>
  )
}

export function JudgePage(): React.ReactElement {
  const roomCode = useParams().roomCode?.toUpperCase()
  const slot = useParams().slot?.toUpperCase()
  if (roomCode === undefined || slot === undefined) return <Navigate to="/control" replace />
  return <JudgeRoomPage roomCode={roomCode} slot={slot} />
}

function JudgeRoomPage({ roomCode, slot }: { roomCode: string; slot: string }): React.ReactElement {
  const { state, publish } = usePoomsaeRoom(roomCode)
  const profile = RECOGNIZED_RULE_PROFILES[state.profileId] ?? WT_RECOGNIZED_2024_06_14
  const submitted = state.judgeScores[slot]
  const [draft, setDraft] = useState<JudgeScoreInput>(() => ({
    judgeSlot: slot,
    minorMistakes: 0,
    majorMistakes: 0,
    presentation: Object.fromEntries(profile.scoring.presentationComponents.map((component) => [component.id, component.max])),
    submittedAt: 0,
  }))
  const judgeScore = computeJudgeScore(profile, draft)

  return (
    <Shell title={`${slot} 裁判端`} roomCode={roomCode}>
      <NonCertifiedNotice />
      <Panel title={`${state.athleteName} · ${state.poomsaeName}`}>
        {submitted !== undefined ? (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-center">
            <p className="text-2xl font-black text-emerald-200">已送出並鎖定</p>
            <p className="mt-2 text-sm text-slate-300">等待主控公布或退回重評。</p>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <ActionButton
                onClick={() => setDraft((current) => ({ ...current, minorMistakes: current.minorMistakes + 1 }))}
                tone="warning"
                className="min-h-[88px]"
              >
                小失誤 -0.1
              </ActionButton>
              <ActionButton
                onClick={() => setDraft((current) => ({ ...current, majorMistakes: current.majorMistakes + 1 }))}
                tone="danger"
                className="min-h-[88px]"
              >
                大失誤 -0.3
              </ActionButton>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ActionButton
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    minorMistakes: Math.max(0, current.minorMistakes - 1),
                  }))
                }
              >
                復原小失誤
              </ActionButton>
              <ActionButton
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    majorMistakes: Math.max(0, current.majorMistakes - 1),
                  }))
                }
              >
                復原大失誤
              </ActionButton>
            </div>
            <p className="text-center text-sm text-slate-400">
              小失誤 {draft.minorMistakes} 次 · 大失誤 {draft.majorMistakes} 次 · 正確性{' '}
              {formatScore(judgeScore.accuracy)}
            </p>
            <div className="grid gap-3">
              {profile.scoring.presentationComponents.map((component) => (
                <div key={component.id} className="rounded-lg border border-line bg-panel-2 p-3">
                  <p className="font-bold">{component.name}</p>
                  <div className="mt-2 grid grid-cols-[72px_1fr_72px] gap-2">
                    <ActionButton
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          presentation: {
                            ...current.presentation,
                            [component.id]: Math.max(
                              0,
                              (current.presentation[component.id] ?? 0) - component.step,
                            ),
                          },
                        }))
                      }
                    >
                      -
                    </ActionButton>
                    <div className="flex min-h-[56px] items-center justify-center rounded-lg bg-black/20 text-3xl font-black">
                      {formatScore(draft.presentation[component.id] ?? 0)}
                    </div>
                    <ActionButton
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          presentation: {
                            ...current.presentation,
                            [component.id]: Math.min(
                              component.max,
                              (current.presentation[component.id] ?? 0) + component.step,
                            ),
                          },
                        }))
                      }
                    >
                      +
                    </ActionButton>
                  </div>
                </div>
              ))}
            </div>
            <ActionButton
              onClick={() =>
                publish({
                  type: 'SUBMIT_JUDGE_SCORE',
                  roomCode,
                  score: { ...draft, submittedAt: Date.now() },
                })
              }
              disabled={state.status !== 'WAITING_FOR_SUBMISSIONS'}
              tone="primary"
              className="min-h-[72px]"
            >
              確認送出 · {formatScore(judgeScore.total)}
            </ActionButton>
          </div>
        )}
      </Panel>
    </Shell>
  )
}

export function DisplayPage(): React.ReactElement {
  const roomCode = useParams().roomCode?.toUpperCase()
  if (roomCode === undefined) return <Navigate to="/control" replace />
  return <DisplayRoomPage roomCode={roomCode} />
}

function DisplayRoomPage({ roomCode }: { roomCode: string }): React.ReactElement {
  const { state } = usePoomsaeRoom(roomCode)
  const result = computeRoomResult(state)
  const slots = activeJudgeSlots(state.judgeCount)

  return (
    <Shell title="公開顯示端" roomCode={roomCode} wide>
      <section className="grid min-h-[70dvh] content-center gap-6 text-center">
        <div>
          <p className="text-2xl text-slate-400">{state.teamName}</p>
          <h1 className="mt-2 text-6xl font-black md:text-8xl">{state.athleteName}</h1>
          <p className="mt-3 text-3xl text-emerald-300">{state.poomsaeName}</p>
        </div>
        {state.status === 'PUBLISHED' ? (
          <div className="mx-auto w-full max-w-3xl rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-6">
            <p className="text-8xl font-black text-emerald-200 md:text-9xl">{formatScore(result.total)}</p>
            <div className="mt-5 grid grid-cols-3 gap-3 text-xl">
              <Summary label="正確性" value={result.accuracy} />
              <Summary label="表現性" value={result.presentation} />
              <Summary label="程序扣分" value={result.procedureDeductions} />
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-4xl rounded-xl border border-line bg-panel p-6">
            <p className="text-4xl font-black">評分進行中</p>
            <div className="mt-5 grid grid-cols-3 gap-3 md:grid-cols-5">
              {slots.map((slot) => (
                <div key={slot} className="rounded-lg bg-panel-2 p-4">
                  <p className="text-2xl font-black">{slot}</p>
                  <p className="mt-2 text-sm text-slate-300">
                    {state.judgeScores[slot] === undefined ? '未送出' : '已送出'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </Shell>
  )
}

function Shell({
  title,
  roomCode,
  children,
  wide = false,
}: {
  title: string
  roomCode: string
  children: React.ReactNode
  wide?: boolean
}): React.ReactElement {
  return (
    <div className={`safe-area mx-auto flex min-h-dvh w-full flex-col gap-4 p-3 sm:p-4 ${wide ? 'max-w-7xl' : 'max-w-5xl'}`}>
      <header className="flex flex-wrap items-end justify-between gap-3 pt-3">
        <div>
          <p className="text-sm font-bold tracking-[0.2em] text-emerald-400">TEAMPRO POOMSAE</p>
          <h1 className="text-3xl font-black">{title}</h1>
        </div>
        <Link to="/" className="rounded-lg border border-line bg-panel px-3 py-2 text-sm font-bold">
          首頁
        </Link>
      </header>
      <p className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-slate-300">
        房間碼：<b className="text-xl text-white">{roomCode}</b>
      </p>
      {children}
    </div>
  )
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}): React.ReactElement {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-300">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[48px] rounded-lg border border-line bg-panel-2 px-3 text-white"
      />
    </label>
  )
}

function ScoreSummary({ state }: { state: PoomsaeRoomState }): React.ReactElement {
  const result = computeRoomResult(state)
  return (
    <div className="mt-4 grid gap-2 md:grid-cols-4">
      <Summary label="正確性" value={result.accuracy} />
      <Summary label="表現性" value={result.presentation} />
      <Summary label="程序扣分" value={result.procedureDeductions} />
      <Summary label="總分" value={result.total} />
    </div>
  )
}

function Summary({ label, value }: { label: string; value: number }): React.ReactElement {
  return (
    <div className="rounded-lg bg-panel-2 p-3 text-center">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="text-3xl font-black">{formatScore(value)}</p>
    </div>
  )
}
