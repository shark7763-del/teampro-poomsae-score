import type { RuleProfile } from './types'

const recognizedPresentationComponents = [
  { id: 'speed_power', name: '速度與力量', max: 20, step: 1 },
  { id: 'rhythm_tempo', name: '節奏與速度控制', max: 20, step: 1 },
  { id: 'energy_expression', name: '氣勢表現', max: 20, step: 1 },
]

export const WT_RECOGNIZED_2024_06_14: RuleProfile = {
  id: 'WT_RECOGNIZED_2024_06_14',
  organization: 'World Taekwondo',
  name: 'WT Recognized Poomsae Rules',
  effectiveDate: '2024-06-14',
  jurisdiction:
    'World Taekwondo events and member associations unless overridden by approved event rules',
  category: 'recognized',
  supportedJudgeCounts: [3, 5, 7],
  verificationStatus: 'verified',
  scoring: {
    accuracyMax: 40,
    presentationMax: 60,
    presentationComponents: recognizedPresentationComponents,
  },
  deductions: {
    minorMistake: 1,
    majorMistake: 3,
    overtime: 3,
    boundary: 3,
  },
  trimming: {
    enabledJudgeCounts: [5, 7],
    removeHighest: 1,
    removeLowest: 1,
    calculateAccuracySeparately: true,
    calculatePresentationSeparately: true,
  },
  tieBreak: ['higher_presentation', 'include_trimmed_scores', 'rematch_required'],
  sources: [
    {
      title: 'WT Poomsae Competition Rules & Interpretation',
      url: 'https://www.tpetkd.org.tw/_files/ugd/08b6fd_fcbb709610c5469f8a9499a01f142e17.pdf',
      article: 'Articles 15, 16, 18',
      effectiveDate: '2024-06-14',
    },
  ],
}

export const USATKD_RECOGNIZED_2026_01_01: RuleProfile = {
  ...WT_RECOGNIZED_2024_06_14,
  id: 'USATKD_RECOGNIZED_2026_01_01',
  organization: 'USA Taekwondo',
  name: 'USATKD Recognized Poomsae Rules',
  effectiveDate: '2026-01-01',
  jurisdiction: 'USA Taekwondo promoted, organized, or sanctioned Poomsae competitions',
  supportedJudgeCounts: [3, 5],
  sources: [
    {
      title: '2026 USATKD Poomsae Rules',
      url: 'https://assets.contentstack.io/v3/assets/blteb7d012fc7ebef7f/blt2103cb6e4ad9cd42/69417ee5d9ae217354c1771c/2026_USATKD_Poomsae_Rules_1_1_26.pdf',
      article: 'Articles 3, 15, 16, 18',
      effectiveDate: '2026-01-01',
    },
  ],
}

export const RECOGNIZED_RULE_PROFILES = {
  [WT_RECOGNIZED_2024_06_14.id]: WT_RECOGNIZED_2024_06_14,
  [USATKD_RECOGNIZED_2026_01_01.id]: USATKD_RECOGNIZED_2026_01_01,
} as const
