import { describe, expect, it } from 'vitest'
import type { JudgeScoreInput } from './scoring'
import type { AthleteEntry, RoomEvent, RoomEventBody, RoomState } from './room'
import { createRoom, reduceRoom, scoreRoom, submissionIdFor } from './room'

const presentation = {
  speed_power: 200,
  rhythm_tempo: 200,
  energy_expression: 200,
}

function score(judgeSlot: string, minorMistakes = 0, majorMistakes = 0): JudgeScoreInput {
  return { judgeSlot, minorMistakes, majorMistakes, presentation, submittedAt: 0 }
}

function hostEvent(room: RoomState, sequence: number, body: RoomEventBody, eventId?: string): RoomEvent {
  return {
    ...body,
    roomCode: room.roomCode,
    eventId: eventId ?? `${body.type}-${sequence}`,
    sequence,
    at: sequence * 1000,
    actor: { role: 'HOST', token: room.tokens?.hostToken ?? '' },
  }
}

function judgeEvent(
  room: RoomState,
  slot: string,
  sequence: number,
  body: RoomEventBody,
  eventId?: string,
  token?: string,
): RoomEvent {
  return {
    ...body,
    roomCode: room.roomCode,
    eventId: eventId ?? `${body.type}-${slot}-${sequence}`,
    sequence,
    at: sequence * 1000,
    actor: { role: 'JUDGE', slot, token: token ?? room.tokens?.judgeTokens[slot] ?? '' },
  }
}

function submit(room: RoomState, slot: string, sequence: number, minor = 0, eventId?: string): RoomEvent {
  return judgeEvent(
    room,
    slot,
    sequence,
    {
      type: 'SUBMIT_SCORE',
      submissionId: submissionIdFor(slot, 'round-1'),
      score: score(slot, minor),
    },
    eventId,
  )
}

function athlete(id: string, name: string): AthleteEntry {
  return { id, name, teamName: '育林國中', poomsaeName: '高麗', status: 'waiting' }
}

describe('poomsae room reducer', () => {
  it('runs setup, scoring, lock, and publish workflow', () => {
    let room = createRoom('ABC234')
    room = reduceRoom(room, hostEvent(room, 1, { type: 'START_SCORING' }))
    room = reduceRoom(room, submit(room, 'J1', 2))
    room = reduceRoom(room, submit(room, 'J2', 3))
    room = reduceRoom(room, submit(room, 'J3', 4))
    room = reduceRoom(room, hostEvent(room, 5, { type: 'LOCK_SCORES' }))
    room = reduceRoom(room, hostEvent(room, 6, { type: 'PUBLISH_SCORES' }))

    expect(room.status).toBe('PUBLISHED')
    expect(scoreRoom(room).total).toBe(1000)
  })

  it('ignores duplicate and delayed events', () => {
    let room = createRoom('ABC234')
    room = reduceRoom(room, hostEvent(room, 1, { type: 'START_SCORING' }))
    room = reduceRoom(room, submit(room, 'J1', 2, 0, 'dup'))
    room = reduceRoom(room, submit(room, 'J1', 2, 5, 'dup'))
    room = reduceRoom(room, hostEvent(room, 1, { type: 'UPDATE_SETTINGS', patch: { athleteName: '過期事件' } }))

    expect(room.judgeScores.J1?.minorMistakes).toBe(0)
    expect(room.athleteName).toBe('')
  })

  it('reopens one judge and lets that judge submit again', () => {
    let room = createRoom('ABC234')
    room = reduceRoom(room, hostEvent(room, 1, { type: 'START_SCORING' }))
    room = reduceRoom(room, submit(room, 'J1', 2))
    room = reduceRoom(room, hostEvent(room, 3, { type: 'RETURN_SCORE', judgeSlot: 'J1' }))

    expect(room.judgeScores.J1).toBeUndefined()
    expect(room.auditLog.some((entry) => entry.type === 'JUDGE_REOPENED')).toBe(true)

    // 退回後同一個 submissionId 必須能重新送出，否則裁判永遠補不了分
    room = reduceRoom(room, submit(room, 'J1', 4, 3, 'resend'))
    expect(room.judgeScores.J1?.minorMistakes).toBe(3)
  })

  /*
   * 回歸測試：RESET 曾經用 createRoom() 重建整個 state，
   * 導致 lastSequence 歸零、appliedEventIds 清空，
   * 上一位選手的延遲事件會被當成新事件套用到下一位身上。
   */
  it('keeps dedupe state across RESET so stale events cannot leak to the next athlete', () => {
    let room = createRoom('ABC234')
    room = reduceRoom(room, hostEvent(room, 1, { type: 'START_SCORING' }))
    room = reduceRoom(room, submit(room, 'J1', 2, 0, 'stale'))
    room = reduceRoom(room, hostEvent(room, 3, { type: 'RESET' }))

    expect(room.lastSequence).toBe(3)
    expect(room.judgeScores).toEqual({})

    room = reduceRoom(room, submit(room, 'J1', 2, 5, 'stale'))
    expect(room.judgeScores.J1).toBeUndefined()
  })

  it('keeps competition settings when moving to the next athlete', () => {
    let room = createRoom('ABC234')
    room = reduceRoom(
      room,
      hostEvent(room, 1, {
        type: 'UPDATE_SETTINGS',
        patch: { judgeCount: 5, teamName: '育林國中', poomsaeName: '高麗', athleteName: '王小明' },
      }),
    )
    room = reduceRoom(room, hostEvent(room, 2, { type: 'START_SCORING' }))
    room = reduceRoom(room, submit(room, 'J1', 3))
    room = reduceRoom(room, hostEvent(room, 4, { type: 'NEXT_ATHLETE' }))

    expect(room.judgeCount).toBe(5)
    expect(room.teamName).toBe('育林國中')
    expect(room.judgeScores).toEqual({})
    expect(room.procedureDeductions).toEqual([])
    // token 保留 → 裁判手機不必重新掃 QR Code
    expect(room.tokens).not.toBeNull()
  })

  it('refuses to lock before every judge has submitted', () => {
    let room = createRoom('ABC234')
    room = reduceRoom(room, hostEvent(room, 1, { type: 'START_SCORING' }))
    room = reduceRoom(room, submit(room, 'J1', 2))
    room = reduceRoom(room, hostEvent(room, 3, { type: 'LOCK_SCORES' }))

    expect(room.status).toBe('WAITING_FOR_SUBMISSIONS')
  })

  it('refuses to publish before scores are locked', () => {
    let room = createRoom('ABC234')
    room = reduceRoom(room, hostEvent(room, 1, { type: 'START_SCORING' }))
    room = reduceRoom(room, hostEvent(room, 2, { type: 'PUBLISH_SCORES' }))

    expect(room.status).toBe('WAITING_FOR_SUBMISSIONS')
  })
})

