import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  applyTrainingDisplayEvent,
  buildResult,
  createId,
  createPrivateTrainingSession,
  createTrainingDisplayState,
  elapsedSeconds,
  sanitizeTrainingDisplayState,
  updateOptionsForMode,
} from './state'
import {
  loadOwnDisplayCode,
  loadRecentDisplay,
  loadTrainingSnapshot,
  saveOwnDisplayCode,
  saveRecentDisplay,
  saveTrainingSnapshot,
} from './storage'
import { createTrainingTransport } from './transport'
import type {
  DisplayMode,
  PrivateTrainingSession,
  TrainingConnectionStatus,
  TrainingDisplayEvent,
  TrainingDisplaySession,
  TrainingDisplayState,
} from './types'

type TrainingPatch = Partial<
  Pick<
    TrainingDisplayState,
    | 'athleteName'
    | 'teamName'
    | 'poomsaeName'
    | 'publicGoal'
    | 'phase'
    | 'minorMistakes'
    | 'majorMistakes'
    | 'lastPenalty'
    | 'latestPublicHint'
    | 'issueTags'
    | 'presentation'
  >
>

export function useTrainingController(initialSessionId?: string) {
  const transport = useMemo(() => createTrainingTransport(), [])
  const senderId = useMemo(() => createId('coach'), [])
  const [connectionStatus, setConnectionStatus] = useState<TrainingConnectionStatus>('not_connected')
  const [displaySession, setDisplaySession] = useState<TrainingDisplaySession | null>(null)
  const [session, setSession] = useState<PrivateTrainingSession>(() =>
    createPrivateTrainingSession(createTrainingDisplayState({ sessionId: initialSessionId })),
  )
  const sessionRef = useRef(session)
  const sequenceRef = useRef(session.state.sequence)
  const recentDisplay = loadRecentDisplay()

  useEffect(() => {
    sessionRef.current = session
    sequenceRef.current = session.state.sequence
  }, [session])

  useEffect(() => {
    if (!initialSessionId) return
    void loadTrainingSnapshot(initialSessionId).then((snapshot) => {
      if (snapshot !== null) setSession((current) => ({ ...current, state: snapshot }))
    })
  }, [initialSessionId])

  const applyAndPersist = useCallback((next: PrivateTrainingSession): void => {
    setSession(next)
    void saveTrainingSnapshot(next.state)
  }, [])

  const makeEvent = useCallback(
    (event: Omit<TrainingDisplayEvent, 'schemaVersion' | 'eventId' | 'sessionId' | 'displayId' | 'senderId' | 'senderRole' | 'sequence' | 'sentAt'>): TrainingDisplayEvent => {
      const current = sessionRef.current.state
      const sequence = sequenceRef.current + 1
      sequenceRef.current = sequence
      return {
        ...event,
        schemaVersion: 1,
        eventId: createId('evt'),
        sessionId: current.sessionId,
        displayId: current.displayId,
        senderId,
        senderRole: 'controller',
        sequence,
        sentAt: Date.now(),
      } as TrainingDisplayEvent
    },
    [senderId],
  )

  const publishEvent = useCallback(
    async (event: TrainingDisplayEvent): Promise<void> => {
      const nextState = applyTrainingDisplayEvent(sessionRef.current.state, event)
      const next = { ...sessionRef.current, state: nextState }
      applyAndPersist(next)
      await transport.publishSnapshot(sanitizeTrainingDisplayState(nextState))
      void transport.publish(event).catch(() => undefined)
    },
    [applyAndPersist, transport],
  )

  const connectDisplay = useCallback(
    async (displayCode: string): Promise<void> => {
      setConnectionStatus('connecting')
      const joined = await transport.joinDisplay(displayCode)
      setDisplaySession(joined)
      saveRecentDisplay(joined.displayCode, joined.displayName, joined.sessionId)
      const joinedState = {
        ...sessionRef.current.state,
        sessionId: joined.sessionId,
        displayId: joined.displayId,
        displayCode: joined.displayCode,
        displayName: joined.displayName,
        expiresAt: joined.expiresAt,
      }
      const joinedSession = { ...sessionRef.current, state: joinedState }
      sessionRef.current = joinedSession
      sequenceRef.current = joinedState.sequence
      setSession(joinedSession)
      await saveTrainingSnapshot(joinedState)
      setConnectionStatus('connected')
      await transport.trackPresence({
        sessionId: joined.sessionId,
        senderId,
        senderRole: 'controller',
        displayName: '教練手機',
        onlineAt: Date.now(),
      })
      await publishEvent(makeEvent({ type: 'SESSION_STARTED', payload: { controllerName: '教練手機' } }))
    },
    [makeEvent, publishEvent, senderId, transport],
  )

  /**
   * 命名場地。
   *
   * 這裡一定要 publish —— 只改手機本地狀態的話，電視永遠顯示預設名稱，
   * 兩個場地同時跑時就分不出哪台是哪台。
   */
  const renameDisplay = useCallback(
    async (displayName: string): Promise<void> => {
      const current = sessionRef.current.state
      const nextState = {
        ...current,
        displayName,
        sequence: current.sequence + 1,
        updatedAt: Date.now(),
      }
      applyAndPersist({ ...sessionRef.current, state: nextState })
      saveRecentDisplay(nextState.displayCode, displayName, nextState.sessionId)
      await publishEvent(makeEvent({ type: 'DISPLAY_CONNECTED', payload: { displayName } }))
    },
    [applyAndPersist, makeEvent, publishEvent],
  )

  const updateTraining = useCallback(
    async (patch: TrainingPatch): Promise<void> => {
      const current = sessionRef.current.state
      const nextState = { ...current, ...patch, sequence: current.sequence + 1, updatedAt: Date.now() }
      const next = { ...sessionRef.current, state: nextState }
      applyAndPersist(next)
      if (patch.athleteName !== undefined || patch.teamName !== undefined || patch.poomsaeName !== undefined) {
        await publishEvent(
          makeEvent({
            type: 'ATHLETE_CHANGED',
            payload: {
              athleteName: nextState.athleteName,
              teamName: nextState.teamName,
              poomsaeName: nextState.poomsaeName,
            },
          }),
        )
      } else if (patch.publicGoal !== undefined || patch.phase !== undefined) {
        await publishEvent(makeEvent({ type: 'GOALS_UPDATED', payload: { publicGoal: nextState.publicGoal, phase: nextState.phase } }))
      } else if (patch.presentation !== undefined) {
        await publishEvent(makeEvent({ type: 'PRESENTATION_UPDATED', payload: nextState.presentation }))
      } else {
        await publishEvent(
          makeEvent({
            type: 'ACCURACY_UPDATED',
            payload: {
              minorMistakes: nextState.minorMistakes,
              majorMistakes: nextState.majorMistakes,
              lastPenalty: nextState.lastPenalty,
              latestPublicHint: nextState.latestPublicHint,
            },
          }),
        )
      }
    },
    [applyAndPersist, makeEvent, publishEvent],
  )

  const setDisplayMode = useCallback(
    async (displayMode: DisplayMode): Promise<void> => {
      const options = updateOptionsForMode(displayMode, sessionRef.current.state.options)
      await publishEvent(makeEvent({ type: 'DISPLAY_MODE_CHANGED', payload: { displayMode, options } }))
    },
    [makeEvent, publishEvent],
  )

  const setOption = useCallback(
    async (key: keyof TrainingDisplayState['options'], value: boolean): Promise<void> => {
      const current = sessionRef.current.state
      await publishEvent(makeEvent({ type: 'DISPLAY_MODE_CHANGED', payload: { displayMode: current.displayMode, options: { ...current.options, [key]: value } } }))
    },
    [makeEvent, publishEvent],
  )

  const startTimer = useCallback(async (): Promise<void> => {
    await publishEvent(
      makeEvent({
        type: 'TIMER_STARTED',
        payload: { timerStartedAt: Date.now(), accumulatedSeconds: elapsedSeconds(sessionRef.current.state) },
      }),
    )
  }, [makeEvent, publishEvent])

  const pauseTimer = useCallback(async (): Promise<void> => {
    await publishEvent(makeEvent({ type: 'TIMER_PAUSED', payload: { accumulatedSeconds: elapsedSeconds(sessionRef.current.state) } }))
  }, [makeEvent, publishEvent])

  const publishResult = useCallback(async (): Promise<void> => {
    await publishEvent(makeEvent({ type: 'RESULT_PUBLISHED', payload: { result: buildResult(sessionRef.current.state) } }))
  }, [makeEvent, publishEvent])

  const resetTraining = useCallback(async (): Promise<void> => {
    const current = sessionRef.current.state
    const nextState = {
      ...current,
      sequence: current.sequence + 1,
      updatedAt: Date.now(),
      phase: '準備',
      timerStatus: 'idle' as const,
      timerStartedAt: null,
      accumulatedSeconds: 0,
      minorMistakes: 0,
      majorMistakes: 0,
      lastPenalty: null,
      latestPublicHint: '',
      issueTags: [],
      presentation: { speedPower: 20, rhythmTempo: 20, energyExpression: 20 },
      result: null,
      displayMode: current.displayMode === 'result' ? 'athlete' as const : current.displayMode,
    }
    const next = { ...sessionRef.current, state: nextState }
    sessionRef.current = next
    sequenceRef.current = nextState.sequence
    applyAndPersist(next)
    await transport.publishSnapshot(sanitizeTrainingDisplayState(nextState))
  }, [applyAndPersist, transport])

  const resync = useCallback(async (): Promise<void> => {
    await transport.publishSnapshot(sanitizeTrainingDisplayState(sessionRef.current.state))
  }, [transport])

  const disconnect = useCallback(async (): Promise<void> => {
    await transport.disconnect()
    setConnectionStatus('not_connected')
    setDisplaySession(null)
  }, [transport])

  return {
    session,
    displaySession,
    connectionStatus,
    recentDisplay,
    transportKind: displaySession?.transportKind ?? (recentDisplay ? 'supabase' : 'local'),
    connectDisplay,
    renameDisplay,
    updateTraining,
    setDisplayMode,
    setOption,
    startTimer,
    pauseTimer,
    publishResult,
    resetTraining,
    resync,
    disconnect,
  }
}

