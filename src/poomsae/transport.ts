import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient } from '../lib/supabaseClient'
import type { RoomEvent, RoomState } from './room'
import { channelName, sanitizeRoomState, storageKey } from './room'
import type { RoomActor } from './tokens'

export type RoomConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'local'

export interface RoomSubscribers {
  /** 收到權威 snapshot（Host 寫回的結果） */
  onSnapshot: (state: RoomState) => void
  /** 收到單一事件（Host 用來套用 reducer；本機模式下所有人都用） */
  onEvent: (event: RoomEvent) => void
  onStatus: (status: RoomConnectionStatus) => void
}

export interface RoomTransport {
  kind: 'local' | 'supabase'
  /** Host 建房。已存在就當作加入既有房間。 */
  createRoom: (state: RoomState, tokensOwner: RoomActor) => Promise<void>
  fetchSnapshot: (roomCode: string) => Promise<RoomState | null>
  /** 非 Host 投遞事件；Host 也用它把自己的事件送進佇列以留下軌跡 */
  sendEvent: (event: RoomEvent) => Promise<void>
  /** 只有 Host 呼叫 */
  saveSnapshot: (state: RoomState, hostToken: string) => Promise<void>
  subscribe: (roomCode: string, handlers: RoomSubscribers) => () => void
  disconnect: () => Promise<void>
}

/** 收進來的資料來自網路，先確認形狀再交給 reducer。 */
function parseRoomState(value: unknown): RoomState | null {
  if (typeof value !== 'object' || value === null) return null
  const candidate = value as Partial<RoomState>
  if (typeof candidate.roomCode !== 'string') return null
  if (typeof candidate.status !== 'string') return null
  if (typeof candidate.judgeScores !== 'object' || candidate.judgeScores === null) return null
  // token 一律不信任遠端來源，遠端副本永遠沒有 token
  return { ...(candidate as RoomState), tokens: null }
}

function parseRoomEvent(value: unknown): RoomEvent | null {
  if (typeof value !== 'object' || value === null) return null
  const candidate = value as Partial<RoomEvent>
  if (typeof candidate.eventId !== 'string' || typeof candidate.type !== 'string') return null
  if (typeof candidate.roomCode !== 'string') return null
  if (typeof candidate.actor !== 'object' || candidate.actor === null) return null
  return candidate as RoomEvent
}

// ------------------------------------------------------------------ 本機模式

/**
 * 同一個瀏覽器的分頁之間同步。
 *
 * 這是 fallback，不是正式方案 —— 另一支手機看不到任何東西。
 * UI 必須據 `kind === 'local'` 明白告訴使用者，不要假裝已經跨裝置同步。
 */
export class LocalRoomTransport implements RoomTransport {
  readonly kind = 'local' as const
  private channel: BroadcastChannel | null = null

  async createRoom(state: RoomState): Promise<void> {
    window.localStorage.setItem(storageKey(state.roomCode), JSON.stringify(state))
  }

  async fetchSnapshot(roomCode: string): Promise<RoomState | null> {
    const raw = window.localStorage.getItem(storageKey(roomCode))
    if (raw === null) return null
    try {
      // 本機模式下 token 就存在本機，不做 sanitize，否則 Host 重整後無法再授權
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed !== 'object' || parsed === null) return null
      return parsed as RoomState
    } catch {
      return null
    }
  }

  async sendEvent(event: RoomEvent): Promise<void> {
    this.channel?.postMessage(event)
  }

  async saveSnapshot(state: RoomState): Promise<void> {
    window.localStorage.setItem(storageKey(state.roomCode), JSON.stringify(state))
  }

  subscribe(roomCode: string, handlers: RoomSubscribers): () => void {
    const channel = new window.BroadcastChannel(channelName(roomCode))
    this.channel = channel
    const listener = (message: MessageEvent<unknown>): void => {
      const event = parseRoomEvent(message.data)
      if (event !== null) handlers.onEvent(event)
    }
    channel.addEventListener('message', listener)
    handlers.onStatus('local')
    return () => {
      channel.removeEventListener('message', listener)
      channel.close()
      this.channel = null
    }
  }

  async disconnect(): Promise<void> {
    this.channel?.close()
    this.channel = null
  }
}

