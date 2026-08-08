import { useMemo, useState } from 'react'
import { AppLogo } from '../../components/AppLogo'
import { Button, Notice, Panel, TextField } from '../../components/ui'
import { RULE_PROFILES, WT_RECOGNIZED_2024_06_14 } from '../../rules/profiles'
import type { JudgeCount, JudgeScoreInput } from '../../poomsae/scoring'
import { computeJudgeScore, computePerformanceScore, formatScore } from '../../poomsae/scoring'

const MAX_JUDGES = 5

function createJudge(slot: string): JudgeScoreInput {
  return {
    judgeSlot: slot,
    minorMistakes: 0,
    majorMistakes: 0,
    presentation: { speed_power: 20, rhythm_tempo: 20, energy_expression: 20 },
    submittedAt: 0,
  }
}

export function Calculator(): React.ReactElement {
  const [profileId, setProfileId] = useState(WT_RECOGNIZED_2024_06_14.id)
  const [judgeCount, setJudgeCount] = useState<JudgeCount>(1)
  const [athleteName, setAthleteName] = useState('選手 A')
  const [teamName, setTeamName] = useState('TeamPro')
  const [poomsaeName, setPoomsaeName] = useState('太極八章')
  const [procedureDeductions, setProcedureDeductions] = useState(0)
  const [judges, setJudges] = useState<JudgeScoreInput[]>(
    Array.from({ length: MAX_JUDGES }, (_, index) => createJudge(`J${index + 1}`)),
  )
  const profile = RULE_PROFILES[profileId] ?? WT_RECOGNIZED_2024_06_14
  const activeJudges = judges.slice(0, judgeCount)
  const result = useMemo(
    () => computePerformanceScore({ profile, judgeCount, judgeScores: activeJudges, procedureDeductions }),
    [activeJudges, judgeCount, procedureDeductions, profile],
  )

  const updateJudge = (index: number, next: JudgeScoreInput): void => {
    setJudges((current) => current.map((judge, judgeIndex) => (judgeIndex === index ? next : judge)))
  }

  return (
    <div className="safe-area mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-4 p-3 sm:p-4">
      <Header subtitle="單機訓練模式" />
      <Notice />
      <Panel title="賽事設定">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm font-bold text-slate-300">
            規則版本
            <select
              value={profileId}
              onChange={(event) => setProfileId(event.target.value)}
              className="min-h-[48px] rounded-lg border border-line bg-panel-2 px-3 text-white"
            >
              {Object.values(RULE_PROFILES).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <TextField label="選手姓名" value={athleteName} onChange={setAthleteName} />
          <TextField label="單位" value={teamName} onChange={setTeamName} />
          <TextField label="指定品勢" value={poomsaeName} onChange={setPoomsaeName} />
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={() => setJudgeCount(1)} tone={judgeCount === 1 ? 'primary' : 'neutral'}>
              1 位裁判
            </Button>
            <Button onClick={() => setJudgeCount(3)} tone={judgeCount === 3 ? 'primary' : 'neutral'}>
              3 位裁判
            </Button>
            <Button onClick={() => setJudgeCount(5)} tone={judgeCount === 5 ? 'primary' : 'neutral'}>
              5 位裁判
            </Button>
          </div>
          <div className="grid grid-cols-[1fr_80px_1fr] gap-2">
            <Button onClick={() => setProcedureDeductions((value) => Math.max(0, value - 3))}>-0.3</Button>
            <div className="flex items-center justify-center rounded-lg bg-panel-2 text-2xl font-black">
              {formatScore(procedureDeductions)}
            </div>
            <Button onClick={() => setProcedureDeductions((value) => value + 3)}>+0.3</Button>
          </div>
        </div>
      </Panel>
      <section className="grid gap-3 xl:grid-cols-[1fr_340px]">
        <div className="grid gap-3">
          {activeJudges.map((judge, index) => (
            <JudgeEditor
              key={judge.judgeSlot}
              judge={judge}
              excludedAccuracy={result.judges.find((item) => item.judgeSlot === judge.judgeSlot)?.excludedAccuracy}
              excludedPresentation={
                result.judges.find((item) => item.judgeSlot === judge.judgeSlot)?.excludedPresentation
              }
              onChange={(next) => updateJudge(index, next)}
            />
          ))}
        </div>
        <ScoreCard
          athleteName={athleteName}
          teamName={teamName}
          poomsaeName={poomsaeName}
          accuracy={result.accuracy}
          presentation={result.presentation}
          procedureDeductions={result.procedureDeductions}
          total={result.total}
        />
      </section>
    </div>
  )
}

export function Header({ subtitle }: { subtitle: string }): React.ReactElement {
  return (
    <header className="pt-3">
      <AppLogo compact />
      <h1 className="text-3xl font-black tracking-tight">跆拳道品勢計分系統</h1>
      <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
    </header>
  )
}

export function JudgeEditor({
  judge,
  onChange,
  excludedAccuracy,
  excludedPresentation,
}: {
  judge: JudgeScoreInput
  onChange: (judge: JudgeScoreInput) => void
  excludedAccuracy?: boolean
  excludedPresentation?: boolean
}): React.ReactElement {
  const score = computeJudgeScore(WT_RECOGNIZED_2024_06_14, judge)
  const changePresentation = (componentId: string, delta: number): void => {
    onChange({
      ...judge,
      presentation: {
        ...judge.presentation,
        [componentId]: Math.max(0, Math.min(20, (judge.presentation[componentId] ?? 0) + delta)),
      },
    })
  }
  return (
    <Panel title={`${judge.judgeSlot} 裁判`}>
      <div className="grid gap-3 lg:grid-cols-[220px_1fr_140px]">
        <div className="grid gap-2">
          <Button onClick={() => onChange({ ...judge, minorMistakes: judge.minorMistakes + 1 })} tone="warning">
            小失誤 -0.1
          </Button>
          <Button onClick={() => onChange({ ...judge, majorMistakes: judge.majorMistakes + 1 })} tone="danger">
            大失誤 -0.3
          </Button>
          <Button
            onClick={() => onChange({ ...judge, minorMistakes: Math.max(0, judge.minorMistakes - 1) })}
          >
            復原小失誤
          </Button>
          <Button
            onClick={() => onChange({ ...judge, majorMistakes: Math.max(0, judge.majorMistakes - 1) })}
          >
            復原大失誤
          </Button>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {(
            [
            ['speed_power', '速度與力量'],
            ['rhythm_tempo', '節奏與速度控制'],
            ['energy_expression', '氣勢表現'],
            ] as const
          ).map(([id, name]) => (
            <div key={id} className="rounded-lg border border-line bg-panel-2 p-2">
              <p className="min-h-[40px] text-sm font-black">{name}</p>
              <div className="mt-2 grid grid-cols-[56px_1fr_56px] gap-2">
                <Button onClick={() => changePresentation(id, -1)}>-</Button>
                <div className="flex items-center justify-center rounded-lg bg-black/20 text-2xl font-black">
                  {formatScore(judge.presentation[id] ?? 0)}
                </div>
                <Button onClick={() => changePresentation(id, 1)}>+</Button>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
          <MiniScore label="正確性" value={score.accuracy} excluded={excludedAccuracy} />
          <MiniScore label="表現性" value={score.presentation} excluded={excludedPresentation} />
          <MiniScore label="總分" value={score.total} />
        </div>
      </div>
    </Panel>
  )
}

export function ScoreCard({
  athleteName,
  teamName,
  poomsaeName,
  accuracy,
  presentation,
  procedureDeductions,
  total,
}: {
  athleteName: string
  teamName: string
  poomsaeName: string
  accuracy: number
  presentation: number
  procedureDeductions: number
  total: number
}): React.ReactElement {
  return (
    <Panel title="公開成績" className="content-start">
      <div className="rounded-lg bg-black/25 p-4 text-center">
        <p className="text-sm text-slate-400">{teamName}</p>
        <p className="text-3xl font-black">{athleteName}</p>
        <p className="mt-1 text-slate-400">{poomsaeName}</p>
        <p className="mt-4 text-7xl font-black text-emerald-300 tabular">{formatScore(total)}</p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <MiniScore label="正確性" value={accuracy} />
        <MiniScore label="表現性" value={presentation} />
        <MiniScore label="程序扣分" value={procedureDeductions} />
      </div>
    </Panel>
  )
}

function MiniScore({ label, value, excluded = false }: { label: string; value: number; excluded?: boolean }): React.ReactElement {
  return (
    <div className="rounded-lg border border-line bg-panel-2 p-2 text-center">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-2xl font-black tabular">{formatScore(value)}</p>
      {excluded && <p className="text-xs font-black text-amber-300">已排除</p>}
    </div>
  )
}
