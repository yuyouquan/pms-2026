import puppeteer from 'puppeteer'

const URL = 'http://localhost:3000'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({ headless: 'new', defaultViewport: { width: 1600, height: 1000 } })
const page = await browser.newPage()
page.on('pageerror', err => console.log('[pageerror]', err.message))

// ============== A. Workspace with Todo Center ==============
console.log('A. Workspace + Todo Center')
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 })
await sleep(800)
await page.screenshot({ path: 'screenshots/prd-todo-center.png', fullPage: false })
console.log('   saved screenshots/prd-todo-center.png')

// ============== B. Plan view with validation red cells ==============
console.log('B. Plan view with validation')
await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('[class*="ant-card"]'))
  cards.find(c => c.textContent && c.textContent.includes('X6877-D8400_H991'))?.click()
})
await sleep(800)
await page.evaluate(() => {
  Array.from(document.querySelectorAll('.ant-menu-item, [role="menuitem"]'))
    .find(i => i.textContent && i.textContent.trim() === '计划')?.click()
})
await sleep(800)

// Switch to V4 (修订中)
const rect = await page.evaluate(() => {
  const items = Array.from(document.querySelectorAll('.ant-select'))
  const target = items.find(el => /V\d+\s*\(/.test(el.textContent || ''))
  if (!target) return null
  const r = target.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
if (rect) await page.mouse.click(rect.x, rect.y)
await sleep(500)
const v4Rect = await page.evaluate(() => {
  const v4 = Array.from(document.querySelectorAll('.ant-select-item-option, .ant-select-item'))
    .find(i => i.textContent && i.textContent.includes('V4'))
  if (!v4) return null
  const r = v4.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
if (v4Rect) await page.mouse.click(v4Rect.x, v4Rect.y)
await sleep(2000)

// Edit 概念 (id=1) planStartDate to 2026-01-25 to trigger validation
await page.click('.pms-table .ant-table-tbody tr[data-row-key="1"] .ant-picker input', { clickCount: 3 })
await sleep(300)
await page.keyboard.press('Backspace')
await page.keyboard.type('2026-01-25')
await sleep(200)
await page.keyboard.press('Enter')
await sleep(800)

// Click somewhere else to deselect
await page.evaluate(() => document.body.click())
await sleep(500)

await page.screenshot({ path: 'screenshots/prd-plan-validation.png', fullPage: false })
console.log('   saved screenshots/prd-plan-validation.png')

// Hover the invalid cell to capture tooltip
const startCell = await page.evaluate(() => {
  const td = document.querySelector('.pms-table .ant-table-tbody tr[data-row-key="1"] td.pms-cell-invalid')
  if (!td) return null
  const r = td.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
if (startCell) {
  await page.mouse.move(0, 0)
  await sleep(150)
  await page.mouse.move(startCell.x, startCell.y, { steps: 12 })
  await sleep(1500)
  await page.screenshot({ path: 'screenshots/prd-plan-validation-tooltip.png', fullPage: false })
  console.log('   saved screenshots/prd-plan-validation-tooltip.png')
}

// ============== C. Switch to a non-responsible user to show locked draft ==============
console.log('C. Non-permission + non-responsible state (read-only)')
// Switch user via UserSwitcher dropdown to 杜甫 (not responsible for X6877 V4 tasks)
await page.evaluate(() => {
  const avatar = Array.from(document.querySelectorAll('[class*="ant-avatar"]'))
    .find(a => a.parentElement?.textContent?.includes('张三') || a.parentElement?.textContent?.includes('管理组'))
  if (avatar) avatar.parentElement?.click()
})
await sleep(500)
// Try direct click on UserSwitcher avatar area
await page.evaluate(() => {
  const switchers = Array.from(document.querySelectorAll('div'))
    .filter(d => d.textContent && /管理组|张三/.test(d.textContent) && d.querySelector('.ant-avatar'))
  if (switchers.length) {
    const last = switchers[switchers.length - 1]
    last.click()
  }
})
await sleep(800)
await page.screenshot({ path: '/tmp/dropdown-state.png', fullPage: false })

// Click 杜甫 in dropdown
const duFuClicked = await page.evaluate(() => {
  const items = Array.from(document.querySelectorAll('.ant-dropdown-menu-item, [role="menuitem"]'))
  const duFu = items.find(i => i.textContent && i.textContent.includes('杜甫'))
  if (duFu) { duFu.click(); return true }
  return false
})
console.log('   clicked 杜甫?', duFuClicked)
await sleep(1500)
await page.screenshot({ path: 'screenshots/prd-readonly-user.png', fullPage: false })
console.log('   saved screenshots/prd-readonly-user.png')

await browser.close()
console.log('done')
