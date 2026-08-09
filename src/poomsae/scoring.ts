import type { JudgeCount, RuleProfile } from '../rules/profiles'
import type { ProcedureDeduction } from '../rules/penalties'
import { totalProcedureDeduction } from '../rules/penalties'

export type { JudgeCount }

export interface JudgeScoreInput {
  judgeSlot: string
  minorMistakes: number
  majorMistakes: number
  /** componentId → 百分位分數 */
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
  /** 去頭去尾後的平均，百分位 */
  accuracy: number
  presentation: number
  procedureDeductions: number
  total: number
  /** 全部裁判都計入（不去頭去尾）的結果，同分判定用 */
  untrimmedAccuracy: number
  untrimmedPresentation: number
  untrimmedTotal: number
  submittedJudgeCount: number
}

/**
 * 把百分位整數轉成顯示字串。
 * 預設 2 位小數，因為 WT 公布成績是到小數第 2 位（例如 7.63）。
 */
export function formatPoints(points: number, digits = 2): string {
  return (points / 100).toFixed(digits)
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
      (sum, component) =>
        sum + Math.max(0, Math.min(component.max, input.presentation[component.id] ?? 0)),
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
  /** 已套用的程序扣分清單；型別化才能做報表 */
  procedureDeductions: readonly ProcedureDeduction[]
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
  const penalty = totalProcedureDeduction(procedureDeductions)

  if (judges.length < judgeCount) {
    return {
      status: 'incomplete',
      judges,
      accuracy: 0,
      presentation: 0,
      procedureDeductions: penalty,
      total: 0,
      untrimmedAccuracy: 0,
      untrimmedPresentation: 0,
      untrimmedTotal: 0,
      submittedJudgeCount: judges.length,
    }
  }

  const accuracyExcluded = exclusionIndexes(
    judges.map((judge) => judge.accuracy),
    profile,
    judgeCount,
  )
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
  const untrimmedAccuracy = average(marked.map((judge) => judge.accuracy))
  const untrimmedPresentation = average(marked.map((judge) => judge.presentation))

  return {
    status: duplicated ? 'duplicate_submission' : 'complete',
    judges: marked,
    accuracy,
    presentation,
    procedureDeductions: penalty,
    total: Math.max(0, accuracy + presentation - penalty),
    untrimmedAccuracy,
    untrimmedPresentation,
    untrimmedTotal: Math.max(0, untrimmedAccuracy + untrimmedPresentation - penalty),
    submittedJudgeCount: judges.length,
  }
}

/** 百分位整數平均，四捨五入回百分位（即保留 2 位小數）。 */
function average(values: number[]): number {
  if (values.length === 0) return 0
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function exclusionIndexes(values: number[], profile: RuleProfile, judgeCount: JudgeCount): Set<number> {
  const excluded = new Set<number>()
  if (!profile.trimming.enabledJudgeCounts.includes(judgeCount)) return excluded

  const removeHighest = Math.max(0, profile.trimming.removeHighest)
  const removeLowest = Math.max(0, profile.trimming.removeLowest)
  // 去除後至少要留一位裁判，否則平均無意義
  if (values.length - removeHighest - removeLowest < 1) return excluded

  for (let index = 0; index < removeHighest; index += 1) {
    const highest = firstExtremeIndex(values, excluded, 'high')
    if (highest !== null) excluded.add(highest)
  }
  for (let index = 0; index < removeLowest; index += 1) {
    const lowest = firstExtremeIndex(values, excluded, 'low')
    if (lowest !== null) excluded.add(lowest)
  }
  return excluded
}

function firstExtremeIndex(
  values: number[],
  excluded: Set<number>,
  direction: 'high' | 'low',
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
