import type { RuleProfile } from '../rules/profiles'

export type ScoreStatus = 'complete' | 'incomplete' | 'duplicate_submission' | 'locked'
export type TieBreakResult =
  | { status: 'winner'; winner: string; reason: 'higher_presentation' | 'include_trimmed_scores' }
  | { status: 'rematch_required' }

export interface JudgeScoreInput {
  judgeSlot: string
  minorMistakes: number
  majorMistakes: number
  presentation: Record<string, number>
  submittedAt: number
}

export interface JudgeComputedScore {
  judgeSlot: string
  accuracy: number
  presentation: number
  total: number
  excludedAccuracy: boolean
  excludedPresentation: boolean
}

export interface PerformanceScoreInput {
  performanceId: string
  judgeCount: number
  judgeScores: JudgeScoreInput[]
  procedureDeductions: number
}

export interface PerformanceScoreResult {
  status: ScoreStatus
  performanceId: string
  expectedJudgeCount: number
  submittedJudgeCount: number
  judges: JudgeComputedScore[]
  accuracy: number
  presentation: number
  procedureDeductions: number
  total: number
}

export interface AggregatePerformance {
  id: string
  total: number
  presentation: number
  untrimmedTotal: number
}

export function formatScore(score: number): string {
  return (score / 10).toFixed(1)
}

export function computeJudgeScore(
  profile: RuleProfile,
  input: JudgeScoreInput,
): JudgeComputedScore {
  const rawAccuracy =
    profile.scoring.accuracyMax -
    input.minorMistakes * profile.deductions.minorMistake -
    input.majorMistakes * profile.deductions.majorMistake
  const accuracy = Math.max(0, Math.min(profile.scoring.accuracyMax, rawAccuracy))
  const presentation = Math.max(
    0,
    Math.min(
      profile.scoring.presentationMax,
      profile.scoring.presentationComponents.reduce(
        (sum, component) =>
          sum + clampComponent(input.presentation[component.id] ?? 0, component.max),
        0,
      ),
    ),
  )

  return {
    judgeSlot: input.judgeSlot,
    accuracy,
    presentation,
    total: accuracy + presentation,
    excludedAccuracy: false,
    excludedPresentation: false,
  }
}

export function computePerformanceScore(
  profile: RuleProfile,
  input: PerformanceScoreInput,
): PerformanceScoreResult {
  if (!profile.supportedJudgeCounts.includes(input.judgeCount)) {
    throw new Error(`Unsupported judge count: ${input.judgeCount}`)
  }

  const seen = new Set<string>()
  const uniqueInputs: JudgeScoreInput[] = []
  let duplicated = false

  for (const score of input.judgeScores) {
    if (seen.has(score.judgeSlot)) {
      duplicated = true
      continue
    }
    seen.add(score.judgeSlot)
    uniqueInputs.push(score)
  }

  const judges = uniqueInputs.map((score) => computeJudgeScore(profile, score))
  if (judges.length < input.judgeCount) {
    return emptyResult('incomplete', input, judges)
  }

  const accuracyExcluded = exclusionIndexes(
    judges.map((judgeScore) => judgeScore.accuracy),
    profile,
    input.judgeCount,
  )
  const presentationExcluded = exclusionIndexes(
    judges.map((judgeScore) => judgeScore.presentation),
    profile,
    input.judgeCount,
  )

  const marked = judges.map((judgeScore, index) => ({
    ...judgeScore,
    excludedAccuracy: accuracyExcluded.has(index),
    excludedPresentation: presentationExcluded.has(index),
  }))

  const accuracy = average(
    marked
      .filter((judgeScore) => !judgeScore.excludedAccuracy)
      .map((judgeScore) => judgeScore.accuracy),
  )
  const presentation = average(
    marked
      .filter((judgeScore) => !judgeScore.excludedPresentation)
      .map((judgeScore) => judgeScore.presentation),
  )
  const procedureDeductions = Math.max(0, input.procedureDeductions)
  const total = Math.max(0, accuracy + presentation - procedureDeductions)

  return {
    status: duplicated ? 'duplicate_submission' : 'complete',
    performanceId: input.performanceId,
    expectedJudgeCount: input.judgeCount,
    submittedJudgeCount: judges.length,
    judges: marked,
    accuracy,
    presentation,
    procedureDeductions,
    total,
  }
}

export function computeTwoPoomsaeTotal(
  first: PerformanceScoreResult,
  second: PerformanceScoreResult,
): number {
  return average([first.total, second.total])
}

export function resolveTie(performances: AggregatePerformance[]): TieBreakResult {
  const [first, second] = performances
  if (first === undefined || second === undefined) return { status: 'rematch_required' }

  if (first.presentation !== second.presentation) {
    return {
      status: 'winner',
      winner: first.presentation > second.presentation ? first.id : second.id,
      reason: 'higher_presentation',
    }
  }

  if (first.untrimmedTotal !== second.untrimmedTotal) {
    return {
      status: 'winner',
      winner: first.untrimmedTotal > second.untrimmedTotal ? first.id : second.id,
      reason: 'include_trimmed_scores',
    }
  }

  return { status: 'rematch_required' }
}

function emptyResult(
  status: ScoreStatus,
  input: PerformanceScoreInput,
  judges: JudgeComputedScore[],
): PerformanceScoreResult {
  return {
    status,
    performanceId: input.performanceId,
    expectedJudgeCount: input.judgeCount,
    submittedJudgeCount: judges.length,
    judges,
    accuracy: 0,
    presentation: 0,
    procedureDeductions: input.procedureDeductions,
    total: 0,
  }
}

function clampComponent(value: number, max: number): number {
  return Math.max(0, Math.min(max, value))
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function exclusionIndexes(values: number[], profile: RuleProfile, judgeCount: number): Set<number> {
  if (!profile.trimming.enabledJudgeCounts.includes(judgeCount)) return new Set()
  const excluded = new Set<number>()

  for (let i = 0; i < profile.trimming.removeHighest; i += 1) {
    const index = firstExtremeIndex(values, excluded, 'highest')
    if (index !== null) excluded.add(index)
  }
  for (let i = 0; i < profile.trimming.removeLowest; i += 1) {
    const index = firstExtremeIndex(values, excluded, 'lowest')
    if (index !== null) excluded.add(index)
  }

  return excluded
}

function firstExtremeIndex(
  values: number[],
  excluded: Set<number>,
  direction: 'highest' | 'lowest',
): number | null {
  let selectedIndex: number | null = null
  let selectedValue: number | null = null

  values.forEach((value, index) => {
    if (excluded.has(index)) return
    if (selectedValue === null) {
      selectedValue = value
      selectedIndex = index
      return
    }
    if (direction === 'highest' && value > selectedValue) {
      selectedValue = value
      selectedIndex = index
    }
    if (direction === 'lowest' && value < selectedValue) {
      selectedValue = value
      selectedIndex = index
    }
  })

  return selectedIndex
}
