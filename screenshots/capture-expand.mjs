import puppeteer from 'puppeteer'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = 'http://localhost:3000'
const wait = ms => new Promise(r => setTimeout(r, ms))

async function clickNavByText(page, text) {
  return await page.evaluate((t) => {
    const els = Array.from(document.querySelectorAll('*')).filter(
      el => el.childElementCount === 0 && el.textContent === t
    )
    for (const e of els) {
      const clickable = e.closest('[role="menuitem"], li, button, a, div')
      if (clickable) { (clickable).click(); return true }
    }
    return false
  }, text)
}

async function capture() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--window-size=1600,1000'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 2 })

  // Initial load — allow compile time
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 })
  await wait(1500)

  // ------------------------------------------------------------------
  // Screenshot A: project space L1 plan table (expand/collapse visible)
  // ------------------------------------------------------------------
  console.log('[A] Navigating to project space L1 plan')

  // Click "工作台" first to get to the dashboard
  // Then click a project card to enter project space
  // Look for "项目空间" in the nav — click a project from the list
  // Actually simplest: click first project card on workspace
  const clickedProject = await page.evaluate(() => {
    // First try sidebar / nav that enters project space: look for project cards
    const cards = Array.from(document.querySelectorAll('.ant-card'))
    for (const c of cards) {
      const text = c.textContent || ''
      // A project card typically contains a project code like X6877 or iOS
      if (text.match(/X\d{4}|iOS\d+/)) {
        const clickable = c.querySelector('button, [role="button"], .ant-card-body')
        if (clickable) { (clickable).click(); return text.slice(0, 30) }
        ;(c).click()
        return text.slice(0, 30)
      }
    }
    return null
  })
  console.log('  clicked project:', clickedProject)
  await wait(1500)

  // Navigate to 计划 inside project space
  const clickedPlan = await clickNavByText(page, '计划')
  console.log('  clicked 计划:', clickedPlan)
  await wait(1500)

  // Ensure we're on 一级计划 tab (default)
  // Ensure 竖版表格 view (default for L1)
  console.log('[A] Capturing project space L1 table')
  await page.screenshot({
    path: path.join(__dirname, 'expand-01-project-L1.png'),
    fullPage: false,
  })

  // ------------------------------------------------------------------
  // Screenshot B: config center L1 template
  // ------------------------------------------------------------------
  console.log('[B] Navigating to config center via fresh reload + top nav')

  // Go back to root
  await page.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(1200)

  // Find the top-nav menu item for 配置中心 and click it
  const clickedConfig = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.ant-menu-item, .ant-menu-submenu-title, a, button, span, div'))
    for (const it of items) {
      if (it.textContent && it.textContent.trim() === '配置中心') {
        // Walk up to find a clickable ancestor
        let el = it
        while (el && el.parentElement) {
          if (el.getAttribute('role') === 'menuitem' || el.tagName === 'A' || el.tagName === 'BUTTON' || el.classList.contains('ant-menu-item')) {
            (el).click()
            return true
          }
          el = el.parentElement
        }
        ;(it).click()
        return true
      }
    }
    return false
  })
  console.log('  clicked 配置中心:', clickedConfig)
  await wait(2000)

  console.log('[B] Capturing config center L1 template')
  await page.screenshot({
    path: path.join(__dirname, 'expand-02-config-L1.png'),
    fullPage: false,
  })

  await browser.close()
  console.log('\nDone!')
}

capture().catch(e => { console.error(e); process.exit(1) })
