/**
 * 規則層型別。
 *
 * 分數一律用「百分位整數」表示，避免浮點誤差：
 *   4.00 分 → 400
 *   0.30 扣分 → 30
 *
 * 為什麼是 ×100 而不是 ×10：WT 公布成績到小數第 2 位（例如 7.63），
 * 五位裁判去頭去尾後平均三個人時，×10 會把 0.01 級距的資訊直接捨掉。
 */

/** 訓練用 1/3；WT 認證品勢 5/7。 */
export type JudgeCount = 1 | 3 | 5 | 7

/** 程序扣分種類。存型別而非只存數值，報表才分析得出「哪一種失誤最常發生」。 */
export type ProcedureDeductionType = 'RESTART' | 'BOUNDARY' | 'TIME' | 'UNIFORM' | 'CUSTOM'

export interface ProcedureDeductionRule {
  type: ProcedureDeductionType
  label: string
  /** 正整數，百分位。0.3 → 30 */
  value: number
}

/**
 * 同分判定順序，依序套用直到分出勝負。
 * `rematch_required` 一定是最後一項：代表規則已用盡，需重賽。
 */
export type TieBreakRule =
  | 'higher_presentation'
  | 'higher_accuracy'
  | 'include_trimmed_scores'
  | 'rematch_required'

export interface PresentationComponent {
  id: string
  name: string
  /** 百分位。2.00 → 200 */
  max: number
  /** 每次調整的級距，百分位。0.1 → 10 */
  step: number
}

export interface RuleProfile {
  id: string
  organization: string
  name: string
  effectiveDate: string
  jurisdiction: string
  category: 'recognized'
  supportedJudgeCounts: JudgeCount[]
  scoring: {
    /** 百分位。4.00 → 400 */
    accuracyMax: number
    /** 百分位。6.00 → 600 */
    presentationMax: number
    presentationComponents: PresentationComponent[]
  }
  deductions: {
    /** 百分位。0.1 → 10 */
    minorMistake: number
    /** 百分位。0.3 → 30 */
    majorMistake: number
  }
  /** 程序扣分快捷選單，Host UI 直接由此渲染，不得硬編碼數值。 */
  procedureDeductions: ProcedureDeductionRule[]
  trimming: {
    /** 只有這些裁判人數會去頭去尾；1/3 判不去除。 */
    enabledJudgeCounts: JudgeCount[]
    removeHighest: number
    removeLowest: number
    calculateAccuracySeparately: boolean
    calculatePresentationSeparately: boolean
  }
  tieBreak: TieBreakRule[]
  sources: Array<{ title: string; url: string; article?: string; effectiveDate?: string }>
}
