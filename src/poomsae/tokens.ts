/**
 * 房間身分 token。
 *
 * 房號（`ABC123`）是給人唸的，本來就會出現在電視上，所以它不是機密。
 * 真正決定「你能做什麼」的是 token，因此 token 不能是 `J1`/`J2` 這種可猜的值。
 *
 * 這一層是 domain 層的授權，reducer 會據此拒絕越權事件。
 * 資料層的授權（Supabase RLS）在 P0-4，兩層都要有 —— 只靠前端路由擋不住任何人。
 */

export type RoomRole = 'HOST' | 'JUDGE' | 'DISPLAY'

export interface RoomActor {
  role: RoomRole
  /** JUDGE 專用，例如 'J1' */
  slot?: string
  token: string
}

export interface RoomTokens {
  hostToken: string
  displayToken: string
  /** judgeSlot → token */
  judgeTokens: Record<string, string>
}

/** 最多支援 7 判，建房時一次把 7 組 token 都生好，改裁判數不必重發 QR。 */
export const MAX_JUDGE_SLOTS = 7

/** 128 bit，以 hex 表示。夠長到無法暴力猜測，又還能塞進 QR Code。 */
export function generateToken(): string {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function createRoomTokens(): RoomTokens {
  const judgeTokens: Record<string, string> = {}
  for (let index = 1; index <= MAX_JUDGE_SLOTS; index += 1) {
    judgeTokens[`J${index}`] = generateToken()
  }
  return {
    hostToken: generateToken(),
    displayToken: generateToken(),
    judgeTokens,
  }
}

/**
 * 定額時間比較，避免用回應時間反推 token。
 * 這裡是前端，時間差攻擊不現實，但同一套函式之後會搬到 server-side function，
 * 先寫對比之後再改省事。
 */
function constantTimeEquals(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return diff === 0
}

/** actor 宣稱的身分是否與房間的 token 相符。 */
export function verifyActor(tokens: RoomTokens, actor: RoomActor): boolean {
  if (typeof actor.token !== 'string' || actor.token.length === 0) return false
  switch (actor.role) {
    case 'HOST':
      return constantTimeEquals(tokens.hostToken, actor.token)
    case 'DISPLAY':
      return constantTimeEquals(tokens.displayToken, actor.token)
    case 'JUDGE': {
      if (actor.slot === undefined) return false
      const expected = tokens.judgeTokens[actor.slot]
      // 沒有這個 slot 就直接拒絕，不要退回「比對空字串」
      return expected !== undefined && constantTimeEquals(expected, actor.token)
    }
  }
}

const TOKEN_STORAGE_PREFIX = 'teampro-poomsae:tokens:'

/**
 * Host 的 token 只存在建房的那台裝置上。
 *
 * 跨裝置 snapshot 不帶 token，所以 Host 重新整理後若沒有這份本機備份，
 * 就再也無法證明自己是 Host —— 這是「Host Refresh 後房間還在」的必要條件。
 */
export function saveHostTokens(roomCode: string, tokens: RoomTokens): void {
  window.localStorage.setItem(`${TOKEN_STORAGE_PREFIX}${roomCode}`, JSON.stringify(tokens))
}

export function loadHostTokens(roomCode: string): RoomTokens | null {
  const raw = window.localStorage.getItem(`${TOKEN_STORAGE_PREFIX}${roomCode}`)
  if (raw === null) return null
  try {
    const parsed = JSON.parse(raw) as Partial<RoomTokens>
    if (typeof parsed.hostToken !== 'string' || typeof parsed.displayToken !== 'string') return null
    if (typeof parsed.judgeTokens !== 'object' || parsed.judgeTokens === null) return null
    return parsed as RoomTokens
  } catch {
    return null
  }
}
