import { describe, expect, it } from 'vitest'
import { applyTrainingDisplayEvent, buildResult, createTrainingDisplayState, elapsedSeconds, sanitizeTrainingDisplayState, updateOptionsForMode } from './state'
import type { PrivateTrainingSession, TrainingDisplayEvent, TrainingDisplayState } from './types'

function event(
  state: TrainingDisplayState,
  sequence: number,
  type: TrainingDisplayEvent['type'],
  payload: TrainingDisplayEvent['payload'],
  sessionId = state.sessionId,
): TrainingDisplayEvent {
  return {
    schemaVersion: 1,
    eventId: `evt-${sequence}-${type}`,
    sessionId,
    displayId: state.displayId,
    senderId: 'coach-1',
    senderRole: 'controller',
    sequence,
    sentAt: 1000 + sequence,
    type,
    payload,
  } as TrainingDisplayEvent
}

describe('training display state protocol', () => {
  it('deduplicates eventId', () => {
    const state = createTrainingDisplayState()
    const first = event(state, 1, 'ACCURACY_UPDATED', {
      minorMistakes: 1,
      majorMistakes: 0,
      latestPublicHint: '公開提示',
    })
    const afterFirst = applyTrainingDisplayEvent(state, first)
    const duplicate = applyTrainingDisplayEvent(afterFirst, first)

    expect(duplicate.minorMistakes).toBe(1)
    expect(duplicate.appliedEventIds).toHaveLength(1)
  })

  it('rejects stale sequence and other sessions', () => {
    const base = createTrainingDisplayState()
    const state = applyTrainingDisplayEvent(base, event(base, 5, 'GOALS_UPDATED', { publicGoal: '節奏', phase: '演練中' }))
    const stale = applyTrainingDisplayEvent(state, event(state, 4, 'GOALS_UPDATED', { publicGoal: '過期', phase: '錯誤' }))
    const otherSession = applyTrainingDisplayEvent(
      state,
      event(state, 6, 'GOALS_UPDATED', { publicGoal: '其他 session', phase: '錯誤' }, 'other-session'),
    )

    expect(stale.publicGoal).toBe(state.publicGoal)
    expect(otherSession.publicGoal).toBe(state.publicGoal)
  })

  it('recovers from a newer snapshot', () => {
    const state = createTrainingDisplayState()
    const snapshot = { ...state, sequence: 10, athleteName: '王小明' }
    const recovered = applyTrainingDisplayEvent(state, event(state, 11, 'STATE_SNAPSHOT', { snapshot }))

    expect(recovered.athleteName).toBe('王小明')
    expect(recovered.sequence).toBe(11)
  })

  it('sanitizes private coach notes and hidden issue details', () => {
    const privateSession: PrivateTrainingSession = {
      coachPrivateNotes: '私人筆記不可送出',
      state: {
        ...createTrainingDisplayState(),
        latestPublicHint: '膝蓋角度',
        issueTags: ['重心', '節奏', '手刀', '私人'],
        options: { ...createTrainingDisplayState().options, showIssueTags: false },
      },
    }
    const sanitized = sanitizeTrainingDisplayState(privateSession)

    expect(JSON.stringify(sanitized)).not.toContain('私人筆記')
    expect(sanitized.latestPublicHint).toBe('')
    expect(sanitized.issueTags).toEqual([])
  })

  it('switches display mode options predictably', () => {
    const base = createTrainingDisplayState().options
    expect(updateOptionsForMode('athlete', { ...base, showAccuracy: true }).showAccuracy).toBe(false)
    expect(updateOptionsForMode('live-score', base).showMistakeCounts).toBe(true)
    expect(updateOptionsForMode('result', base).showIssueTags).toBe(true)
  })

  it('computes timer from start timestamp without per-second network events', () => {
    const state = {
      ...createTrainingDisplayState(),
      timerStatus: 'running' as const,
      timerStartedAt: 10_000,
      accumulatedSeconds: 12,
    }

    expect(elapsedSeconds(state, 25_900)).toBe(27)
  })

  it('builds result from public scoring state', () => {
    const state = {
      ...createTrainingDisplayState(),
      minorMistakes: 2,
      majorMistakes: 1,
      presentation: { speedPower: 19, rhythmTempo: 18, energyExpression: 20 },
      issueTags: ['重心', '節奏', '視線', '多餘'],
    }

    expect(buildResult(state).total).toBe(92)
    expect(buildResult(state).topIssues).toEqual(['重心', '節奏', '視線'])
  })

  it('applies latest penalty signal to public accuracy updates', () => {
    const state = createTrainingDisplayState()
    const next = applyTrainingDisplayEvent(
      state,
      event(state, 1, 'ACCURACY_UPDATED', {
        minorMistakes: 1,
        majorMistakes: 0,
        latestPublicHint: '小失誤',
        lastPenalty: { kind: 'minor', value: 1, label: '-0.1', at: 2000 },
      }),
    )

    expect(next.lastPenalty?.label).toBe('-0.1')
    expect(next.minorMistakes).toBe(1)
  })
})
