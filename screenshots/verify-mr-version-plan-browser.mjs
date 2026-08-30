#!/usr/bin/env node

import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import puppeteer from 'puppeteer'
import { waitForApplicationBundles } from './level1-browser-harness.mjs'

const BASE_URL = process.env.PMS_BASE_URL || 'http://127.0.0.1:3004'
const TIMEOUT = Number(process.env.PMS_BROWSER_TIMEOUT || 45_000)
const FIXED_BROWSER_NOW = '2026-08-30T00:00:00.000+08:00'
const TRACKED_OUTPUT = path.join(process.cwd(), 'screenshots', 'mr-version-plan')
const UPDATE_TRACKED_SCREENSHOTS = process.env.PMS_UPDATE_SCREENSHOTS === '1'
const OUTPUT = fs.mkdtempSync(path.join(os.tmpdir(), 'pms-mr-version-plan-actual-'))
const EXPECTED_SCREENSHOTS = [
  'configuration.png', 'tos-vertical.png', 'tos-horizontal.png', 'joint-valid.png',
  'joint-invalid.png', 'stop-record.png', 'machine-vertical.png', 'machine-horizontal.png',
]
const STEP_MARKERS = [
  'STEP 1 PASS', 'STEP 2 PASS', 'STEP 3 PASS', 'STEP 4 PASS', 'STEP 5 PASS',
  'STEP 6 PASS', 'STEP 7 PASS', 'STEP 8 PASS', 'STEP 9 PASS', 'STEP 10 PASS',
  'STEP 11 PASS', 'STEP 12 PASS', 'STEP 13 PASS', 'STEP 14 PASS', 'STEP 15 PASS',
]
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

function validateScreenshotEvidence(directory) {
  const actualFiles = fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .sort()
  assert.deepEqual(actualFiles, [...EXPECTED_SCREENSHOTS].sort(), 'MR screenshot evidence must contain the exact eight-file allowlist')
  for (const file of EXPECTED_SCREENSHOTS) {
    const stat = fs.statSync(path.join(directory, file))
    assert.ok(stat.isFile() && stat.size > 1_000, `${file} is current and non-empty`)
  }
}

function promoteTrackedScreenshotsAtomically(actualDirectory) {
  validateScreenshotEvidence(actualDirectory)
  const parent = path.dirname(TRACKED_OUTPUT)
  const staging = fs.mkdtempSync(path.join(parent, '.mr-version-plan-staging-'))
  const backup = path.join(parent, `.mr-version-plan-backup-${process.pid}-${Date.now()}`)
  let targetMoved = false
  let stagingPromoted = false
  try {
    for (const file of EXPECTED_SCREENSHOTS) {
      fs.copyFileSync(path.join(actualDirectory, file), path.join(staging, file))
    }
    validateScreenshotEvidence(staging)
    if (fs.existsSync(TRACKED_OUTPUT)) {
      fs.renameSync(TRACKED_OUTPUT, backup)
      targetMoved = true
    }
    fs.renameSync(staging, TRACKED_OUTPUT)
    stagingPromoted = true
    validateScreenshotEvidence(TRACKED_OUTPUT)
    if (targetMoved) fs.rmSync(backup, { recursive: true, force: true })
  } catch (error) {
    try {
      if (stagingPromoted && fs.existsSync(TRACKED_OUTPUT)) fs.renameSync(TRACKED_OUTPUT, staging)
      if (targetMoved && fs.existsSync(backup)) fs.renameSync(backup, TRACKED_OUTPUT)
      if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true })
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], 'MR screenshot update failed and baseline rollback also failed')
    }
    throw error
  }
}

process.once('exit', () => {
  if (fs.existsSync(OUTPUT) && fs.readdirSync(OUTPUT).length === 0) fs.rmSync(OUTPUT, { recursive: true, force: true })
})

const assertTrackedScreenshotsClean = stage => {
  if (process.env.PMS_ASSERT_SCREENSHOTS_CLEAN !== '1') return
  try {
    execSync('git diff --exit-code -- screenshots/mr-version-plan', { stdio: 'inherit' })
  } catch (error) {
    throw new Error(`tracked MR screenshots are dirty ${stage}`, { cause: error })
  }
}

assertTrackedScreenshotsClean('before browser verification')

