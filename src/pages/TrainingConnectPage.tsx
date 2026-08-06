import { useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import { AppLogo } from '../components/AppLogo'
import { Button, Notice, Panel, TextField } from '../components/ui'
import { useTrainingController } from '../training/useTrainingRealtime'

export function TrainingConnectPage(): React.ReactElement {
  const { displayCode } = useParams()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('sessionId') ?? undefined
  const normalizedCode = useMemo(() => displayCode?.toUpperCase() ?? '', [displayCode])
  const controller = useTrainingController(sessionId)
  const [displayName, setDisplayName] = useState('TeamPro 訓練顯示器')
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(false)

  if (!displayCode) return <Navigate to="/training" replace />

  async function connect(): Promise<void> {
    try {
      setError('')
      await controller.connectDisplay(normalizedCode)
      controller.renameDisplay(displayName)
      setConnected(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '連接失敗')
    }
  }

  return (
    <main className="page-shell">
      <section className="hero-row">
        <div>
          <AppLogo />
          <h1>連接訓練電視</h1>
          <p className="subtitle">顯示器代碼 {normalizedCode}</p>
        </div>
      </section>
      {error ? <Notice>{error}</Notice> : null}
      <Panel title="配對">
        <div className="setup-grid">
          <TextField label="顯示器名稱" value={displayName} onChange={setDisplayName} />
          <div className="button-row align-end">
            <Button onClick={() => void connect()}>連接</Button>
            {connected ? (
              <Link className="primary-link" to={`/training/session/${sessionId ?? controller.session.state.sessionId}`}>
                進入訓練控制
              </Link>
            ) : null}
          </div>
        </div>
      </Panel>
      <Notice>名稱會保存在手機最近使用顯示器清單中，不會保存任何管理者密鑰。</Notice>
    </main>
  )
}