/**
 * 電視在沒帶代碼時，先試著接回自己上一次的顯示器。
 *
 * 直接 createDisplay() 會讓每次重整都換一組新代碼，
 * 手機既有的配對就斷了 —— 現場碰到遙控器就要重配對。
 * 代碼過期或找不到才建立新的。
 */
async function resumeOrCreateDisplay(
  transport: ReturnType<typeof createTrainingTransport>,
): Promise<TrainingDisplaySession> {
  const saved = loadOwnDisplayCode()
  if (saved !== null) {
    try {
      return await transport.joinDisplay(saved)
    } catch {
      // 過期或已被清掉，往下建立新的
    }
  }
  // 刻意不在這裡寫入 localStorage：effect 可能被丟棄重跑（StrictMode、HMR），
  // 那樣會存到沒有被採用的那組代碼，跟畫面顯示的不一致。由 boot() 確認存活後才存。
  return transport.createDisplay()
}

export function useTrainingDisplay(displayCode?: string) {
  const transport = useMemo(() => createTrainingTransport(), [])
  const [state, setState] = useState<TrainingDisplayState | null>(null)
  const [session, setSession] = useState<TrainingDisplaySession | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<TrainingConnectionStatus>('connecting')
  const stateRef = useRef<TrainingDisplayState | null>(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    let cancelled = false
    async function boot(): Promise<void> {
      try {
        const created = displayCode
          ? await transport.joinDisplay(displayCode)
          : await resumeOrCreateDisplay(transport)
        if (cancelled) return
        // 這一次 boot 確定被採用了，才把代碼記成「這台電視的」
        if (displayCode === undefined) saveOwnDisplayCode(created.displayCode)
        setSession(created)
        const initial =
          created.snapshot ??
          createTrainingDisplayState({
            sessionId: created.sessionId,
            displayId: created.displayId,
            displayCode: created.displayCode,
            displayName: created.displayName,
          })
        setState(initial)
        setConnectionStatus('connected')
        await saveTrainingSnapshot(initial)
        await transport.trackPresence({
          sessionId: created.sessionId,
          senderId: created.displayId,
          senderRole: 'display',
          displayName: created.displayName,
          onlineAt: Date.now(),
        })
        await transport.publishSnapshot(initial)
        await transport.requestSnapshot()
      } catch {
        setConnectionStatus('offline')
      }
    }
    void boot()
    const unsubscribe = transport.subscribe((event) => {
      setState((current) => {
        if (current === null) return current
        if (event.type === 'STATE_REQUESTED') {
          void transport.publishSnapshot(current)
          return current
        }
        const next = applyTrainingDisplayEvent(current, event)
        void saveTrainingSnapshot(next)
        return next
      })
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [displayCode, transport])

  useEffect(() => {
    if (session?.transportKind !== 'supabase') return
    const interval = window.setInterval(() => {
      void transport.readSnapshot().then((snapshot) => {
        if (snapshot === null) return
        setState((current) => {
          if (current !== null && snapshot.sequence < current.sequence) return current
          void saveTrainingSnapshot(snapshot)
          return snapshot
        })
      })
    }, 1500)
    return () => window.clearInterval(interval)
  }, [session?.transportKind, transport])

  return { state, session, connectionStatus, transportKind: session?.transportKind ?? 'local' }
}
