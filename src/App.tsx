import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { ControlEntryPage, ControlPage, DisplayPage, JudgePage } from './pages/RoomPages'
import { TrainingPage } from './pages/TrainingPage'

export function App(): React.ReactElement {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ControlEntryPage />} />
        <Route path="/control" element={<ControlEntryPage />} />
        <Route path="/control/:roomCode" element={<ControlPage />} />
        <Route path="/judge/:roomCode/:slot" element={<JudgePage />} />
        <Route path="/display/:roomCode" element={<DisplayPage />} />
        <Route path="/training" element={<TrainingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
