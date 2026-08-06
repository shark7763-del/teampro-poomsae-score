import { HashRouter, Route, Routes } from 'react-router'
import { HomePage } from './pages/HomePage'
import { ControlEntryPage, ControlPage, DisplayPage, JudgePage } from './pages/PoomsaeRoomPages'

/**
 * 使用 HashRouter：
 * 部署在 GitHub Pages 這類靜態主機時，`/display/ABC123` 這種深層網址
 * 直接重新整理會 404。改用 `#/display/ABC123` 可確保電視、裁判手機
 * 從 QR Code 開啟或重新整理時都不會失敗。
 */
export function App(): React.ReactElement {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ControlEntryPage />} />
        <Route path="/training" element={<HomePage />} />
        <Route path="/control" element={<ControlEntryPage />} />
        <Route path="/control/:roomCode" element={<ControlPage />} />
        <Route path="/judge/:roomCode/:slot" element={<JudgePage />} />
        <Route path="/display/:roomCode" element={<DisplayPage />} />
        <Route path="*" element={<ControlEntryPage />} />
      </Routes>
    </HashRouter>
  )
}