describe('idempotent submissions', () => {
  it('counts one score no matter how many times the judge presses submit', () => {
    let room = createRoom('ABC234')
    room = reduceRoom(room, hostEvent(room, 1, { type: 'START_SCORING' }))

    // 三個不同的 eventId，但同一個 submissionId：狂按送出 / 網路重送 / refresh 後再送
    room = reduceRoom(room, submit(room, 'J1', 2, 1, 'press-1'))
    room = reduceRoom(room, submit(room, 'J1', 3, 9, 'press-2'))
    room = reduceRoom(room, submit(room, 'J1', 4, 9, 'press-3'))

    expect(room.judgeScores.J1?.minorMistakes).toBe(1)
    expect(room.auditLog.filter((entry) => entry.type === 'JUDGE_SUBMITTED')).toHaveLength(1)
  })
})

describe('role authorization', () => {
  it('rejects a judge submitting for another slot', () => {
    let room = createRoom('ABC234')
    room = reduceRoom(room, hostEvent(room, 1, { type: 'START_SCORING' }))
    const forged: RoomEvent = {
      type: 'SUBMIT_SCORE',
      submissionId: submissionIdFor('J2', 'round-1'),
      score: score('J2'),
      roomCode: room.roomCode,
      eventId: 'forged',
      sequence: 2,
      at: 2000,
      // 拿 J1 的 token 想送 J2 的分數
      actor: { role: 'JUDGE', slot: 'J1', token: room.tokens?.judgeTokens.J1 ?? '' },
    }
    room = reduceRoom(room, forged)

    expect(room.judgeScores.J2).toBeUndefined()
    expect(room.auditLog.some((entry) => entry.type === 'DENIED')).toBe(true)
  })

  it('rejects a guessed judge token', () => {
    let room = createRoom('ABC234')
    room = reduceRoom(room, hostEvent(room, 1, { type: 'START_SCORING' }))
    room = reduceRoom(room, judgeEvent(room, 'J1', 2, {
      type: 'SUBMIT_SCORE',
      submissionId: submissionIdFor('J1', 'round-1'),
      score: score('J1'),
    }, 'guess', 'J1'))

    expect(room.judgeScores.J1).toBeUndefined()
  })

  it('does not let the host submit judge scores', () => {
    let room = createRoom('ABC234')
    room = reduceRoom(room, hostEvent(room, 1, { type: 'START_SCORING' }))
    room = reduceRoom(
      room,
      hostEvent(room, 2, {
        type: 'SUBMIT_SCORE',
        submissionId: submissionIdFor('J1', 'round-1'),
        score: score('J1'),
      }),
    )

    expect(room.judgeScores.J1).toBeUndefined()
  })

  it('does not let a judge drive the competition flow', () => {
    let room = createRoom('ABC234')
    room = reduceRoom(room, judgeEvent(room, 'J1', 1, { type: 'PUBLISH_SCORES' }))

    expect(room.status).toBe('SETUP')
  })

  it('does not let the display write anything', () => {
    let room = createRoom('ABC234')
    const displayEvent: RoomEvent = {
      type: 'START_SCORING',
      roomCode: room.roomCode,
      eventId: 'display-try',
      sequence: 1,
      at: 1000,
      actor: { role: 'DISPLAY', token: room.tokens?.displayToken ?? '' },
    }
    room = reduceRoom(room, displayEvent)

    expect(room.status).toBe('SETUP')
  })

  it('does not let a denied event advance the sequence', () => {
    let room = createRoom('ABC234')
    const forged: RoomEvent = {
      type: 'START_SCORING',
      roomCode: room.roomCode,
      eventId: 'forged-huge-sequence',
      sequence: 999_999,
      at: 1000,
      actor: { role: 'HOST', token: 'not-the-real-token' },
    }
    room = reduceRoom(room, forged)

    expect(room.lastSequence).toBe(0)
    // 房間仍可正常運作，沒有被卡死
    room = reduceRoom(room, hostEvent(room, 1, { type: 'START_SCORING' }))
    expect(room.status).toBe('WAITING_FOR_SUBMISSIONS')
  })
})

