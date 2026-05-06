import puppeteer from 'puppeteer'

const URL = 'http://localhost:3000'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({ headless: 'new', defaultViewport: { width: 1800, height: 1100 } })
const page = await browser.newPage()
page.on('pageerror', err => console.log('[pageerror]', err.message))

console.log('Open workspace tracker tab')
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 })
await sleep(800)

// Click "工作跟踪" tab in workspace
const tabClicked = await page.evaluate(() => {
  const tabs = Array.from(document.querySelectorAll('button, span, div'))
  const tab = tabs.find(t => t.textContent && t.textContent.trim() === '工作跟踪')
  if (tab) { tab.click(); return true }
  return false
})
console.log('  clicked 工作跟踪?', tabClicked)
await sleep(1500)

await page.screenshot({ path: 'screenshots/prd-work-tracker.png', fullPage: false })
console.log('saved screenshots/prd-work-tracker.png')

// Open the actual-time modal too
const actualBtn = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'))
  const btn = btns.find(b => b.textContent.trim() === '实际时间')
  if (btn) { btn.click(); return true }
  return false
})
console.log('  opened actual-time modal?', actualBtn)
await sleep(1000)
await page.screenshot({ path: 'screenshots/prd-work-tracker-actual-modal.png', fullPage: false })
console.log('saved screenshots/prd-work-tracker-actual-modal.png')

await browser.close()
console.log('done')
