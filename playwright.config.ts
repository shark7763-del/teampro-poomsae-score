import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    /*
     * 單裝置版面測試：每個檔案在兩種尺寸各跑一次。
     * 多裝置測試自己開 context 並指定尺寸，跑兩次只會重複污染資料庫，所以排除。
     */
    {
      name: 'phone-390',
      testIgnore: /multi-device/,
      use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'tv-1366',
      testIgnore: /multi-device/,
      use: { viewport: { width: 1366, height: 768 } },
    },
    {
      name: 'multi-device',
      testMatch: /multi-device/,
      use: { viewport: { width: 1366, height: 768 } },
    },
  ],
})
