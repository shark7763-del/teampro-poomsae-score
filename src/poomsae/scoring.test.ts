import { describe, expect, it } from 'vitest'
import {
  TEAMPRO_TRAINING_2026,
  USATKD_RECOGNIZED_2026_01_01,
  WT_RECOGNIZED_2024_06_14,
} from '../rules/profiles'
import type { ProcedureDeduction } from '../rules/penalties'
import { createProcedureDeduction, procedureRule, summarizeProcedureDeductions } from '../rules/penalties'
import { computePerformanceScore, formatPoints } from './scoring'

const full = { speed_power: 200, rhythm_tempo: 200, energy_expression: 200 }

function judge(judgeSlot: string, minorMistakes = 0, majorMistakes = 0, presentation = full) {
  return { judgeSlot, minorMistakes, majorMistakes, presentation, submittedAt: 0 }
}

function penalty(type: 'RESTART' | 'BOUNDARY' | 'TIME'): ProcedureDeduction {
  const rule = procedureRule(WT_RECOGNIZED_2024_06_14, type)
  if (rule === undefined) throw new Error(`missing rule ${type}`)
  return createProcedureDeduction(rule, { id: `${type}-1`, appliedAt: 0 })
}

describe('formatPoints', () => {
  it('renders hundredths with two decimals', () => {
    expect(formatPoints(763)).toBe('7.63')
    expect(formatPoints(1000)).toBe('10.00')
    expect(formatPoints(0)).toBe('0.00')
  })

  it('can render one decimal when a compact display needs it', () => {
    expect(formatPoints(763, 1)).toBe('7.6')
  })
})

