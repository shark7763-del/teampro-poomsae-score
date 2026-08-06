import { describe, expect, it } from 'vitest'
import { createTrainingDisplayState } from './state'
import { LocalTrainingTransport } from './transport'

describe('training realtime transport', () => {
  it('rejects expired displayCode in local lookup by absence', async () => {
    const transport = new LocalTrainingTransport()
    await expect(transport.joinDisplay('EXPIRED')).rejects.toThrow('找不到')
  })

  it('publishes local snapshots for same-device demo', async () => {
    const display = new LocalTrainingTransport()
    const session = await display.createDisplay()
    const coach = new LocalTrainingTransport()
    await coach.joinDisplay(session.displayCode)
    const state = createTrainingDisplayState({
      sessionId: session.sessionId,
      displayId: session.displayId,
      displayCode: session.displayCode,
    })

    await expect(coach.publishSnapshot(state)).resolves.toBeUndefined()
  })
})
