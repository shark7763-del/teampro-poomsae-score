import { RULE_PROFILES, WT_RECOGNIZED_2024_06_14 } from '../rules/profiles'
import type { JudgeCount } from '../rules/profiles'
import type { ProcedureDeduction } from '../rules/penalties'
import type { JudgeScoreInput, PerformanceScoreResult } from './scoring'
import { computePerformanceScore } from './scoring'
import type { RoomActor, RoomTokens } from './tokens'
import { createRoomTokens, verifyActor } from './tokens'

export type RoomStatus = 'SETUP' | 'WAITING_FOR_SUBMISSIONS' | 'SCORES_LOCKED' | 'PUBLISHED'

export type AthleteStatus = 'waiting' | 'current' | 'done' | 'skipped'

export interface AthleteEntry {
  id: string
  name: string
  teamName: string
  poomsaeName: string
  status: AthleteStatus
}

export type AuditEventType =
  | 'ROOM_CREATED'
  | 'SETTINGS_UPDATED'
  | 'ATHLETE_STARTED'
  | 'ATHLETE_CHANGED'
  | 'JUDGE_SUBMITTED'
  | 'JUDGE_REOPENED'
  | 'PENALTY_APPLIED'
  | 'PENALTY_UNDONE'
  | 'SCORE_LOCKED'
  | 'SCORE_REVEALED'
  | 'QUEUE_UPDATED'
  | 'DENIED'

export interface AuditEntry {
  id: string
  type: AuditEventType
  at: number
  actorRole: RoomActor['role']
  actorSlot?: string
  detail?: string
}

export interface RoomState {
  roomCode: string
  /**
   * `null` 代表這份副本沒有 token —— 跨裝置同步時 token 絕不隨 snapshot 廣播，
   * 否則任何人讀到房間狀態就拿到全部裁判 token。
   * 這種副本只做結構授權（見 canPerform），真正的 token 驗證在資料層（Supabase RPC）。
   */
  tokens: RoomTokens | null
  profileId: string
  judgeCount: JudgeCount
  athleteName: string
  teamName: string
  poomsaeName: string
  /** 型別化的程序扣分清單；不要退回單一數字，報表需要知道扣分原因 */
  procedureDeductions: ProcedureDeduction[]
  status: RoomStatus
  judgeScores: Record<string, JudgeScoreInput>
  queue: AthleteEntry[]
  currentAthleteId: string | null
  auditLog: AuditEntry[]
  appliedEventIds: string[]
  /** 已套用過的送分識別碼，裁判重送同一筆不會產生第二筆分數 */
  appliedSubmissionIds: string[]
  lastSequence: number
}

/** UPDATE_SETTINGS 只允許改比賽設定，不能透過它繞過 token 或竄改評分 */
export type RoomSettingsPatch = Partial<
  Pick<RoomState, 'profileId' | 'judgeCount' | 'athleteName' | 'teamName' | 'poomsaeName'>
>

export type RoomEventBody =
  | { type: 'UPDATE_SETTINGS'; patch: RoomSettingsPatch }
  | { type: 'START_SCORING' }
  | { type: 'SUBMIT_SCORE'; submissionId: string; score: JudgeScoreInput }
  | { type: 'RETURN_SCORE'; judgeSlot: string }
  | { type: 'LOCK_SCORES' }
  | { type: 'PUBLISH_SCORES' }
  | { type: 'RESET' }
  | { type: 'APPLY_PENALTY'; deduction: ProcedureDeduction }
  | { type: 'UNDO_PENALTY' }
  | { type: 'QUEUE_REPLACED'; entries: AthleteEntry[] }
  | { type: 'QUEUE_REORDERED'; order: string[] }
  | { type: 'NEXT_ATHLETE' }
  | { type: 'SKIP_ATHLETE' }

export type RoomEvent = RoomEventBody & {
  roomCode: string
  eventId: string
  sequence: number
  at: number
  actor: RoomActor
}

