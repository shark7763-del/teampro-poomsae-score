import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoom, makeEvent, reduceRoom, type RoomEvent, type RoomEventInput, type RoomState } from './room'
import type { RoomConnectionStatus, RoomTransport } from './transport'
import { createRoomTransport } from './transport'
import type { RoomActor } from './tokens'
import { loadHostTokens, saveHostTokens } from './tokens'

/**
 * 呼叫端宣告的身分。
 * HOST 不必自己帶 token —— hook 會從本機取出建房時存下的那份。
 */
export type RoomActorInput =
  | { role: 'HOST' }
  | { role: 'JUDGE'; slot: string; token: string }
  | { role: 'DISPLAY'; token: string }

export interface UseRoomResult {
  state: RoomState | null
  status: RoomConnectionStatus
  transportKind: RoomTransport['kind']
  error: string
  publish: (event: RoomEventInput) => void
}

/**
 * 把房間狀態綁到 React。
 *
 * 權威模型：
 *   - HOST 是唯一會跑 reducer 並寫回 snapshot 的角色。
 *   - JUDGE / DISPLAY 只投遞事件、只讀 snapshot。
 *
 * 這樣計分規則（去頭去尾、tie-break）只存在 TypeScript 一份，
 * 不必在 SQL 再實作一次，也就不會兩邊算出不同分數。
 */
export function useRoom(roomCode: string, actorInput: RoomActorInput): UseRoomResult {
  const normalized = roomCode.toUpperCase()
  const transport = useMemo(() => createRoomTransport(), [])
  const [state, setState] = useState<RoomState | null>(null)
  const [status, setStatus] = useState<RoomConnectionStatus>('connecting')
  const [error, setError] = useState('')
  const stateRef = useRef<RoomState | null>(null)
  const roleRef = useRef(actorInput.role)

  useEffect(() => {
    stateRef.current = state
  }, [state])
  useEffect(() => {
    roleRef.current = actorInput.role
  }, [actorInput.role])

  const slot = actorInput.role === 'JUDGE' ? actorInput.slot : undefined
  const providedToken = actorInput.role === 'HOST' ? undefined : actorInput.token

  /** 目前這台裝置能用的 actor；HOST 的 token 來自本機保存的建房紀錄。 */
  const currentActor = useCallback((): RoomActor => {
    if (roleRef.current === 'HOST') {
      return { role: 'HOST', token: loadHostTokens(normalized)?.hostToken ?? '' }
    }
    return { role: roleRef.current, slot, token: providedToken ?? '' }
  }, [normalized, providedToken, slot])

  /** Host 專用：套用事件 → 寫回 snapshot。其他角色只等 snapshot。 */
  const applyAsHost = useCallback(
    (event: RoomEvent) => {
      const current = stateRef.current
      if (current === null) return
      const next = reduceRoom(current, event)
      if (next === current) return
      stateRef.current = next
      setState(next)
      const hostToken = next.tokens?.hostToken
      if (hostToken === undefined) return
      void transport.saveSnapshot(next, hostToken).catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : '同步失敗')
      })
    },
    [transport],
  )

  useEffect(() => {
    let disposed = false

    async function join(): Promise<void> {
      try {
        const existing = await transport.fetchSnapshot(normalized)
        if (disposed) return

        if (roleRef.current !== 'HOST') {
          if (existing === null) {
            setError('找不到房間，請確認房號或重新掃描 QR Code。')
            return
          }
          stateRef.current = existing
          setState(existing)
          return
        }

        const storedTokens = loadHostTokens(normalized)
        if (existing !== null) {
          if (storedTokens === null) {
            // 房間存在但這台裝置沒有 host token → 不是這台建的，不給控制權
            setError('這個房間不是由本裝置建立，無法取得主控權限。')
            stateRef.current = existing
            setState(existing)
            return
          }
          const restored = { ...existing, tokens: storedTokens }
          stateRef.current = restored
          setState(restored)
          return
        }

        const created = createRoom(normalized)
        if (created.tokens !== null) saveHostTokens(normalized, created.tokens)
        await transport.createRoom(created, { role: 'HOST', token: created.tokens?.hostToken ?? '' })
        if (disposed) return
        stateRef.current = created
        setState(created)
      } catch (caught) {
        if (!disposed) setError(caught instanceof Error ? caught.message : '連線失敗')
      }
    }

    void join()

    const unsubscribe = transport.subscribe(normalized, {
      onSnapshot: (next) => {
        if (disposed) return
        // Host 自己就是權威，不要被自己寫回的 snapshot 覆蓋（可能比本地舊）
        if (roleRef.current === 'HOST') return
        stateRef.current = next
        setState(next)
      },
      onEvent: (event) => {
        if (disposed) return
        if (roleRef.current === 'HOST') {
          applyAsHost(event)
          return
        }
        if (transport.kind === 'local') {
          // 本機模式沒有權威 Host 在跑，所有分頁各自 reduce
          const current = stateRef.current
          if (current === null) return
          const next = reduceRoom(current, event)
          stateRef.current = next
          setState(next)
        }
      },
      onStatus: (next) => {
        if (!disposed) setStatus(next)
      },
    })

    return () => {
      disposed = true
      unsubscribe()
      void transport.disconnect()
    }
  }, [applyAsHost, normalized, transport])

  const publish = useCallback(
    (input: RoomEventInput) => {
      const current = stateRef.current
      if (current === null) return
      const actor = currentActor()
      const event = makeEvent(current, actor, input)

      if (actor.role === 'HOST') {
        applyAsHost(event)
        return
      }

      /*
       * 非 Host 不先套用到本地畫面 —— 等 Host 的 snapshot 回來才算數。
       * 這樣裁判不會看到「自己以為送出了、其實伺服器拒絕了」的假成功。
       */
      void transport.sendEvent(event).catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : '送出失敗')
      })

      if (transport.kind === 'local') {
        const next = reduceRoom(current, event)
        stateRef.current = next
        setState(next)
        void transport.saveSnapshot(next, actor.token)
      }
    },
    [applyAsHost, currentActor, transport],
  )

  return { state, status, transportKind: transport.kind, error, publish }
}
