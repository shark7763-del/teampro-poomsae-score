import type { RuleProfile } from '../rules/profiles'

export type JudgeCount = 1 | 3 | 5

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

export interface PerformanceScoreResult {
  status: 'complete' | 'incomplete' | 'duplicate_submission'
  judges: JudgeComputedScore[]
  accuracy: number
  presentation: number
  procedureDeductions: number
  total: number
  submittedJudgeCount: number
}

export function formatScore(score: number): string {
  return (score / 10).toFixed(1)
}

export function computeJudgeScore(profile: RuleProfile, input: JudgeScoreInput): JudgeComputedScore {
  const accuracy = Math.max(
    0,
    profile.scoring.accuracyMax -
      input.minorMistakes * profile.deductions.minorMistake -
      input.majorMistakes * profile.deductions.majorMistake,
  )
  const presentation = Math.min(
    profile.scoring.presentationMax,
    profile.scoring.presentationComponents.reduce(
      (sum, component) => sum + Math.max(0, Math.min(component.max, input.presentation[component.id] ?? 0)),
      0,
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

export function computePerformanceScore({
  profile,
  judgeCount,
  judgeScores,
  procedureDeductions,
}: {
  profile: RuleProfile
  judgeCount: JudgeCount
  judgeScores: JudgeScoreInput[]
  procedureDeductions: number
}): PerformanceScoreResult {
  const seen = new Set<string>()
  const uniqueInputs: JudgeScoreInput[] = []
  let duplicated = false
  for (const score of judgeScores) {
    if (seen.has(score.judgeSlot)) {
      duplicated = true
      continue
    }
    seen.add(score.judgeSlot)
    uniqueInputs.push(score)
  }

  const judges = uniqueInputs.map((score) => computeJudgeScore(profile, score))
  if (judges.length < judgeCount) {
    return {
      status: 'incomplete',
      judges,
      accuracy: 0,
      presentation: 0,
      procedureDeductions,
      total: 0,
      submittedJudgeCount: judges.length,
    }
  }

  const accuracyExcluded = exclusionIndexes(judges.map((judge) => judge.accuracy), profile, judgeCount)
  const presentationExcluded = exclusionIndexes(
    judges.map((judge) => judge.presentation),
    profile,
    judgeCount,
  )
  const marked = judges.map((judge, index) => ({
    ...judge,
    excludedAccuracy: accuracyExcluded.has(index),
    excludedPresentation: presentationExcluded.has(index),
  }))
  const accuracy = average(marked.filter((judge) => !judge.excludedAccuracy).map((judge) => judge.accuracy))
  const presentation = average(
    marked.filter((judge) => !judge.excludedPresentation).map((judge) => judge.presentation),
  )
  const total = Math.max(0, accuracy + presentation - Math.max(0, procedureDeductions))
  return {
    status: duplicated ? 'duplicate_submission' : 'complete',
    judges: marked,
    accuracy,
    presentation,
    procedureDeductions,
    total,
    submittedJudgeCount: judges.length,
  }
}

function average(values: number[]): number {
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function exclusionIndexes(values: number[], profile: RuleProfile, judgeCount: JudgeCount): Set<number> {
  if (!profile.trimming.enabledJudgeCounts.some((count) => count === judgeCount)) return new Set()
  const excluded = new Set<number>()
  const high = firstExtremeIndex(values, excluded, 'high')
  if (high !== null) excluded.add(high)
  const low = firstExtremeIndex(values, excluded, 'low')
  if (low !== null) excluded.add(low)
  return excluded
}

function firstExtremeIndex(values: number[], excluded: Set<number>, direction: 'high' | 'low'): number | null {
  let selectedIndex: number | null = null
  let selectedValue: number | null = null
  values.forEach((value, index) => {
    if (excluded.has(index)) return
    if (selectedValue === null) {
      selectedValue = value
      selectedIndex = index
      return
    }
    if (direction === 'high' && value > selectedValue) {
      selectedValue = value
      selectedIndex = index
    }
    if (direction === 'low' && value < selectedValue) {
      selectedValue = value
      selectedIndex = index
    }
  })
  return selectedIndex
}
