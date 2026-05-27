// 抓转维配置中心的版本对比 modal 截图
import puppeteer from 'puppeteer'

const URL = 'http://localhost:3001'
const OUT = '/Users/shswyuyouquan/Documents/work/transfer-maintenance-flow/docs/screenshots/prd-pms-integration'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({ headless: 'new', defaultViewport: { width: 1600, height: 1000 } })
const page = await browser.newPage()
page.on('pageerror', err => console.log('[pageerror]', err.message))

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })
  console.log(`  ✓ ${name}.png`)
}

console.log('1. 进入 /config/checklist')
await page.goto(`${URL}/config/checklist`, { waitUntil: 'networkidle0', timeout: 30000 })
await sleep(1500)

console.log('2. 点击 版本对比 按钮')
await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'))
  const btn = btns.find(b => (b.textContent || '').includes('版本对比'))
  btn?.click()
})
await sleep(800)

console.log('3. 点击 开始对比 按钮')
await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'))
  const btn = btns.find(b => (b.textContent || '').includes('开始对比'))
  btn?.click()
})
await sleep(1000)

await shot('13-version-compare-impl')

await browser.close()
console.log('完成')
