import { describe, expect, it } from 'vitest'
import { USATKD_RECOGNIZED_2026_01_01, WT_RECOGNIZED_2024_06_14 } from '../rules/profiles'
import { computePerformanceScore, formatScore } from './scoring'

const presentation = {
  speed_power: 20,
  rhythm_tempo: 20,
  energy_expression: 20,
}

function judge(judgeSlot: string, minorMistakes = 0, majorMistakes = 0, score = presentation) {
  return { judgeSlot, minorMistakes, majorMistakes, presentation: score, submittedAt: 0 }
}

describe('poomsae scoring engine', () => {
  it('keeps internal integer scores and formats display decimals', () => {
    expect(formatScore(97)).toBe('9.7')
  })

  it('averages three judges without trimming', () => {
    const result = computePerformanceScore({
      profile: WT_RECOGNIZED_2024_06_14,
      judgeCount: 3,
      judgeScores: [
        judge('J1', 1),
        judge('J2', 0, 1),
        judge('J3'),
      ],
      procedureDeductions: 0,
    })

    expect(result.accuracy).toBe(39)
    expect(result.presentation).toBe(60)
    expect(result.total).toBe(99)
  })

  it('trims accuracy and presentation independently for five judges', () => {
    const result = computePerformanceScore({
      profile: USATKD_RECOGNIZED_2026_01_01,
      judgeCount: 5,
      judgeScores: [
        judge('J1', 0, 0, { speed_power: 20, rhythm_tempo: 20, energy_expression: 20 }),
        judge('J2', 1, 0, { speed_power: 19, rhythm_tempo: 20, energy_expression: 20 }),
        judge('J3', 0, 1, { speed_power: 18, rhythm_tempo: 20, energy_expression: 20 }),
        judge('J4', 1, 1, { speed_power: 17, rhythm_tempo: 20, energy_expression: 20 }),
        judge('J5', 0, 2, { speed_power: 16, rhythm_tempo: 20, energy_expression: 20 }),
      ],
      procedureDeductions: 0,
    })

    expect(result.accuracy).toBe(37)
    expect(result.presentation).toBe(58)
    expect(result.total).toBe(95)
    expect(result.judges.filter((item) => item.excludedAccuracy)).toHaveLength(2)
    expect(result.judges.filter((item) => item.excludedPresentation)).toHaveLength(2)
  })

  it('does not count duplicate judge submissions', () => {
    const result = computePerformanceScore({
      profile: WT_RECOGNIZED_2024_06_14,
      judgeCount: 3,
      judgeScores: [
        judge('J1'),
        judge('J1', 0, 3, { speed_power: 0, rhythm_tempo: 0, energy_expression: 0 }),
        judge('J2'),
        judge('J3'),
      ],
      procedureDeductions: 0,
    })

    expect(result.total).toBe(100)
  })
})
