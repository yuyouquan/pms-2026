#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'
import { waitForApplicationBundles } from './level1-browser-harness.mjs'

const baseUrl = process.env.PMS_BASE_URL || 'http://127.0.0.1:3004'
const output = process.env.PMS_BROWSER_OUTPUT || path.join(process.cwd(), 'output/playwright/figma-ui/reference-followup/joint-name')
fs.mkdirSync(output, { recursive: true })
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
await waitForApplicationBundles({ baseUrl, timeoutMs: 60_000 })
const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.PMS_CHROME_EXECUTABLE || (fs.existsSync(chrome) ? chrome : undefined),
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
const errors = []
const observations = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`))
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`) })

const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))

try {
  await page.setViewport({ width: 1440, height: 1000 })
  await page.goto(baseUrl, { waitUntil: 'networkidle2' })
  await page.waitForFunction(() => [...document.querySelectorAll('[role="menuitem"]')]
    .some(item => item.textContent?.trim() === '项目组合管理'))
  const menu = await page.evaluate(() => {
    const item = [...document.querySelectorAll('[role="menuitem"]')]
      .find(node => node.textContent?.trim() === '项目组合管理')
    const rect = item.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  })
  await page.mouse.click(menu.x, menu.y)
  await page.waitForSelector('.pms-joint-mr-project-link')
  await page.evaluate(() => document.fonts.ready)

  const initialState = await page.evaluate(() => ({
    locks: JSON.parse(localStorage.getItem('pms-mr-version-plan-store') || '{}').state?.machineRowLocks,
    controls: [...document.querySelectorAll('[data-mr-row-kind="machine"]')].map(row => ({
      key: row.dataset.mrRowKey,
      locked: Boolean(row.querySelector('.pms-joint-mr-lock-icon')),
      selectionDisabled: row.querySelector('.ant-selection-column input')?.disabled,
      transferDisabled: Boolean(row.querySelector('.ant-select-disabled')),
      editableDates: row.querySelectorAll('.ant-picker input:not(:disabled)').length,
    })),
  }))

  for (const width of [1440, 1920]) {
    await page.setViewport({ width, height: 1000 })
    for (const locked of [false, true]) {
      const rowKey = await page.evaluate(wantLocked => {
        const row = [...document.querySelectorAll('[data-mr-row-kind="machine"]')]
          .find(node => Boolean(node.querySelector('.pms-joint-mr-lock-icon')) === wantLocked)
        return row?.dataset.mrRowKey
      }, locked)
      assert.ok(rowKey, `fixture includes a ${locked ? 'locked' : 'unlocked'} machine row`)
      for (const position of ['start', 'middle', 'end']) {
        await page.evaluate(({ rowKey, position }) => {
          const body = document.querySelector('.pms-joint-mr-table .ant-table-body')
          const row = [...body.querySelectorAll('[data-mr-row-key]')].find(node => node.dataset.mrRowKey === rowKey)
          body.scrollTop += row.getBoundingClientRect().top - body.getBoundingClientRect().top - 24
          const max = body.scrollWidth - body.clientWidth
          body.scrollLeft = position === 'start' ? 0 : position === 'middle' ? max / 2 : max
        }, { rowKey, position })
        await settle()
        const inspection = await page.evaluate(rowKey => {
          const row = [...document.querySelectorAll('[data-mr-row-key]')].find(node => node.dataset.mrRowKey === rowKey)
          const link = row.querySelector('.pms-joint-mr-project-link')
          const label = link.firstElementChild
          const icon = row.querySelector('.pms-joint-mr-lock-icon')
          const cell = link.closest('td')
          const rect = node => node.getBoundingClientRect()
          const inside = (inner, outer) => inner.left >= outer.left - 0.5 && inner.right <= outer.right + 0.5
            && inner.top >= outer.top - 0.5 && inner.bottom <= outer.bottom + 0.5
          const owns = (node, box) => node.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2))
          const firstCharacter = document.createRange()
          firstCharacter.setStart(label.firstChild, 0)
          firstCharacter.setEnd(label.firstChild, 1)
          const firstRect = firstCharacter.getBoundingClientRect()
          const fixedCells = [...row.querySelectorAll('td.ant-table-cell-fix-start, td.ant-table-cell-fix-left')]
          return {
            text: link.textContent,
            firstCharacterVisible: inside(firstRect, rect(link)) && inside(firstRect, rect(cell)) && owns(link, firstRect),
            labelEllipsis: getComputedStyle(label).textOverflow === 'ellipsis',
            completeNameOnHover: link.title === link.textContent,
            iconVisible: !icon || (inside(rect(icon), rect(cell)) && inside(rect(icon), rect(link.parentElement)) && owns(icon, rect(icon))),
            iconBeforeName: !icon || rect(icon).right <= rect(link).left,
            fixedCellsSeparated: fixedCells.every((fixedCell, index) => index === 0 || rect(fixedCells[index - 1]).right <= rect(fixedCell).left + 0.5),
            fixedCellsVisible: fixedCells.every(fixedCell => owns(fixedCell, rect(fixedCell))),
            fixedCellCount: fixedCells.length,
          }
        }, rowKey)
        observations.push({ width, locked, position, ...inspection })
        if (locked && position !== 'middle') {
          await page.screenshot({ path: path.join(output, `locked-${width}-${position}.png`) })
        }
      }
    }
  }

  const finalState = await page.evaluate(() => ({
    locks: JSON.parse(localStorage.getItem('pms-mr-version-plan-store') || '{}').state?.machineRowLocks,
    controls: [...document.querySelectorAll('[data-mr-row-kind="machine"]')].map(row => ({
      key: row.dataset.mrRowKey,
      locked: Boolean(row.querySelector('.pms-joint-mr-lock-icon')),
      selectionDisabled: row.querySelector('.ant-selection-column input')?.disabled,
      transferDisabled: Boolean(row.querySelector('.ant-select-disabled')),
      editableDates: row.querySelectorAll('.ant-picker input:not(:disabled)').length,
    })),
  }))
  fs.writeFileSync(path.join(output, 'observations.json'), JSON.stringify({ observations, errors }, null, 2))
  assert.deepEqual(finalState, initialState, 'scrolling must preserve lock state and editing permissions')
  const failed = observations.filter(item => !item.firstCharacterVisible || !item.labelEllipsis || !item.completeNameOnHover
    || !item.iconVisible || !item.iconBeforeName || !item.fixedCellsSeparated || !item.fixedCellsVisible || item.fixedCellCount !== 3)
  assert.deepEqual(failed, [], 'names, lock icons and fixed columns remain visible at both widths and every scroll position')
  assert.deepEqual(errors, [], 'browser runtime and network errors')
  console.log(`PASS joint MR names and lock icons: ${observations.length} viewport/scroll/lock checks; ${output}`)
} finally {
  console.log(`Joint MR visibility evidence: ${output}`)
  await browser.close()
}
