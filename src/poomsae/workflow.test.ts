import { describe, expect, it } from 'vitest'
import { reducePoomsaeWorkflow, type PoomsaeWorkflowState } from './workflow'

describe('poomsae workflow finite state model', () => {
  it('moves through the required explicit states', () => {
    let state: PoomsaeWorkflowState = { status: 'SETUP' }
    state = reducePoomsaeWorkflow(state, { type: 'CREATE_ROOM', requiredJudges: 3 })
    expect(state.status).toBe('WAITING_FOR_JUDGES')
    state = reducePoomsaeWorkflow(state, { type: 'START_PERFORMANCE', performanceId: 'p1' })
    state = reducePoomsaeWorkflow(state, { type: 'START_ACCURACY' })
    expect(state.status).toBe('ACCURACY_SCORING')
    state = reducePoomsaeWorkflow(state, { type: 'START_PRESENTATION' })
    state = reducePoomsaeWorkflow(state, { type: 'SUBMIT_SCORE', judgeSlot: 'J1' })
    expect(state.status).toBe('WAITING_FOR_SUBMISSIONS')
    state = reducePoomsaeWorkflow(state, { type: 'LOCK_SCORES' })
    state = reducePoomsaeWorkflow(state, { type: 'READY_TO_PUBLISH' })
    state = reducePoomsaeWorkflow(state, { type: 'PUBLISH' })
    state = reducePoomsaeWorkflow(state, { type: 'COMPLETE' })
    expect(state.status).toBe('COMPLETED')
  })
})
