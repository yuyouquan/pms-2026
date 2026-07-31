#!/usr/bin/env node

import puppeteer from 'puppeteer'

const BASE_URL = process.env.PMS_BASE_URL || 'http://127.0.0.1:3004'
const TIMEOUT = 30_000
const STORAGE_KEY = 'pms-enum-values'
const allowedWarnings = [
  'Warning: [antd: ConfigProvider] `autoInsertSpaceInButton` is deprecated. Please use `{ button: { autoInsertSpace: boolean }}` instead.',
  'Warning: [antd: Space] `split` is deprecated. Please use `separator` instead.',
  'Warning: [antd: Divider] `type` is deprecated. Please use `orientation` instead.',
]
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

const clickExactText = async (page, selector, text) => {
  const clicked = await page.evaluate((candidateSelector, expected) => {
    const element = Array.from(document.querySelectorAll(candidateSelector))
      .find(candidate => (candidate.textContent || '').trim() === expected)
    if (!element) return false
    element.click()
    return true
  }, selector, text)
  if (!clicked) throw new Error(`missing ${selector} with text ${text}`)
  await wait(250)
}

const openEnumConfig = async page => {
  await clickExactText(page, '[role="menuitem"]', '配置中心')
  await page.waitForFunction(() => Array.from(document.querySelectorAll('[role="tab"]'))
    .some(element => (element.textContent || '').includes('枚举值配置')))
  await clickExactText(page, '[role="tab"]', '枚举值配置')
}

const seedEditValue = async page => {
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({
    state: {
      valuesByType: {
        'tos-2-part': ['16.0', '17.2', '18.0'],
        'tos-3-part': ['16.0.1', '16.0.2', '17.2.0'],
      },
    },
    version: 1,
  })), STORAGE_KEY)
  await page.reload({ waitUntil: 'networkidle0' })
  await openEnumConfig(page)
}

