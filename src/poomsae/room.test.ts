import { describe, expect, it } from 'vitest'
import type { JudgeScoreInput } from './scoring'
import { createRoom, reduceRoom, scoreRoom } from './room'

const presentation = {
  speed_power: 200,
  rhythm_tempo: 200,
  energy_expression: 200,
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
    expect(scoreRoom(room).total).toBe(1000)
  })

  it('ignores duplicate and delayed events', () => {
    let room = createRoom('ABC234')
    room = reduceRoom(room, { type: 'START_SCORING', eventId: 'start', sequence: 1 })
    room = reduceRoom(room, { type: 'SUBMIT_SCORE', eventId: 'j1', sequence: 2, score: score('J1') })
    room = reduceRoom(room, { type: 'SUBMIT_SCORE', eventId: 'j1', sequence: 2, score: score('J1', 0, 1) })
    room = reduceRoom(room, {
      type: 'UPDATE_SETTINGS',
      eventId: 'late',
      sequence: 1,
      patch: { athleteName: '過期事件' },
    })

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

  /*
   * 回歸測試：RESET 曾經用 createRoom() 重建整個 state，
   * 導致 lastSequence 歸零、appliedEventIds 清空，
   * 上一位選手的延遲事件會被當成新事件套用到下一位身上。
   */
  it('keeps dedupe state across RESET so stale events cannot leak to the next athlete', () => {
    let room = createRoom('ABC234')
    room = reduceRoom(room, { type: 'START_SCORING', eventId: 'start', sequence: 1 })
    room = reduceRoom(room, { type: 'SUBMIT_SCORE', eventId: 'j1', sequence: 2, score: score('J1') })
    room = reduceRoom(room, { type: 'RESET', eventId: 'reset', sequence: 3 })

    expect(room.lastSequence).toBe(3)
    expect(room.judgeScores).toEqual({})

    // 上一位選手那筆 SUBMIT_SCORE 因網路延遲重新抵達
    room = reduceRoom(room, { type: 'SUBMIT_SCORE', eventId: 'j1', sequence: 2, score: score('J1', 5) })

    expect(room.judgeScores.J1).toBeUndefined()
  })

  it('keeps competition settings when moving to the next athlete', () => {
    let room = createRoom('ABC234')
    room = reduceRoom(room, {
      type: 'UPDATE_SETTINGS',
      eventId: 'settings',
      sequence: 1,
      patch: { judgeCount: 5, teamName: '育林國中', poomsaeName: '高麗', athleteName: '王小明' },
    })
    room = reduceRoom(room, { type: 'START_SCORING', eventId: 'start', sequence: 2 })
    room = reduceRoom(room, { type: 'SUBMIT_SCORE', eventId: 'j1', sequence: 3, score: score('J1') })
    room = reduceRoom(room, { type: 'RESET', eventId: 'reset', sequence: 4 })

    expect(room.judgeCount).toBe(5)
    expect(room.teamName).toBe('育林國中')
    expect(room.poomsaeName).toBe('高麗')
    // 選手姓名保留給 Host 決定何時換人，不再被重設成預設值
    expect(room.athleteName).toBe('王小明')
    expect(room.judgeScores).toEqual({})
    expect(room.procedureDeductions).toEqual([])
  })

  it('refuses to lock before every judge has submitted', () => {
    let room = createRoom('ABC234')
    room = reduceRoom(room, { type: 'START_SCORING', eventId: 'start', sequence: 1 })
    room = reduceRoom(room, { type: 'SUBMIT_SCORE', eventId: 'j1', sequence: 2, score: score('J1') })
    room = reduceRoom(room, { type: 'LOCK_SCORES', eventId: 'lock', sequence: 3 })

    expect(room.status).toBe('WAITING_FOR_SUBMISSIONS')
  })

  it('refuses to publish before scores are locked', () => {
    let room = createRoom('ABC234')
    room = reduceRoom(room, { type: 'START_SCORING', eventId: 'start', sequence: 1 })
    room = reduceRoom(room, { type: 'PUBLISH_SCORES', eventId: 'publish', sequence: 2 })

    expect(room.status).toBe('WAITING_FOR_SUBMISSIONS')
  })
})
