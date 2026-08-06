export type DisplayMode = 'athlete' | 'live-score' | 'result'
export type TimerStatus = 'idle' | 'running' | 'paused' | 'ended'
export type SenderRole = 'controller' | 'display'
export type TrainingConnectionStatus = 'not_connected' | 'connecting' | 'connected' | 'reconnecting' | 'offline'

export interface TrainingDisplayOptions {
  showTimer: boolean
  showAccuracy: boolean
  showMistakeCounts: boolean
  showIssueTags: boolean
  autoPublishResult: boolean
  hidden: boolean
}

export interface TrainingResultSummary {
  total: number
  accuracy: number
  speedPower: number
  rhythmTempo: number
  energyExpression: number
  topIssues: string[]
  nextGoal: string
  previousComparison: string
}

export interface TrainingDisplayState {
  schemaVersion: 1
  sessionId: string
  displayId: string
  displayCode: string
  displayName: string
  expiresAt: number
  sequence: number
  updatedAt: number
  connectedControllerName: string
  displayMode: DisplayMode
  athleteName: string
  teamName: string
  poomsaeName: string
  publicGoal: string
  phase: string
  timerStatus: TimerStatus
  timerStartedAt: number | null
  accumulatedSeconds: number
  minorMistakes: number
  majorMistakes: number
  latestPublicHint: string
  issueTags: string[]
  presentation: {
    speedPower: number
    rhythmTempo: number
    energyExpression: number
  }
  result: TrainingResultSummary | null
  options: TrainingDisplayOptions
  appliedEventIds: string[]
}

export interface PrivateTrainingSession {
  state: TrainingDisplayState
  coachPrivateNotes: string
}

export interface TrainingDisplaySession {
  sessionId: string
  displayId: string
  displayCode: string
  displayName: string
  expiresAt: number
  transportKind: 'local' | 'supabase'
  snapshot?: TrainingDisplayState
}

export interface TrainingPresence {
  sessionId: string
  senderId: string
  senderRole: SenderRole
  displayName: string
  onlineAt: number
}

export interface TrainingEventBase {
  schemaVersion: 1
  eventId: string
  sessionId: string
  displayId: string
  senderId: string
  senderRole: SenderRole
  sequence: number
  sentAt: number
}

export type TrainingDisplayEvent =
  | (TrainingEventBase & { type: 'DISPLAY_CONNECTED'; payload: { displayName: string } })
  | (TrainingEventBase & { type: 'SESSION_STARTED'; payload: { controllerName: string } })
  | (TrainingEventBase & { type: 'ATHLETE_CHANGED'; payload: { athleteName: string; teamName: string; poomsaeName: string } })
  | (TrainingEventBase & { type: 'GOALS_UPDATED'; payload: { publicGoal: string; phase: string } })
  | (TrainingEventBase & { type: 'TIMER_STARTED'; payload: { timerStartedAt: number; accumulatedSeconds: number } })
  | (TrainingEventBase & { type: 'TIMER_PAUSED'; payload: { accumulatedSeconds: number } })
  | (TrainingEventBase & { type: 'TIMER_SYNC'; payload: { timerStartedAt: number | null; accumulatedSeconds: number; timerStatus: TimerStatus } })
  | (TrainingEventBase & { type: 'ACCURACY_UPDATED'; payload: { minorMistakes: number; majorMistakes: number; latestPublicHint: string } })
  | (TrainingEventBase & { type: 'PRESENTATION_UPDATED'; payload: TrainingDisplayState['presentation'] })
  | (TrainingEventBase & { type: 'DISPLAY_MODE_CHANGED'; payload: { displayMode: DisplayMode; options: TrainingDisplayOptions } })
  | (TrainingEventBase & { type: 'RESULT_PUBLISHED'; payload: { result: TrainingResultSummary } })
  | (TrainingEventBase & { type: 'SCREEN_HIDDEN'; payload: { hidden: boolean } })
  | (TrainingEventBase & { type: 'STATE_REQUESTED'; payload: { reason: 'refresh' | 'reconnect' | 'manual' } })
  | (TrainingEventBase & { type: 'STATE_SNAPSHOT'; payload: { snapshot: TrainingDisplayState } })
  | (TrainingEventBase & { type: 'SESSION_ENDED'; payload: { endedAt: number } })

export interface TrainingRealtimeTransport {
  createDisplay(): Promise<TrainingDisplaySession>
  joinDisplay(displayCode: string): Promise<TrainingDisplaySession>
  publish(event: TrainingDisplayEvent): Promise<void>
  publishSnapshot(snapshot: TrainingDisplayState): Promise<void>
  requestSnapshot(): Promise<void>
  subscribe(handler: (event: TrainingDisplayEvent) => void): () => void
  trackPresence(payload: TrainingPresence): Promise<void>
  reconnect(): Promise<void>
  disconnect(): Promise<void>
}
