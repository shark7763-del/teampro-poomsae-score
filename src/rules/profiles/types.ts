export interface RuleProfile {
  id: string
  organization: string
  name: string
  effectiveDate: string
  jurisdiction: string
  category: 'recognized'
  supportedJudgeCounts: Array<3 | 5>
  scoring: {
    accuracyMax: number
    presentationMax: number
    presentationComponents: Array<{ id: string; name: string; max: number; step: number }>
  }
  deductions: {
    minorMistake: number
    majorMistake: number
    overtime: number
    boundary: number
  }
  trimming: {
    enabledJudgeCounts: Array<3 | 5>
    removeHighest: number
    removeLowest: number
    calculateAccuracySeparately: boolean
    calculatePresentationSeparately: boolean
  }
  tieBreak: string[]
  sources: Array<{ title: string; url: string; article?: string; effectiveDate?: string }>
}
