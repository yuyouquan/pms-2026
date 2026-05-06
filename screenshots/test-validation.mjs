import puppeteer from 'puppeteer'

const URL = 'http://localhost:3000'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({ headless: 'new', defaultViewport: { width: 1600, height: 1000 } })
const page = await browser.newPage()
page.on('pageerror', err => console.log('[pageerror]', err.message))

console.log('1. Loading', URL)
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 })

console.log('2. Click X6877 card')
await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('[class*="ant-card"]'))
  cards.find(c => c.textContent && c.textContent.includes('X6877-D8400_H991'))?.click()
})
await sleep(800)

console.log('3. Click 计划 menu')
await page.evaluate(() => {
  const items = Array.from(document.querySelectorAll('.ant-menu-item, [role="menuitem"]'))
  items.find(i => i.textContent && i.textContent.trim() === '计划')?.click()
})
await sleep(800)

console.log('4. Open version dropdown and select V4')
// Find version Select bounding rect, use puppeteer mouse click (real native click)
const rect = await page.evaluate(() => {
  const items = Array.from(document.querySelectorAll('.ant-select'))
  const target = items.find(el => /V\d+\s*\(/.test(el.textContent || ''))
  if (!target) return null
  const r = target.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, txt: target.textContent.trim().slice(0,40) }
})
console.log('   version select rect:', rect)
if (rect) {
  await page.mouse.click(rect.x, rect.y)
  await sleep(600)
}

const dropdownItems = await page.evaluate(() => Array.from(document.querySelectorAll('.ant-select-item-option, .ant-select-item')).map(i => i.textContent.trim()))
console.log('   dropdown items:', dropdownItems)

// Click V4 option — find and use mouse click for reliability
const v4Rect = await page.evaluate(() => {
  const items = Array.from(document.querySelectorAll('.ant-select-item-option, .ant-select-item'))
  const v4 = items.find(i => i.textContent && i.textContent.includes('V4'))
  if (!v4) return null
  const r = v4.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
console.log('   v4 option rect:', v4Rect)
if (v4Rect) await page.mouse.click(v4Rect.x, v4Rect.y)
await sleep(2500)

const stateAfterV4 = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(Boolean)
  const versionTxt = Array.from(document.querySelectorAll('.ant-select-selector')).map(s => s.textContent.trim())
  const editingBanner = document.body.textContent.includes('编辑模式')
  return { buttons: buttons.slice(0, 12), versionTxt, editingBanner }
})
console.log('5. After V4:', stateAfterV4)
await page.screenshot({ path: '/tmp/v4-state.png', fullPage: false })

// Debug: dump first body row attributes
const rowDebug = await page.evaluate(() => {
  const tbody = document.querySelector('.pms-table tbody')
  if (!tbody) return { tbodyExists: false }
  const rows = Array.from(tbody.querySelectorAll('tr')).slice(0, 3)
  return {
    tbodyExists: true,
    tbodyClass: tbody.className,
    rows: rows.map(r => ({
      cls: r.className,
      attrs: Array.from(r.attributes).map(a => `${a.name}=${a.value.slice(0,40)}`),
    })),
  }
})
console.log('   row debug:', JSON.stringify(rowDebug, null, 2).slice(0, 1500))

const conceptInspect = await page.evaluate(() => {
  // Try multiple selectors
  const allRowsV1 = Array.from(document.querySelectorAll('.pms-table .ant-table-tbody tr.ant-table-row'))
  const allRowsV2 = Array.from(document.querySelectorAll('.pms-table tbody tr'))
  const allRowsV3 = Array.from(document.querySelectorAll('table tbody tr'))
  const allRowsV4 = Array.from(document.querySelectorAll('[class*="ant-table"] tbody tr'))
  const allRows = allRowsV1.length ? allRowsV1 : allRowsV2.length ? allRowsV2 : allRowsV3.length ? allRowsV3 : allRowsV4
  const dump = allRows.map(r => ({
    key: r.getAttribute('data-row-key'),
    text: Array.from(r.querySelectorAll('td')).map(td => td.textContent.trim().slice(0,18)).slice(0,5),
  }))
  const row = document.querySelector('.pms-table .ant-table-tbody tr[data-row-key="1"]')
  if (!row) return { found: false, allRows: dump }
  const pickers = Array.from(row.querySelectorAll('.ant-picker'))
  const inputs = Array.from(row.querySelectorAll('input'))
  return {
    found: true,
    pickerCount: pickers.length,
    inputCount: inputs.length,
    inputs: inputs.map(i => ({ placeholder: i.placeholder, value: i.value })),
    classes: row.className,
    allRows: dump,
  }
})
console.log('6. Concept row inspect:', JSON.stringify(conceptInspect, null, 2).slice(0, 1500))

