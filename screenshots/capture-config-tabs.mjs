// 抓配置中心 转维材料配置 + 评审要素配置 两个 tab 截图
import puppeteer from 'puppeteer'

const URL = 'http://localhost:3000'
const OUT = '/Users/shswyuyouquan/Documents/work/transfer-maintenance-flow/docs/screenshots/prd-pms-integration'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({ headless: 'new', defaultViewport: { width: 1600, height: 1000 } })
const page = await browser.newPage()
page.on('pageerror', err => console.log('[pageerror]', err.message))

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })
  console.log(`  ✓ ${name}.png`)
}

const clickByText = async (text) => {
  return page.evaluate((t) => {
    const els = Array.from(document.querySelectorAll('button, a, .ant-menu-item, [role="menuitem"], .ant-tabs-tab'))
    const el = els.find(x => (x.textContent || '').trim().includes(t))
    if (!el) return false
    el.click()
    return true
  }, text)
}

console.log('1. 进入配置中心')
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 })
await sleep(800)
await clickByText('配置中心')
await sleep(1500)
await clickByText('转维材料模板配置')
await sleep(1500)

console.log('2. 转维材料配置 - 点击「管理」')
// "转维材料配置" 卡片的「管理」按钮
await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('.ant-card'))
  const card = cards.find(c => (c.textContent || '').includes('转维材料配置'))
  if (card) {
    const btn = card.querySelector('button')
    btn?.click()
  }
})
await sleep(1500)
await shot('10-config-checklist-template')

console.log('3. 返回配置中心首页')
// 点击 Breadcrumb 配置中心
await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll('.ant-breadcrumb a'))
  const link = links.find(a => (a.textContent || '').includes('配置中心'))
  link?.click()
})
await sleep(1200)

console.log('4. 评审要素配置 - 点击「管理」')
await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('.ant-card'))
  const card = cards.find(c => (c.textContent || '').includes('评审要素配置'))
  if (card) {
    const btn = card.querySelector('button')
    btn?.click()
  }
})
await sleep(1500)
await shot('11-config-review-element-template')

await browser.close()
console.log('\n完成')
