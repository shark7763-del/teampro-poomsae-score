import { useState } from 'react'
import { TvUrlHint } from '../components/TvUrlHint'
import { Button, Notice, Panel, TextField } from '../components/ui'
import { Calculator } from './shared/Calculator'
import { TrainingControllerPage } from './TrainingControllerPage'

export function TrainingPage(): React.ReactElement {
  const [mode, setMode] = useState<'score' | 'tv'>('score')
  const [displayCode, setDisplayCode] = useState('')

  if (mode === 'tv') {
    return (
      <>
        <div className="safe-area mx-auto w-full max-w-6xl p-3 sm:p-4">
          <div className="button-row">
            <Button tone="secondary" onClick={() => setMode('score')}>
              回到單機計分
            </Button>
          </div>
        </div>
        <TrainingControllerPage initialDisplayCode={displayCode} autoConnect={displayCode.length > 0} />
      </>
    )
  }

  return (
    <>
      <div className="safe-area mx-auto w-full max-w-6xl p-3 pb-0 sm:p-4 sm:pb-0">
        <Notice>目前預設為可直接使用的單機計分；跨裝置電視同步需要 Supabase 設定完成後再使用。</Notice>
        <Panel title="快速連接電視">
          <TvUrlHint />
          <div className="setup-grid">
            <TextField label="六碼代碼" value={displayCode} onChange={(value) => setDisplayCode(value.toUpperCase())} />
            <div className="button-row align-end">
              <Button onClick={() => setMode('tv')}>連接電視</Button>
            </div>
          </div>
        </Panel>
        <div className="button-row mt-3">
          <Button onClick={() => setMode('score')}>單機計分</Button>
          <Button tone="secondary" onClick={() => setMode('tv')}>
            連接訓練電視
          </Button>
        </div>
      </div>
      <Calculator />
    </>
  )
}
