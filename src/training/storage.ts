import { parseTrainingDisplayState } from './validation'
import type { TrainingDisplayState } from './types'

const DB_NAME = 'teampro-poomsae-coach'
const DB_VERSION = 1
const STORE = 'training-snapshots'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'sessionId' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveTrainingSnapshot(state: TrainingDisplayState): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(state)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function loadTrainingSnapshot(sessionId: string): Promise<TrainingDisplayState | null> {
  const db = await openDb()
  const value = await new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).get(sessionId)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return parseTrainingDisplayState(value)
}

export function saveRecentDisplay(displayCode: string, displayName: string, sessionId: string): void {
  localStorage.setItem(
    'teampro-poomsae:recent-training-display',
    JSON.stringify({ displayCode, displayName, sessionId, savedAt: Date.now() }),
  )
}

export function loadRecentDisplay(): { displayCode: string; displayName: string; sessionId: string } | null {
  const raw = localStorage.getItem('teampro-poomsae:recent-training-display')
  if (raw === null) return null
  try {
    const parsed = JSON.parse(raw) as { displayCode?: unknown; displayName?: unknown; sessionId?: unknown }
    if (typeof parsed.displayCode === 'string' && typeof parsed.displayName === 'string' && typeof parsed.sessionId === 'string') {
      return { displayCode: parsed.displayCode, displayName: parsed.displayName, sessionId: parsed.sessionId }
    }
  } catch {
    return null
  }
  return null
}

const OWN_DISPLAY_KEY = 'teampro-poomsae:tv-own-display-code'

/**
 * 這台電視自己的顯示器代碼。
 *
 * 沒有這份紀錄的話，停在 /tv 等待畫面時每重整一次就 createDisplay() 一次，
 * 產生新代碼並讓手機既有的配對失效 —— 現場只要有人不小心碰到遙控器就斷線。
 */
export function saveOwnDisplayCode(displayCode: string): void {
  localStorage.setItem(OWN_DISPLAY_KEY, displayCode)
}

export function loadOwnDisplayCode(): string | null {
  return localStorage.getItem(OWN_DISPLAY_KEY)
}

export function clearOwnDisplayCode(): void {
  localStorage.removeItem(OWN_DISPLAY_KEY)
}
