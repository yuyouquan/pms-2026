import puppeteer from 'puppeteer'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = 'http://localhost:3000'
const wait = ms => new Promise(r => setTimeout(r, ms))

async function gotoRoadmap(page) {
  await page.goto(BASE + '/?demo=compare', { waitUntil: 'networkidle2' })
  await wait(800)
  // Click "项目路标视图" via header nav
  const clicked = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('*')).filter(el =>
      el.childElementCount === 0 && el.textContent === '项目路标视图'
    )
    for (const n of nodes) {
      const clickable = n.closest('[role="menuitem"], li, button, a, div')
      if (clickable) { (clickable).click(); return true }
    }
    return false
  })
  if (!clicked) {
    console.warn('Header nav click failed; trying direct selector')
  }
  await wait(1200)
}

async function capture() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--window-size=1600,1000'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 2 })

  await gotoRoadmap(page)

  // 1. Overview: roadmap with toolbar showing "对比" button (enabled, since demo seeder created 2 snapshots)
  console.log('[1] Capturing: roadmap overview with compare button')
  await page.screenshot({
    path: path.join(__dirname, 'compare-01-overview.png'),
    fullPage: false,
  })

  // 2. Open the compare entry modal
  console.log('[2] Opening compare modal')
  const clickedCompare = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    for (const b of btns) {
      const t = b.textContent?.trim()
      if (t === '对比' || t === '对比中') {
        // dispatch full event chain
        b.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
        b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
        b.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
        ;(b).click()
        return true
      }
    }
    return false
  })
  if (!clickedCompare) throw new Error('Could not find 对比 button')
  await wait(1200)
  // Post-click: dump modal state
  const modalState = await page.evaluate(() => {
    const modals = Array.from(document.querySelectorAll('.ant-modal-wrap'))
    return modals.map(m => ({
      display: (m).style.display,
      hasRoot: !!m.querySelector('.ant-modal-root'),
      title: m.querySelector('.ant-modal-title')?.textContent || null,
      selectCount: m.querySelectorAll('.ant-select').length,
    }))
  })
  console.log('  modal state:', JSON.stringify(modalState))

  // Dump select structure for debug
  const selectDebug = await page.evaluate(() => {
    const modal = Array.from(document.querySelectorAll('.ant-modal-wrap')).find(m =>
      m.querySelector('.ant-modal-title')?.textContent?.includes('选择要对比')
    )
    if (!modal) return 'no-modal'
    const selects = modal.querySelectorAll('.ant-select')
    return Array.from(selects).map(s => ({
      className: s.className,
      innerLen: s.innerHTML.length,
      hasSelector: !!s.querySelector('.ant-select-selector'),
      firstChildTag: s.firstElementChild?.tagName,
      firstChildClass: s.firstElementChild?.className,
    }))
  })
  console.log('  select debug:', JSON.stringify(selectDebug))
  // Open the first Select inside the compare modal
  await page.evaluate(() => {
    const modal = Array.from(document.querySelectorAll('.ant-modal-wrap')).find(m =>
      m.querySelector('.ant-modal-title')?.textContent?.includes('选择要对比')
    )
    if (!modal) throw new Error('compare modal not found')
    const firstSelectEl = modal.querySelector('.ant-select')
    if (!firstSelectEl) throw new Error('no .ant-select')
    // Try clicking the select itself, not .ant-select-selector
    ;(firstSelectEl).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    ;(firstSelectEl).dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  })
  await wait(900)
  // Dump option count and texts
  const opts1 = await page.evaluate(() => {
    const dd = Array.from(document.querySelectorAll('.ant-select-dropdown'))
      .find(d => !d.classList.contains('ant-select-dropdown-hidden'))
    if (!dd) return []
    return Array.from(dd.querySelectorAll('.ant-select-item-option')).map(o => (o).textContent)
  })
  console.log('  base options:', opts1)
  if (opts1.length >= 2) {
    await page.evaluate(() => {
      const dd = Array.from(document.querySelectorAll('.ant-select-dropdown'))
        .find(d => !d.classList.contains('ant-select-dropdown-hidden'))
      if (!dd) return
      const opts = Array.from(dd.querySelectorAll('.ant-select-item-option'))
      const last = opts[opts.length - 1]
      last.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      last.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
  }
  await wait(500)

  console.log('[3] Capturing: compare entry modal')
  await page.screenshot({
    path: path.join(__dirname, 'compare-02-modal.png'),
    fullPage: false,
  })

  // Click 开始对比
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.ant-modal-footer button'))
    for (const b of btns) {
      if (b.textContent?.trim() === '开始对比') { b.click(); return }
    }
  })
  await wait(800)

  // 4. Compare mode active
  console.log('[4] Capturing: compare mode with summary bar + diff cells')
  await page.screenshot({
    path: path.join(__dirname, 'compare-03-diff.png'),
    fullPage: false,
  })

  // 5. Scroll right to show milestone date diffs more clearly
  await page.evaluate(() => {
    const wrap = document.querySelector('.ant-table-body')
    if (wrap) (wrap).scrollLeft = 500
  })
  await wait(400)
  console.log('[5] Capturing: compare mode scrolled to milestones')
  await page.screenshot({
    path: path.join(__dirname, 'compare-04-milestones.png'),
    fullPage: false,
  })

  await browser.close()
  console.log('\nAll screenshots saved to screenshots/compare-*.png')
}

capture().catch(e => { console.error(e); process.exit(1) })
