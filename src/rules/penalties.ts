import type { ProcedureDeductionRule, ProcedureDeductionType, RuleProfile } from './profiles'

/**
 * 一筆已套用的程序扣分。
 *
 * 存 `type` 而不是只存 `-30`，是為了之後能回答
 *「這個選手最常被扣的是出界還是超時」這種問題。
 */
export interface ProcedureDeduction {
  id: string
  type: ProcedureDeductionType
  label: string
  /** 正整數，百分位。0.3 → 30 */
  value: number
  /** CUSTOM 時的自由說明 */
  note?: string
  appliedAt: number
}

export function createProcedureDeduction(
  rule: ProcedureDeductionRule,
  options: { id: string; appliedAt: number; note?: string; value?: number } ,
): ProcedureDeduction {
  return {
    id: options.id,
    type: rule.type,
    label: rule.label,
    // CUSTOM 允許覆寫數值，其他種類一律以 RuleProfile 為準
    value: rule.type === 'CUSTOM' && options.value !== undefined ? Math.max(0, options.value) : rule.value,
    note: options.note,
    appliedAt: options.appliedAt,
  }
}

export function totalProcedureDeduction(deductions: readonly ProcedureDeduction[]): number {
  return deductions.reduce((sum, deduction) => sum + Math.max(0, deduction.value), 0)
}

/** 依種類統計，給報表與弱項分析用。 */
export function summarizeProcedureDeductions(
  deductions: readonly ProcedureDeduction[],
): Array<{ type: ProcedureDeductionType; count: number; total: number }> {
  const buckets = new Map<ProcedureDeductionType, { count: number; total: number }>()
  for (const deduction of deductions) {
    const bucket = buckets.get(deduction.type) ?? { count: 0, total: 0 }
    bucket.count += 1
    bucket.total += Math.max(0, deduction.value)
    buckets.set(deduction.type, bucket)
  }
  return Array.from(buckets, ([type, bucket]) => ({ type, ...bucket }))
}

export function procedureRule(
  profile: RuleProfile,
  type: ProcedureDeductionType,
): ProcedureDeductionRule | undefined {
  return profile.procedureDeductions.find((rule) => rule.type === type)
}
