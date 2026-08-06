import { RECOGNIZED_RULE_PROFILES, WT_RECOGNIZED_2024_06_14 } from '../rules/profiles'
import type { JudgeScoreInput, PerformanceScoreResult } from './scoring'
import { computePerformanceScore } from './scoring'

export type PoomsaeRoomStatus = 'SETUP' | 'WAITING_FOR_SUBMISSIONS' | 'SCORES_LOCKED' | 'PUBLISHED'
export type PoomsaeRoomRole = 'CONTROL' | 'JUDGE' | 'DISPLAY'

export interface PoomsaeRoomState {
  roomCode: string
  profileId: string
  judgeCount: 3 | 5
  athleteName: string
  teamName: string
  poomsaeName: string
  procedureDeductions: number
  status: PoomsaeRoomStatus
  judgeScores: Record<string, JudgeScoreInput>
  returnedJudgeSlots: string[]
  auditLog: string[]
  appliedEventIds: string[]
  lastSequence: number
  updatedAt: number
}

export type PoomsaeRoomEvent =
  | {
      type: 'UPDATE_SETTINGS'
      eventId: string
      roomCode: string
      sequence: number
      patch: Partial<
        Pick<
          PoomsaeRoomState,
          'profileId' | 'judgeCount' | 'athleteName' | 'teamName' | 'poomsaeName' | 'procedureDeductions'
        >
      >
    }
  | { type: 'START_SCORING'; eventId: string; roomCode: string; sequence: number }
  | {
      type: 'SUBMIT_JUDGE_SCORE'
      eventId: string
      roomCode: string
      sequence: number
      score: JudgeScoreInput
    }
  | { type: 'RETURN_JUDGE_SCORE'; eventId: string; roomCode: string; sequence: number; judgeSlot: string }
  | { type: 'LOCK_SCORES'; eventId: string; roomCode: string; sequence: number }
  | { type: 'PUBLISH_SCORES'; eventId: string; roomCode: string; sequence: number }
  | { type: 'RESET_PERFORMANCE'; eventId: string; roomCode: string; sequence: number }

export type PoomsaeRoomEventInput = PoomsaeRoomEvent extends infer Event
  ? Event extends unknown
    ? Omit<Event, 'eventId' | 'sequence'>
    : never
  : never

const STORAGE_PREFIX = 'teampro-poomsae-room:'
const CHANNEL_PREFIX = 'teampro-poomsae-local:'
const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateRoomCode(): string {
  const cryptoApi = globalThis.crypto
  const bytes = new Uint8Array(6)
  cryptoApi?.getRandomValues(bytes)
  return Array.from(bytes, (byte) => ROOM_ALPHABET[byte % ROOM_ALPHABET.length]).join('')
}

export function createInitialRoomState(roomCode = generateRoomCode()): PoomsaeRoomState {
  return {
    roomCode,
    profileId: WT_RECOGNIZED_2024_06_14.id,
    judgeCount: 3,
    athleteName: '選手 A',
    teamName: 'TeamPro',
    poomsaeName: '太極八章',
    procedureDeductions: 0,
    status: 'SETUP',
    judgeScores: {},
    returnedJudgeSlots: [],
    auditLog: [],
    appliedEventIds: [],
    lastSequence: 0,
    updatedAt: Date.now(),
  }
}

export function roomStorageKey(roomCode: string): string {
  return `${STORAGE_PREFIX}${roomCode.toUpperCase()}`
}

export function roomChannelName(roomCode: string): string {
  return `${CHANNEL_PREFIX}${roomCode.toUpperCase()}`
}

export function loadPoomsaeRoom(roomCode: string): PoomsaeRoomState | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(roomStorageKey(roomCode))
  if (raw === null) return null
  try {
    return JSON.parse(raw) as PoomsaeRoomState
  } catch {
    return null
  }
}

export function savePoomsaeRoom(state: PoomsaeRoomState): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(roomStorageKey(state.roomCode), JSON.stringify(state))
}

export function makeRoomEvent(
  state: PoomsaeRoomState,
  event: PoomsaeRoomEventInput,
): PoomsaeRoomEvent {
  return {
    ...event,
    eventId: `${state.roomCode}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sequence: state.lastSequence + 1,
  } as PoomsaeRoomEvent
}

export function reducePoomsaeRoom(
  current: PoomsaeRoomState,
  event: PoomsaeRoomEvent,
): PoomsaeRoomState {
  if (event.roomCode !== current.roomCode) return current
  if (current.appliedEventIds.includes(event.eventId)) return current
  if (event.sequence <= current.lastSequence) return current

  const appliedEventIds = [...current.appliedEventIds, event.eventId].slice(-120)
  const base = {
    ...current,
    appliedEventIds,
    lastSequence: event.sequence,
    updatedAt: Date.now(),
  }

  switch (event.type) {
    case 'UPDATE_SETTINGS':
      if (current.status !== 'SETUP' && current.status !== 'WAITING_FOR_SUBMISSIONS') return base
      return {
        ...base,
        ...event.patch,
        judgeScores:
          event.patch.judgeCount !== undefined && event.patch.judgeCount !== current.judgeCount
            ? {}
            : current.judgeScores,
        returnedJudgeSlots: [],
      }
    case 'START_SCORING':
      return { ...base, status: 'WAITING_FOR_SUBMISSIONS' }
    case 'SUBMIT_JUDGE_SCORE':
      if (current.status !== 'WAITING_FOR_SUBMISSIONS') return base
      if (current.judgeScores[event.score.judgeSlot] !== undefined) return base
      return {
        ...base,
        judgeScores: { ...current.judgeScores, [event.score.judgeSlot]: event.score },
        returnedJudgeSlots: current.returnedJudgeSlots.filter((slot) => slot !== event.score.judgeSlot),
      }
    case 'RETURN_JUDGE_SCORE': {
      const { [event.judgeSlot]: _removed, ...remainingScores } = current.judgeScores
      return {
        ...base,
        status: 'WAITING_FOR_SUBMISSIONS',
        judgeScores: remainingScores,
        returnedJudgeSlots: Array.from(new Set([...current.returnedJudgeSlots, event.judgeSlot])),
        auditLog: [
          ...current.auditLog,
          `${new Date(base.updatedAt).toISOString()} RETURN ${event.judgeSlot}`,
        ],
      }
    }
    case 'LOCK_SCORES':
      if (Object.keys(current.judgeScores).length < current.judgeCount) return base
      return { ...base, status: 'SCORES_LOCKED' }
    case 'PUBLISH_SCORES':
      if (current.status !== 'SCORES_LOCKED') return base
      return { ...base, status: 'PUBLISHED' }
    case 'RESET_PERFORMANCE':
      return {
        ...createInitialRoomState(current.roomCode),
        profileId: current.profileId,
        judgeCount: current.judgeCount,
        athleteName: current.athleteName,
        teamName: current.teamName,
        poomsaeName: current.poomsaeName,
        appliedEventIds,
        lastSequence: event.sequence,
        updatedAt: base.updatedAt,
      }
  }
}

export function computeRoomResult(state: PoomsaeRoomState): PerformanceScoreResult {
  const profile = RECOGNIZED_RULE_PROFILES[state.profileId] ?? WT_RECOGNIZED_2024_06_14
  return computePerformanceScore(profile, {
    performanceId: state.roomCode,
    judgeCount: state.judgeCount,
    judgeScores: Object.values(state.judgeScores),
    procedureDeductions: state.procedureDeductions,
  })
}

export function activeJudgeSlots(judgeCount: 3 | 5): string[] {
  return Array.from({ length: judgeCount }, (_, index) => `J${index + 1}`)
}
