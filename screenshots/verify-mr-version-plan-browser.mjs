#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'
import { waitForApplicationBundles } from './level1-browser-harness.mjs'

const BASE_URL = process.env.PMS_BASE_URL || 'http://127.0.0.1:3004'
const TIMEOUT = Number(process.env.PMS_BROWSER_TIMEOUT || 45_000)
const OUTPUT = path.join(process.cwd(), 'screenshots', 'mr-version-plan')
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

fs.mkdirSync(OUTPUT, { recursive: true })
for (const file of [...EXPECTED_SCREENSHOTS, 'failure.png']) {
  const target = path.join(OUTPUT, file)
  if (fs.existsSync(target)) fs.unlinkSync(target)
}

await waitForApplicationBundles({ baseUrl: BASE_URL, timeoutMs: 60_000, requestTimeoutMs: 30_000 })

const MAC_SYSTEM_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const configuredBrowser = process.env.PMS_CHROME_EXECUTABLE
  || (fs.existsSync(MAC_SYSTEM_CHROME) ? MAC_SYSTEM_CHROME : undefined)
const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: configuredBrowser,
  protocolTimeout: Math.max(30_000, TIMEOUT * 2),
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
const cdp = await page.createCDPSession()
await page.setViewport({ width: 1600, height: 1000 })
page.setDefaultTimeout(TIMEOUT)
await page.evaluateOnNewDocument(() => {
  try {
    window.localStorage.removeItem('pms-mr-version-plan-store')
    window.localStorage.removeItem('pms-level3-plan-store')
  } catch {
    // about:blank has no storage origin; the hook runs again for the app origin.
  }
})

const browserErrors = []
page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`))
page.on('console', message => { if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`) })

