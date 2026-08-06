import { describe, expect, it } from 'vitest'
import { WT_RECOGNIZED_2024_06_14 } from '../rules/profiles'
import {
  computePerformanceScore,
  computeTwoPoomsaeTotal,
  formatScore,
  resolveTie,
  type JudgeScoreInput,
} from './scoring'

const profile = WT_RECOGNIZED_2024_06_14

function judge(judgeSlot: string, accuracy: number, presentation: number): JudgeScoreInput {
  const mistakes = Math.max(0, 40 - accuracy)
  return {
    judgeSlot,
    minorMistakes: mistakes,
    majorMistakes: 0,
    presentation: {
      speed_power: Math.floor(presentation / 3),
      rhythm_tempo: Math.floor(presentation / 3),
      energy_expression: presentation - Math.floor(presentation / 3) * 2,
    },
    submittedAt: 1,
  }
}

describe('poomsae recognized scoring', () => {
  it('formats integer score units as one decimal only at display boundary', () => {
    expect(formatScore(87)).toBe('8.7')
  })

  it('averages three judges without trimming', () => {
    const result = computePerformanceScore(profile, {
      performanceId: 'p1',
      judgeCount: 3,
      judgeScores: [judge('J1', 38, 55), judge('J2', 37, 54), judge('J3', 36, 53)],
      procedureDeductions: 0,
    })
    expect(result.accuracy).toBe(37)
    expect(result.presentation).toBe(54)
    expect(result.total).toBe(91)
  })

  it('trims one highest and one lowest for five judges', () => {
    const result = computePerformanceScore(profile, {
      performanceId: 'p1',
      judgeCount: 5,
      judgeScores: [
        judge('J1', 40, 60),
        judge('J2', 39, 59),
        judge('J3', 38, 58),
        judge('J4', 37, 57),
        judge('J5', 36, 56),
      ],
      procedureDeductions: 0,
    })
    expect(result.accuracy).toBe(38)
    expect(result.presentation).toBe(58)
    expect(result.total).toBe(96)
  })

  it('trims accuracy and presentation independently', () => {
    const result = computePerformanceScore(profile, {
      performanceId: 'p1',
      judgeCount: 5,
      judgeScores: [
        judge('J1', 40, 50),
        judge('J2', 39, 60),
        judge('J3', 38, 58),
        judge('J4', 37, 57),
        judge('J5', 36, 56),
      ],
      procedureDeductions: 0,
    })
    expect(result.judges.find((score) => score.judgeSlot === 'J1')?.excludedAccuracy).toBe(true)
    expect(result.judges.find((score) => score.judgeSlot === 'J2')?.excludedPresentation).toBe(true)
  })

  it('removes only one tied highest and one tied lowest', () => {
    const result = computePerformanceScore(profile, {
      performanceId: 'p1',
      judgeCount: 5,
      judgeScores: [
        judge('J1', 40, 60),
        judge('J2', 40, 59),
        judge('J3', 38, 58),
        judge('J4', 36, 57),
        judge('J5', 36, 56),
      ],
      procedureDeductions: 0,
    })
    expect(
      result.judges.filter((score) => score.excludedAccuracy && score.accuracy === 40),
    ).toHaveLength(1)
    expect(
      result.judges.filter((score) => score.excludedAccuracy && score.accuracy === 36),
    ).toHaveLength(1)
  })

  it('handles all judges giving the same score', () => {
    const result = computePerformanceScore(profile, {
      performanceId: 'p1',
      judgeCount: 5,
      judgeScores: ['J1', 'J2', 'J3', 'J4', 'J5'].map((slot) => judge(slot, 38, 58)),
      procedureDeductions: 0,
    })
    expect(result.total).toBe(96)
  })

  it('clamps accuracy and final totals below zero', () => {
    const result = computePerformanceScore(profile, {
      performanceId: 'p1',
      judgeCount: 3,
      judgeScores: [judge('J1', -4, 0), judge('J2', -2, 0), judge('J3', -1, 0)],
      procedureDeductions: 3,
    })
    expect(result.accuracy).toBe(0)
    expect(result.total).toBe(0)
  })

  it('returns incomplete when not all judges submitted', () => {
    const result = computePerformanceScore(profile, {
      performanceId: 'p1',
      judgeCount: 3,
      judgeScores: [judge('J1', 38, 58), judge('J2', 38, 58)],
      procedureDeductions: 0,
    })
    expect(result.status).toBe('incomplete')
  })

  it('deduplicates repeated judge submissions', () => {
    const result = computePerformanceScore(profile, {
      performanceId: 'p1',
      judgeCount: 3,
      judgeScores: [
        judge('J1', 38, 58),
        judge('J1', 20, 20),
        judge('J2', 38, 58),
        judge('J3', 38, 58),
      ],
      procedureDeductions: 0,
    })
    expect(result.status).toBe('duplicate_submission')
    expect(result.total).toBe(96)
  })

  it('resolves first tie-break by higher presentation', () => {
    expect(
      resolveTie([
        { id: 'A', total: 90, presentation: 55, untrimmedTotal: 455 },
        { id: 'B', total: 90, presentation: 54, untrimmedTotal: 455 },
      ]),
    ).toEqual({ status: 'winner', winner: 'A', reason: 'higher_presentation' })
  })

  it('resolves second tie-break by adding back trimmed scores', () => {
    expect(
      resolveTie([
        { id: 'A', total: 90, presentation: 55, untrimmedTotal: 456 },
        { id: 'B', total: 90, presentation: 55, untrimmedTotal: 455 },
      ]),
    ).toEqual({ status: 'winner', winner: 'A', reason: 'include_trimmed_scores' })
  })

  it('returns rematch required when tie-break data is identical', () => {
    expect(
      resolveTie([
        { id: 'A', total: 90, presentation: 55, untrimmedTotal: 455 },
        { id: 'B', total: 90, presentation: 55, untrimmedTotal: 455 },
      ]),
    ).toEqual({ status: 'rematch_required' })
  })

  it('averages one-form and two-form totals with integer rounding', () => {
    const first = computePerformanceScore(profile, {
      performanceId: 'p1',
      judgeCount: 3,
      judgeScores: [judge('J1', 38, 58), judge('J2', 38, 58), judge('J3', 38, 58)],
      procedureDeductions: 0,
    })
    const second = { ...first, performanceId: 'p2', total: 95 }
    expect(computeTwoPoomsaeTotal(first, second)).toBe(96)
  })
})
