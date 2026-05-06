import puppeteer from 'puppeteer'

const URL = 'http://localhost:3000'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({ headless: 'new', defaultViewport: { width: 1600, height: 1000 } })
const page = await browser.newPage()
page.on('pageerror', err => console.log('[pageerror]', err.message))

console.log('1. Open config center')
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 })
await sleep(800)
await page.evaluate(() => {
  Array.from(document.querySelectorAll('.ant-menu-item, [role="menuitem"]'))
    .find(i => i.textContent && i.textContent.trim() === '配置中心')?.click()
})
await sleep(1500)

// A. Default landing — 整机产品项目 with default V3 已发布
console.log('A. Landing (整机产品项目, V3 已发布)')
await page.screenshot({ path: 'screenshots/prd-config-landing.png', fullPage: false })
console.log('   saved screenshots/prd-config-landing.png')

// B. Open version Select to show dropdown items
console.log('B. Version dropdown opened')
const rect = await page.evaluate(() => {
  const items = Array.from(document.querySelectorAll('.ant-select'))
  const target = items.find(el => /V\d+\s*\(/.test(el.textContent || ''))
  if (!target) return null
  const r = target.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
if (rect) await page.mouse.click(rect.x, rect.y)
await sleep(700)
await page.screenshot({ path: 'screenshots/prd-config-version-dropdown.png', fullPage: false })
console.log('   saved screenshots/prd-config-version-dropdown.png')

// Switch to V4 修订中 to see edit mode
const v4Rect = await page.evaluate(() => {
  const v4 = Array.from(document.querySelectorAll('.ant-select-item-option, .ant-select-item'))
    .find(i => i.textContent && i.textContent.includes('V4'))
  if (!v4) return null
  const r = v4.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
if (v4Rect) await page.mouse.click(v4Rect.x, v4Rect.y)
await sleep(2000)

// C. Edit mode (修订中) — full edit with drag handles and add buttons visible
console.log('C. Edit mode (修订中)')
await page.evaluate(() => document.body.click())
await sleep(400)
await page.screenshot({ path: 'screenshots/prd-config-edit-mode.png', fullPage: false })
console.log('   saved screenshots/prd-config-edit-mode.png')

// D. Hover a row to show the action column delete button
console.log('D. Edit mode with hover (showing delete affordance)')
const firstRow = await page.evaluate(() => {
  const tr = document.querySelector('.pms-table-edit .ant-table-tbody tr.ant-table-row')
  if (!tr) return null
  const r = tr.getBoundingClientRect()
  return { x: r.x + 100, y: r.y + r.height / 2 }
})
if (firstRow) {
  await page.mouse.move(firstRow.x, firstRow.y)
  await sleep(500)
  await page.screenshot({ path: 'screenshots/prd-config-edit-hover.png', fullPage: false })
  console.log('   saved screenshots/prd-config-edit-hover.png')
}

// E. Click 历史版本对比 button to open compare modal
console.log('E. History version compare modal')
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent.trim() === '历史版本对比')
  btn?.click()
})
await sleep(1200)
await page.screenshot({ path: 'screenshots/prd-config-compare-modal.png', fullPage: false })
console.log('   saved screenshots/prd-config-compare-modal.png')

// F. Trigger compare with different versions to show diff result
const startBtn = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent.trim() === '开始对比')
  if (!btn) return false
  btn.click()
  return true
})
console.log('   clicked 开始对比?', startBtn)
await sleep(1500)
await page.screenshot({ path: 'screenshots/prd-config-compare-result.png', fullPage: false })
console.log('   saved screenshots/prd-config-compare-result.png')

// Close modal
await page.evaluate(() => {
  const closeBtn = Array.from(document.querySelectorAll('.ant-modal-close, button.ant-modal-close'))[0]
  closeBtn?.click()
})
await sleep(500)

// G. Switch to a different project type to show sidebar in action
console.log('G. Different project type (产品项目)')
await page.evaluate(() => {
  const items = Array.from(document.querySelectorAll('.ant-menu-item, [role="menuitem"]'))
  const item = items.find(i => i.textContent && i.textContent.trim() === '产品项目')
  if (item) item.click()
})
await sleep(1000)
await page.screenshot({ path: 'screenshots/prd-config-other-type.png', fullPage: false })
console.log('   saved screenshots/prd-config-other-type.png')

await browser.close()
console.log('done')
