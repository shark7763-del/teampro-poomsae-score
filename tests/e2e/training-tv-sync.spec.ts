import { expect, test } from '@playwright/test'

test('coach phone connects to training display and controls public data', async ({ browser }) => {
  const context = await browser.newContext()
  const tv = await context.newPage()
  await tv.setViewportSize({ width: 1366, height: 768 })
  await tv.goto('/#/tv')
  await expect(tv.getByText('等待教練手機連接')).toBeVisible()
  const displayCode = (await tv.locator('.tv-code').innerText()).trim()
  await tv.goto(`/#/tv/${displayCode}`)

  const phone = await context.newPage()
  await phone.setViewportSize({ width: 390, height: 844 })
  await phone.goto('/#/training')
  await phone.getByLabel('六碼代碼').fill(displayCode)
  await phone.getByRole('button', { name: '連接電視' }).click()
  await expect(phone.getByText('connected')).toBeVisible()

  await phone.getByLabel('選手姓名').fill('林品勢')
  await expect(tv.getByRole('heading', { name: '林品勢' })).toBeVisible()

  await phone.getByRole('button', { name: '小失誤 -0.1' }).click()
  await expect(tv.getByText('小失誤')).toHaveCount(0)

  await phone.getByRole('button', { name: '即時評分' }).click()
  await expect(tv.getByText('正確性')).toBeVisible()
  await expect(tv.getByText('小失誤 -0.1')).toBeVisible()
  await expect(tv.locator('.penalty-lamp').getByText('-0.1')).toBeVisible()
  await phone.getByRole('button', { name: '大失誤 -0.3' }).click()
  await expect(tv.locator('.penalty-lamp').getByText('-0.3')).toBeVisible()
  await phone.getByRole('button', { name: '重新開始' }).first().click()
  await expect(tv.getByText('待開始')).toBeVisible()

  await phone.getByRole('button', { name: '公布結果' }).click()
  await expect(tv.getByText('修正重點')).toBeVisible()

  await context.close()
})

test('private coach notes are not rendered on display route', async ({ page }) => {
  await page.goto('/#/tv')
  await expect(page.locator('body')).not.toContainText('私人筆記')
})
