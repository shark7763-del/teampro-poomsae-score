import type { TrainingDisplayEvent, TrainingDisplayState } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function parseTrainingDisplayEvent(value: unknown): TrainingDisplayEvent | null {
  if (!isRecord(value)) return null
  if (value.schemaVersion !== 1) return null
  if (!isString(value.eventId) || !isString(value.sessionId) || !isString(value.displayId)) return null
  if (!isString(value.senderId) || !isString(value.senderRole) || !isString(value.type)) return null
  if (!isNumber(value.sequence) || !isNumber(value.sentAt) || !isRecord(value.payload)) return null
  return value as unknown as TrainingDisplayEvent
}

export function parseTrainingDisplayState(value: unknown): TrainingDisplayState | null {
  if (!isRecord(value)) return null
  if (value.schemaVersion !== 1) return null
  if (!isString(value.sessionId) || !isString(value.displayId) || !isString(value.displayCode)) return null
  if (!isNumber(value.sequence) || !isNumber(value.updatedAt)) return null
  return value as unknown as TrainingDisplayState
}