export type RoomEventInput = RoomEventBody

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const STORAGE_PREFIX = 'teampro-poomsae:'
const CHANNEL_PREFIX = 'teampro-poomsae-channel:'
const AUDIT_LIMIT = 500

export function generateRoomCode(): string {
  const bytes = new Uint8Array(6)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('')
}

export function judgeSlots(count: JudgeCount): string[] {
  return Array.from({ length: count }, (_, index) => `J${index + 1}`)
}

export function createRoom(roomCode = generateRoomCode(), createdAt = Date.now()): RoomState {
  return {
    roomCode,
    tokens: createRoomTokens(),
    profileId: WT_RECOGNIZED_2024_06_14.id,
    judgeCount: 3,
    athleteName: '',
    teamName: '',
    poomsaeName: '',
    procedureDeductions: [],
    status: 'SETUP',
    judgeScores: {},
    queue: [],
    currentAthleteId: null,
    auditLog: [
      { id: `${roomCode}-created`, type: 'ROOM_CREATED', at: createdAt, actorRole: 'HOST' },
    ],
    appliedEventIds: [],
    appliedSubmissionIds: [],
    lastSequence: 0,
  }
}

/**
 * 誰可以做什麼。
 *
 * HOST 掌控流程但**不能代替裁判送分**；
 * JUDGE 只能送自己那一格；
 * DISPLAY 什麼都不能改。
 */
export function canPerform(event: RoomEvent): boolean {
  switch (event.actor.role) {
    case 'HOST':
      return event.type !== 'SUBMIT_SCORE'
    case 'JUDGE':
      return event.type === 'SUBMIT_SCORE' && event.score.judgeSlot === event.actor.slot
    case 'DISPLAY':
      return false
  }
}