describe('poomsae scoring engine', () => {
  /*
   * 這個 case 是規格書自己舉的例子（TOTAL 7.63 / Accuracy 3.20 / Presentation 4.43）。
   * 舊的 ×10 引擎表示不出 7.63，所以這一條同時是精度的回歸測試。
   */
  it('produces two-decimal results such as 7.63', () => {
    const result = computePerformanceScore({
      profile: WT_RECOGNIZED_2024_06_14,
      judgeCount: 3,
      judgeScores: [
        judge('J1', 8, 0, { speed_power: 150, rhythm_tempo: 150, energy_expression: 140 }),
        judge('J2', 8, 0, { speed_power: 150, rhythm_tempo: 150, energy_expression: 140 }),
        judge('J3', 8, 0, { speed_power: 150, rhythm_tempo: 150, energy_expression: 150 }),
      ],
      procedureDeductions: [],
    })

    expect(result.accuracy).toBe(320)
    expect(result.presentation).toBe(443)
    expect(result.total).toBe(763)
    expect(formatPoints(result.total)).toBe('7.63')
  })

  it('averages three judges without trimming', () => {
    const result = computePerformanceScore({
      profile: WT_RECOGNIZED_2024_06_14,
      judgeCount: 3,
      judgeScores: [judge('J1', 1), judge('J2', 0, 1), judge('J3')],
      procedureDeductions: [],
    })

    // 390, 370, 400 → 1160/3 = 386.67 → 386.67 取到百分位是 387（×10 引擎只會給 3.9）
    expect(result.accuracy).toBe(387)
    expect(result.presentation).toBe(600)
    expect(result.total).toBe(987)
    expect(formatPoints(result.total)).toBe('9.87')
  })

  it('scores a single judge and subtracts typed procedure deductions', () => {
    const result = computePerformanceScore({
      profile: WT_RECOGNIZED_2024_06_14,
      judgeCount: 1,
      judgeScores: [judge('J1', 2, 1, { speed_power: 180, rhythm_tempo: 190, energy_expression: 200 })],
      procedureDeductions: [penalty('BOUNDARY')],
    })

    expect(result.accuracy).toBe(350)
    expect(result.presentation).toBe(570)
    expect(result.procedureDeductions).toBe(30)
    expect(result.total).toBe(890)
    expect(result.judges.at(0)?.excludedAccuracy).toBe(false)
  })

  it('trims accuracy and presentation independently for five judges', () => {
    const result = computePerformanceScore({
      profile: USATKD_RECOGNIZED_2026_01_01,
      judgeCount: 5,
      judgeScores: [
        judge('J1', 0, 0, { speed_power: 200, rhythm_tempo: 200, energy_expression: 200 }),
        judge('J2', 1, 0, { speed_power: 190, rhythm_tempo: 200, energy_expression: 200 }),
        judge('J3', 0, 1, { speed_power: 180, rhythm_tempo: 200, energy_expression: 200 }),
        judge('J4', 1, 1, { speed_power: 170, rhythm_tempo: 200, energy_expression: 200 }),
        judge('J5', 0, 2, { speed_power: 160, rhythm_tempo: 200, energy_expression: 200 }),
      ],
      procedureDeductions: [],
    })

    // accuracy 400/390/370/360/340 → 去 400 與 340 → (390+370+360)/3 = 373.33 → 373
    expect(result.accuracy).toBe(373)
    // presentation 600/590/580/570/560 → 去 600 與 560 → 580
    expect(result.presentation).toBe(580)
    expect(result.total).toBe(953)
    expect(result.judges.filter((item) => item.excludedAccuracy)).toHaveLength(2)
    expect(result.judges.filter((item) => item.excludedPresentation)).toHaveLength(2)
  })

  it('supports a seven judge WT simulation panel', () => {
    const result = computePerformanceScore({
      profile: WT_RECOGNIZED_2024_06_14,
      judgeCount: 7,
      judgeScores: [0, 1, 2, 3, 4, 5, 6].map((minor, index) => judge(`J${index + 1}`, minor)),
      procedureDeductions: [],
    })

    // 400,390,380,370,360,350,340 → 去 400 與 340 → (390+380+370+360+350)/5 = 370
    expect(result.accuracy).toBe(370)
    expect(result.presentation).toBe(600)
    expect(result.total).toBe(970)
    expect(result.submittedJudgeCount).toBe(7)
  })

  it('does not trim in TeamPro training mode', () => {
    const result = computePerformanceScore({
      profile: TEAMPRO_TRAINING_2026,
      judgeCount: 5,
      judgeScores: [0, 1, 2, 3, 4].map((minor, index) => judge(`J${index + 1}`, minor)),
      procedureDeductions: [],
    })

    // 400,390,380,370,360 全部計入 → 380
    expect(result.accuracy).toBe(380)
    expect(result.judges.filter((item) => item.excludedAccuracy)).toHaveLength(0)
  })

  it('reports untrimmed totals for tie-break use', () => {
    const result = computePerformanceScore({
      profile: WT_RECOGNIZED_2024_06_14,
      judgeCount: 5,
      judgeScores: [0, 1, 2, 3, 4].map((minor, index) => judge(`J${index + 1}`, minor)),
      procedureDeductions: [],
    })

    expect(result.accuracy).toBe(380)
    expect(result.untrimmedAccuracy).toBe(380)
    expect(result.untrimmedTotal).toBe(980)
  })

  it('ignores duplicate judge submissions and flags them', () => {
    const result = computePerformanceScore({
      profile: WT_RECOGNIZED_2024_06_14,
      judgeCount: 3,
      judgeScores: [
        judge('J1'),
        judge('J1', 0, 3, { speed_power: 0, rhythm_tempo: 0, energy_expression: 0 }),
        judge('J2'),
        judge('J3'),
      ],
      procedureDeductions: [],
    })

    expect(result.status).toBe('duplicate_submission')
    expect(result.total).toBe(1000)
  })

  it('reports incomplete until every judge has submitted', () => {
    const result = computePerformanceScore({
      profile: WT_RECOGNIZED_2024_06_14,
      judgeCount: 5,
      judgeScores: [judge('J1'), judge('J2')],
      procedureDeductions: [penalty('TIME')],
    })

    expect(result.status).toBe('incomplete')
    expect(result.total).toBe(0)
    expect(result.submittedJudgeCount).toBe(2)
  })

  it('never lets procedure deductions push the total below zero', () => {
    const result = computePerformanceScore({
      profile: WT_RECOGNIZED_2024_06_14,
      judgeCount: 1,
      judgeScores: [judge('J1', 40, 0, { speed_power: 0, rhythm_tempo: 0, energy_expression: 0 })],
      procedureDeductions: [penalty('RESTART')],
    })

    expect(result.total).toBe(0)
  })
})

describe('typed procedure deductions', () => {
  it('keeps the reason so reports can group by type', () => {
    const deductions = [penalty('BOUNDARY'), penalty('BOUNDARY'), penalty('RESTART')]
    const summary = summarizeProcedureDeductions(deductions)

    expect(summary).toContainEqual({ type: 'BOUNDARY', count: 2, total: 60 })
    expect(summary).toContainEqual({ type: 'RESTART', count: 1, total: 60 })
  })

  it('only lets CUSTOM override the configured value', () => {
    const boundary = procedureRule(WT_RECOGNIZED_2024_06_14, 'BOUNDARY')!
    const custom = procedureRule(WT_RECOGNIZED_2024_06_14, 'CUSTOM')!

    expect(createProcedureDeduction(boundary, { id: 'a', appliedAt: 0, value: 999 }).value).toBe(30)
    expect(createProcedureDeduction(custom, { id: 'b', appliedAt: 0, value: 50 }).value).toBe(50)
  })
})
