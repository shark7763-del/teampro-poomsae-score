import type {
  DisplayMode,
  PrivateTrainingSession,
  TimerStatus,
  TrainingDisplayEvent,
  TrainingDisplayOptions,
  TrainingDisplayState,
  TrainingResultSummary,
} from './types'

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const DEFAULT_OPTIONS: TrainingDisplayOptions = {
  showTimer: true,
  showAccuracy: false,
  showMistakeCounts: false,
  showIssueTags: false,
  autoPublishResult: false,
  hidden: false,
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 18)}`
}

export function createDisplayCode(): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('')
}

export function createTrainingDisplayState(input: {
  sessionId?: string
  displayId?: string
  displayCode?: string
  displayName?: string
} = {}): TrainingDisplayState {
  const now = Date.now()
  return {
    schemaVersion: 1,
    sessionId: input.sessionId ?? createId('trn'),
    displayId: input.displayId ?? createId('dsp'),
    displayCode: input.displayCode ?? createDisplayCode(),
    displayName: input.displayName ?? 'TeamPro 訓練顯示器',
    expiresAt: now + 1000 * 60 * 60 * 8,
    sequence: 0,
    updatedAt: now,
    connectedControllerName: '',
    displayMode: 'athlete',
    athleteName: '選手 A',
    teamName: 'TeamPro',
    poomsaeName: '太極八章',
    publicGoal: '穩定節奏與重心',
    phase: '準備',
    timerStatus: 'idle',
    timerStartedAt: null,
    accumulatedSeconds: 0,
    minorMistakes: 0,
    majorMistakes: 0,
    latestPublicHint: '',
    issueTags: [],
    presentation: { speedPower: 20, rhythmTempo: 20, energyExpression: 20 },
    result: null,
    options: DEFAULT_OPTIONS,
    appliedEventIds: [],
  }
}

export function createPrivateTrainingSession(state = createTrainingDisplayState()): PrivateTrainingSession {
  return { state, coachPrivateNotes: '' }
}

export function sanitizeTrainingDisplayState(session: PrivateTrainingSession | TrainingDisplayState): TrainingDisplayState {
  const state = 'state' in session ? session.state : session
  return {
    ...state,
    latestPublicHint: state.options.showIssueTags ? state.latestPublicHint : '',
    issueTags: state.options.showIssueTags ? state.issueTags.slice(0, 3) : [],
    appliedEventIds: state.appliedEventIds.slice(-100),
  }
}

export function applyTrainingDisplayEvent(
  state: TrainingDisplayState,
  event: TrainingDisplayEvent,
): TrainingDisplayState {
  if (event.schemaVersion !== 1) return state
  if (event.sessionId !== state.sessionId) return state
  if (state.appliedEventIds.includes(event.eventId)) return state
  if (event.type !== 'STATE_SNAPSHOT' && event.sequence <= state.sequence) return state

  const base = {
    ...state,
    appliedEventIds: [...state.appliedEventIds, event.eventId].slice(-100),
    sequence: Math.max(state.sequence, event.sequence),
    updatedAt: event.sentAt,
  }

  switch (event.type) {
    case 'DISPLAY_CONNECTED':
      return { ...base, displayName: event.payload.displayName }
    case 'SESSION_STARTED':
      return { ...base, connectedControllerName: event.payload.controllerName, phase: '演練中' }
    case 'ATHLETE_CHANGED':
      return { ...base, ...event.payload }
    case 'GOALS_UPDATED':
      return { ...base, publicGoal: event.payload.publicGoal, phase: event.payload.phase }
    case 'TIMER_STARTED':
      return {
        ...base,
        timerStatus: 'running',
        timerStartedAt: event.payload.timerStartedAt,
        accumulatedSeconds: event.payload.accumulatedSeconds,
      }
    case 'TIMER_PAUSED':
      return { ...base, timerStatus: 'paused', timerStartedAt: null, accumulatedSeconds: event.payload.accumulatedSeconds }
    case 'TIMER_SYNC':
      return { ...base, ...event.payload }
    case 'ACCURACY_UPDATED':
      return { ...base, ...event.payload }
    case 'PRESENTATION_UPDATED':
      return { ...base, presentation: event.payload }
    case 'DISPLAY_MODE_CHANGED':
      return { ...base, displayMode: event.payload.displayMode, options: event.payload.options }
    case 'RESULT_PUBLISHED':
      return { ...base, displayMode: 'result', result: event.payload.result, timerStatus: 'ended' }
    case 'SCREEN_HIDDEN':
      return { ...base, options: { ...base.options, hidden: event.payload.hidden } }
    case 'STATE_REQUESTED':
      return base
    case 'STATE_SNAPSHOT':
      if (event.payload.snapshot.sequence < state.sequence) return base
      return sanitizeTrainingDisplayState({
        ...event.payload.snapshot,
        sequence: Math.max(event.payload.snapshot.sequence, event.sequence),
        updatedAt: event.sentAt,
        appliedEventIds: base.appliedEventIds,
      })
    case 'SESSION_ENDED':
      return { ...base, phase: '結束', timerStatus: 'ended' }
  }
}

export function elapsedSeconds(state: TrainingDisplayState, now = Date.now()): number {
  if (state.timerStatus !== 'running' || state.timerStartedAt === null) return state.accumulatedSeconds
  return state.accumulatedSeconds + Math.max(0, Math.floor((now - state.timerStartedAt) / 1000))
}

export function buildResult(state: TrainingDisplayState): TrainingResultSummary {
  const accuracy = Math.max(0, 40 - state.minorMistakes - state.majorMistakes * 3)
  const presentation = state.presentation.speedPower + state.presentation.rhythmTempo + state.presentation.energyExpression
  return {
    total: Math.max(0, accuracy + presentation),
    accuracy,
    speedPower: state.presentation.speedPower,
    rhythmTempo: state.presentation.rhythmTempo,
    energyExpression: state.presentation.energyExpression,
    topIssues: state.issueTags.slice(0, 3),
    nextGoal: state.publicGoal,
    previousComparison: '尚未建立同品勢歷史比較',
  }
}

export function updateOptionsForMode(
  mode: DisplayMode,
  current: TrainingDisplayOptions,
): TrainingDisplayOptions {
  if (mode === 'athlete') {
    return { ...current, showAccuracy: false, showMistakeCounts: false, showIssueTags: false, hidden: false }
  }
  if (mode === 'live-score') {
    return { ...current, showAccuracy: true, showMistakeCounts: true, hidden: false }
  }
  return { ...current, showAccuracy: true, showMistakeCounts: true, showIssueTags: true, hidden: false }
}

export function timerStatusText(status: TimerStatus): string {
  return status === 'running' ? '計時中' : status === 'paused' ? '暫停' : status === 'ended' ? '完成' : '待開始'
}