export function reduceRoom(state: RoomState, event: RoomEvent): RoomState {
  if (state.appliedEventIds.includes(event.eventId)) return state

  // 結構授權永遠檢查；token 只在持有 token 的副本（本機模式／Host 自己）能檢查
  const authorized =
    canPerform(event) && (state.tokens === null || verifyActor(state.tokens, event.actor))
  if (!authorized) {
    /*
     * 越權事件不推進 lastSequence，否則偽造一個超大 sequence 就能讓整個房間卡住。
     * 但要留下紀錄，現場才查得出「是誰在亂送」。
     */
    return {
      ...state,
      appliedEventIds: appendCapped(state.appliedEventIds, event.eventId, 100),
      auditLog: appendAudit(state.auditLog, {
        id: `${event.eventId}-denied`,
        type: 'DENIED',
        at: event.at,
        actorRole: event.actor.role,
        actorSlot: event.actor.slot,
        detail: event.type,
      }),
    }
  }

  if (event.sequence <= state.lastSequence) return state

  const base: RoomState = {
    ...state,
    appliedEventIds: appendCapped(state.appliedEventIds, event.eventId, 100),
    lastSequence: event.sequence,
  }
  const audit = (entry: Omit<AuditEntry, 'id' | 'at' | 'actorRole' | 'actorSlot'>): AuditEntry[] =>
    appendAudit(state.auditLog, {
      id: `${event.eventId}-audit`,
      at: event.at,
      actorRole: event.actor.role,
      actorSlot: event.actor.slot,
      ...entry,
    })

  switch (event.type) {
    case 'UPDATE_SETTINGS':
      return {
        ...base,
        ...event.patch,
        auditLog: audit({ type: 'SETTINGS_UPDATED', detail: Object.keys(event.patch).join(',') }),
      }

    case 'START_SCORING':
      return {
        ...base,
        status: 'WAITING_FOR_SUBMISSIONS',
        auditLog: audit({ type: 'ATHLETE_STARTED', detail: state.athleteName }),
      }

    case 'SUBMIT_SCORE': {
      if (state.status !== 'WAITING_FOR_SUBMISSIONS') return base
      // 真正的 idempotency：同一個 submissionId 不論重送幾次都只算一筆
      if (state.appliedSubmissionIds.includes(event.submissionId)) return base
      if (state.judgeScores[event.score.judgeSlot] !== undefined) return base
      return {
        ...base,
        judgeScores: { ...state.judgeScores, [event.score.judgeSlot]: event.score },
        appliedSubmissionIds: appendCapped(state.appliedSubmissionIds, event.submissionId, 200),
        auditLog: audit({ type: 'JUDGE_SUBMITTED', detail: event.score.judgeSlot }),
      }
    }

    case 'RETURN_SCORE': {
      const { [event.judgeSlot]: _removed, ...remaining } = state.judgeScores
      return {
        ...base,
        status: 'WAITING_FOR_SUBMISSIONS',
        judgeScores: remaining,
        /*
         * 退回時要一併清掉該裁判的 submissionId，
         * 否則他重新送出會被 idempotency 當成重複而永遠送不進來。
         */
        appliedSubmissionIds: state.appliedSubmissionIds.filter(
          (id) => !id.startsWith(`${event.judgeSlot}:`),
        ),
        auditLog: audit({ type: 'JUDGE_REOPENED', detail: event.judgeSlot }),
      }
    }

    case 'LOCK_SCORES':
      if (Object.keys(state.judgeScores).length < state.judgeCount) return base
      return { ...base, status: 'SCORES_LOCKED', auditLog: audit({ type: 'SCORE_LOCKED' }) }

    case 'PUBLISH_SCORES':
      if (state.status !== 'SCORES_LOCKED') return base
      return { ...base, status: 'PUBLISHED', auditLog: audit({ type: 'SCORE_REVEALED' }) }

    case 'APPLY_PENALTY':
      return {
        ...base,
        procedureDeductions: [...state.procedureDeductions, event.deduction],
        auditLog: audit({ type: 'PENALTY_APPLIED', detail: event.deduction.type }),
      }

    case 'UNDO_PENALTY': {
      const removed = state.procedureDeductions.at(-1)
      if (removed === undefined) return base
      return {
        ...base,
        procedureDeductions: state.procedureDeductions.slice(0, -1),
        auditLog: audit({ type: 'PENALTY_UNDONE', detail: removed.type }),
      }
    }

    case 'QUEUE_REPLACED':
      return {
        ...base,
        queue: event.entries,
        auditLog: audit({ type: 'QUEUE_UPDATED', detail: `${event.entries.length} 位` }),
      }

    case 'QUEUE_REORDERED': {
      const byId = new Map(state.queue.map((entry) => [entry.id, entry]))
      const reordered = event.order.flatMap((id) => {
        const entry = byId.get(id)
        return entry === undefined ? [] : [entry]
      })
      // 沒被列在 order 裡的人接在後面，避免拖曳失誤把人弄不見
      const missing = state.queue.filter((entry) => !event.order.includes(entry.id))
      return {
        ...base,
        queue: [...reordered, ...missing],
        auditLog: audit({ type: 'QUEUE_UPDATED', detail: 'reordered' }),
      }
    }

    case 'RESET':
      /*
       * 重新評分同一位選手。
       *
       * 這裡必須從 `base` 展開，不能用 createRoom() 重建：
       * createRoom() 會把 lastSequence 歸零、appliedEventIds 清空，
       * 於是一個延遲抵達的舊事件（例如 sequence 12 的 SUBMIT_SCORE）
       * 不再被 `sequence <= lastSequence` 擋下，會被當成新事件重新套用。
       */
      return {
        ...base,
        status: 'SETUP',
        judgeScores: {},
        procedureDeductions: [],
        auditLog: audit({ type: 'ATHLETE_CHANGED', detail: '重新評分' }),
      }

    case 'SKIP_ATHLETE':
      return advanceAthlete(base, state, audit, 'skipped')

    case 'NEXT_ATHLETE':
      return advanceAthlete(base, state, audit, 'done')
  }
}

/**
 * 換下一位選手：清掉這一輪的評分，保留房間、設定、token 與裁判身分。
 * 裁判手機不需要重新掃 QR —— 這是現場效率的關鍵。
 */
