import { describe, expect, it } from 'vitest'
import {
  createInitialRoomState,
  reducePoomsaeRoom,
  type PoomsaeRoomEvent,
} from './roomSession'

function submit(slot: string, sequence: number, eventId = `e-${sequence}`): PoomsaeRoomEvent {
  return {
    type: 'SUBMIT_JUDGE_SCORE',
    eventId,
    roomCode: 'ABC234',
    sequence,
    score: {
      judgeSlot: slot,
      minorMistakes: 0,
      majorMistakes: 0,
      presentation: { speed_power: 20, rhythm_tempo: 20, energy_expression: 20 },
      submittedAt: sequence,
    },
  }
}

describe('poomsae room session reducer', () => {
  it('deduplicates events by eventId', () => {
    let state = createInitialRoomState('ABC234')
    state = reducePoomsaeRoom(state, { type: 'START_SCORING', eventId: 'start', roomCode: 'ABC234', sequence: 1 })
    state = reducePoomsaeRoom(state, submit('J1', 2, 'same'))
    state = reducePoomsaeRoom(state, submit('J2', 3, 'same'))
    expect(Object.keys(state.judgeScores)).toEqual(['J1'])
  })

  it('rejects stale sequence events', () => {
    let state = createInitialRoomState('ABC234')
    state = reducePoomsaeRoom(state, { type: 'START_SCORING', eventId: 'start', roomCode: 'ABC234', sequence: 4 })
    state = reducePoomsaeRoom(state, submit('J1', 3))
    expect(state.judgeScores.J1).toBeUndefined()
  })

  it('locks only after all active judges submitted and then publishes', () => {
    let state = createInitialRoomState('ABC234')
    state = reducePoomsaeRoom(state, { type: 'START_SCORING', eventId: 'start', roomCode: 'ABC234', sequence: 1 })
    state = reducePoomsaeRoom(state, submit('J1', 2))
    state = reducePoomsaeRoom(state, { type: 'LOCK_SCORES', eventId: 'lock-a', roomCode: 'ABC234', sequence: 3 })
    expect(state.status).toBe('WAITING_FOR_SUBMISSIONS')
    state = reducePoomsaeRoom(state, submit('J2', 4))
    state = reducePoomsaeRoom(state, submit('J3', 5))
    state = reducePoomsaeRoom(state, { type: 'LOCK_SCORES', eventId: 'lock-b', roomCode: 'ABC234', sequence: 6 })
    expect(state.status).toBe('SCORES_LOCKED')
    state = reducePoomsaeRoom(state, { type: 'PUBLISH_SCORES', eventId: 'pub', roomCode: 'ABC234', sequence: 7 })
    expect(state.status).toBe('PUBLISHED')
  })

  it('returns a judge score with audit log and reopens submissions', () => {
    let state = createInitialRoomState('ABC234')
    state = reducePoomsaeRoom(state, { type: 'START_SCORING', eventId: 'start', roomCode: 'ABC234', sequence: 1 })
    state = reducePoomsaeRoom(state, submit('J1', 2))
    state = reducePoomsaeRoom(state, {
      type: 'RETURN_JUDGE_SCORE',
      eventId: 'return',
      roomCode: 'ABC234',
      sequence: 3,
      judgeSlot: 'J1',
    })
    expect(state.status).toBe('WAITING_FOR_SUBMISSIONS')
    expect(state.judgeScores.J1).toBeUndefined()
    expect(state.auditLog.at(-1)).toContain('RETURN J1')
  })
})
