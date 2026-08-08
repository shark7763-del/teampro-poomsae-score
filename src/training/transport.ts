import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient } from '../lib/supabaseClient'
import { createId, createTrainingDisplayState, sanitizeTrainingDisplayState } from './state'
import type {
  TrainingDisplayEvent,
  TrainingDisplaySession,
  TrainingDisplayState,
  TrainingPresence,
  TrainingRealtimeTransport,
} from './types'
import { parseTrainingDisplayEvent, parseTrainingDisplayState } from './validation'

const LOCAL_PREFIX = 'teampro-training-display:'
const SNAPSHOT_TABLE = 'training_display_snapshots'

function channelName(sessionId: string): string {
  return `training-display:${sessionId}`
}

function codeKey(displayCode: string): string {
  return `${LOCAL_PREFIX}code:${displayCode}`
}

function snapshotKey(sessionId: string): string {
  return `${LOCAL_PREFIX}snapshot:${sessionId}`
}

export class LocalTrainingTransport implements TrainingRealtimeTransport {
  private channel: BroadcastChannel | null = null
  private session: TrainingDisplaySession | null = null

  async createDisplay(): Promise<TrainingDisplaySession> {
    const state = createTrainingDisplayState()
    const session = {
      sessionId: state.sessionId,
      displayId: state.displayId,
      displayCode: state.displayCode,
      displayName: state.displayName,
      expiresAt: state.expiresAt,
      transportKind: 'local' as const,
      snapshot: state,
    }
    localStorage.setItem(codeKey(state.displayCode), state.sessionId)
    localStorage.setItem(snapshotKey(state.sessionId), JSON.stringify(state))
    this.session = session
    this.channel = new BroadcastChannel(channelName(state.sessionId))
    return session
  }

  async joinDisplay(displayCode: string): Promise<TrainingDisplaySession> {
    const sessionId = localStorage.getItem(codeKey(displayCode.toUpperCase()))
    if (sessionId === null) throw new Error('找不到本機測試顯示器，跨裝置請設定 Supabase。')
    const raw = localStorage.getItem(snapshotKey(sessionId))
    const snapshot = parseTrainingDisplayState(raw === null ? null : JSON.parse(raw))
    if (snapshot === null) throw new Error('本機顯示器 snapshot 已遺失。')
    const session = {
      sessionId: snapshot.sessionId,
      displayId: snapshot.displayId,
      displayCode: snapshot.displayCode,
      displayName: snapshot.displayName,
      expiresAt: snapshot.expiresAt,
      transportKind: 'local' as const,
      snapshot,
    }
    this.session = session
    this.channel = new BroadcastChannel(channelName(snapshot.sessionId))
    return session
  }

  async publish(event: TrainingDisplayEvent): Promise<void> {
    this.channel?.postMessage(event)
  }

  async publishSnapshot(snapshot: TrainingDisplayState): Promise<void> {
    localStorage.setItem(snapshotKey(snapshot.sessionId), JSON.stringify(sanitizeTrainingDisplayState(snapshot)))
    await this.publish({
      schemaVersion: 1,
      eventId: createId('evt'),
      sessionId: snapshot.sessionId,
      displayId: snapshot.displayId,
      senderId: snapshot.displayId,
      senderRole: 'controller',
      sequence: snapshot.sequence + 1,
      sentAt: Date.now(),
      type: 'STATE_SNAPSHOT',
      payload: { snapshot: sanitizeTrainingDisplayState(snapshot) },
    })
  }

  async readSnapshot(): Promise<TrainingDisplayState | null> {
    if (this.session === null) return null
    const raw = localStorage.getItem(snapshotKey(this.session.sessionId))
    return parseTrainingDisplayState(raw === null ? null : JSON.parse(raw))
  }

  async requestSnapshot(): Promise<void> {
    if (this.session === null) return
    const snapshot = await this.readSnapshot()
    if (snapshot !== null) await this.publishSnapshot(snapshot)
  }

  subscribe(handler: (event: TrainingDisplayEvent) => void): () => void {
    const listener = (message: MessageEvent<unknown>): void => {
      const event = parseTrainingDisplayEvent(message.data)
      if (event !== null) handler(event)
    }
    this.channel?.addEventListener('message', listener)
    return () => this.channel?.removeEventListener('message', listener)
  }

  async trackPresence(_payload: TrainingPresence): Promise<void> {
    return Promise.resolve()
  }

  async reconnect(): Promise<void> {
    if (this.session !== null && this.channel === null) this.channel = new BroadcastChannel(channelName(this.session.sessionId))
  }

  async disconnect(): Promise<void> {
    this.channel?.close()
    this.channel = null
  }
}

interface SnapshotRow {
  session_id: string
  display_id: string
  display_code: string
  display_name: string
  expires_at: string
  sequence: number
  snapshot: TrainingDisplayState
  updated_at: string
}

export class SupabaseTrainingTransport implements TrainingRealtimeTransport {
  private client: SupabaseClient
  private channel: RealtimeChannel | null = null
  private session: TrainingDisplaySession | null = null

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async createDisplay(): Promise<TrainingDisplaySession> {
    const state = createTrainingDisplayState()
    await this.upsertSnapshot(state)
    const session = this.sessionFromState(state, 'supabase')
    this.session = session
    this.openChannel(session.sessionId)
    return session
  }

