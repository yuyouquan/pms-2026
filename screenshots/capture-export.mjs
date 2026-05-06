import puppeteer from 'puppeteer'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = 'http://localhost:3005'
const wait = ms => new Promise(r => setTimeout(r, ms))

async function clickMenuItemByText(page, text) {
  const items = await page.$$('.ant-menu-item')
  for (const i of items) {
    const t = await page.evaluate(el => el.textContent, i)
    if (t && t.includes(text)) { await i.click(); return true }
  }
  return false
}

async function hoverDownloadButton(page) {
  const pos = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    for (const b of btns) {
      if (b.querySelector('.anticon-download')) {
        const rect = b.getBoundingClientRect()
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
      }
    }
    return null
  })
  if (!pos) {
    console.warn('  [warn] download button not found')
    return false
  }
  await page.mouse.move(pos.x, pos.y)
  await wait(400)
  await page.mouse.move(pos.x + 1, pos.y + 1)
  await wait(1200)
  return true
}

async function capture() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--window-size=1600,1000'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 2 })

  // ------------------------------------------------------------------
  // Screenshot 1: 项目路标视图（里程碑）导出 Dropdown 展开
  // ------------------------------------------------------------------
  console.log('[1] Roadmap (Milestone) export dropdown')
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 })
  await wait(1500)

  const navOk = await clickMenuItemByText(page, '路标')
  console.log('  nav to roadmap:', navOk)
  await wait(1800)

  await hoverDownloadButton(page)
  await page.screenshot({
    path: path.join(__dirname, 'export-01-roadmap-milestone.png'),
    fullPage: false,
  })
  console.log('  saved: export-01-roadmap-milestone.png')

  await page.mouse.move(0, 0)
  await wait(500)

  // ------------------------------------------------------------------
  // Screenshot 2: 项目空间 一级计划 竖版表格 导出 Dropdown
  // ------------------------------------------------------------------
  console.log('[2] Project space L1 vertical table export dropdown')
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 })
  await wait(1500)

  // Click first project card (workspace landing page)
  await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.ant-card'))
    for (const c of cards) {
      if (/X\d{4}|tOS\d+/.test(c.textContent || '')) { c.click(); return }
    }
  })
  await wait(1800)

  // Click 计划 sidebar item (inside project space sidebar — left vertical menu)
  const planOk = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.ant-menu-item, [role="menuitem"]'))
    for (const i of items) {
      if (i.textContent?.trim() === '计划') { i.click(); return true }
    }
    return false
  })
  console.log('  nav to plan:', planOk)
  await wait(2500)

  // Dismiss any due-notifications
  await page.evaluate(() => {
    document.querySelectorAll('.ant-notification-notice-close').forEach(b => b.click())
  })
  await wait(500)

  await hoverDownloadButton(page)
  await page.screenshot({
    path: path.join(__dirname, 'export-02-project-vertical.png'),
    fullPage: false,
  })
  console.log('  saved: export-02-project-vertical.png')

  await page.mouse.move(0, 0)
  await wait(500)

  // ------------------------------------------------------------------
  // Screenshot 3: 项目空间 一级计划 横版表格 导出 Dropdown
  // ------------------------------------------------------------------
  console.log('[3] Project space L1 horizontal table export dropdown')

  // Switch viewMode to 横版表格 via Radio.Group
  const switched = await page.evaluate(() => {
    const radios = Array.from(document.querySelectorAll('label.ant-radio-button-wrapper'))
    for (const r of radios) {
      if (r.textContent?.trim() === '横版表格') { r.click(); return true }
    }
    return false
  })
  console.log('  switched to horizontal:', switched)
  await wait(1500)

  await hoverDownloadButton(page)
  await page.screenshot({
    path: path.join(__dirname, 'export-03-project-horizontal.png'),
    fullPage: false,
  })
  console.log('  saved: export-03-project-horizontal.png')

  await browser.close()
  console.log('[done]')
}

capture().catch(err => {
  console.error(err)
  process.exit(1)
})
