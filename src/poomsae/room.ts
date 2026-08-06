import { RULE_PROFILES, WT_RECOGNIZED_2024_06_14 } from '../rules/profiles'
import type { JudgeScoreInput, PerformanceScoreResult } from './scoring'
import { computePerformanceScore } from './scoring'

export type RoomStatus = 'SETUP' | 'WAITING_FOR_SUBMISSIONS' | 'SCORES_LOCKED' | 'PUBLISHED'

export interface RoomState {
  roomCode: string
  profileId: string
  judgeCount: 3 | 5
  athleteName: string
  teamName: string
  poomsaeName: string
  procedureDeductions: number
  status: RoomStatus
  judgeScores: Record<string, JudgeScoreInput>
  auditLog: string[]
  appliedEventIds: string[]
  lastSequence: number
}

export type RoomEvent =
  | { type: 'UPDATE_SETTINGS'; eventId: string; sequence: number; patch: Partial<Omit<RoomState, 'judgeScores' | 'auditLog' | 'appliedEventIds' | 'lastSequence'>> }
  | { type: 'START_SCORING'; eventId: string; sequence: number }
  | { type: 'SUBMIT_SCORE'; eventId: string; sequence: number; score: JudgeScoreInput }
  | { type: 'RETURN_SCORE'; eventId: string; sequence: number; judgeSlot: string }
  | { type: 'LOCK_SCORES'; eventId: string; sequence: number }
  | { type: 'PUBLISH_SCORES'; eventId: string; sequence: number }
  | { type: 'RESET'; eventId: string; sequence: number }

export type RoomEventInput = RoomEvent extends infer Event
  ? Event extends unknown
    ? Omit<Event, 'eventId' | 'sequence'>
    : never
  : never

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const STORAGE_PREFIX = 'teampro-poomsae:'
const CHANNEL_PREFIX = 'teampro-poomsae-channel:'

export function generateRoomCode(): string {
  const bytes = new Uint8Array(6)
  globalThis.crypto?.getRandomValues(bytes)
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('')
}

export function judgeSlots(count: 3 | 5): string[] {
  return Array.from({ length: count }, (_, index) => `J${index + 1}`)
}

export function createRoom(roomCode = generateRoomCode()): RoomState {
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
    auditLog: [],
    appliedEventIds: [],
    lastSequence: 0,
  }
}

export function reduceRoom(state: RoomState, event: RoomEvent): RoomState {
  if (state.appliedEventIds.includes(event.eventId)) return state
  if (event.sequence <= state.lastSequence) return state
  const base = {
    ...state,
    appliedEventIds: [...state.appliedEventIds, event.eventId].slice(-100),
    lastSequence: event.sequence,
  }
  switch (event.type) {
    case 'UPDATE_SETTINGS':
      return { ...base, ...event.patch }
    case 'START_SCORING':
      return { ...base, status: 'WAITING_FOR_SUBMISSIONS' }
    case 'SUBMIT_SCORE':
      if (state.status !== 'WAITING_FOR_SUBMISSIONS') return base
      if (state.judgeScores[event.score.judgeSlot] !== undefined) return base
      return { ...base, judgeScores: { ...state.judgeScores, [event.score.judgeSlot]: event.score } }
    case 'RETURN_SCORE': {
      const { [event.judgeSlot]: _removed, ...remaining } = state.judgeScores
      return {
        ...base,
        status: 'WAITING_FOR_SUBMISSIONS',
        judgeScores: remaining,
        auditLog: [...state.auditLog, `${new Date().toISOString()} RETURN ${event.judgeSlot}`],
      }
    }
    case 'LOCK_SCORES':
      if (Object.keys(state.judgeScores).length < state.judgeCount) return base
      return { ...base, status: 'SCORES_LOCKED' }
    case 'PUBLISH_SCORES':
      if (state.status !== 'SCORES_LOCKED') return base
      return { ...base, status: 'PUBLISHED' }
    case 'RESET':
      return { ...createRoom(state.roomCode), profileId: state.profileId, judgeCount: state.judgeCount }
  }
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

export function storageKey(roomCode: string): string {
  return `${STORAGE_PREFIX}${roomCode}`
}

export function channelName(roomCode: string): string {
  return `${CHANNEL_PREFIX}${roomCode}`
}

export function makeEvent(state: RoomState, event: RoomEventInput): RoomEvent {
  return {
    ...event,
    eventId: `${state.roomCode}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sequence: state.lastSequence + 1,
  } as RoomEvent
}
