import { expect, test, type Browser, type Page } from '@playwright/test'

/**
 * 兩個場地同時運作的跨裝置測試。
 *
 * 關鍵在於**每台裝置都用獨立的 browser context**。
 * 同一個 context 下的分頁共用 origin 的 BroadcastChannel 與 localStorage，
 * 所以就算 realtime 完全沒接上，測試也會過 —— 那正是舊 E2E 的盲點。
 * 獨立 context 之間唯一的溝通管道只剩 Supabase。
 *
 * 需要 .env 內有 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，
 * 否則 app 會退回本機模式，這個測試就會（正確地）失敗。
 */

const SYNC_TIMEOUT = 20_000

/** 開一台獨立裝置。 */
async function openDevice(
  browser: Browser,
  viewport: { width: number; height: number },
): Promise<Page> {
  const context = await browser.newContext({ viewport })
  return context.newPage()
}

/** 電視開 /tv，取得自己的六碼，然後進入顯示畫面。 */
async function bootDisplay(tv: Page): Promise<string> {
  await tv.goto('/#/tv')
  await expect(tv.locator('.tv-code')).toBeVisible({ timeout: SYNC_TIMEOUT })
  const code = (await tv.locator('.tv-code').innerText()).trim()
  await tv.goto(`/#/tv/${code}`)
  return code
}

/** 教練手機連上指定場地並命名。 */
async function connectCoach(phone: Page, code: string, venueName: string): Promise<void> {
  await phone.goto('/#/training')
  await phone.getByLabel('六碼代碼').fill(code)
  await phone.getByRole('button', { name: '連接電視' }).first().click()

  /*
   * 一定要等真的連上才命名。
   * 連線完成前手機用的還是自己的 sessionId，電視會丟棄那些事件，
   * 而且 connectDisplay 完成時會用電視端名稱覆蓋回來，打的字會無聲消失。
   */
  await expect(phone.locator('.connection-dot.online')).toBeVisible({ timeout: SYNC_TIMEOUT })
  await phone.getByLabel('場地名稱（電視上會顯示）').fill(venueName)
}

test('two venues run side by side without leaking into each other', async ({ browser }) => {
  const tvA = await openDevice(browser, { width: 1366, height: 768 })
  const tvB = await openDevice(browser, { width: 1366, height: 768 })

  const codeA = await bootDisplay(tvA)
  const codeB = await bootDisplay(tvB)

  // 兩台各自建立顯示器，代碼必須不同，否則兩個場地會共用同一場
  expect(codeA).not.toBe(codeB)

  const phoneA = await openDevice(browser, { width: 390, height: 844 })
  const phoneB = await openDevice(browser, { width: 390, height: 844 })

  await connectCoach(phoneA, codeA, 'A 場地')
  await connectCoach(phoneB, codeB, 'B 場地')

  // 場地名稱要真的傳到各自的電視上
  await expect(tvA.getByText('A 場地')).toBeVisible({ timeout: SYNC_TIMEOUT })
  await expect(tvB.getByText('B 場地')).toBeVisible({ timeout: SYNC_TIMEOUT })

  await phoneA.getByLabel('選手姓名').fill('王小明')
  await expect(tvA.getByRole('heading', { name: '王小明' })).toBeVisible({ timeout: SYNC_TIMEOUT })
  // 這一行是整個測試的重點：A 場地的選手絕不能出現在 B 場地的電視上
  await expect(tvB.getByText('王小明')).toHaveCount(0)

  await phoneB.getByLabel('選手姓名').fill('陳小華')
  await expect(tvB.getByRole('heading', { name: '陳小華' })).toBeVisible({ timeout: SYNC_TIMEOUT })
  await expect(tvA.getByText('陳小華')).toHaveCount(0)

  // A 場地扣分只影響 A 場地
  await phoneA.getByRole('button', { name: '即時評分' }).click()
  // 精確比對：寬鬆的 /小失誤/ 會同時命中「復原小失誤」
  await phoneA.getByRole('button', { name: '小失誤 -0.1', exact: true }).click()
  await expect(tvA.locator('.penalty-lamp')).toBeVisible({ timeout: SYNC_TIMEOUT })
  await expect(tvB.locator('.penalty-lamp')).toHaveCount(0)

  await Promise.all([
    tvA.context().close(),
    tvB.context().close(),
    phoneA.context().close(),
    phoneB.context().close(),
  ])
})

test('a reloading TV keeps its own code so the phone stays paired', async ({ browser }) => {
  const tv = await openDevice(browser, { width: 1366, height: 768 })

  await tv.goto('/#/tv')
  await expect(tv.locator('.tv-code')).toBeVisible({ timeout: SYNC_TIMEOUT })
  const first = (await tv.locator('.tv-code').innerText()).trim()

  // 停在等待畫面時重整：以前每次都會 createDisplay() 換一組新碼，把手機配對弄斷
  await tv.reload()
  await expect(tv.locator('.tv-code')).toBeVisible({ timeout: SYNC_TIMEOUT })
  const second = (await tv.locator('.tv-code').innerText()).trim()

  expect(second).toBe(first)

  await tv.context().close()
})

test('cross-device sync is actually configured', async ({ browser }) => {
  const tv = await openDevice(browser, { width: 1366, height: 768 })
  await tv.goto('/#/tv')
  await expect(tv.locator('.tv-code')).toBeVisible({ timeout: SYNC_TIMEOUT })

  /*
   * 本機模式會顯示這段警告。它出現代表沒有 Supabase 憑證，
   * 上面兩個測試即使通過也不能證明跨裝置真的會通。
   */
  await expect(tv.getByText('本機測試模式', { exact: false })).toHaveCount(0)

  await tv.context().close()
})
