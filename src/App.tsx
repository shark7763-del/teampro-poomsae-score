import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { ControlEntryPage, ControlPage, DisplayPage, JudgePage } from './pages/RoomPages'
import { TrainingConnectPage } from './pages/TrainingConnectPage'
import { TrainingControllerPage } from './pages/TrainingControllerPage'
import { TrainingDisplayPage } from './pages/TrainingDisplayPage'
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
        <Route path="/training/session/:sessionId" element={<TrainingControllerPage />} />
        <Route path="/training/connect/:displayCode" element={<TrainingConnectPage />} />
        <Route path="/training-display" element={<TrainingDisplayPage />} />
        <Route path="/training-display/:displayCode" element={<TrainingDisplayPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
