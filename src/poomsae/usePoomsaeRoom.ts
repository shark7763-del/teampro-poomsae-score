import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createInitialRoomState,
  loadPoomsaeRoom,
  makeRoomEvent,
  reducePoomsaeRoom,
  roomChannelName,
  savePoomsaeRoom,
  type PoomsaeRoomEvent,
  type PoomsaeRoomEventInput,
  type PoomsaeRoomState,
} from './roomSession'

interface PoomsaeRoomApi {
  state: PoomsaeRoomState
  publish: (event: PoomsaeRoomEventInput) => void
}

export function usePoomsaeRoom(roomCode: string): PoomsaeRoomApi {
  const normalizedRoomCode = roomCode.toUpperCase()
  const [state, setState] = useState<PoomsaeRoomState>(() => {
    const stored = loadPoomsaeRoom(normalizedRoomCode)
    if (stored !== null) return stored
    const created = createInitialRoomState(normalizedRoomCode)
    savePoomsaeRoom(created)
    return created
  })
  const stateRef = useRef(state)
  const channelRef = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const apply = useCallback((event: PoomsaeRoomEvent) => {
    setState((current) => {
      const next = reducePoomsaeRoom(current, event)
      if (next !== current) savePoomsaeRoom(next)
      return next
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.BroadcastChannel !== 'function') return
    const channel = new window.BroadcastChannel(roomChannelName(normalizedRoomCode))
    channelRef.current = channel
    const listener = (message: MessageEvent<PoomsaeRoomEvent>): void => {
      if (typeof message.data?.type !== 'string') return
      apply(message.data)
    }
    channel.addEventListener('message', listener)
    return () => {
      channel.removeEventListener('message', listener)
      channel.close()
      channelRef.current = null
    }
  }, [apply, normalizedRoomCode])

  const publish = useCallback(
    (event: PoomsaeRoomEventInput) => {
      const fullEvent = makeRoomEvent(stateRef.current, event)
      apply(fullEvent)
      channelRef.current?.postMessage(fullEvent)
    },
    [apply],
  )

  return { state, publish }
}