  async joinDisplay(displayCode: string): Promise<TrainingDisplaySession> {
    const { data, error } = await this.client
      .from(SNAPSHOT_TABLE)
      .select('session_id,display_id,display_code,display_name,expires_at,sequence,snapshot,updated_at')
      .eq('display_code', displayCode.toUpperCase())
      .gt('expires_at', new Date().toISOString())
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle<SnapshotRow>()
    if (error !== null) throw new Error(error.message)
    if (data === null) throw new Error('找不到顯示器或代碼已過期。')
    const snapshot = parseTrainingDisplayState(data.snapshot)
    if (snapshot === null) throw new Error('顯示器 snapshot 格式不相容。')
    const session = this.sessionFromState(snapshot, 'supabase')
    this.session = session
    this.openChannel(session.sessionId)
    return session
  }

  async publish(event: TrainingDisplayEvent): Promise<void> {
    await this.ensureSubscribed()
    await this.channel?.send({ type: 'broadcast', event: 'training-event', payload: event })
  }

  async publishSnapshot(snapshot: TrainingDisplayState): Promise<void> {
    const sanitized = sanitizeTrainingDisplayState(snapshot)
    await this.upsertSnapshot(sanitized)
    await this.publish({
      schemaVersion: 1,
      eventId: createId('evt'),
      sessionId: sanitized.sessionId,
      displayId: sanitized.displayId,
      senderId: sanitized.displayId,
      senderRole: 'controller',
      sequence: sanitized.sequence + 1,
      sentAt: Date.now(),
      type: 'STATE_SNAPSHOT',
      payload: { snapshot: sanitized },
    })
  }

  async readSnapshot(): Promise<TrainingDisplayState | null> {
    if (this.session === null) return null
    const { data, error } = await this.client
      .from(SNAPSHOT_TABLE)
      .select('snapshot')
      .eq('session_id', this.session.sessionId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle<{ snapshot: TrainingDisplayState }>()
    if (error !== null || data === null) return null
    return parseTrainingDisplayState(data.snapshot)
  }

  async requestSnapshot(): Promise<void> {
    if (this.session === null) return
    await this.publish({
      schemaVersion: 1,
      eventId: createId('evt'),
      sessionId: this.session.sessionId,
      displayId: this.session.displayId,
      senderId: this.session.displayId,
      senderRole: 'display',
      sequence: Date.now(),
      sentAt: Date.now(),
      type: 'STATE_REQUESTED',
      payload: { reason: 'refresh' },
    })
  }

  subscribe(handler: (event: TrainingDisplayEvent) => void): () => void {
    this.channel?.on('broadcast', { event: 'training-event' }, (message: { payload: unknown }) => {
      const event = parseTrainingDisplayEvent(message.payload)
      if (event !== null) handler(event)
    })
    void this.ensureSubscribed()
    return () => {
      void this.disconnect()
    }
  }

  async trackPresence(payload: TrainingPresence): Promise<void> {
    await this.ensureSubscribed()
    await this.channel?.track(payload)
  }

  async reconnect(): Promise<void> {
    if (this.session !== null) this.openChannel(this.session.sessionId)
    await this.ensureSubscribed()
  }

  async disconnect(): Promise<void> {
    if (this.channel !== null) await this.client.removeChannel(this.channel)
    this.channel = null
  }

  private openChannel(sessionId: string): void {
    if (this.channel !== null) return
    this.channel = this.client.channel(channelName(sessionId), {
      config: {
        private: true,
        broadcast: { ack: true, self: true },
        presence: { key: createId('presence') },
      },
    })
  }

  private async ensureSubscribed(): Promise<void> {
    if (this.channel === null && this.session !== null) this.openChannel(this.session.sessionId)
    if (this.channel === null) return
    await new Promise<void>((resolve) => {
      this.channel?.subscribe(() => resolve())
    })
  }

  private async upsertSnapshot(snapshot: TrainingDisplayState): Promise<void> {
    const { error } = await this.client.from(SNAPSHOT_TABLE).upsert(
      {
        session_id: snapshot.sessionId,
        display_id: snapshot.displayId,
        display_code: snapshot.displayCode,
        display_name: snapshot.displayName,
        expires_at: new Date(snapshot.expiresAt).toISOString(),
        sequence: snapshot.sequence,
        snapshot,
        updated_at: new Date(snapshot.updatedAt).toISOString(),
      },
      { onConflict: 'session_id' },
    )
    if (error !== null) throw new Error(error.message)
  }

  private sessionFromState(
    state: TrainingDisplayState,
    transportKind: TrainingDisplaySession['transportKind'],
  ): TrainingDisplaySession {
    return {
      sessionId: state.sessionId,
      displayId: state.displayId,
      displayCode: state.displayCode,
      displayName: state.displayName,
      expiresAt: state.expiresAt,
      transportKind,
      snapshot: state,
    }
  }
}

export function createTrainingTransport(): TrainingRealtimeTransport {
  const client = getSupabaseClient()
  return client === null ? new LocalTrainingTransport() : new SupabaseTrainingTransport(client)
}