function installDeterministicBrowserEnvironment(fixedNow) {
  const NativeDate = Date
  const fixedTimestamp = NativeDate.parse(fixedNow)
  function FixedDate(...args) {
    if (!new.target) return new NativeDate(fixedTimestamp).toString()
    return Reflect.construct(NativeDate, args.length ? args : [fixedTimestamp], new.target)
  }
  Object.setPrototypeOf(FixedDate, NativeDate)
  FixedDate.prototype = NativeDate.prototype
  FixedDate.now = () => fixedTimestamp
  FixedDate.parse = NativeDate.parse
  FixedDate.UTC = NativeDate.UTC
  globalThis.Date = FixedDate
  try {
    window.localStorage.removeItem('pms-mr-version-plan-store')
    window.localStorage.removeItem('pms-level3-plan-store')
  } catch {
    // about:blank has no storage origin; this hook runs again for the app origin.
  }
  document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style')
    style.dataset.mrAcceptanceEvidence = 'true'
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0.001s !important;
        animation-delay: 0s !important;
        transition-duration: 0.001s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
      }
    `
    document.head.append(style)
  }, { once: true })
}

await waitForApplicationBundles({ baseUrl: BASE_URL, timeoutMs: 60_000, requestTimeoutMs: 30_000 })

const MAC_SYSTEM_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const configuredBrowser = process.env.PMS_CHROME_EXECUTABLE
  || (fs.existsSync(MAC_SYSTEM_CHROME) ? MAC_SYSTEM_CHROME : undefined)
const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: configuredBrowser,
  protocolTimeout: Math.max(30_000, TIMEOUT * 2),
  args: [
    '--no-sandbox',
    '--deterministic-mode',
    '--disable-features=UseSkiaRenderer',
    '--disable-gpu',
    '--disable-lcd-text',
    '--font-render-hinting=none',
    '--force-color-profile=srgb',
    '--force-device-scale-factor=1',
  ],
})
const page = await browser.newPage()
const cdp = await page.createCDPSession()
await page.setViewport({ width: 1600, height: 1000 })
page.setDefaultTimeout(TIMEOUT)
await page.evaluateOnNewDocument(installDeterministicBrowserEnvironment, FIXED_BROWSER_NOW)

const browserErrors = []
const failedRequests = []
const failedHttpResponses = []
page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`))
page.on('console', message => { if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`) })
page.on('requestfailed', request => failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'unknown error'}`))
page.on('response', response => {
  if (response.status() >= 400) failedHttpResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`)
})

const pass = (step, label) => console.log(`${STEP_MARKERS[step - 1]} ${label}`)
async function waitForStableEvidence() {
  await page.evaluate(async () => {
    await Promise.race([
      document.fonts.ready,
      new Promise(resolve => setTimeout(resolve, 3_000)),
    ])
  })
  try {
    await page.waitForFunction(() => ![...document.querySelectorAll('.ant-message-notice')].some(node => {
      const rect = node.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== 'hidden'
    }), { timeout: 5_000 })
  } catch (error) {
    const visibleMessages = await page.$$eval('.ant-message-notice', nodes => nodes
      .filter(node => {
        const rect = node.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== 'hidden'
      })
      .map(node => node.textContent?.trim())
      .filter(Boolean))
    throw new Error(`visible Ant messages did not clear before screenshot: ${visibleMessages.join(' | ') || '(no readable text)'}`, { cause: error })
  }
  let previous = ''
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const current = await page.evaluate(() => JSON.stringify({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      body: document.body.getBoundingClientRect().toJSON(),
      tables: [...document.querySelectorAll('.ant-table-container')].map(node => node.getBoundingClientRect().toJSON()),
    }))
    if (current === previous) return
    previous = current
    await wait(100)
  }
  throw new Error('acceptance evidence layout did not stabilize')
}
const screenshot = async name => {
  assert.ok(EXPECTED_SCREENSHOTS.includes(name), `unexpected screenshot target: ${name}`)
  await waitForStableEvidence()
  const capture = cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
    optimizeForSpeed: true,
    clip: { x: 0, y: 0, width: 1600, height: 1000, scale: 1 },
  })
  const result = await Promise.race([
    capture,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`screenshot timeout: ${name}`)), 10_000)),
  ])
  fs.writeFileSync(path.join(OUTPUT, name), Buffer.from(result.data, 'base64'))
}
const bodyText = () => page.$eval('body', node => node.innerText)
const readMrState = () => page.evaluate(() => {
  const raw = window.localStorage.getItem('pms-mr-version-plan-store')
  return raw ? JSON.parse(raw).state : null
})

async function assertNaMachineProjection(projectId, tosVersion) {
  const state = await readMrState()
  assert.deepEqual(state.machinePlansByKey[`${projectId}::${tosVersion}`].dates, {})
  const projection = await page.$eval(
    `tr[data-mr-row-key="${projectId}::${tosVersion}"][data-mr-row-kind="machine"][data-mr-project-id="${projectId}"][data-mr-tos-version="${tosVersion}"]`,
    row => {
      const dateCells = [...row.querySelectorAll('[data-mr-date-cell="true"]')]
      return {
        rowKey: row.dataset.mrRowKey,
        cellCount: dateCells.length,
        values: dateCells.map(cell => cell.textContent?.trim()),
        editableDateInputs: dateCells.reduce((count, cell) => count + cell.querySelectorAll('input').length, 0),
      }
    },
  )
  assert.equal(projection.rowKey, `${projectId}::${tosVersion}`)
  assert.equal(projection.cellCount, 10)
  assert.deepEqual(projection.values, Array(10).fill('/'))
  assert.equal(projection.editableDateInputs, 0)
}

async function setTosCollectionDateThroughProject(value) {
  await openProjectFromList('tOS版本项目', 'tOS16.3', '张三,李白')
  await clickVisibleText('计划')
  await clickVisibleText('三级计划-MR版本计划', '[role="tab"],button,span')
  await page.waitForSelector('input[aria-label="16.3.0.140-修改点收集开始时间-日期"]', { visible: true })
  await fillDate('input[aria-label="16.3.0.140-修改点收集开始时间-日期"]', value)
  assert.equal((await readMrState()).tosInstancesByProjectId['19'][0].dates['mr-node-change-collection'], value)
  await clickButtonStarting('返回')
  await openMainMenu('jointProjectSpace')
  await page.waitForSelector('.pms-joint-mr-table', { visible: true })
}

async function assertJointStickyColumns() {
  const results = []
  for (const scrollLeft of [1200, 1440]) {
    await page.$eval('.pms-joint-mr-table .ant-table-body', (body, nextScrollLeft) => { body.scrollLeft = nextScrollLeft }, scrollLeft)
    await wait(150)
    results.push(await page.$eval('.pms-joint-mr-table', table => {
      const visible = element => {
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden'
      }
      const owns = (cell, x, y) => {
        const hit = document.elementFromPoint(x, y)
        return hit === cell || cell.contains(hit)
      }
      const alphaOpaque = cell => {
        const color = getComputedStyle(cell).backgroundColor
        const alpha = color.match(/^rgba?\([^,]+,[^,]+,[^,]+(?:,\s*([\d.]+))?\)$/)?.[1]
        return { color, opaque: alpha === undefined || Number(alpha) === 1 }
      }
      const inspectCells = cells => cells.map(cell => {
        const rect = cell.getBoundingClientRect()
        return {
          text: cell.textContent?.trim(),
          rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width },
          ownsCenter: owns(cell, rect.left + rect.width / 2, rect.top + rect.height / 2),
          zIndex: Number(getComputedStyle(cell).zIndex),
          ...alphaOpaque(cell),
        }
      })
      const headers = [...table.querySelectorAll('thead th.ant-table-cell-fix-start, thead th.ant-table-cell-fix-left')].filter(visible)
      const rows = [
        table.querySelector('tr[data-mr-row-kind="tos-reference"][data-mr-tos-version="16.3.0.140"]'),
        table.querySelector('tr[data-mr-row-kind="machine"][data-mr-project-id="3"][data-mr-tos-version="16.3.0.140"]'),
      ]
      return {
        headers: inspectCells(headers),
        rows: rows.map(row => {
          if (!row) return null
          const fixed = [...row.querySelectorAll('td.ant-table-cell-fix-start, td.ant-table-cell-fix-left')].filter(visible)
          const dateCells = [...row.querySelectorAll('td[data-mr-date-cell="true"]')].filter(visible)
          const fixedInfo = inspectCells(fixed)
          const visibleDate = dateCells.map(cell => ({ cell, rect: cell.getBoundingClientRect() }))
            .find(({ rect }) => rect.left + rect.width / 2 > fixed.at(-1).getBoundingClientRect().right + 4
              && rect.left + rect.width / 2 < window.innerWidth - 4)
          const firstRect = fixed[0].getBoundingClientRect()
          const secondRect = fixed[1].getBoundingClientRect()
          return {
            fixed: fixedInfo,
            noOverlap: firstRect.right <= secondRect.left + 0.5,
            firstOwnsSeam: owns(fixed[0], firstRect.right - 1, firstRect.top + firstRect.height / 2),
            secondOwnsSeam: owns(fixed[1], secondRect.left + 1, secondRect.top + secondRect.height / 2),
            dateCenterOwned: Boolean(visibleDate && owns(visibleDate.cell, visibleDate.rect.left + visibleDate.rect.width / 2, visibleDate.rect.top + visibleDate.rect.height / 2)),
          }
        }),
      }
    }))
  }
  for (const result of results) {
    assert.equal(result.headers.length, 2)
    assert.ok(result.headers.every(cell => cell.opaque && cell.ownsCenter && cell.zIndex === 6))
    for (const row of result.rows) {
      assert.ok(row)
      assert.equal(row.fixed.length, 2)
      assert.ok(row.fixed.every(cell => cell.opaque && cell.ownsCenter && cell.zIndex === 3))
      assert.ok(result.headers.every(header => header.zIndex > row.fixed[0].zIndex))
      assert.equal(row.noOverlap, true)
      assert.equal(row.firstOwnsSeam, true)
      assert.equal(row.secondOwnsSeam, true)
      assert.equal(row.dateCenterOwned, true)
    }
  }
}

async function snapshotTemplateRevision(versionId) {
  const state = await readMrState()
  const version = state.templateVersions.find(item => item.id === versionId)
  assert.ok(version, `template version exists: ${versionId}`)
  const domRows = await page.$$eval('tr[data-mr-template-activity-id]', rows => rows.map(row => ({
    id: row.dataset.mrTemplateActivityId,
    number: row.dataset.mrTemplateNumber,
    name: row.querySelector('input[aria-label^="活动名称-"]')?.value || row.children[2]?.textContent?.trim(),
  })))
  return { version: structuredClone(version), domRows }
}

function assertTemplateRevisionMutation({ beforeDelete, afterDelete, beforeDrag, afterDrag, deletedId, deletedName, parentId, retainedChildIds, priorPublished, priorPublishedAfter, finalPublished }) {
  assert.equal(afterDelete.version.activities.length, beforeDelete.version.activities.length - 1)
  assert.equal(afterDelete.domRows.length, beforeDelete.domRows.length - 1)
  assert.ok(beforeDelete.version.activities.some(activity => activity.id === deletedId && activity.activityName === deletedName))
  assert.equal(afterDelete.version.activities.some(activity => activity.id === deletedId || activity.activityName === deletedName), false)
  const beforeParent = beforeDrag.version.activities.find(activity => activity.id === parentId)
  const afterParent = afterDrag.version.activities.find(activity => activity.id === parentId)
  assert.ok(beforeParent && afterParent)
  assert.notEqual(afterParent.order, beforeParent.order)
  assert.deepEqual(
    afterDrag.version.activities.filter(activity => activity.parentId === parentId).map(activity => activity.id).sort(),
    [...retainedChildIds].sort(),
  )
  const parentDom = afterDrag.domRows.find(row => row.id === parentId)
  assert.ok(parentDom && /^\d+$/.test(parentDom.number))
  for (const childId of retainedChildIds) {
    const childDom = afterDrag.domRows.find(row => row.id === childId)
    assert.ok(childDom?.number.startsWith(`${parentDom.number}.`))
  }
  assert.deepEqual(beforeDelete.version.status, '修订中')
  assert.deepEqual(priorPublishedAfter, priorPublished)
  assert.equal(priorPublishedAfter.status, '已发布')
  if (finalPublished) {
    assert.equal(finalPublished.activities.some(activity => activity.id === deletedId || activity.activityName === deletedName), false)
    assert.ok(finalPublished.activities.some(activity => activity.id === parentId && activity.activityName === 'MR验收收尾'))
    assert.deepEqual(
      finalPublished.activities.filter(activity => activity.parentId === parentId).map(activity => activity.id).sort(),
      [...retainedChildIds].sort(),
    )
    assert.equal(finalPublished.activities.find(activity => activity.id === parentId)?.order, afterDrag.version.activities.find(activity => activity.id === parentId)?.order)
  }
}

async function waitForMainMenu(key) {
  const labels = { workbench: '工作台', projectList: '项目列表', jointProjectSpace: '联合项目空间', config: '配置中心' }
  await page.waitForFunction(({ key, label }) => [...document.querySelectorAll('[role="menuitem"]')].some(node => {
    const rect = node.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 && node.textContent?.trim() === label
  }), { timeout: TIMEOUT }, { key, label: labels[key] })
}

async function openMainMenu(key) {
  await waitForMainMenu(key)
  const labels = { workbench: '工作台', projectList: '项目列表', jointProjectSpace: '联合项目空间', config: '配置中心' }
  const box = await page.evaluate(label => {
    const node = [...document.querySelectorAll('[role="menuitem"]')].find(item => item.textContent?.trim() === label)
    if (!node) return null
    const rect = node.getBoundingClientRect()
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  }, labels[key])
  assert.ok(box, `main menu is actionable: ${labels[key]}`)
  await page.mouse.click(box.x, box.y)
  await wait(450)
}

async function clickVisibleText(text, selector = 'button,[role="tab"],[role="menuitem"],td,span') {
  const box = await page.evaluate(({ text, selector }) => {
    const visible = node => {
      const rect = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
    }
    const node = [...document.querySelectorAll(selector)].find(item => visible(item) && item.textContent?.trim() === text)
    const target = node?.closest('button,[role="tab"],[role="menuitem"],tr,td') || node
    if (!target || !visible(target)) return null
    const rect = target.getBoundingClientRect()
    return { x: rect.x + Math.min(rect.width / 2, 28), y: rect.y + rect.height / 2 }
  }, { text, selector })
  if (!box) throw new Error(`missing visible text control: ${text}`)
  await page.mouse.click(box.x, box.y)
  await wait(350)
}

async function clickButtonStarting(prefix) {
  const box = await page.evaluate(prefix => {
    const node = [...document.querySelectorAll('button')].find(item => {
      const rect = item.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && item.textContent?.trim().startsWith(prefix)
    })
    if (!node) return null
    const rect = node.getBoundingClientRect()
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  }, prefix)
  if (!box) throw new Error(`missing button starting with: ${prefix}`)
  await page.mouse.click(box.x, box.y)
  await wait(450)
}

let modalCloseSequence = 0
async function clickTopVisibleModalButton(label) {
  const token = `mr-acceptance-modal-action-${++modalCloseSequence}`
  const result = await page.evaluate(({ label, token }) => {
    const wraps = [...document.querySelectorAll('.ant-modal-wrap')].filter(wrap => {
      const rect = wrap.getBoundingClientRect()
      const style = getComputedStyle(wrap)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none'
        && style.visibility !== 'hidden'
    }).map((wrap, domIndex) => ({ wrap, domIndex, zIndex: Number.parseInt(getComputedStyle(wrap).zIndex, 10) || 0 }))
      .sort((left, right) => left.zIndex - right.zIndex || left.domIndex - right.domIndex)
    const top = wraps.at(-1)?.wrap
    const button = [...(top?.querySelectorAll('button') ?? [])].find(node => node.textContent?.replace(/\s/g, '') === label.replace(/\s/g, '') && !node.disabled)
    if (!button) return {
      activated: false,
      wrapCount: wraps.length,
      topText: top?.textContent,
      buttons: [...(top?.querySelectorAll('button') ?? [])].map(node => ({ text: node.textContent, disabled: node.disabled })),
    }
    top.setAttribute('data-mr-acceptance-modal-token', token)
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }))
    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    button.click()
    return { activated: true }
  }, { label, token })
  assert.equal(result.activated, true, `top visible modal button is actionable: ${label}; ${JSON.stringify(result)}`)
  await page.waitForFunction(token => {
    const wrap = document.querySelector(`.ant-modal-wrap[data-mr-acceptance-modal-token="${token}"]`)
    if (!wrap) return true
    const rect = wrap.getBoundingClientRect()
    const style = getComputedStyle(wrap)
    return rect.width === 0 || rect.height === 0 || style.display === 'none' || style.visibility === 'hidden'
  }, {}, token)
}

async function closeTopVisibleModal() {
  const token = `mr-acceptance-modal-${++modalCloseSequence}`
  const closed = await page.evaluate(token => {
    const wraps = [...document.querySelectorAll('.ant-modal-wrap')].filter(wrap => {
      const rect = wrap.getBoundingClientRect()
      const style = getComputedStyle(wrap)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none'
        && style.visibility !== 'hidden'
    }).map((wrap, domIndex) => ({
      wrap,
      domIndex,
      zIndex: Number.parseInt(getComputedStyle(wrap).zIndex, 10) || 0,
    })).sort((left, right) => left.zIndex - right.zIndex || left.domIndex - right.domIndex)
    const top = wraps.at(-1)?.wrap
    const close = top?.querySelector('.ant-modal-close')
    if (!top || !close) return false
    top.setAttribute('data-mr-acceptance-modal-token', token)
    close.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }))
    close.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    close.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    close.click()
    return true
  }, token)
  assert.equal(closed, true, 'top visible modal exposes a close action')
  await page.waitForFunction(token => {
    const wrap = document.querySelector(`.ant-modal-wrap[data-mr-acceptance-modal-token="${token}"]`)
    if (!wrap) return true
    const rect = wrap.getBoundingClientRect()
    const style = getComputedStyle(wrap)
    return rect.width === 0 || rect.height === 0 || style.display === 'none' || style.visibility === 'hidden'
  }, {}, token)
}

async function chooseSelect(ariaLabel, option, currentOption) {
  const selector = `[aria-label="${ariaLabel}"]`
  await page.waitForSelector(selector, { visible: true })
  await page.click(selector)
  await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { visible: true })
  if (currentOption !== undefined) {
    const order = ['N/A', '1', '2', '3', '4', '5', '6', '7', '8']
    const delta = order.indexOf(option) - order.indexOf(currentOption)
    const key = delta > 0 ? 'ArrowDown' : 'ArrowUp'
    for (let index = 0; index < Math.abs(delta); index += 1) await page.keyboard.press(key)
    await page.keyboard.press('Enter')
    await wait(350)
    return
  }
  const controlId = await page.$eval(selector, node => node.getAttribute('aria-controls'))
  const optionActivated = await page.evaluate(({ option, controlId }) => {
    const visible = node => {
      const rect = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none'
        && style.visibility !== 'hidden' && style.pointerEvents !== 'none'
    }
    const dropdown = (controlId ? document.getElementById(controlId)?.closest('.ant-select-dropdown') : null)
      || [...document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')].find(visible)
    const item = [...(dropdown?.querySelectorAll('.ant-select-item-option') ?? [])]
      .find(node => visible(node) && node.textContent?.trim().startsWith(option))
    if (!item) return false
    item.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }))
    item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    item.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    item.click()
    return true
  }, { option, controlId })
  if (!optionActivated) {
    await page.click(selector)
    await page.keyboard.type(option)
    await page.keyboard.press('Enter')
  }
  await wait(350)
}

async function fillInput(selector, value) {
  await page.waitForSelector(selector, { visible: true })
  await page.$eval(selector, (input, nextValue) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, nextValue)
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: nextValue }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
  await wait(400)
}

async function fillDate(selector, value) {
  await page.waitForSelector(selector, { visible: true })
  if (await page.$eval(selector, input => Boolean(input.value))) {
    const picker = await page.$eval(selector, input => {
      const host = input.closest('.ant-picker')
      const rect = host?.getBoundingClientRect()
      return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null
    })
    assert.ok(picker, `date picker host exists: ${selector}`)
    await page.mouse.move(picker.x, picker.y)
    await wait(100)
    const clearBox = await page.$eval(selector, input => {
      const clear = input.closest('.ant-picker')?.querySelector('.ant-picker-clear')
      if (!clear) return null
      const rect = clear.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    })
    assert.ok(clearBox, `date picker clear affordance exists: ${selector}`)
    await page.mouse.click(clearBox.x, clearBox.y)
    await page.waitForFunction(selector => document.querySelector(selector)?.value === '', {}, selector)
  }
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.click(selector)
    await page.keyboard.down(modifier)
    await page.keyboard.press('A')
    await page.keyboard.up(modifier)
    await page.keyboard.press('Backspace')
    await page.keyboard.type(value)
    await page.keyboard.press('Enter')
    await wait(450)
    if (await page.$eval(selector, (input, expected) => input.value === expected, value)) return
    await page.keyboard.press('Escape')
  }
  throw new Error(`date input did not accept ${value}: ${selector}`)
}

async function switchUser(user) {
  let activated = false
  for (let attempt = 0; attempt < 2 && !activated; attempt += 1) {
    await page.click('button[aria-label="切换当前用户"]')
    await wait(350)
    activated = await page.evaluate(user => {
      const name = [...document.querySelectorAll('.pms-user-dropdown .pms-user-menu__name')]
        .find(node => {
          const rect = node.getBoundingClientRect()
          const style = getComputedStyle(node)
          return rect.width > 0 && rect.height > 0 && style.display !== 'none'
            && style.visibility !== 'hidden' && node.textContent?.trim() === user
        })
      const item = name?.closest('[role="menuitem"]')
      if (!item) return false
      item.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }))
      item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      item.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      item.click()
      return true
    }, user)
  }
  assert.equal(activated, true, `switch user option exists: ${user}`)
  await page.waitForFunction(user => document.querySelector('button[aria-label="切换当前用户"]')?.getAttribute('data-current-user') === user, {}, user)
  await wait(300)
}

async function openProjectFromList(categoryPrefix, projectName, rowSuffix = '') {
  await openMainMenu('projectList')
  await clickButtonStarting(categoryPrefix)
  const box = await page.evaluate(({ projectName, rowSuffix }) => {
    const row = [...document.querySelectorAll('tbody tr')]
      .find(candidate => candidate.innerText.includes(projectName) && (!rowSuffix || candidate.innerText.includes(rowSuffix)))
    if (!row) return null
    const cell = [...row.querySelectorAll('td')].find(candidate => candidate.innerText.trim() === projectName) || row
    const rect = cell.getBoundingClientRect()
    return { x: rect.x + Math.min(rect.width / 2, 24), y: rect.y + rect.height / 2 }
  }, { projectName, rowSuffix })
  if (!box) throw new Error(`project row missing: ${projectName}`)
  await page.mouse.click(box.x, box.y)
  await page.waitForSelector('.pms-project-space', { visible: true })
}

try {
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: TIMEOUT })
  // Ant Design's menu is server-rendered before React attaches its event handlers.
  // A bounded hydration settle avoids accepting focus-only clicks as navigation.
  await wait(5_000)
  await waitForMainMenu('workbench')
  await waitForMainMenu('jointProjectSpace')

  const headerOrder = await page.$$eval('.pms-main-header__menu [role="menuitem"]', nodes => nodes.map(node => node.textContent?.trim()).filter(Boolean))
  assert.ok(headerOrder.indexOf('项目列表') < headerOrder.indexOf('联合项目空间'))
  assert.ok(headerOrder.indexOf('联合项目空间') < headerOrder.indexOf('tOS路标'))
  await openMainMenu('jointProjectSpace')
  await page.waitForSelector('.pms-joint-mr-table', { visible: true })
  assert.equal(await page.$eval('.pms-joint-mr-table', table => table.innerText.includes('错误提示')), false)
  assert.equal(await page.$('[data-mr-fixed-error-cell]'), null)
  pass(1, 'header order and joint-space entry')

  const jointRows = await page.$$eval('.pms-joint-mr-table tbody tr.ant-table-row', rows => rows.map(row => ({ kind: row.dataset.mrRowKind, text: row.innerText, pickerCount: row.querySelectorAll('.ant-picker').length, selectCount: row.querySelectorAll('.ant-select').length })))
  assert.equal(jointRows[0].kind, 'tos-reference')
  assert.ok(jointRows[0].text.includes('16.3.0.140') && jointRows[0].text.includes('tOS16.3'))
  assert.equal(jointRows[0].pickerCount, 0)
  assert.equal(jointRows[0].selectCount, 0)
  assert.ok(jointRows.findIndex(row => row.text.includes('X6855_H8917')) > 0)
  pass(2, 'tOS reference precedes machine rows and is read-only')

  await assertJointStickyColumns()
  pass(3, 'fixed columns remain opaque after horizontal scroll')
  await page.$eval('.pms-joint-mr-table .ant-table-body', body => { body.scrollLeft = 0 })
  await wait(200)

  await fillInput('input[aria-label="项目名称"]', 'X6877-D8400_H991')
  const filteredTexts = await page.$$eval('.pms-joint-mr-table tbody tr.ant-table-row', rows => rows.map(row => row.innerText))
  assert.ok(filteredTexts.some(text => text.includes('X6877-D8400_H991')))
  assert.ok(filteredTexts.every(text => text.includes('X6877-D8400_H991')))
  assert.equal(await page.$('.pms-joint-mr-table .pms-mr-cell-error-icon'), null)
  await screenshot('joint-valid.png')
  await fillInput('input[aria-label="项目名称"]', '')
  pass(4, 'filters reduce visible row set')

  await switchUser('王五')
  assert.equal(await page.$eval('[aria-label="1-16.3.0.140-1+N版本类型"]', node => node.closest('.ant-select')?.classList.contains('ant-select-disabled')), false)
  assert.equal(await page.$eval('[aria-label="3-16.3.0.140-1+N版本类型"]', node => node.closest('.ant-select')?.classList.contains('ant-select-disabled')), true)
  await chooseSelect('1-16.3.0.140-1+N版本类型', '4', '1')
  assert.equal((await readMrState()).machinePlansByKey['1::16.3.0.140'].transferType, '4')
  await chooseSelect('1-16.3.0.140-1+N版本类型', '1', '4')
  pass(5, 'machine SPM edits only the owned project')

  await switchUser('张三')
  assert.equal(await page.$eval('[aria-label="3-16.3.0.140-1+N版本类型"]', node => node.closest('.ant-select')?.classList.contains('ant-select-disabled')), false)
  await chooseSelect('3-16.3.0.140-1+N版本类型', '3', '2')
  assert.equal((await readMrState()).machinePlansByKey['3::16.3.0.140'].transferType, '3')
  await chooseSelect('3-16.3.0.140-1+N版本类型', '2', '3')
  pass(6, 'global admin edits all machine rows')

  await fillDate('input[aria-label="1-16.3.0.145-修改点收集开始时间"]', '2026-06-16')
  assert.equal((await readMrState()).machinePlansByKey['1::16.3.0.145'].dates['mr-node-change-collection'], '2026-06-16')
  await chooseSelect('1-16.3.0.145-1+N版本类型', 'N/A', '1')
  await assertNaMachineProjection('1', '16.3.0.145')
  await chooseSelect('1-16.3.0.145-1+N版本类型', '1', 'N/A')
  await fillDate('input[aria-label="1-16.3.0.145-修改点收集开始时间"]', '2026-06-16')
  assert.equal((await readMrState()).machinePlansByKey['1::16.3.0.145'].dates['mr-node-change-collection'], '2026-06-16')
  pass(7, 'N/A clears dates and displays slashes')

  await setTosCollectionDateThroughProject('2026-05-15')
  const localizedErrors = await page.evaluate(() => {
    const inspect = (rowSelector, activityId) => {
      const row = document.querySelector(rowSelector)
      const cell = row?.querySelector(`[data-mr-date-cell="true"][data-mr-activity-id="${activityId}"]`)
      const icon = cell?.querySelector('.pms-mr-cell-error-icon')
      const picker = cell?.querySelector('.ant-picker')
      const content = cell?.querySelector('.pms-mr-invalid-cell-content > :first-child')
      const cellStyle = cell ? getComputedStyle(cell) : null
      const iconRect = icon?.getBoundingClientRect()
      const contentRect = (picker || content)?.getBoundingClientRect()
      return {
        invalid: cell?.classList.contains('pms-mr-invalid-cell') ?? false,
        iconCount: cell?.querySelectorAll('.pms-mr-cell-error-icon').length ?? 0,
        inputCount: cell?.querySelectorAll('input').length ?? 0,
        backgroundColor: cellStyle?.backgroundColor,
        boxShadow: cellStyle?.boxShadow,
        iconOnRight: Boolean(iconRect && contentRect && iconRect.left >= contentRect.right),
        ariaLabel: icon?.getAttribute('aria-label'),
      }
    }
    return {
      tos: inspect('tr[data-mr-row-kind="tos-reference"][data-mr-project-id="19"][data-mr-tos-version="16.3.0.140"]', 'mr-node-change-collection'),
      machine: inspect('tr[data-mr-row-kind="machine"][data-mr-project-id="3"][data-mr-tos-version="16.3.0.140"]', 'mr-node-mp-intake-deadline'),
    }
  })
  assert.equal(localizedErrors.tos.invalid, true)
  assert.equal(localizedErrors.machine.invalid, true)
  assert.equal(localizedErrors.tos.iconCount, 1)
  assert.equal(localizedErrors.machine.iconCount, 1)
  assert.equal(localizedErrors.tos.inputCount, 0)
  assert.equal(localizedErrors.machine.inputCount, 1)
  assert.equal(localizedErrors.tos.backgroundColor, localizedErrors.machine.backgroundColor)
  assert.equal(localizedErrors.tos.boxShadow, localizedErrors.machine.boxShadow)
  assert.equal(localizedErrors.tos.iconOnRight, true)
  assert.equal(localizedErrors.machine.iconOnRight, true)
  assert.match(localizedErrors.tos.ariaLabel, /1条日期错误/)
  const tosErrorIcon = await page.$('tr[data-mr-row-kind="tos-reference"][data-mr-project-id="19"][data-mr-tos-version="16.3.0.140"] [data-mr-activity-id="mr-node-change-collection"] .pms-mr-cell-error-icon')
  assert.ok(tosErrorIcon)
  await tosErrorIcon.hover()
  await page.waitForFunction(() => [...document.querySelectorAll('.ant-tooltip')].some(node => {
    const rect = node.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 && node.textContent?.includes('修改点收集开始时间不能早于一级计划中的计划开始时间')
  }))
  assert.match(await page.$$eval('.ant-tooltip', nodes => nodes
    .find(node => node.textContent?.includes('修改点收集开始时间不能早于一级计划中的计划开始时间'))?.textContent ?? ''), /修改点收集开始时间不能早于一级计划中的计划开始时间（2026-05-16）/)
  await page.mouse.move(1, 1)
  await wait(300)
  await page.$eval('.pms-joint-mr-table .ant-table-body', body => { body.scrollLeft = 520 })
  await wait(200)
  const machineErrorIcon = await page.$('tr[data-mr-row-kind="machine"][data-mr-project-id="3"][data-mr-tos-version="16.3.0.140"] [data-mr-activity-id="mr-node-mp-intake-deadline"] .pms-mr-cell-error-icon')
  assert.ok(machineErrorIcon)
  await machineErrorIcon.hover()
  await page.waitForFunction(() => [...document.querySelectorAll('.ant-tooltip')].some(node => {
    const rect = node.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 && node.textContent?.includes('整机产品项目的MP入库截止时间不得晚于tOS项目时间')
  }))
  assert.match(await page.$$eval('.ant-tooltip', nodes => nodes
    .find(node => node.textContent?.includes('整机产品项目的MP入库截止时间不得晚于tOS项目时间'))?.textContent ?? ''), /整机产品项目的MP入库截止时间不得晚于tOS项目时间（2026-05-20）/)
  assert.equal((await readMrState()).machinePlansByKey['3::16.3.0.140'].dates['mr-node-mp-intake-deadline'], '2026-05-25')
  await screenshot('joint-invalid.png')
  await setTosCollectionDateThroughProject('2026-05-16')
  pass(8, 'tOS and machine errors are localized with red exact tooltips')

  await clickVisibleText('停止发版')
  await chooseSelect('停止发版项目名称', 'X6877-D8400_H991')
  await fillDate('input[aria-label="停止发版日期"]', '2026-05-31')
  assert.equal(await page.$eval('input[aria-label="停止发版日期"]', input => input.value), '2026-05-31')
  await clickTopVisibleModalButton('确认停止')
  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem('pms-mr-version-plan-store')
    return raw && JSON.parse(raw).state.stopReleaseRecords.length === 1
  })
  const stoppedState = await readMrState()
  assert.ok(stoppedState.machinePlansByKey['1::16.3.0.140'])
  assert.equal(stoppedState.stopReleaseRecords.at(-1)?.stopDate, '2026-05-31')
  assert.equal(stoppedState.machinePlansByKey['1::16.3.0.145'], undefined)
  assert.equal(stoppedState.stopReleaseRecords.at(-1).projectId, '1')
  await clickVisibleText('停止发版记录')
  await page.waitForSelector('[role="dialog"]', { visible: true })
  assert.match(await page.$eval('[role="dialog"]', node => node.innerText), /X6877-D8400_H991/)
  await screenshot('stop-record.png')
  await closeTopVisibleModal()
  await wait(300)
  pass(9, 'stop release removes future rows and records history')

  await page.click('button[aria-label="打开项目-X6877-D8400_H991"]')
  await page.waitForSelector('.pms-machine-mr-table [data-mr-tos-version="16.3.0.140"]', { visible: true })
  assert.match(await bodyText(), /三级计划-MR版本计划/)
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-mr-tos-version') === '16.3.0.140')
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-mr-tos-version')), '16.3.0.140')
  pass(10, 'project link opens MR tab and focuses the requested version')

  assert.equal(await page.$('input[aria-label="16.3.0.140-OP-测试开始时间"]'), null)
  const trPicker = await page.$('input[aria-label="16.3.0.140-TR-修改点收集开始时间"]')
  assert.ok(trPicker)
  assert.equal(await trPicker.evaluate(node => node.disabled), false)
  await fillDate('input[aria-label="16.3.0.140-TR-修改点收集开始时间"]', '2026-05-16')
  assert.equal((await readMrState()).marketOverridesByKey['1::16.3.0.140::TR'].dates['mr-node-change-collection'], '2026-05-16')
  await screenshot('machine-vertical.png')
  await clickVisibleText('横版视图', 'label,button,span')
  await page.waitForSelector('[aria-label="整机MR版本计划横版表格"]', { visible: true })
  assert.equal(await page.$eval('input[aria-label="16.3.0.140-TR-修改点收集开始时间"]', node => node.value), '2026-05-16')
  await screenshot('machine-horizontal.png')
  pass(13, 'main market is read-only and non-main market edits within bounds')

  await clickButtonStarting('返回')
  await openProjectFromList('tOS版本项目', 'tOS16.3', '张三,李白')
  await clickVisibleText('计划')
  await clickVisibleText('三级计划-MR版本计划', '[role="tab"],button,span')
  await page.waitForSelector('.pms-mr-project-card', { visible: true })
  const searchSelector = 'input[aria-label="搜索tOS版本号"]'
  const searchStorageBefore = await page.evaluate(() => window.localStorage.getItem('pms-mr-version-plan-store'))
  await page.waitForSelector(searchSelector, { visible: true })
  await page.type(searchSelector, '145')
  await page.waitForFunction(() => {
    const versions = [...document.querySelectorAll('.pms-mr-plan-grid--vertical tbody tr[data-mr-tos-version]')]
      .map(row => row.getAttribute('data-mr-tos-version'))
    return versions.length > 0 && [...new Set(versions)].join(',') === '16.3.0.145'
  })
  assert.equal(await page.evaluate(() => window.localStorage.getItem('pms-mr-version-plan-store')), searchStorageBefore)
  await clickVisibleText('横版', 'label,button,span')
  await page.waitForSelector('[aria-label="MR版本计划横版表格"]', { visible: true })
  assert.deepEqual(
    await page.$$eval('.pms-mr-plan-grid--horizontal tbody tr[data-mr-tos-version]', rows => rows.map(row => row.getAttribute('data-mr-tos-version'))),
    ['16.3.0.145'],
  )
  const searchCleared = await page.$eval(searchSelector, input => {
    const clear = input.closest('.ant-input-search')?.querySelector('.ant-input-clear-icon')
    if (!clear) return false
    clear.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }))
    clear.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    clear.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    clear.click()
    return true
  })
  assert.equal(searchCleared, true, '搜索框暴露 allowClear 操作')
  await page.waitForFunction(() => {
    const versions = [...document.querySelectorAll('.pms-mr-plan-grid--horizontal tbody tr[data-mr-tos-version]')]
      .map(row => row.getAttribute('data-mr-tos-version'))
    return [...new Set(versions)].sort().join(',') === '16.3.0.140,16.3.0.145'
  })
  assert.equal(await page.$eval(searchSelector, input => input.value), '')
  assert.equal(Object.hasOwn((await readMrState()), 'versionQuery'), false)
  await page.click('button[aria-label="新增tOS版本号"]')
  await page.click('[aria-label="选择tOS版本号"]')
  await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { visible: true })
  const candidateState = await page.evaluate(() => [...document.querySelectorAll('.ant-select-item-option')].map(node => ({ text: node.textContent?.trim(), disabled: node.classList.contains('ant-select-item-option-disabled') })))
  assert.ok(candidateState.some(item => item.text?.startsWith('16.3.0.140') && item.disabled && item.text.includes('该tOS版本号已添加')))
  assert.ok(candidateState.some(item => item.text?.startsWith('16.3.0.145') && item.disabled && item.text.includes('该tOS版本号已添加')))
  assert.ok(candidateState.some(item => item.text?.startsWith('16.3.0.150') && item.disabled && item.text.includes('请先完善一级计划中的计划开始时间和计划完成时间')))
  await page.keyboard.press('Escape')
  await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { hidden: true })
  await wait(200)
  const cancelBox = await page.$eval('[role="dialog"]', dialog => {
    const button = [...dialog.querySelectorAll('button')].find(node => node.textContent?.trim() === '取消')
    if (!button) return null
    const rect = button.getBoundingClientRect()
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  })
  assert.ok(cancelBox, 'add-version modal exposes a cancel action')
  await page.mouse.click(cancelBox.x, cancelBox.y)
  await page.waitForSelector('[role="dialog"]', { hidden: true })
  await wait(300)
  await clickVisibleText('竖版', 'label,button,span')
  await page.waitForSelector('[aria-label="MR版本计划竖版表格"]', { visible: true })
  pass(11, 'add-version modal explains used and incomplete candidates')

  await screenshot('tos-vertical.png')
  await fillDate('input[aria-label="16.3.0.140-测试开始时间-日期"]', '2026-05-24')
  assert.equal((await readMrState()).tosInstancesByProjectId['19'][0].dates['mr-node-test-start'], '2026-05-24')
  await clickVisibleText('横版', 'label,button,span')
  await page.waitForSelector('[aria-label="MR版本计划横版表格"]', { visible: true })
  assert.equal(await page.$eval('input[aria-label="16.3.0.140-测试开始时间-日期"]', node => node.value), '2026-05-24')
  await screenshot('tos-horizontal.png')
  await clickVisibleText('竖版', 'label,button,span')
  await fillDate('input[aria-label="16.3.0.140-测试开始时间-日期"]', '2026-05-23')
  pass(12, 'tOS vertical and horizontal modes share dates')

  await clickButtonStarting('返回')
  await openMainMenu('config')
  await clickVisibleText('tOS版本项目', '[aria-label="计划模板项目分类"] [role="menuitem"]')
  await clickVisibleText('三级计划-MR版本计划', '[role="tab"],button,span')
  await page.waitForSelector('.pms-mr-template-table', { visible: true })
  await screenshot('configuration.png')
  const templateStateBefore = await readMrState()
  const priorPublished = structuredClone(templateStateBefore.templateVersions.find(version => version.status === '已发布'))
  assert.ok(priorPublished)
  await clickVisibleText('创建修订')
  await page.waitForSelector('button[aria-label="新增一级活动"]', { visible: true })
  const revisionId = (await readMrState()).currentTemplateVersionId
  assert.equal((await readMrState()).templateVersions.find(version => version.id === revisionId)?.status, '修订中')
  await page.click('button[aria-label="新增一级活动"]')
  let inputs = await page.$$('input[aria-label^="活动名称-"]')
  const parentAria = await inputs.at(-1).evaluate(node => node.getAttribute('aria-label'))
  await fillInput(`input[aria-label="${parentAria}"]`, '需求&修改点')
  const parentNumber = parentAria.replace('活动名称-', '')
  const parentId = await page.$eval(`input[aria-label="${parentAria}"]`, input => input.closest('tr')?.dataset.mrTemplateActivityId)
  assert.ok(parentId)
  await page.click(`button[aria-label="新增子活动-${parentNumber}"]`)
  inputs = await page.$$('input[aria-label^="活动名称-"]')
  const retainedChildAria = await inputs.at(-1).evaluate(node => node.getAttribute('aria-label'))
  await fillInput(`input[aria-label="${retainedChildAria}"]`, '保留子活动')
  await page.click(`button[aria-label="新增子活动-${parentNumber}"]`)
  inputs = await page.$$('input[aria-label^="活动名称-"]')
  const deletedChildAria = await inputs.at(-1).evaluate(node => node.getAttribute('aria-label'))
  await fillInput(`input[aria-label="${deletedChildAria}"]`, '临时子活动')
  const beforeDelete = await snapshotTemplateRevision(revisionId)
  const deletedActivity = beforeDelete.version.activities.find(activity => activity.parentId === parentId && activity.activityName === '临时子活动')
  assert.ok(deletedActivity)
  const deleteSelector = `button[aria-label="删除活动-${deletedChildAria.replace('活动名称-', '')}"]`
  const childRow = await page.$(`input[aria-label="${deletedChildAria}"]`)
  assert.ok(childRow, 'new child activity remains addressable after rename')
  const rowHandle = await childRow.evaluateHandle(input => input.closest('tr'))
  await rowHandle.asElement().hover()
  await wait(300)
  const deleteButton = await page.$(deleteSelector)
  assert.ok(deleteButton, 'new child activity exposes its delete action')
  await deleteButton.focus()
  await deleteButton.click()
  const popconfirmSelector = '.ant-popover.ant-popconfirm:not(.ant-popover-hidden)'
  await page.waitForSelector(popconfirmSelector, { visible: true })
  const deleteConfirmed = await page.$eval(popconfirmSelector, popconfirm => {
    const button = [...popconfirm.querySelectorAll('button')]
      .find(node => node.textContent?.replace(/\s/g, '') === '确定')
    if (!button) return false
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }))
    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    button.click()
    return true
  })
  assert.equal(deleteConfirmed, true, 'delete confirmation exposes a confirm action')
  await page.waitForSelector(popconfirmSelector, { hidden: true })
  await page.waitForFunction(deletedId => !document.querySelector(`tr[data-mr-template-activity-id="${deletedId}"]`), {}, deletedActivity.id)
  const afterDelete = await snapshotTemplateRevision(revisionId)
  const beforeDrag = await snapshotTemplateRevision(revisionId)
  const parentNumberBeforeDrag = beforeDrag.domRows.find(row => row.id === parentId)?.number
  const parentBeforeDrag = beforeDrag.version.activities.find(activity => activity.id === parentId)
  const previousParent = beforeDrag.version.activities
    .filter(activity => activity.parentId === null && activity.order < parentBeforeDrag.order)
    .sort((left, right) => right.order - left.order)[0]
  assert.ok(previousParent, 'new parent has a previous same-level drop target')
  const dragGeometry = await page.evaluate(({ parentId, targetId, parentNumber }) => {
    const handle = document.querySelector(`tr[data-mr-template-activity-id="${parentId}"] button[aria-label="拖动活动-${parentNumber}"]`)
    const target = document.querySelector(`tr[data-mr-template-activity-id="${targetId}"]`)
    if (!handle || !target) return null
    const handleRect = handle.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    return {
      from: { x: handleRect.left + handleRect.width / 2, y: handleRect.top + handleRect.height / 2 },
      to: { x: targetRect.left + Math.min(targetRect.width / 3, 240), y: targetRect.top + targetRect.height / 2 },
    }
  }, { parentId, targetId: previousParent.id, parentNumber: parentNumberBeforeDrag })
  assert.ok(dragGeometry)
  await page.mouse.move(dragGeometry.from.x, dragGeometry.from.y)
  await page.mouse.down()
  await page.mouse.move(dragGeometry.from.x, dragGeometry.from.y - 12, { steps: 3 })
  await page.mouse.move(dragGeometry.to.x, dragGeometry.to.y, { steps: 12 })
  await page.mouse.up()
  await page.waitForFunction(({ parentId, previousNumber }) => document.querySelector(`tr[data-mr-template-activity-id="${parentId}"]`)?.dataset.mrTemplateNumber !== previousNumber, {}, { parentId, previousNumber: parentNumberBeforeDrag })
  const afterDrag = await snapshotTemplateRevision(revisionId)
  const retainedChildIds = afterDelete.version.activities.filter(activity => activity.parentId === parentId).map(activity => activity.id)
  assert.equal(retainedChildIds.length, 1)
  const priorPublishedAfterMutation = (await readMrState()).templateVersions.find(version => version.id === priorPublished.id)
  assertTemplateRevisionMutation({
    beforeDelete,
    afterDelete,
    beforeDrag,
    afterDrag,
    deletedId: deletedActivity.id,
    deletedName: deletedActivity.activityName,
    parentId,
    retainedChildIds,
    priorPublished,
    priorPublishedAfter: priorPublishedAfterMutation,
  })
  await clickVisibleText('发布')
  await page.waitForSelector('[role="dialog"]', { visible: true })
  assert.match(await page.$eval('[role="dialog"]', node => node.innerText), /活动名称重复/)
  await page.keyboard.press('Escape')
  await page.waitForSelector('[role="dialog"]', { hidden: true })
  const reorderedParentNumber = afterDrag.domRows.find(row => row.id === parentId)?.number
  await fillInput(`input[aria-label="活动名称-${reorderedParentNumber}"]`, 'MR验收收尾')
  await clickVisibleText('发布')
  await page.waitForFunction(() => document.body.innerText.includes('V2 (已发布)'))
  const publishedState = await readMrState()
  const published = publishedState.templateVersions.find(version => version.versionNo === 'V2' && version.status === '已发布')
  assert.ok(published)
  assertTemplateRevisionMutation({
    beforeDelete,
    afterDelete,
    beforeDrag,
    afterDrag,
    deletedId: deletedActivity.id,
    deletedName: deletedActivity.activityName,
    parentId,
    retainedChildIds,
    priorPublished,
    priorPublishedAfter: publishedState.templateVersions.find(version => version.id === priorPublished.id),
    finalPublished: published,
  })
  assert.equal((await page.$$('input[aria-label^="活动名称-"]')).length, 0)
  pass(14, 'template revision add/delete/reorder/validation/publish')

  const finalText = await bodyText()
  assert.ok(finalText.includes('三级计划-MR版本计划'))
  assert.ok(!finalText.split('\n').some(line => line.trim() === '三级计划'))
  assert.equal(await page.evaluate(() => window.localStorage.getItem('pms-level3-plan-store')), null)
  pass(15, 'legacy standalone level-three UI and storage are absent')

  assert.deepEqual(browserErrors, [], `unexpected browser errors:\n${browserErrors.join('\n')}`)
  assert.deepEqual(failedRequests, [], `unexpected failed requests:\n${failedRequests.join('\n')}`)
  assert.deepEqual(failedHttpResponses, [], `unexpected HTTP error responses:\n${failedHttpResponses.join('\n')}`)
  validateScreenshotEvidence(OUTPUT)
  if (process.env.PMS_FORCE_FAILURE_AFTER_SCREENSHOTS === '1') {
    throw new Error('controlled MR acceptance failure after screenshot validation')
  }
  if (UPDATE_TRACKED_SCREENSHOTS) promoteTrackedScreenshotsAtomically(OUTPUT)
  assertTrackedScreenshotsClean('after browser verification')
  console.log(`MR screenshot evidence: ${OUTPUT}`)
  console.log('PASS MR version plan browser verification')
} catch (error) {
  console.error(error?.stack || error)
  if (browserErrors.length) console.error(`browser errors:\n${browserErrors.join('\n')}`)
  if (failedRequests.length) console.error(`failed requests:\n${failedRequests.join('\n')}`)
  if (failedHttpResponses.length) console.error(`HTTP error responses:\n${failedHttpResponses.join('\n')}`)
  if (fs.existsSync(OUTPUT) && fs.readdirSync(OUTPUT).length > 0) console.error(`MR screenshot evidence preserved after failure: ${OUTPUT}`)
  process.exitCode = 1
} finally {
  await browser.close()
}
