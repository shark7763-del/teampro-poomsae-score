export type PoomsaeRole = 'DISPLAY' | 'CONTROL' | 'JUDGE' | 'TRAINING'

export type PoomsaeWorkflowState =
  | { status: 'SETUP' }
  | { status: 'WAITING_FOR_JUDGES'; connectedJudges: number; requiredJudges: number }
  | { status: 'READY'; performanceId: string }
  | { status: 'ACCURACY_SCORING'; performanceId: string }
  | { status: 'PRESENTATION_SCORING'; performanceId: string }
  | { status: 'WAITING_FOR_SUBMISSIONS'; performanceId: string; submittedJudges: string[] }
  | { status: 'SCORES_LOCKED'; performanceId: string }
  | { status: 'READY_TO_PUBLISH'; performanceId: string }
  | { status: 'PUBLISHED'; performanceId: string }
  | { status: 'COMPLETED' }

export type PoomsaeWorkflowEvent =
  | { type: 'CREATE_ROOM'; requiredJudges: number }
  | { type: 'JUDGE_CONNECTED'; connectedJudges: number }
  | { type: 'START_PERFORMANCE'; performanceId: string }
  | { type: 'START_ACCURACY' }
  | { type: 'START_PRESENTATION' }
  | { type: 'SUBMIT_SCORE'; judgeSlot: string }
  | { type: 'LOCK_SCORES' }
  | { type: 'READY_TO_PUBLISH' }
  | { type: 'PUBLISH' }
  | { type: 'COMPLETE' }

export function reducePoomsaeWorkflow(
  state: PoomsaeWorkflowState,
  event: PoomsaeWorkflowEvent,
): PoomsaeWorkflowState {
  switch (state.status) {
    case 'SETUP':
      if (event.type === 'CREATE_ROOM') {
        return {
          status: 'WAITING_FOR_JUDGES',
          connectedJudges: 0,
          requiredJudges: event.requiredJudges,
        }
      }
      return state
    case 'WAITING_FOR_JUDGES':
      if (event.type === 'JUDGE_CONNECTED') {
        if (event.connectedJudges >= state.requiredJudges)
          return { status: 'READY', performanceId: '' }
        return { ...state, connectedJudges: event.connectedJudges }
      }
      if (event.type === 'START_PERFORMANCE')
        return { status: 'READY', performanceId: event.performanceId }
      return state
    case 'READY':
      if (event.type === 'START_PERFORMANCE')
        return { status: 'READY', performanceId: event.performanceId }
      if (event.type === 'START_ACCURACY')
        return { status: 'ACCURACY_SCORING', performanceId: state.performanceId }
      return state
    case 'ACCURACY_SCORING':
      if (event.type === 'START_PRESENTATION') {
        return { status: 'PRESENTATION_SCORING', performanceId: state.performanceId }
      }
      return state
    case 'PRESENTATION_SCORING':
      if (event.type === 'SUBMIT_SCORE') {
        return {
          status: 'WAITING_FOR_SUBMISSIONS',
          performanceId: state.performanceId,
          submittedJudges: [event.judgeSlot],
        }
      }
      return state
    case 'WAITING_FOR_SUBMISSIONS':
      if (event.type === 'SUBMIT_SCORE') {
        return {
          ...state,
          submittedJudges: Array.from(new Set([...state.submittedJudges, event.judgeSlot])),
        }
      }
      if (event.type === 'LOCK_SCORES')
        return { status: 'SCORES_LOCKED', performanceId: state.performanceId }
      return state
    case 'SCORES_LOCKED':
      if (event.type === 'READY_TO_PUBLISH') {
        return { status: 'READY_TO_PUBLISH', performanceId: state.performanceId }
      }
      return state
    case 'READY_TO_PUBLISH':
      if (event.type === 'PUBLISH')
        return { status: 'PUBLISHED', performanceId: state.performanceId }
      return state
    case 'PUBLISHED':
      if (event.type === 'COMPLETE') return { status: 'COMPLETED' }
      return state
    case 'COMPLETED':
      return state
  }
}
