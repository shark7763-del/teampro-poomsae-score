import type { PresentationComponent, ProcedureDeductionRule, RuleProfile } from './types'

/** 表現性三分項，各 2.00 分，合計 6.00。級距 0.1。 */
const presentationComponents: PresentationComponent[] = [
  { id: 'speed_power', name: '速度與力量', max: 200, step: 10 },
  { id: 'rhythm_tempo', name: '節奏與速度控制', max: 200, step: 10 },
  { id: 'energy_expression', name: '氣勢表現', max: 200, step: 10 },
]

/** 程序扣分快捷。Host UI 直接由此渲染，改規則只改這裡。 */
const procedureDeductions: ProcedureDeductionRule[] = [
  { type: 'RESTART', label: '重新開始', value: 60 },
  { type: 'BOUNDARY', label: '出界', value: 30 },
  { type: 'TIME', label: '時間', value: 30 },
  { type: 'UNIFORM', label: '服裝儀容', value: 30 },
  { type: 'CUSTOM', label: '其他', value: 10 },
]

export const WT_RECOGNIZED_2024_06_14: RuleProfile = {
  id: 'WT_RECOGNIZED_2024_06_14',
  organization: 'World Taekwondo',
  name: 'WT Recognized Poomsae 2024',
  effectiveDate: '2024-06-14',
  jurisdiction: 'WT / member association events unless overridden by event rules',
  category: 'recognized',
  supportedJudgeCounts: [1, 3, 5, 7],
  scoring: {
    accuracyMax: 400,
    presentationMax: 600,
    presentationComponents,
  },
  deductions: {
    minorMistake: 10,
    majorMistake: 30,
  },
  procedureDeductions,
  trimming: {
    // 5 判與 7 判去掉最高與最低各一位；1/3 判人數太少，去除後樣本不足。
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
  name: 'USATKD Recognized Poomsae 2026',
  effectiveDate: '2026-01-01',
  jurisdiction: 'USA Taekwondo promoted, organized, or sanctioned events',
  sources: [
    {
      title: '2026 USATKD Poomsae Rules',
      url: 'https://assets.contentstack.io/v3/assets/blteb7d012fc7ebef7f/blt2103cb6e4ad9cd42/69417ee5d9ae217354c1771c/2026_USATKD_Poomsae_Rules_1_1_26.pdf',
      article: 'Articles 3, 15, 16, 18',
      effectiveDate: '2026-01-01',
    },
  ],
}

/**
 * TeamPro 訓練模式：沿用 WT 的計分結構，但明確標示為訓練用，
 * 且不做去頭去尾（訓練時每位教練的意見都要保留）。
 */
export const TEAMPRO_TRAINING_2026: RuleProfile = {
  ...WT_RECOGNIZED_2024_06_14,
  id: 'TEAMPRO_TRAINING_2026',
  organization: 'TeamPro',
  name: 'TeamPro 訓練模式',
  effectiveDate: '2026-01-01',
  jurisdiction: '訓練、校隊測驗、道館模擬賽；非正式競賽',
  supportedJudgeCounts: [1, 3, 5],
  trimming: {
    ...WT_RECOGNIZED_2024_06_14.trimming,
    enabledJudgeCounts: [],
  },
}

export const RULE_PROFILES: Record<string, RuleProfile> = {
  [WT_RECOGNIZED_2024_06_14.id]: WT_RECOGNIZED_2024_06_14,
  [USATKD_RECOGNIZED_2026_01_01.id]: USATKD_RECOGNIZED_2026_01_01,
  [TEAMPRO_TRAINING_2026.id]: TEAMPRO_TRAINING_2026,
}

export type {
  JudgeCount,
  PresentationComponent,
  ProcedureDeductionRule,
  ProcedureDeductionType,
  RuleProfile,
  TieBreakRule,
} from './types'