function advanceAthlete(
  base: RoomState,
  state: RoomState,
  audit: (entry: Omit<AuditEntry, 'id' | 'at' | 'actorRole' | 'actorSlot'>) => AuditEntry[],
  finishedStatus: Extract<AthleteStatus, 'done' | 'skipped'>,
): RoomState {
  const queue = state.queue.map((entry) =>
    entry.id === state.currentAthleteId ? { ...entry, status: finishedStatus } : entry,
  )
  const next = queue.find((entry) => entry.status === 'waiting')

  const cleared: RoomState = {
    ...base,
    status: 'SETUP',
    judgeScores: {},
    procedureDeductions: [],
    queue,
  }

  if (next === undefined) {
    // 名單跑完（或本來就沒有名單）：保留目前選手資料，讓 Host 手動輸入下一位
    return {
      ...cleared,
      currentAthleteId: null,
      auditLog: audit({ type: 'ATHLETE_CHANGED', detail: '名單已結束' }),
    }
  }

  return {
    ...cleared,
    queue: queue.map((entry) => (entry.id === next.id ? { ...entry, status: 'current' } : entry)),
    currentAthleteId: next.id,
    athleteName: next.name,
    teamName: next.teamName,
    poomsaeName: next.poomsaeName,
    auditLog: audit({ type: 'ATHLETE_CHANGED', detail: next.name }),
  }
}

function appendCapped(list: string[], value: string, limit: number): string[] {
  return [...list, value].slice(-limit)
}

function appendAudit(log: AuditEntry[], entry: AuditEntry): AuditEntry[] {
  return [...log, entry].slice(-AUDIT_LIMIT)
}

/** 廣播前必用：拿掉 token，其餘照舊。 */
export function sanitizeRoomState(state: RoomState): RoomState {
  return { ...state, tokens: null }
}

export function scoreRoom(state: RoomState): PerformanceScoreResult {
  const activeSlots = new Set(judgeSlots(state.judgeCount))
  return computePerformanceScore({
    profile: RULE_PROFILES[state.profileId] ?? WT_RECOGNIZED_2024_06_14,
    judgeCount: state.judgeCount,
    judgeScores: Object.values(state.judgeScores).filter((score) => activeSlots.has(score.judgeSlot)),
    procedureDeductions: state.procedureDeductions,
  })
}

/** 下一位待上場的選手，給 Host 畫面預告用。 */
export function nextAthlete(state: RoomState): AthleteEntry | undefined {
  return state.queue.find((entry) => entry.status === 'waiting')
}

export function storageKey(roomCode: string): string {
  return `${STORAGE_PREFIX}${roomCode}`
}

export function channelName(roomCode: string): string {
  return `${CHANNEL_PREFIX}${roomCode}`
}

/**
 * 裁判送分用的識別碼。
 *
 * 綁定 slot 與「這一輪」，所以同一位裁判狂按送出、網路重送、或按了重新整理後再送，
 * 產生的都是同一個 id，reducer 只會收下第一筆。
 * 前綴 `slot:` 是為了讓 RETURN_SCORE 能精準清掉該裁判的紀錄。
 */
export function submissionIdFor(judgeSlot: string, roundKey: string): string {
  return `${judgeSlot}:${roundKey}`
}

/** 這一輪的識別：換選手或重新評分後會變，重新開放送分。 */
export function roundKey(state: RoomState): string {
  return `${state.currentAthleteId ?? state.athleteName}#${state.lastSequence === 0 ? 0 : countRounds(state)}`
}

function countRounds(state: RoomState): number {
  return state.auditLog.filter((entry) => entry.type === 'ATHLETE_STARTED').length
}

export function makeEvent(state: RoomState, actor: RoomActor, event: RoomEventInput): RoomEvent {
  return {
    ...event,
    roomCode: state.roomCode,
    eventId: `${state.roomCode}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sequence: state.lastSequence + 1,
    at: Date.now(),
    actor,
  }
}