const pass = (step, label) => console.log(`${STEP_MARKERS[step - 1]} ${label}`)
const screenshot = async name => {
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
  const optionBox = await page.evaluate(({ option, controlId }) => {
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
    if (!item) return null
    const rect = item.getBoundingClientRect()
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  }, { option, controlId })
  if (optionBox) {
    await page.mouse.click(optionBox.x, optionBox.y)
  } else {
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
  const existingValue = await page.$eval(selector, input => input.value)
  if (existingValue) {
    await page.click(selector)
    await page.waitForSelector('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)', { visible: true })
    await wait(300)
    const controlId = await page.$eval(selector, node => node.getAttribute('aria-controls'))
    const dateBox = await page.evaluate(({ value, controlId, selector }) => {
      const inputRect = document.querySelector(selector)?.getBoundingClientRect()
      const visibleDropdowns = [...document.querySelectorAll('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)')].filter(node => {
          const rect = node.getBoundingClientRect()
          const style = getComputedStyle(node)
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden'
        })
      const controlled = controlId ? document.getElementById(controlId)?.closest('.ant-picker-dropdown') : null
      const dropdown = controlled && visibleDropdowns.includes(controlled)
        ? controlled
        : visibleDropdowns.sort((left, right) => {
          if (!inputRect) return 0
          const distance = node => {
            const rect = node.getBoundingClientRect()
            return Math.abs(rect.left - inputRect.left) + Math.abs(rect.top - inputRect.bottom)
          }
          return distance(left) - distance(right)
        })[0]
      const cell = [...(dropdown?.querySelectorAll(`td[title="${value}"]`) ?? [])]
        .find(node => {
          const rect = node.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== 'hidden'
        })
      if (!cell) return null
      const rect = cell.getBoundingClientRect()
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    }, { value, controlId, selector })
    if (dateBox) {
      await page.mouse.click(dateBox.x, dateBox.y)
      await wait(450)
      return
    }
    await page.keyboard.press('Escape')
  }
  await page.click(selector)
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
  await page.keyboard.down(modifier)
  await page.keyboard.press('A')
  await page.keyboard.up(modifier)
  await page.keyboard.press('Backspace')
  await page.keyboard.type(value)
  await page.keyboard.press('Enter')
  await wait(450)
}

async function switchUser(user) {
  let optionBox = null
  for (let attempt = 0; attempt < 2 && !optionBox; attempt += 1) {
    await page.click('button[aria-label="切换当前用户"]')
    await wait(350)
    optionBox = await page.evaluate(user => {
      const name = [...document.querySelectorAll('.pms-user-dropdown .pms-user-menu__name')]
        .find(node => {
          const rect = node.getBoundingClientRect()
          const style = getComputedStyle(node)
          return rect.width > 0 && rect.height > 0 && style.display !== 'none'
            && style.visibility !== 'hidden' && node.textContent?.trim() === user
        })
      const item = name?.closest('[role="menuitem"]')
      if (!item) return null
      const rect = item.getBoundingClientRect()
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    }, user)
  }
  assert.ok(optionBox, `switch user option exists: ${user}`)
  await page.mouse.click(optionBox.x, optionBox.y)
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
  pass(1, 'header order and joint-space entry')

  const jointRows = await page.$$eval('.pms-joint-mr-table tbody tr.ant-table-row', rows => rows.map(row => ({ text: row.innerText, pickerCount: row.querySelectorAll('.ant-picker').length, selectCount: row.querySelectorAll('.ant-select').length })))
  assert.ok(jointRows[0].text.startsWith('16.3.0.140\ttOS16.3'))
  assert.equal(jointRows[0].pickerCount, 0)
  assert.equal(jointRows[0].selectCount, 0)
  assert.ok(jointRows.findIndex(row => row.text.includes('X6855_H8917')) > 0)
  pass(2, 'tOS reference precedes machine rows and is read-only')

  const stickyCheck = await page.$eval('.pms-joint-mr-table .ant-table-body', body => {
    body.scrollLeft = 1200
    const fixed = body.querySelector('tbody tr.ant-table-row td.ant-table-cell-fix-start, tbody tr.ant-table-row td.ant-table-cell-fix-left')
    if (!fixed) return null
    const rect = fixed.getBoundingClientRect()
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    const color = getComputedStyle(fixed).backgroundColor
    return {
      ownsHit: hit === fixed || fixed.contains(hit),
      color,
      zIndex: getComputedStyle(fixed).zIndex,
      fixedText: fixed.textContent?.trim(),
      hitText: hit?.textContent?.trim(),
      hitClass: hit instanceof HTMLElement ? hit.className : '',
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    }
  })
  if (!stickyCheck?.ownsHit) console.error('sticky diagnostic', stickyCheck)
  assert.ok(stickyCheck?.ownsHit)
  assert.doesNotMatch(stickyCheck.color, /rgba\([^)]*,\s*0\)/)
  assert.notEqual(stickyCheck.zIndex, 'auto')
  pass(3, 'fixed columns remain opaque after horizontal scroll')
  await page.$eval('.pms-joint-mr-table .ant-table-body', body => { body.scrollLeft = 0 })
  await wait(200)

  await fillInput('input[aria-label="项目名称"]', 'X6877-D8400_H991')
  const filteredTexts = await page.$$eval('.pms-joint-mr-table tbody tr.ant-table-row', rows => rows.map(row => row.innerText))
  assert.ok(filteredTexts.some(text => text.includes('X6877-D8400_H991')))
  assert.ok(filteredTexts.every(text => text.includes('X6877-D8400_H991')))
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
  assert.deepEqual((await readMrState()).machinePlansByKey['1::16.3.0.145'].dates, {})
  const naRowText = await page.$eval('[aria-label="1-16.3.0.145-1+N版本类型"]', node => node.closest('tr')?.innerText || '')
  assert.ok(naRowText.includes('N/A'))
  await chooseSelect('1-16.3.0.145-1+N版本类型', '1', 'N/A')
  pass(7, 'N/A clears dates and displays slashes')

  assert.ok(await page.$$eval('.pms-joint-mr-table .pms-mr-invalid-cell', nodes => nodes.length) > 0)
  const errorIcon = await page.$('.pms-joint-mr-error-icon')
  assert.ok(errorIcon)
  await errorIcon.hover()
  await page.waitForSelector('.ant-tooltip', { visible: true })
  assert.match(await page.$eval('.ant-tooltip', node => node.innerText), /整机产品项目的MP入库截止时间不得晚于tOS项目时间/)
  assert.equal((await readMrState()).machinePlansByKey['3::16.3.0.140'].dates['mr-node-mp-intake-deadline'], '2026-05-25')
  await screenshot('joint-invalid.png')
  pass(8, 'invalid canonical date persists with red exact tooltip')

  await clickVisibleText('停止发版')
  await chooseSelect('停止发版项目名称', 'X6877-D8400_H991')
  await fillDate('input[aria-label="停止发版日期"]', '2026-05-31')
  await clickVisibleText('确认停止')
  await wait(500)
  const stoppedState = await readMrState()
  assert.ok(stoppedState.machinePlansByKey['1::16.3.0.140'])
  assert.equal(stoppedState.machinePlansByKey['1::16.3.0.145'], undefined)
  assert.equal(stoppedState.stopReleaseRecords.at(-1).projectId, '1')
  await clickVisibleText('停止发版记录')
  await page.waitForSelector('[role="dialog"]', { visible: true })
  assert.match(await page.$eval('[role="dialog"]', node => node.innerText), /X6877-D8400_H991/)
  await screenshot('stop-record.png')
  await page.keyboard.press('Escape')
  await page.waitForSelector('[role="dialog"]', { hidden: true })
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
  await page.click('button[aria-label="新增tOS版本号"]')
  await page.click('[aria-label="选择tOS版本号"]')
  await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { visible: true })
  const candidateState = await page.evaluate(() => [...document.querySelectorAll('.ant-select-item-option')].map(node => ({ text: node.textContent?.trim(), disabled: node.classList.contains('ant-select-item-option-disabled') })))
  assert.ok(candidateState.some(item => item.text?.startsWith('16.3.0.140') && item.disabled && item.text.includes('该tOS版本号已添加')))
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
  await clickVisibleText('创建修订')
  await page.waitForSelector('button[aria-label="新增一级活动"]', { visible: true })
  await page.click('button[aria-label="新增一级活动"]')
  let inputs = await page.$$('input[aria-label^="活动名称-"]')
  const parentAria = await inputs.at(-1).evaluate(node => node.getAttribute('aria-label'))
  await fillInput(`input[aria-label="${parentAria}"]`, '需求&修改点')
  const parentNumber = parentAria.replace('活动名称-', '')
  await page.click(`button[aria-label="新增子活动-${parentNumber}"]`)
  inputs = await page.$$('input[aria-label^="活动名称-"]')
  const childAria = await inputs.at(-1).evaluate(node => node.getAttribute('aria-label'))
  await fillInput(`input[aria-label="${childAria}"]`, '临时子活动')
  const deleteSelector = `button[aria-label="删除活动-${childAria.replace('活动名称-', '')}"]`
  const childRow = await page.$(`input[aria-label="${childAria}"]`)
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
  const confirmBox = await page.$eval(popconfirmSelector, popconfirm => {
    const button = [...popconfirm.querySelectorAll('button')]
      .find(node => node.textContent?.replace(/\s/g, '') === '确定')
    if (!button) return null
    const rect = button.getBoundingClientRect()
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  })
  assert.ok(confirmBox, 'delete confirmation exposes a confirm action')
  await page.mouse.click(confirmBox.x, confirmBox.y)
  await page.waitForSelector(popconfirmSelector, { hidden: true })
  const drag = await page.$(`button[aria-label="拖动活动-${parentNumber}"]`)
  assert.ok(drag)
  await drag.focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Space')
  await clickVisibleText('发布')
  await page.waitForSelector('[role="dialog"]', { visible: true })
  assert.match(await page.$eval('[role="dialog"]', node => node.innerText), /活动名称重复/)
  await page.keyboard.press('Escape')
  await fillInput(`input[aria-label="活动名称-${parentNumber}"]`, 'MR验收收尾')
  await clickVisibleText('发布')
  await page.waitForFunction(() => document.body.innerText.includes('V2 (已发布)'))
  const publishedState = await readMrState()
  const published = publishedState.templateVersions.find(version => version.versionNo === 'V2' && version.status === '已发布')
  assert.ok(published)
  assert.ok(published.activities.some(activity => activity.activityName === 'MR验收收尾'))
  assert.equal((await page.$$('input[aria-label^="活动名称-"]')).length, 0)
  pass(14, 'template revision add/delete/reorder/validation/publish')

  const finalText = await bodyText()
  assert.ok(finalText.includes('三级计划-MR版本计划'))
  assert.ok(!finalText.split('\n').some(line => line.trim() === '三级计划'))
  assert.equal(await page.evaluate(() => window.localStorage.getItem('pms-level3-plan-store')), null)
  pass(15, 'legacy standalone level-three UI and storage are absent')

  assert.deepEqual(browserErrors, [], `unexpected browser errors:\n${browserErrors.join('\n')}`)
  for (const file of EXPECTED_SCREENSHOTS) assert.ok(fs.statSync(path.join(OUTPUT, file)).size > 1_000, `${file} is current and non-empty`)
  console.log('PASS MR version plan browser verification')
} catch (error) {
  console.error(error?.stack || error)
  if (browserErrors.length) console.error(`browser errors:\n${browserErrors.join('\n')}`)
  try {
    await Promise.race([
      page.screenshot({ path: path.join(OUTPUT, 'failure.png'), fullPage: false }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('failure screenshot timeout')), 5_000)),
    ])
  } catch {}
  process.exitCode = 1
} finally {
  await browser.close()
}
