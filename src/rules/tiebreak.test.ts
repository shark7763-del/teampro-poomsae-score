import { describe, expect, it } from 'vitest'
import { WT_RECOGNIZED_2024_06_14 } from './profiles'
import type { TieBreakEntry } from './tiebreak'
import { rankEntries, resolveTie } from './tiebreak'

function entry(id: string, overrides: Partial<TieBreakEntry> = {}): TieBreakEntry {
  return {
    id,
    total: 763,
    presentation: 443,
    accuracy: 320,
    untrimmedTotal: 763,
    ...overrides,
  }
}

describe('tie-break engine', () => {
  it('decides on higher presentation first', () => {
    const group = resolveTie(WT_RECOGNIZED_2024_06_14, [
      entry('A', { presentation: 440, accuracy: 323 }),
      entry('B', { presentation: 450, accuracy: 313 }),
    ])

    expect(group.ordered).toEqual(['B', 'A'])
    expect(group.rematchRequired).toBe(false)
    expect(group.steps.at(0)?.rule).toBe('higher_presentation')
    expect(group.steps.at(0)?.decided).toBe(true)
  })

  it('falls through to the untrimmed scores when presentation ties', () => {
    const group = resolveTie(WT_RECOGNIZED_2024_06_14, [
      entry('A', { untrimmedTotal: 760 }),
      entry('B', { untrimmedTotal: 770 }),
    ])

    expect(group.ordered).toEqual(['B', 'A'])
    expect(group.steps.map((step) => step.rule)).toEqual([
      'higher_presentation',
      'include_trimmed_scores',
    ])
    expect(group.steps.at(0)?.decided).toBe(false)
    expect(group.steps.at(1)?.decided).toBe(true)
  })

  it('requires a rematch when every rule is exhausted', () => {
    const group = resolveTie(WT_RECOGNIZED_2024_06_14, [entry('A'), entry('B')])

    expect(group.rematchRequired).toBe(true)
    expect(group.unresolved.sort()).toEqual(['A', 'B'])
    expect(group.steps.at(-1)?.rule).toBe('rematch_required')
  })

  it('exposes every comparison step so the host does not have to calculate', () => {
    const group = resolveTie(WT_RECOGNIZED_2024_06_14, [
      entry('A', { presentation: 440 }),
      entry('B', { presentation: 450 }),
    ])

    expect(group.steps.at(0)?.values).toEqual([
      { id: 'A', value: 440 },
      { id: 'B', value: 450 },
    ])
  })

  it('does nothing for a single entry', () => {
    const group = resolveTie(WT_RECOGNIZED_2024_06_14, [entry('A')])

    expect(group.ordered).toEqual(['A'])
    expect(group.steps).toHaveLength(0)
    expect(group.rematchRequired).toBe(false)
  })
})

describe('ranking', () => {
  it('sorts by total before applying tie-break', () => {
    const { ranked } = rankEntries(WT_RECOGNIZED_2024_06_14, [
      entry('A', { total: 700 }),
      entry('C', { total: 900 }),
      entry('B', { total: 800 }),
    ])

    expect(ranked.map((item) => item.id)).toEqual(['C', 'B', 'A'])
    expect(ranked.map((item) => item.rank)).toEqual([1, 2, 3])
  })

  it('gives unresolved ties the same rank and skips the next one (1, 2, 2, 4)', () => {
    const { ranked } = rankEntries(WT_RECOGNIZED_2024_06_14, [
      entry('A', { total: 900, presentation: 500, untrimmedTotal: 900 }),
      entry('B', { total: 800, presentation: 440, untrimmedTotal: 800 }),
      entry('C', { total: 800, presentation: 440, untrimmedTotal: 800 }),
      entry('D', { total: 700, presentation: 400, untrimmedTotal: 700 }),
    ])

    expect(ranked.map((item) => item.rank)).toEqual([1, 2, 2, 4])
    expect(ranked.filter((item) => item.tied).map((item) => item.id).sort()).toEqual(['B', 'C'])
  })

  it('separates a tie that the rules can resolve', () => {
    const { ranked } = rankEntries(WT_RECOGNIZED_2024_06_14, [
      entry('A', { total: 800, presentation: 440 }),
      entry('B', { total: 800, presentation: 450 }),
    ])

    expect(ranked.map((item) => item.id)).toEqual(['B', 'A'])
    expect(ranked.map((item) => item.rank)).toEqual([1, 2])
    expect(ranked.every((item) => !item.tied)).toBe(true)
  })
})
