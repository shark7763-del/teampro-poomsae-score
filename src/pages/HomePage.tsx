import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ActionButton, NonCertifiedNotice, Panel } from '../components/ui'
import type { RuleProfile } from '../rules/profiles'
import {
  RECOGNIZED_RULE_PROFILES,
  USATKD_RECOGNIZED_2026_01_01,
  WT_RECOGNIZED_2024_06_14,
} from '../rules/profiles'
import { computeJudgeScore, computePerformanceScore, formatScore } from '../poomsae/scoring'

type JudgeCount = 3 | 5

interface JudgeDraft {
  judgeSlot: string
  minorMistakes: number
  majorMistakes: number
  presentation: Record<string, number>
}

const PROFILE_OPTIONS = [WT_RECOGNIZED_2024_06_14, USATKD_RECOGNIZED_2026_01_01]
const MAX_JUDGES = 5

function createJudgeDraft(judgeSlot: string, profile: RuleProfile): JudgeDraft {
  return {
    judgeSlot,
    minorMistakes: 0,
    majorMistakes: 0,
    presentation: Object.fromEntries(
      profile.scoring.presentationComponents.map((component) => [component.id, component.max]),
    ),
  }
}

export function HomePage(): React.ReactElement {
  const [profileId, setProfileId] = useState(WT_RECOGNIZED_2024_06_14.id)
  const [judgeCount, setJudgeCount] = useState<JudgeCount>(3)
  const [athleteName, setAthleteName] = useState('選手 A')
  const [teamName, setTeamName] = useState('TeamPro')
  const [poomsaeName, setPoomsaeName] = useState('太極八章')
  const [procedureDeductions, setProcedureDeductions] = useState(0)
  const [published, setPublished] = useState(false)

  const profile = RECOGNIZED_RULE_PROFILES[profileId] ?? WT_RECOGNIZED_2024_06_14
  const [judges, setJudges] = useState<JudgeDraft[]>(() =>
    Array.from({ length: MAX_JUDGES }, (_, index) => createJudgeDraft(`J${index + 1}`, profile)),
  )

  const activeJudges = judges.slice(0, judgeCount)
  const result = useMemo(
    () =>
      computePerformanceScore(profile, {
        performanceId: 'local-demo',
        judgeCount,
        judgeScores: activeJudges.map((judge) => ({ ...judge, submittedAt: 0 })),
        procedureDeductions,
      }),
    [activeJudges, judgeCount, procedureDeductions, profile],
  )

  const resetScores = (): void => {
    setJudges(Array.from({ length: MAX_JUDGES }, (_, index) => createJudgeDraft(`J${index + 1}`, profile)))
    setProcedureDeductions(0)
    setPublished(false)
  }

  const updateJudge = (index: number, patch: Partial<JudgeDraft>): void => {
    setPublished(false)
    setJudges((current) =>
      current.map((judge, judgeIndex) =>
        judgeIndex === index
          ? {
              ...judge,
              ...patch,
              presentation: patch.presentation ?? judge.presentation,
            }
          : judge,
      ),
    )
  }

  const changePresentation = (
    judgeIndex: number,
    componentId: string,
    delta: number,
    max: number,
  ): void => {
    const judge = judges[judgeIndex]
    if (judge === undefined) return
    updateJudge(judgeIndex, {
      presentation: {
        ...judge.presentation,
        [componentId]: Math.max(0, Math.min(max, (judge.presentation[componentId] ?? 0) + delta)),
      },
    })
  }

  const selectProfile = (nextProfileId: string): void => {
    const nextProfile = RECOGNIZED_RULE_PROFILES[nextProfileId] ?? WT_RECOGNIZED_2024_06_14
    setProfileId(nextProfile.id)
    setJudgeCount(nextProfile.supportedJudgeCounts.includes(judgeCount) ? judgeCount : 3)
    setJudges(Array.from({ length: MAX_JUDGES }, (_, index) => createJudgeDraft(`J${index + 1}`, nextProfile)))
    setProcedureDeductions(0)
    setPublished(false)
  }

  return (
    <div className="safe-area mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-4 p-3 sm:p-4">
      <header className="pt-3">
        <p className="text-sm font-bold tracking-[0.2em] text-emerald-400">TEAMPRO</p>
        <h1 className="text-3xl font-black tracking-tight">跆拳道品勢計分系統</h1>
        <p className="mt-1 text-sm text-slate-400">
          公認品勢單機計分 · 3 / 5 裁判 · 整數單位計算避免浮點誤差
        </p>
      </header>

      <NonCertifiedNotice />

      <Link
        to="/control"
        className="flex min-h-[72px] items-center justify-center rounded-lg border-2 border-emerald-400/50 bg-emerald-600/20 text-xl font-black"
      >
        建立現場計分房間
      </Link>

      <Panel title="賽事設定">
        <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr]">
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            規則版本
            <select
              value={profileId}
              onChange={(event) => selectProfile(event.target.value)}
              className="min-h-[48px] rounded-lg border border-line bg-panel-2 px-3 text-white"
            >
              {PROFILE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} · {option.effectiveDate}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            裁判數
            <div className="grid grid-cols-2 gap-2">
              {[3, 5].map((count) => (
                <ActionButton
                  key={count}
                  onClick={() => {
                    setJudgeCount(count as JudgeCount)
                    setPublished(false)
                  }}
                  tone={judgeCount === count ? 'primary' : 'neutral'}
                >
                  {count} 位裁判
                </ActionButton>
              ))}
            </div>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            指定品勢
            <input
              value={poomsaeName}
              onChange={(event) => setPoomsaeName(event.target.value)}
              className="min-h-[48px] rounded-lg border border-line bg-panel-2 px-3 text-white"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            選手姓名
            <input
              value={athleteName}
              onChange={(event) => setAthleteName(event.target.value)}
              className="min-h-[48px] rounded-lg border border-line bg-panel-2 px-3 text-white"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            單位
            <input
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              className="min-h-[48px] rounded-lg border border-line bg-panel-2 px-3 text-white"
            />
          </label>

          <div className="flex flex-col gap-1 text-sm text-slate-300">
            程序扣分
            <div className="grid grid-cols-3 gap-2">
              <ActionButton
                onClick={() => {
                  setProcedureDeductions((value) => Math.max(0, value - 3))
                  setPublished(false)
                }}
              >
                -0.3
              </ActionButton>
              <div className="flex min-h-[56px] items-center justify-center rounded-lg border border-line bg-panel-2 text-2xl font-black text-white">
                {formatScore(procedureDeductions)}
              </div>
              <ActionButton
                onClick={() => {
                  setProcedureDeductions((value) => value + 3)
                  setPublished(false)
                }}
              >
                +0.3
              </ActionButton>
            </div>
          </div>
        </div>
      </Panel>

      <section className="grid gap-3 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-3">
          {activeJudges.map((judge, judgeIndex) => {
            const judgeScore = computeJudgeScore(profile, {
              ...judge,
              submittedAt: 0,
            })
            const computed = result.judges.find((item) => item.judgeSlot === judge.judgeSlot)
            return (
              <Panel key={judge.judgeSlot} title={`${judge.judgeSlot} 裁判`}>
                <div className="grid gap-3 lg:grid-cols-[220px_1fr_140px]">
                  <div className="grid gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <ActionButton
                        onClick={() =>
                          updateJudge(judgeIndex, { minorMistakes: judge.minorMistakes + 1 })
                        }
                        tone="warning"
                      >
                        小失誤 -0.1
                      </ActionButton>
                      <ActionButton
                        onClick={() =>
                          updateJudge(judgeIndex, { majorMistakes: judge.majorMistakes + 1 })
                        }
                        tone="danger"
                      >
                        大失誤 -0.3
                      </ActionButton>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <ActionButton
                        onClick={() =>
                          updateJudge(judgeIndex, {
                            minorMistakes: Math.max(0, judge.minorMistakes - 1),
                          })
                        }
                      >
                        復原小失誤
                      </ActionButton>
                      <ActionButton
                        onClick={() =>
                          updateJudge(judgeIndex, {
                            majorMistakes: Math.max(0, judge.majorMistakes - 1),
                          })
                        }
                      >
                        復原大失誤
                      </ActionButton>
                    </div>
                    <p className="text-sm text-slate-400">
                      小失誤 {judge.minorMistakes} 次 · 大失誤 {judge.majorMistakes} 次
                    </p>
                  </div>

                  <div className="grid gap-2 md:grid-cols-3">
                    {profile.scoring.presentationComponents.map((component) => (
                      <div key={component.id} className="rounded-lg border border-line bg-panel-2 p-2">
                        <p className="min-h-[40px] text-sm font-bold text-slate-200">{component.name}</p>
                        <div className="mt-2 grid grid-cols-[56px_1fr_56px] gap-2">
                          <ActionButton
                            onClick={() =>
                              changePresentation(judgeIndex, component.id, -component.step, component.max)
                            }
                            ariaLabel={`${component.name} 減少`}
                          >
                            -
                          </ActionButton>
                          <div className="flex min-h-[56px] items-center justify-center rounded-lg bg-black/20 text-2xl font-black text-white">
                            {formatScore(judge.presentation[component.id] ?? 0)}
                          </div>
                          <ActionButton
                            onClick={() =>
                              changePresentation(judgeIndex, component.id, component.step, component.max)
                            }
                            ariaLabel={`${component.name} 增加`}
                          >
                            +
                          </ActionButton>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
                    <ScoreBox label="正確性" value={judgeScore.accuracy} excluded={computed?.excludedAccuracy} />
                    <ScoreBox
                      label="表現性"
                      value={judgeScore.presentation}
                      excluded={computed?.excludedPresentation}
                    />
                    <ScoreBox label="裁判總分" value={judgeScore.total} />
                  </div>
                </div>
              </Panel>
            )
          })}
        </div>

        <aside className="grid content-start gap-3">
          <Panel title="公開成績">
            <div className="rounded-lg bg-black/25 p-4 text-center">
              <p className="text-sm text-slate-400">{teamName}</p>
              <p className="text-2xl font-black text-white">{athleteName}</p>
              <p className="mt-1 text-sm text-slate-400">{poomsaeName}</p>
              <p className="mt-4 text-6xl font-black text-emerald-300">{formatScore(result.total)}</p>
              <p className="mt-1 text-sm text-slate-400">{published ? '已公布' : '尚未公布'}</p>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <SummaryItem label="正確性" value={result.accuracy} />
              <SummaryItem label="表現性" value={result.presentation} />
              <SummaryItem label="程序扣分" value={result.procedureDeductions} />
              <SummaryItem label="裁判數" text={`${judgeCount} 位`} />
            </dl>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <ActionButton onClick={() => setPublished(true)} tone="primary">
                公布成績
              </ActionButton>
              <ActionButton onClick={resetScores}>重設</ActionButton>
            </div>
          </Panel>

          <Panel title="計算方式">
            <p className="text-sm leading-6 text-slate-300">
              內部以整數單位計算：10.0 = 100，0.1 = 1。3 位裁判直接平均；5 位裁判時，
              正確性與表現性各自刪除一個最高分與一個最低分後平均。
            </p>
          </Panel>
        </aside>
      </section>
    </div>
  )
}

function ScoreBox({
  label,
  value,
  excluded = false,
}: {
  label: string
  value: number
  excluded?: boolean
}): React.ReactElement {
  return (
    <div className="rounded-lg border border-line bg-black/20 p-2 text-center">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-2xl font-black text-white">{formatScore(value)}</p>
      {excluded && <p className="text-xs font-bold text-amber-300">已排除</p>}
    </div>
  )
}

function SummaryItem({
  label,
  value,
  text,
}: {
  label: string
  value?: number
  text?: string
}): React.ReactElement {
  return (
    <div className="rounded-lg bg-panel-2 p-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-xl font-black text-white">{text ?? formatScore(value ?? 0)}</dd>
    </div>
  )
}