describe('athlete queue', () => {
  it('advances to the next athlete and copies their details in', () => {
    let room = createRoom('ABC234')
    room = reduceRoom(
      room,
      hostEvent(room, 1, {
        type: 'QUEUE_REPLACED',
        entries: [athlete('a1', '王小明'), athlete('a2', '陳小華')],
      }),
    )
    room = reduceRoom(room, hostEvent(room, 2, { type: 'NEXT_ATHLETE' }))
    expect(room.athleteName).toBe('王小明')
    expect(room.currentAthleteId).toBe('a1')

    room = reduceRoom(room, hostEvent(room, 3, { type: 'NEXT_ATHLETE' }))
    expect(room.athleteName).toBe('陳小華')
    expect(room.queue.find((entry) => entry.id === 'a1')?.status).toBe('done')
  })

  it('marks a skipped athlete differently from a finished one', () => {
    let room = createRoom('ABC234')
    room = reduceRoom(
      room,
      hostEvent(room, 1, { type: 'QUEUE_REPLACED', entries: [athlete('a1', '王小明'), athlete('a2', '陳小華')] }),
    )
    room = reduceRoom(room, hostEvent(room, 2, { type: 'NEXT_ATHLETE' }))
    room = reduceRoom(room, hostEvent(room, 3, { type: 'SKIP_ATHLETE' }))

    expect(room.queue.find((entry) => entry.id === 'a1')?.status).toBe('skipped')
    expect(room.athleteName).toBe('陳小華')
  })

  it('keeps everyone in the queue when a reorder omits someone', () => {
    let room = createRoom('ABC234')
    room = reduceRoom(
      room,
      hostEvent(room, 1, {
        type: 'QUEUE_REPLACED',
        entries: [athlete('a1', '王小明'), athlete('a2', '陳小華'), athlete('a3', '李小美')],
      }),
    )
    room = reduceRoom(room, hostEvent(room, 2, { type: 'QUEUE_REORDERED', order: ['a3', 'a1'] }))

    expect(room.queue.map((entry) => entry.id)).toEqual(['a3', 'a1', 'a2'])
  })

  it('stops cleanly when the queue runs out', () => {
    let room = createRoom('ABC234')
    room = reduceRoom(room, hostEvent(room, 1, { type: 'QUEUE_REPLACED', entries: [athlete('a1', '王小明')] }))
    room = reduceRoom(room, hostEvent(room, 2, { type: 'NEXT_ATHLETE' }))
    room = reduceRoom(room, hostEvent(room, 3, { type: 'NEXT_ATHLETE' }))

    expect(room.currentAthleteId).toBeNull()
    expect(room.queue.every((entry) => entry.status === 'done')).toBe(true)
  })
})

describe('audit log', () => {
  it('records the whole competition flow', () => {
    let room = createRoom('ABC234')
    room = reduceRoom(room, hostEvent(room, 1, { type: 'START_SCORING' }))
    room = reduceRoom(room, submit(room, 'J1', 2))
    room = reduceRoom(room, submit(room, 'J2', 3))
    room = reduceRoom(room, submit(room, 'J3', 4))
    room = reduceRoom(room, hostEvent(room, 5, { type: 'LOCK_SCORES' }))
    room = reduceRoom(room, hostEvent(room, 6, { type: 'PUBLISH_SCORES' }))
    room = reduceRoom(room, hostEvent(room, 7, { type: 'NEXT_ATHLETE' }))

    const types = room.auditLog.map((entry) => entry.type)
    expect(types).toContain('ROOM_CREATED')
    expect(types).toContain('ATHLETE_STARTED')
    expect(types).toContain('JUDGE_SUBMITTED')
    expect(types).toContain('SCORE_LOCKED')
    expect(types).toContain('SCORE_REVEALED')
    expect(types).toContain('ATHLETE_CHANGED')
  })

  it('records who was denied so the floor can be debugged', () => {
    let room = createRoom('ABC234')
    room = reduceRoom(room, judgeEvent(room, 'J9', 1, { type: 'PUBLISH_SCORES' }, 'bad', 'wrong'))

    const denied = room.auditLog.find((entry) => entry.type === 'DENIED')
    expect(denied?.actorRole).toBe('JUDGE')
    expect(denied?.actorSlot).toBe('J9')
    expect(denied?.detail).toBe('PUBLISH_SCORES')
  })
})
