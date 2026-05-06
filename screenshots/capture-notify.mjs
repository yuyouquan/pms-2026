import puppeteer from 'puppeteer'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = 'http://localhost:3000'
const wait = ms => new Promise(r => setTimeout(r, ms))

async function clickByText(page, text, selector = '*') {
  return await page.evaluate(({ t, sel }) => {
    const els = Array.from(document.querySelectorAll(sel)).filter(
      el => el.childElementCount === 0 && el.textContent?.trim() === t
    )
    for (const e of els) {
      const clickable = e.closest('[role="menuitem"], li, button, a, div')
      if (clickable) { (clickable).click(); return true }
    }
    return false
  }, { t: text, sel: selector })
}

async function capture() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--window-size=1600,1000'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 2 })

  // ------------------------------------------------------------------
  // Navigate to project space → first project → 计划
  // ------------------------------------------------------------------
  console.log('[nav] Loading root + entering project')
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 })
  await wait(1500)

  // Click first project card
  await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.ant-card'))
    for (const c of cards) {
      if (/X\d{4}|iOS\d+/.test(c.textContent || '')) { (c).click(); return }
    }
  })
  await wait(1500)

  // Click 计划 sidebar item
  console.log('[nav] Clicking 计划 sidebar')
  await clickByText(page, '计划')
  await wait(2500)  // give due-check effect time to run + notification to render

  // ------------------------------------------------------------------
  // Screenshot 1: due notification (fired automatically on L1 entry)
  // ------------------------------------------------------------------
  console.log('[1] Capturing due notification')
  await page.screenshot({
    path: path.join(__dirname, 'notify-01-due.png'),
    fullPage: false,
  })

  // Dismiss any open notification
  await page.evaluate(() => {
    document.querySelectorAll('.ant-notification-notice-close').forEach(b => (b).click())
  })
  await wait(800)

  // ------------------------------------------------------------------
  // Enter revision mode + modify a task + publish
  // ------------------------------------------------------------------
  console.log('[edit] Clicking 创建修订')
  const entered = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    for (const b of btns) {
      if (b.textContent?.trim() === '创建修订') { (b).click(); return true }
    }
    return false
  })
  console.log('  entered revision:', entered)
  await wait(1500)

  // Modify the first visible editable text input (likely task name) in the table
  console.log('[edit] Modifying first task name')
  const modified = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('.ant-table input.ant-input, .ant-table input.pms-edit-input'))
    if (inputs.length === 0) return 'no-inputs'
    const el = inputs[0]
    el.focus()
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, '概念启动(已修改)')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.blur()
    return 'ok'
  })
  console.log('  modify:', modified)
  await wait(800)

  // Click 发布 button
  console.log('[edit] Clicking 发布')
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    for (const b of btns) {
      if (b.textContent?.trim() === '发布') { (b).click(); return }
    }
  })
  await wait(1800)  // wait for notification.info to render

  // ------------------------------------------------------------------
  // Screenshot 2: publish notification
  // ------------------------------------------------------------------
  console.log('[2] Capturing publish notification')
  await page.screenshot({
    path: path.join(__dirname, 'notify-02-publish.png'),
    fullPage: false,
  })

  await browser.close()
  console.log('\nDone — 2 screenshots saved')
}

capture().catch(e => { console.error(e); process.exit(1) })
