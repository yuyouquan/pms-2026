#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'

// Browser regression for bookmarked demo URLs: shared data and permissions must
// match the configuration center reached from the main navigation.
const baseUrl = process.env.PMS_BASE_URL || 'http://127.0.0.1:3004'
const output = path.resolve(process.env.PMS_LEGACY_OUTPUT || 'output/audit-20260907/legacy-template-routes')
const browserPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.PMS_CHROME_EXECUTABLE || (fs.existsSync(browserPath) ? browserPath : undefined),
  args: ['--no-sandbox'],
})
fs.mkdirSync(output, { recursive: true })
const failures = []

async function clickText(page, selector, text) {
  await page.waitForFunction((selector, text) => [...document.querySelectorAll(selector)].some(element => (
    element.textContent.replace(/\s+/g, '') === text.replace(/\s+/g, '')
    && element.getBoundingClientRect().width > 0
  )), {}, selector, text)
  const clicked = await page.evaluate((selector, text) => {
    const element = [...document.querySelectorAll(selector)].find(element => (
      element.textContent.replace(/\s+/g, '') === text.replace(/\s+/g, '')
      && element.getBoundingClientRect().width > 0
    ))
    element?.click()
    return Boolean(element)
  }, selector, text)
  assert.ok(clicked, `visible ${selector}: ${text}`)
}

try {
  for (const level of ['level1', 'level2']) {
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewport({ width: 1500, height: 1050 })
    page.setDefaultTimeout(15_000)
    try {
      const response = await page.goto(`${baseUrl}/config/${level}-template`, { waitUntil: 'networkidle0' })
      assert.equal(response?.status(), 200, `${level}: bookmarked URL remains reachable`)
      assert.ok(await page.$('.pms-config-center'), `${level}: use the canonical configuration center, not an isolated demo`)
      assert.ok(await page.$('[aria-label="切换当前用户"]'), `${level}: retain the shared session and user switcher`)
      assert.equal(new URL(page.url()).pathname, '/', `${level}: normalize the old URL to the shared application`)
      assert.equal(await page.$('input.pms-edit-input'), null, `${level}: published template is read-only`)

      await page.click('.pms-config-template-toolbar [role="combobox"]')
      await page.waitForSelector('.ant-select-item-option')
      await clickText(page, '.ant-select-item-option', 'V4 (修订中)')
      await page.waitForSelector('input.pms-edit-input')
      const name = `旧入口联动验证-${level}`
      const input = await page.$('input.pms-edit-input')
      await input.click({ clickCount: 3 })
      await input.type(name)
      await page.waitForFunction(name => localStorage.getItem('pms-plan-store')?.includes(name), {}, name)

      // A full reopen discards component-local state. The saved template must
      // survive in the same store used by the other legacy URL and main entry.
      const otherLevel = level === 'level1' ? 'level2' : 'level1'
      await page.goto(`${baseUrl}/config/${otherLevel}-template`, { waitUntil: 'networkidle0' })
      await page.waitForFunction(name => [...document.querySelectorAll('input.pms-edit-input')].some(input => input.value === name), {}, name)
      await page.click('[aria-label="切换当前用户"]')
      await page.waitForSelector('.pms-user-menu__name')
      await page.evaluate(() => [...document.querySelectorAll('.pms-user-menu__name')].find(element => element.textContent === '孙七')?.closest('li')?.click())
      // Switching sessions while a draft is open uses the canonical edit guard.
      await clickText(page, '.ant-modal-footer button', '确认离开')
      await page.waitForFunction(() => document.querySelector('[aria-label="切换当前用户"]')?.getAttribute('data-current-user') === '孙七')
      await page.waitForFunction(() => !document.querySelector('input.pms-edit-input'))
      const forbidden = await page.evaluate(() => [...document.querySelectorAll('.pms-config-center button')]
        .filter(button => ['发布', '取消修订', '创建修订'].includes(button.textContent.replace(/\s+/g, '')))
        .map(button => button.textContent))
      assert.deepEqual(forbidden, [], `${level}: a viewer cannot edit or publish the shared draft`)
      assert.ok((await page.$eval('.pms-config-center', element => element.textContent)).includes(name), `${level}: viewer sees the same edited template`)
      assert.deepEqual(errors, [], `${level}: browser has no runtime errors`)
      await page.screenshot({ path: path.join(output, `${level}-shared-viewer.png`), fullPage: true })
      console.log(`PASS ${level}: shared entry, published read-only, persisted cross-route editing, viewer permission gate`)
    } catch (error) {
      failures.push(`${level}: ${error.message}`)
      await page.screenshot({ path: path.join(output, `${level}-failure.png`), fullPage: true })
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
}
fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ baseUrl, checkedAt: new Date().toISOString(), failures }, null, 2))
assert.deepEqual(failures, [], 'legacy template routes must share configuration data and permissions')
