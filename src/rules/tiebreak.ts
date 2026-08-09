import type { RuleProfile, TieBreakRule } from './profiles'

/**
 * 同分判定引擎。
 *
 * 刻意獨立於 UI：Host 不需要自己算，UI 只負責把 `steps` 畫出來，
 * 讓現場看得到「為什麼是這個人贏」。
 */

export interface TieBreakEntry {
  id: string
  /** 最終總分（已扣程序分），百分位 */
  total: number
  /** 去頭去尾後的表現性平均，百分位 */
  presentation: number
  /** 去頭去尾後的正確性平均，百分位 */
  accuracy: number
  /** 不去頭去尾、全部裁判計入的總分，百分位 */
  untrimmedTotal: number
}

export interface TieBreakStep {
  rule: TieBreakRule
  label: string
  /** 這一步是否分出勝負 */
  decided: boolean
  /** 參與比較的選手在這一步的數值，供 UI 顯示 */
  values: Array<{ id: string; value: number }>
}

export interface TieBreakGroup {
  /** 這一組原本同分的選手，依判定後順序排列 */
  ordered: string[]
  steps: TieBreakStep[]
  /** 規則用盡仍同分 → 需要重賽 */
  rematchRequired: boolean
  /** 仍然並列、需要重賽的選手 */
  unresolved: string[]
}

export interface RankedEntry {
  id: string
  rank: number
  /** 與人並列時為 true */
  tied: boolean
}

const RULE_LABELS: Record<TieBreakRule, string> = {
  higher_presentation: '比較表現性',
  higher_accuracy: '比較正確性',
  include_trimmed_scores: '納入被去除的裁判分數',
  rematch_required: '需要重賽',
}

function valueForRule(entry: TieBreakEntry, rule: TieBreakRule): number {
  switch (rule) {
    case 'higher_presentation':
      return entry.presentation
    case 'higher_accuracy':
      return entry.accuracy
    case 'include_trimmed_scores':
      return entry.untrimmedTotal
    case 'rematch_required':
      return entry.total
  }
}

/**
 * 對一組「總分相同」的選手套用 profile.tieBreak，依序嘗試直到分出高下。
 * 回傳每一步的比較過程，即使最後仍需重賽。
 */
export function resolveTie(profile: RuleProfile, entries: TieBreakEntry[]): TieBreakGroup {
  const steps: TieBreakStep[] = []
  if (entries.length <= 1) {
    return { ordered: entries.map((entry) => entry.id), steps, rematchRequired: false, unresolved: [] }
  }

  let pool = [...entries]
  for (const rule of profile.tieBreak) {
    if (rule === 'rematch_required') break

    const values = pool.map((entry) => ({ id: entry.id, value: valueForRule(entry, rule) }))
    const distinct = new Set(values.map((item) => item.value))
    const decided = distinct.size > 1
    steps.push({ rule, label: RULE_LABELS[rule], decided, values })
    if (!decided) continue

    pool = [...pool].sort((left, right) => valueForRule(right, rule) - valueForRule(left, rule))
    // 若這一步已經把所有人分開就結束；否則只剩仍並列的那一群繼續往下比
    const top = valueForRule(pool[0]!, rule)
    const stillTied = pool.filter((entry) => valueForRule(entry, rule) === top)
    if (stillTied.length === 1) {
      return { ordered: pool.map((entry) => entry.id), steps, rematchRequired: false, unresolved: [] }
    }
  }

  const unresolved = unresolvedGroup(pool, profile.tieBreak)
  const rematchRequired = unresolved.length > 1 && profile.tieBreak.includes('rematch_required')
  if (rematchRequired) {
    steps.push({
      rule: 'rematch_required',
      label: RULE_LABELS.rematch_required,
      decided: false,
      values: pool.filter((entry) => unresolved.includes(entry.id)).map((entry) => ({ id: entry.id, value: entry.total })),
    })
  }
  return { ordered: pool.map((entry) => entry.id), steps, rematchRequired, unresolved }
}

function unresolvedGroup(pool: TieBreakEntry[], rules: TieBreakRule[]): string[] {
  const comparable = rules.filter((rule) => rule !== 'rematch_required')
  return pool
    .filter((entry) =>
      pool.some(
        (other) =>
          other.id !== entry.id &&
          other.total === entry.total &&
          comparable.every((rule) => valueForRule(other, rule) === valueForRule(entry, rule)),
      ),
    )
    .map((entry) => entry.id)
}

/**
 * 完整排名：先依總分分組，只有同分的組別才進 tie-break。
 * 仍然並列的選手共用同一個名次，並在 `tied` 標記出來。
 */
export function rankEntries(
  profile: RuleProfile,
  entries: TieBreakEntry[],
): { ranked: RankedEntry[]; groups: TieBreakGroup[] } {
  const byTotal = new Map<number, TieBreakEntry[]>()
  for (const entry of entries) {
    byTotal.set(entry.total, [...(byTotal.get(entry.total) ?? []), entry])
  }

  const groups: TieBreakGroup[] = []
  /** id → 仍然並列的群組編號；沒有並列的人不會出現在這裡 */
  const tieGroupOf = new Map<string, number>()
  const ordered: string[] = []

  for (const total of [...byTotal.keys()].sort((left, right) => right - left)) {
    const group = resolveTie(profile, byTotal.get(total) ?? [])
    if (group.steps.length > 0 || group.rematchRequired) groups.push(group)
    if (group.unresolved.length > 1) {
      const groupIndex = groups.length
      for (const id of group.unresolved) tieGroupOf.set(id, groupIndex)
    }
    ordered.push(...group.ordered)
  }

  /*
   * 標準競賽名次：1, 2, 2, 4。
   * 仍然並列的人在 ordered 裡必定相鄰（同總分且各項 tie-break 值都相同），
   * 所以只要跟前一位比較是否同群組即可。
   */
  const ranked: RankedEntry[] = []
  ordered.forEach((id, index) => {
    const previous = index > 0 ? ordered[index - 1] : undefined
    const group = tieGroupOf.get(id)
    const sharesRank =
      previous !== undefined && group !== undefined && tieGroupOf.get(previous) === group
    const rank = sharesRank ? (ranked[index - 1]?.rank ?? index + 1) : index + 1
    ranked.push({ id, rank, tied: group !== undefined })
  })
  return { ranked, groups }
}
