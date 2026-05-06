import puppeteer from 'puppeteer'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = 'http://localhost:3004'
const wait = ms => new Promise(r => setTimeout(r, ms))

async function capture() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1440,900'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })

  // === 1. Version Compare Screenshot ===
  await page.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(500)

  // Enter project X6877
  const allCards = await page.$$('.ant-card')
  for (const card of allCards) {
    const t = await page.evaluate(el => el.textContent, card)
    if (t && t.includes('X6877')) { await card.click(); break }
  }
  await wait(1000)

  // Click "计划" in sidebar
  let menuItems = await page.$$('.ant-menu-item')
  for (const item of menuItems) {
    const t = await page.evaluate(el => el.textContent, item)
    if (t && t.includes('计划')) { await item.click(); break }
  }
  await wait(800)

  // Click "版本对比" button
  let buttons = await page.$$('.ant-btn')
  for (const btn of buttons) {
    const t = await page.evaluate(el => el.textContent, btn)
    if (t && t.includes('版本对比')) { await btn.click(); break }
  }
  await wait(500)

  // In the modal, click "开始对比"
  buttons = await page.$$('.ant-btn')
  for (const btn of buttons) {
    const t = await page.evaluate(el => el.textContent, btn)
    if (t && t.includes('开始对比')) { await btn.click(); break }
  }
  await wait(800)

  console.log('Capturing: version compare modal')
  await page.screenshot({ path: path.join(__dirname, 'v1-version-compare.png') })
  console.log('  -> saved')

  // Close modal
  const closeBtn = await page.$('.ant-modal-close')
  if (closeBtn) await closeBtn.click()
  await wait(300)

  // === 2. Config Center - L1 Plan Config ===
  await page.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(500)

  // Click "配置中心" in header nav
  menuItems = await page.$$('.ant-menu-item')
  for (const item of menuItems) {
    const t = await page.evaluate(el => el.textContent, item)
    if (t && t.includes('配置中心')) { await item.click(); break }
  }
  await wait(800)

  console.log('Capturing: config center - plan tab')
  await page.screenshot({ path: path.join(__dirname, 'v1-config-plan-overview.png') })
  console.log('  -> saved')

  // Click on a different project type in sidebar if possible
  menuItems = await page.$$('.ant-menu-item')
  for (const item of menuItems) {
    const t = await page.evaluate(el => el.textContent, item)
    if (t && t.includes('整机产品项目')) { await item.click(); break }
  }
  await wait(800)

  console.log('Capturing: config center - whole machine type')
  await page.screenshot({ path: path.join(__dirname, 'v1-config-plan-machine.png') })
  console.log('  -> saved')

  await browser.close()
  console.log('\nDone!')
}

capture().catch(e => { console.error(e); process.exit(1) })
