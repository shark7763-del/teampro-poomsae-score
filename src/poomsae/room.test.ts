import { describe, expect, it } from 'vitest'
import type { JudgeScoreInput } from './scoring'
import { createRoom, reduceRoom, scoreRoom } from './room'

const presentation = {
  speed_power: 20,
  rhythm_tempo: 20,
  energy_expression: 20,
}

function score(judgeSlot: string, minorMistakes = 0, majorMistakes = 0): JudgeScoreInput {
  return { judgeSlot, minorMistakes, majorMistakes, presentation, submittedAt: 0 }
}

describe('poomsae room reducer', () => {
  it('runs setup, scoring, lock, and publish workflow', () => {
    let room = createRoom('ABC234')
    room = reduceRoom(room, { type: 'START_SCORING', eventId: 'start', sequence: 1 })
    room = reduceRoom(room, { type: 'SUBMIT_SCORE', eventId: 'j1', sequence: 2, score: score('J1') })
    room = reduceRoom(room, { type: 'SUBMIT_SCORE', eventId: 'j2', sequence: 3, score: score('J2') })
    room = reduceRoom(room, { type: 'SUBMIT_SCORE', eventId: 'j3', sequence: 4, score: score('J3') })
    room = reduceRoom(room, { type: 'LOCK_SCORES', eventId: 'lock', sequence: 5 })
    room = reduceRoom(room, { type: 'PUBLISH_SCORES', eventId: 'publish', sequence: 6 })

    expect(room.status).toBe('PUBLISHED')
    expect(scoreRoom(room).total).toBe(100)
  })

  it('ignores duplicate and delayed events', () => {
    let room = createRoom('ABC234')
    room = reduceRoom(room, { type: 'START_SCORING', eventId: 'start', sequence: 1 })
    room = reduceRoom(room, { type: 'SUBMIT_SCORE', eventId: 'j1', sequence: 2, score: score('J1') })
    room = reduceRoom(room, { type: 'SUBMIT_SCORE', eventId: 'j1', sequence: 2, score: score('J1', 0, 1) })
    room = reduceRoom(room, { type: 'UPDATE_SETTINGS', eventId: 'late', sequence: 1, patch: { athleteName: '過期事件' } })

    expect(room.judgeScores.J1?.majorMistakes).toBe(0)
    expect(room.athleteName).toBe('選手 A')
  })

  it('returns one judge score with an audit record', () => {
    let room = createRoom('ABC234')
    room = reduceRoom(room, { type: 'START_SCORING', eventId: 'start', sequence: 1 })
    room = reduceRoom(room, { type: 'SUBMIT_SCORE', eventId: 'j1', sequence: 2, score: score('J1') })
    room = reduceRoom(room, { type: 'RETURN_SCORE', eventId: 'return-j1', sequence: 3, judgeSlot: 'J1' })

    expect(room.judgeScores.J1).toBeUndefined()
    expect(room.auditLog[0]).toContain('RETURN J1')
  })
})