const runScenario = async (name, options, scenario) => {
  console.log(`RUN ${name}`)
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  const browserErrors = []
  page.setDefaultTimeout(TIMEOUT)
  page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`))
  page.on('console', message => {
    if (message.type() !== 'error' || allowedWarnings.includes(message.text())) return
    browserErrors.push(`console: ${message.text()}`)
  })
  try {
    await page.setViewport(options.viewport)
    if (options.beforeGoto) await options.beforeGoto(page)
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: TIMEOUT })
    await scenario(page)
    if (browserErrors.length) throw new Error(browserErrors.join('\n'))
    console.log(`PASS ${name}`)
  } finally {
    await context.close()
    await browser.close()
  }
}

try {
  await runScenario('corrupt persistence recovers by exact-key reset', {
    viewport: { width: 640, height: 900 },
  }, async page => {
    await page.evaluate(key => {
      localStorage.setItem(key, '{damaged-json')
      localStorage.setItem(`${key}-neighbor`, 'keep-me')
    }, STORAGE_KEY)
    await page.reload({ waitUntil: 'networkidle0' })
    await openEnumConfig(page)
    await page.waitForFunction(() => document.body.innerText.includes('本地枚举配置无法读取'))
    await clickExactText(page, 'button', '重试')
    await page.waitForFunction(() => document.body.innerText.includes('本地枚举配置无法读取'))
    await clickExactText(page, 'button', '重置本地配置')
    await page.waitForSelector('[aria-label="枚举值配置"]', { visible: true })
    const stored = await page.evaluate(key => ({
      value: localStorage.getItem(key),
      neighbor: localStorage.getItem(`${key}-neighbor`),
    }), STORAGE_KEY)
    if (stored.neighbor !== 'keep-me') throw new Error('reset removed a neighboring key')
    if (!stored.value || JSON.parse(stored.value).state.valuesByType['tos-2-part'][0] !== '16.0') {
      throw new Error('reset did not persist seeds')
    }
  })

  await runScenario('unavailable storage reports error and retries', {
    viewport: { width: 640, height: 900 },
    beforeGoto: page => page.evaluateOnNewDocument(key => {
      const getItem = Storage.prototype.getItem
      const setItem = Storage.prototype.setItem
      const removeItem = Storage.prototype.removeItem
      window.__enumStorageUnavailable = true
      Storage.prototype.getItem = function patchedGetItem(name) {
        if (name === key && window.__enumStorageUnavailable) throw new DOMException('Storage blocked', 'SecurityError')
        return getItem.call(this, name)
      }
      Storage.prototype.setItem = function patchedSetItem(name, value) {
        if (name === key && window.__enumStorageUnavailable) throw new DOMException('Storage blocked', 'SecurityError')
        return setItem.call(this, name, value)
      }
      Storage.prototype.removeItem = function patchedRemoveItem(name) {
        if (name === key && window.__enumStorageUnavailable) throw new DOMException('Storage blocked', 'SecurityError')
        return removeItem.call(this, name)
      }
    }, STORAGE_KEY),
  }, async page => {
    await openEnumConfig(page)
    await page.waitForFunction(() => document.body.innerText.includes('本地枚举存储不可用'))
    await page.evaluate(() => { window.__enumStorageUnavailable = false })
    await clickExactText(page, 'button', '重试')
    await page.waitForSelector('[aria-label="枚举值配置"]', { visible: true })
  })

  await runScenario('failed storage write rolls back without success feedback', {
    viewport: { width: 640, height: 900 },
  }, async page => {
    await page.evaluate(key => localStorage.removeItem(key), STORAGE_KEY)
    await page.reload({ waitUntil: 'networkidle0' })
    await openEnumConfig(page)
    await page.evaluate(key => {
      const setItem = Storage.prototype.setItem
      Storage.prototype.setItem = function patchedSetItem(name, value) {
        if (name === key) throw new DOMException('Storage blocked', 'SecurityError')
        return setItem.call(this, name, value)
      }
    }, STORAGE_KEY)
    await page.$eval('[data-enum-add-value]', element => element.click())
    const input = 'input[aria-label="枚举值"]'
    await page.waitForSelector(input, { visible: true })
    await page.$eval(input, element => element.focus())
    await page.keyboard.type('18.0')
    await page.$eval('button[aria-label="确认枚举值"]', element => element.click())
    await page.waitForFunction(() => document.body.innerText.includes('本地枚举存储不可用'))
    const falseSuccess = await page.evaluate(() => document.body.innerText.includes('枚举值已新增'))
    if (falseSuccess) throw new Error('write failure displayed a success message')
  })

  await runScenario('320px user dropdown stays in the viewport', {
    viewport: { width: 320, height: 900 },
  }, async page => {
    await page.$eval('button[aria-label="切换当前用户"]', element => element.click())
    await page.waitForSelector('.ant-dropdown:not(.ant-dropdown-hidden)', { visible: true })
    const bounds = await page.$eval('.ant-dropdown:not(.ant-dropdown-hidden)', element => {
      const rect = element.getBoundingClientRect()
      return { left: rect.left, right: rect.right, viewport: innerWidth, documentWidth: document.documentElement.scrollWidth }
    })
    if (bounds.left < 8 || bounds.right > bounds.viewport - 8 || bounds.documentWidth > bounds.viewport) {
      throw new Error(`dropdown escaped viewport: ${JSON.stringify(bounds)}`)
    }
  })

  await runScenario('edit cancel restores the original trigger', {
    viewport: { width: 640, height: 900 },
  }, async page => {
    await seedEditValue(page)
    const trigger = 'button[aria-label="编辑枚举值 18.0"]'
    await page.waitForSelector(trigger, { visible: true })
    await page.$eval(trigger, element => element.click())
    await page.waitForSelector('input[aria-label="枚举值"]', { visible: true })
    await page.$eval('button[aria-label="取消枚举值编辑"]', element => element.click())
    await wait(700)
    const activeLabel = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))
    if (activeLabel !== '编辑枚举值 18.0') throw new Error(`cancel focus landed on ${activeLabel}`)
  })

  await runScenario('edit success focuses the updated row', {
    viewport: { width: 640, height: 900 },
  }, async page => {
    await seedEditValue(page)
    await page.$eval('button[aria-label="编辑枚举值 18.0"]', element => element.click())
    const input = 'input[aria-label="枚举值"]'
    await page.waitForSelector(input, { visible: true })
    await page.$eval(input, element => {
      element.focus()
      element.select()
    })
    await page.keyboard.type('18.1')
    await page.$eval('button[aria-label="确认枚举值"]', element => element.click())
    await wait(700)
    const activeLabel = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))
    if (activeLabel !== '编辑枚举值 18.1') throw new Error(`success focus landed on ${activeLabel}`)
  })

  console.log(`PASS enum configuration browser recovery (${BASE_URL})`)
} catch (error) {
  console.error(`FAIL enum configuration browser recovery\n${error.stack || error}`)
  process.exitCode = 1
}