// --------------------------------------------------------------- Supabase 模式

interface RoomRow {
  room_code: string
  snapshot: unknown
  sequence: number
}

/**
 * 真正的跨裝置同步。
 *
 * 權威在 Host：裁判與顯示端把事件投遞到 competition_room_events，
 * Host 套用 reducer 後把結果寫回 competition_rooms.snapshot，
 * 其他人訂閱 snapshot 變更。
 *
 * 這樣計分規則只有 TypeScript 一份，不必在 SQL 再實作一次去頭去尾與 tie-break。
 */
export class SupabaseRoomTransport implements RoomTransport {
  readonly kind = 'supabase' as const
  private client: SupabaseClient
  private channel: RealtimeChannel | null = null

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async createRoom(state: RoomState, owner: RoomActor): Promise<void> {
    if (state.tokens === null) throw new Error('建立房間需要 token')
    const { error } = await this.client.rpc('create_competition_room', {
      p_room_code: state.roomCode,
      p_host_token: state.tokens.hostToken,
      p_display_token: state.tokens.displayToken,
      p_judge_tokens: state.tokens.judgeTokens,
      p_snapshot: sanitizeRoomState(state),
    })
    // 房號已存在代表這是重新整理後回到同一間房，不是錯誤
    if (error !== null && !error.message.includes('duplicate key')) {
      throw new Error(`建立房間失敗：${error.message}`)
    }
    void owner
  }

  async fetchSnapshot(roomCode: string): Promise<RoomState | null> {
    const { data, error } = await this.client
      .from('competition_rooms')
      .select('room_code,snapshot,sequence')
      .eq('room_code', roomCode)
      .maybeSingle<RoomRow>()
    if (error !== null || data === null) return null
    return parseRoomState(data.snapshot)
  }

  async sendEvent(event: RoomEvent): Promise<void> {
    const { error } = await this.client.rpc('submit_room_event', {
      p_room_code: event.roomCode,
      p_role: event.actor.role,
      p_slot: event.actor.slot ?? null,
      p_token: event.actor.token,
      p_event: event,
    })
    if (error !== null) throw new Error(`送出失敗：${error.message}`)
  }

  async saveSnapshot(state: RoomState, hostToken: string): Promise<void> {
    const { error } = await this.client.rpc('save_room_snapshot', {
      p_room_code: state.roomCode,
      p_token: hostToken,
      p_snapshot: sanitizeRoomState(state),
      p_sequence: state.lastSequence,
    })
    if (error !== null) throw new Error(`同步失敗：${error.message}`)
  }

  subscribe(roomCode: string, handlers: RoomSubscribers): () => void {
    handlers.onStatus('connecting')
    const channel = this.client
      .channel(`competition-room:${roomCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'competition_rooms', filter: `room_code=eq.${roomCode}` },
        (message) => {
          const next = parseRoomState((message.new as { snapshot?: unknown } | null)?.snapshot)
          if (next !== null) handlers.onSnapshot(next)
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'competition_room_events',
          filter: `room_code=eq.${roomCode}`,
        },
        (message) => {
          const event = parseRoomEvent((message.new as { payload?: unknown } | null)?.payload)
          if (event !== null) handlers.onEvent(event)
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') handlers.onStatus('connected')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') handlers.onStatus('reconnecting')
        else if (status === 'CLOSED') handlers.onStatus('offline')
      })
    this.channel = channel
    return () => {
      void this.client.removeChannel(channel)
      this.channel = null
    }
  }

  async disconnect(): Promise<void> {
    if (this.channel !== null) await this.client.removeChannel(this.channel)
    this.channel = null
  }
}

export function createRoomTransport(): RoomTransport {
  const client = getSupabaseClient()
  return client === null ? new LocalRoomTransport() : new SupabaseRoomTransport(client)
}