if (conceptInspect.pickerCount > 0) {
  console.log('7. Setting planStartDate to 2026-01-25 via first picker')
  await page.click('.pms-table .ant-table-tbody tr[data-row-key="1"] .ant-picker input', { clickCount: 3 })
  await sleep(300)
  await page.keyboard.press('Backspace')
  await page.keyboard.type('2026-01-25')
  await sleep(200)
  await page.keyboard.press('Enter')
  await sleep(800)
}

// Check cell-level invalid markers (which date cells get pms-cell-invalid)
const cellsAfter = await page.evaluate(() => {
  const rows = Array.from(document.querySelectorAll('.pms-table .ant-table-tbody tr.ant-table-row'))
  return rows.map(r => {
    const cells = Array.from(r.querySelectorAll('td'))
    const invalidCells = cells.map((td, i) => td.classList.contains('pms-cell-invalid') ? i : null).filter(x => x !== null)
    return {
      key: r.getAttribute('data-row-key'),
      rowHasInvalidClass: r.classList.contains('pms-row-invalid'),
      invalidCellIdx: invalidCells,
    }
  })
})
console.log('   cell-level invalid status:', cellsAfter)

const afterEdit = await page.evaluate(() => {
  const row = document.querySelector('.pms-table .ant-table-tbody tr[data-row-key="1"]')
  if (!row) return null
  const td = row.querySelector('td')
  const cs = td ? window.getComputedStyle(td) : null
  const pickerInputs = Array.from(row.querySelectorAll('.ant-picker input')).map(i => i.value)
  return {
    classes: row.className,
    hasInvalid: row.classList.contains('pms-row-invalid'),
    bg: cs?.backgroundColor,
    boxShadow: cs?.boxShadow,
    pickerInputs,
  }
})
console.log('8. Concept row after edit:', afterEdit)

await page.screenshot({ path: '/tmp/after-edit.png', fullPage: false })

// Also take a clipped close-up of the table for clearer visual inspection
const tableRect = await page.evaluate(() => {
  const t = document.querySelector('.pms-table')
  if (!t) return null
  const r = t.getBoundingClientRect()
  return { x: Math.max(0, r.x - 10), y: Math.max(0, r.y - 10), width: r.width + 20, height: r.height + 20 }
})
if (tableRect) await page.screenshot({ path: '/tmp/cell-highlight.png', clip: tableRect })

// Inspect computed style of the marked cell to confirm CSS applied
const cellStyle = await page.evaluate(() => {
  const td = document.querySelector('.pms-table .ant-table-tbody tr[data-row-key="1"] td.pms-cell-invalid')
  if (!td) return { found: false }
  const cs = window.getComputedStyle(td)
  return {
    found: true,
    cls: td.className,
    bg: cs.backgroundColor,
    boxShadow: cs.boxShadow,
    borderBottomColor: cs.borderBottomColor,
  }
})
console.log('   cell computed style:', cellStyle)

// Hover the invalid start cell to capture tooltip
console.log('11. Hover invalid 概念 start cell to show tooltip')
const startCell = await page.evaluate(() => {
  const td = document.querySelector('.pms-table .ant-table-tbody tr[data-row-key="1"] td.pms-cell-invalid')
  if (!td) return null
  const r = td.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
if (startCell) {
  // Two-step hover (initial position outside, then move to target) to trigger Antd Tooltip
  await page.mouse.move(0, 0)
  await sleep(150)
  await page.mouse.move(startCell.x, startCell.y, { steps: 12 })
  await sleep(1500)
  await page.screenshot({ path: '/tmp/cell-tooltip.png', fullPage: false })
  const tipText = await page.evaluate(() => {
    const tips = Array.from(document.querySelectorAll('.ant-tooltip, [class*="tooltip"]'))
    return tips.map(t => ({ cls: t.className.toString().slice(0,80), text: t.textContent?.trim().slice(0, 200) }))
  })
  console.log('   tooltip elements:', JSON.stringify(tipText))
}

console.log('9. Click 发布')
await page.evaluate(() => {
  Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '发布')?.click()
})
await sleep(800)
await page.screenshot({ path: '/tmp/after-publish.png', fullPage: false })

const msgText = await page.evaluate(() => {
  const messages = Array.from(document.querySelectorAll('.ant-message-notice, .ant-message'))
  return messages.map(m => m.textContent.trim()).join(' | ')
})
console.log('   message:', msgText)

await browser.close()
console.log('done')
