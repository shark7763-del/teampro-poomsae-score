/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/** GitHub Pages project path; local dev keeps the root path. */
const BASE = '/teampro-poomsae-score/'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? BASE : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'teampro-poomsae-coach-logo.png',
        'favicon-v2-32.png',
        'favicon-v2-64.png',
        'favicon-v2-180.png',
        'icons/poomsae-coach-v2-apple-touch.png',
      ],
      manifest: {
        name: 'TeamPro Poomsae Score',
        short_name: '品勢計分',
        description:
          'TeamPro 跆拳道品勢計分系統：公認品勢計分、訓練賽與模擬賽輔助。非 WT 認證競賽設備。',
        lang: 'zh-Hant-TW',
        dir: 'ltr',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'any',
        background_color: '#05070c',
        theme_color: '#05070c',
        categories: ['sports', 'utilities'],
        // 檔名的 v2 對應 scripts/generate-icons.mjs 的 VERSION，換圖示時一起加一號才吃得到
        icons: [
          {
            src: 'icons/poomsae-coach-v2-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/poomsae-coach-v2-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            // maskable 版留了 14% 安全區，Android 圓形遮罩才不會把下面的字裁掉
            src: 'icons/poomsae-coach-v2-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: `${BASE}index.html`,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: true, // 讓同網段的電視／平板／裁判手機可以連進來
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    /*
     * Tests use the local demo transport only; real realtime backends belong to
     * adapter-specific integration tests.
     */
    env: {
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
    },
    coverage: {
      provider: 'v8',
      include: ['src/rules/**', 'src/timer/**', 'src/match/**', 'src/pairing/**'],
    },
  },
}))
