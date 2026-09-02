#!/usr/bin/env node

import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import puppeteer from 'puppeteer'

const BASE_URL = process.env.PMS_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3317'
const TIMEOUT = 20_000
const OUTPUT_DIR = 'docs/prd/assets'
const HEADERS = ['JIRA服务器', 'JIRA库名', '类型', '共库', 'Affect Projects', '操作']
const EDITOR = '.ant-modal [data-jira-project-editor]'

const deadline = async (label, action) => {
  console.log(`STEP ${label}`)
  let timer
  const startedAt = Date.now()
  try {
    const result = await Promise.race([
      Promise.resolve().then(action),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} exceeded ${TIMEOUT}ms`)), TIMEOUT) }),
    ])
    console.log(`PASS ${label} (${Date.now() - startedAt}ms)`)
    return result
  } finally {
    clearTimeout(timer)
  }
}

const clickText = async (page, selector, text, scope = 'body') => {
  const clicked = await page.evaluate((candidateSelector, expected, rootSelector) => {
    const root = document.querySelector(rootSelector)
    const target = Array.from(root?.querySelectorAll(candidateSelector) || []).find(element => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
        && (element.textContent || '').replace(/\s+/g, ' ').trim() === expected
    })
    if (!(target instanceof HTMLElement)) return false
    target.click()
    return true
  }, selector, text, scope)
  assert.equal(clicked, true, `missing visible control: ${scope} ${selector} ${text}`)
}

const clickAria = async (page, label) => {
  const clicked = await page.evaluate(expected => {
    const isVisible = element => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    }
    const element = Array.from(document.querySelectorAll(`[aria-label="${CSS.escape(expected)}"]`)).find(candidate => {
      const target = isVisible(candidate) ? candidate : candidate.closest('label')
      return target && isVisible(target)
    })
    const target = element && (isVisible(element) ? element : element.closest('label'))
    if (!(target instanceof HTMLElement)) return false
    target.click()
    return true
  }, label)
  assert.equal(clicked, true, `missing visible ARIA control: ${label}`)
}

let browser
let page
const applicationErrors = []

try {
  await mkdir(OUTPUT_DIR, { recursive: true })
  browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PMS_CHROME_EXECUTABLE
      || (existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : undefined),
    protocolTimeout: 90_000,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1600,1000'],
  })
  page = await browser.newPage()
  page.setDefaultTimeout(TIMEOUT)
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 })
  page.on('pageerror', error => applicationErrors.push(`[pageerror] ${error.message}`))
  page.on('console', message => { if (message.type() === 'error') applicationErrors.push(`[console.error] ${message.text()}`) })
  page.on('requestfailed', request => applicationErrors.push(`[requestfailed] ${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`))

  await deadline('prewarm app', async () => {
    const response = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT })
    assert.ok(response && response.status() < 400, `HTTP ${response?.status() || 'none'}`)
    await page.waitForSelector('[aria-label="切换当前用户"]', { visible: true })
  })

  await deadline('reset browser state', async () => {
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
    await page.reload({ waitUntil: 'networkidle0', timeout: TIMEOUT })
    await page.waitForFunction(() => document.querySelector('[aria-label="切换当前用户"]')?.getAttribute('data-current-user') === '张三')
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    applicationErrors.length = 0
  })

  await deadline('open project list', async () => {
    await clickText(page, '[role="menuitem"]', '项目列表', '[aria-label="主导航滚动区"]')
    await page.waitForSelector('[aria-label="项目列表视图"]', { visible: true })
  })

  await deadline('open X6877 project space', async () => {
    await clickAria(page, '卡片视图')
    await page.waitForSelector('.pms-project-card-title', { visible: true })
    const opened = await page.evaluate(() => {
      const title = Array.from(document.querySelectorAll('.pms-project-card-title')).find(element => element.getBoundingClientRect().height > 0 && element.textContent?.trim() === 'X6877-D8400_H991')
      const card = title?.closest('.pms-project-card[role="button"]')
      if (!(card instanceof HTMLElement)) return false
      card.click()
      return true
    })
    assert.equal(opened, true, 'X6877 project card missing')
    await page.waitForSelector('.pms-project-info-core-actions', { visible: true })
  })

  await deadline('open reused JIRA editor', async () => {
    await clickText(page, '.pms-project-info-core-actions button', '编辑')
    await page.waitForSelector(EDITOR, { visible: true })
    const headers = await page.$$eval(`${EDITOR} [role="columnheader"]`, elements => elements.map(element => element.querySelector('span')?.textContent?.trim()))
    assert.deepEqual(headers, HEADERS)
  })

  await deadline('verify shared off clears and disables Affect', async () => {
    const row = `${EDITOR} [data-jira-row="0"]`
    const shared = `${row} [data-jira-field="shared"] button`
    const affect = `${row} [data-jira-field="affectProjects"]`
    assert.equal(await page.$eval(shared, element => element.getAttribute('aria-checked')), 'true')
    await page.$eval(shared, element => element.click())
    await page.waitForFunction(selector => {
      const field = document.querySelector(selector)
      const input = field?.querySelector('input')
      return field?.querySelector('.ant-select')?.classList.contains('ant-select-disabled')
        && input instanceof HTMLInputElement && input.disabled
        && !field.querySelector('.ant-select-selection-item')
    }, {}, affect)
    await page.$eval(shared, element => element.click())
    await page.waitForFunction(selector => {
      const field = document.querySelector(selector)
      const input = field?.querySelector('input')
      return !field?.querySelector('.ant-select')?.classList.contains('ant-select-disabled')
        && input instanceof HTMLInputElement && !input.disabled
        && !field.querySelector('.ant-select-selection-item')
    }, {}, affect)
    await page.$eval(shared, element => element.click())
    await page.waitForFunction(selector => {
      const field = document.querySelector(selector)
      const input = field?.querySelector('input')
      return field?.querySelector('.ant-select')?.classList.contains('ant-select-disabled')
        && input instanceof HTMLInputElement && input.disabled
    }, {}, affect)
  })

  await deadline('capture editor evidence', async () => {
    await page.$eval(EDITOR, element => {
      element.querySelector('.pms-jira-project-editor__scroll')?.scrollTo({ left: 0 })
      element.scrollIntoView({ block: 'center', inline: 'center' })
    })
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const editor = await page.$(EDITOR)
    assert.ok(editor)
    await editor.screenshot({ path: join(OUTPUT_DIR, 'jira-project-editor.png') })
  })

  await deadline('close editor', async () => {
    await clickText(page, '.ant-modal-footer button', '取消')
    await page.waitForSelector('.ant-modal-confirm-btns', { visible: true })
    await clickText(page, '.ant-modal-confirm-btns button', '放弃')
    await page.waitForSelector(EDITOR, { hidden: true })
  })

  await deadline('verify and capture full-row display', async () => {
    const section = '.pms-project-info-collapse--extended'
    await page.waitForSelector(section, { visible: true })
    const expanded = await page.$eval(section, element => element.querySelector('.ant-collapse-item')?.classList.contains('ant-collapse-item-active'))
    if (!expanded) await page.click(`${section} .ant-collapse-header`)
    await page.waitForSelector(`${section} .pms-project-info-jira-horizontal`, { visible: true })
    await page.waitForFunction(selector => document.querySelector(selector)?.querySelector('.ant-collapse-item')?.classList.contains('ant-collapse-item-active'), {}, section)
    const state = await page.$eval(section, element => {
      const items = Array.from(element.querySelectorAll('.pms-project-info-display-item')).filter(item => item.getBoundingClientRect().height > 0)
      const jira = element.querySelector('.pms-project-info-jira-horizontal')
      const grid = jira?.closest('.pms-project-info-display-grid')
      const jiraRect = jira?.getBoundingClientRect()
      const gridRect = grid?.getBoundingClientRect()
      const style = jira ? getComputedStyle(jira) : null
      return {
        lastLabel: items.at(-1)?.querySelector('.pms-project-info-display-label')?.textContent?.trim(),
        width: jiraRect?.width || 0,
        gridWidth: gridRect?.width || 0,
        display: style?.display,
        direction: style?.flexDirection,
        links: jira?.querySelectorAll('a').length || 0,
      }
    })
    assert.equal(state.lastLabel, 'JIRA项目')
    assert.ok(state.width >= state.gridWidth - 2, JSON.stringify(state))
    assert.deepEqual([state.display, state.direction, state.links], ['flex', 'row', 2])
    const jiraSelector = `${section} .pms-project-info-jira-horizontal`
    await page.$eval(jiraSelector, element => element.scrollIntoView({ block: 'center', inline: 'center' }))
    await new Promise(resolve => setTimeout(resolve, 400))
    await page.screenshot({ path: join(OUTPUT_DIR, 'jira-project-display.png'), fullPage: false })
  })

  assert.deepEqual(applicationErrors, [], applicationErrors.join('\n'))
  console.log(`PASS JIRA project browser verification: ${BASE_URL}`)
} catch (error) {
  if (page) await page.screenshot({ path: '/tmp/jira-project-browser-failure.png', fullPage: false }).catch(() => undefined)
  throw error
} finally {
  if (browser) {
    await Promise.race([
      browser.close(),
      new Promise(resolve => setTimeout(() => { browser.process()?.kill('SIGTERM'); resolve() }, 5000)),
    ])
  }
}
