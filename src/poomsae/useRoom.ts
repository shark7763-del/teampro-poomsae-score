import { useCallback, useEffect, useRef, useState } from 'react'
import {
  channelName,
  createRoom,
  makeEvent,
  reduceRoom,
  storageKey,
  type RoomEvent,
  type RoomEventInput,
  type RoomState,
} from './room'

export function useRoom(roomCode: string): {
  state: RoomState
  publish: (event: RoomEventInput) => void
} {
  const normalized = roomCode.toUpperCase()
  const [state, setState] = useState<RoomState>(() => {
    const raw = window.localStorage.getItem(storageKey(normalized))
    if (raw !== null) {
      try {
        return JSON.parse(raw) as RoomState
      } catch {
        // fall through
      }
    }
    const created = createRoom(normalized)
    window.localStorage.setItem(storageKey(normalized), JSON.stringify(created))
    return created
  })
  const stateRef = useRef(state)
  const channelRef = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const apply = useCallback((event: RoomEvent) => {
    setState((current) => {
      const next = reduceRoom(current, event)
      if (next !== current) window.localStorage.setItem(storageKey(next.roomCode), JSON.stringify(next))
      return next
    })
  }, [])

  useEffect(() => {
    const channel = new window.BroadcastChannel(channelName(normalized))
    channelRef.current = channel
    const listener = (message: MessageEvent<RoomEvent>): void => apply(message.data)
    channel.addEventListener('message', listener)
    return () => {
      channel.removeEventListener('message', listener)
      channel.close()
      channelRef.current = null
    }
  }, [apply, normalized])

  const publish = useCallback(
    (event: RoomEventInput) => {
      const full = makeEvent(stateRef.current, event)
      apply(full)
      channelRef.current?.postMessage(full)
    },
    [apply],
  )

  return { state, publish }
}
