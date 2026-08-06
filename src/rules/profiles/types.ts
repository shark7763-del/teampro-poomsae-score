export type PoomsaeCategory = 'recognized' | 'freestyle' | 'mixed'
export type VerificationStatus = 'verified' | 'verified_event_outline' | 'pending_verification'

export interface RuleProfile {
  id: string
  organization: string
  name: string
  effectiveDate: string
  jurisdiction: string
  category: PoomsaeCategory
  supportedJudgeCounts: number[]
  verificationStatus: VerificationStatus
  scoring: {
    accuracyMax: number
    presentationMax: number
    presentationComponents: Array<{
      id: string
      name: string
      max: number
      step: number
    }>
  }
  deductions: {
    minorMistake: number
    majorMistake: number
    restart?: number
    overtime?: number
    boundary?: number
  }
  trimming: {
    enabledJudgeCounts: number[]
    removeHighest: number
    removeLowest: number
    calculateAccuracySeparately: boolean
    calculatePresentationSeparately: boolean
  }
  tieBreak: string[]
  sources: Array<{
    title: string
    url: string
    article?: string
    effectiveDate?: string
  }>
}
