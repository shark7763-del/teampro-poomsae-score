import { HashRouter, Route, Routes } from 'react-router'
import { HomePage } from './pages/HomePage'

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
        <Route path="/" element={<HomePage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </HashRouter>
  )
}
