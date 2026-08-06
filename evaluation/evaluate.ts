export interface EvaluationScore {
  total: number
  ruleCorrectness: number
  workflowSuccess: number
  realtimeReliability: number
  resilience: number
  usability: number
  maintainability: number
}

export const MAX_EVALUATION_SCORE: EvaluationScore = {
  total: 100,
  ruleCorrectness: 40,
  workflowSuccess: 20,
  realtimeReliability: 15,
  resilience: 10,
  usability: 10,
  maintainability: 5,
}
