import assert from 'node:assert/strict'
import fs from 'node:fs'
import puppeteer from 'puppeteer'

const baseUrl = process.env.PMS_BASE_URL || 'http://127.0.0.1:3034'
const output = process.env.PMS_BROWSER_OUTPUT || 'output/playwright/roadmap-row-height'
fs.mkdirSync(output, { recursive: true })
const browser = await puppeteer.launch({ headless: true })
const page = await browser.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
const measurements = []
const header = key => `.roadmap-table th[data-project-list-header-id="roadmap::${key}"]`
const measure = () => page.$eval('.roadmap-table', table => ({
  headerHeight: table.querySelector('thead tr').getBoundingClientRect().height,
  rows: [...table.querySelectorAll('tbody tr[data-row-key]')].map(row => ({
    key: row.dataset.rowKey, height: row.getBoundingClientRect().height,
  })),
}))
function assertStable(before, after, step) {
  assert.ok(Math.abs(after.headerHeight - before.headerHeight) < 0.5, `${step}: header height ${before.headerHeight} → ${after.headerHeight}`)
  assert.deepEqual(after.rows.map(row => row.key), before.rows.map(row => row.key))
  for (let index = 0; index < before.rows.length; index++) {
    assert.ok(Math.abs(after.rows[index].height - before.rows[index].height) < 0.5,
      `${step}: row ${before.rows[index].key} height ${before.rows[index].height} → ${after.rows[index].height}`)
  }
}
async function resize(key, width) {
  const before = await measure()
  const control = await page.$(`${header(key)} [role="separator"]`)
  await control.scrollIntoView()
  const box = await control.boundingBox()
  const oldWidth = await page.$eval(header(key), cell => cell.getBoundingClientRect().width)
  await page.mouse.move(box.x + 3, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 3 + width - oldWidth, box.y + box.height / 2, { steps: 12 })
  // AntD distributes spare viewport space when all columns fit; verify shrinkage,
  // not an exact rendered width that would depend on that distribution.
  await page.waitForFunction((selector, previous) => document.querySelector(selector).getBoundingClientRect().width < previous - 0.5, {}, header(key), oldWidth)
  const during = await measure()
  await page.mouse.up()
  const after = await measure()
  measurements.push({ key, width, before, during, after })
  assertStable(before, during, `resizing ${key}`)
  assertStable(before, after, `after resizing ${key}`)
}
try {
  await page.setViewport({ width: 1600, height: 1000 })
  await page.goto(baseUrl, { waitUntil: 'networkidle0' })
  await page.$$eval('[role="menuitem"]', elements => elements.find(element => element.textContent.trim() === 'tOS路标').click())
  await page.waitForSelector('.roadmap-table tbody tr[data-row-key]')
  await page.screenshot({ path: `${output}/before.png`, fullPage: true })
  for (const key of ['brand', 'marketName', 'displayName', 'chipCode', 'str5Date', 'launchDate', 'remark']) {
    await resize(key, 80)
  }
  const beforeReorder = await measure()
  const brand = await page.$(header('brand'))
  await brand.scrollIntoView()
  const source = await brand.boundingBox()
  const target = await (await page.$(header('marketName'))).boundingBox()
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 })
  await page.waitForSelector(`${header('brand')}[data-project-list-unit-placeholder="true"]`)
  assertStable(beforeReorder, await measure(), 'reordering columns')
  await page.mouse.up()
  await page.waitForFunction(() => !document.querySelector('[data-project-list-unit-placeholder="true"]'))
  assertStable(beforeReorder, await measure(), 'after reordering columns')
  const beforeReload = await measure()
  await page.reload({ waitUntil: 'networkidle0' })
  await page.$$eval('[role="menuitem"]', elements => elements.find(element => element.textContent.trim() === 'tOS路标').click())
  await page.waitForSelector('.roadmap-table tbody tr[data-row-key]')
  assertStable(beforeReload, await measure(), 'persisted narrow columns')
  await page.setViewport({ width: 736, height: 1000 })
  assertStable(beforeReload, await measure(), 'narrow viewport with horizontal scrolling')
  await page.setViewport({ width: 1600, height: 1000 })
  await page.screenshot({ path: `${output}/after.png`, fullPage: true })
  assert.deepEqual(errors, [])
  fs.writeFileSync(`${output}/results.json`, JSON.stringify({ baseUrl, measurements, errors }, null, 2))
  console.log('PASS roadmap row/header heights remain stable during resize, reorder, refresh and narrow viewport')
} catch (error) {
  fs.writeFileSync(`${output}/failure.json`, JSON.stringify({ measurements, errors }, null, 2))
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true })
  throw error
} finally {
  await browser.close()
}
