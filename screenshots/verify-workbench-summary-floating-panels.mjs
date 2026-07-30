#!/usr/bin/env node

import puppeteer from 'puppeteer'

const BASE_URL = process.env.PMS_BASE_URL || 'http://127.0.0.1:3004'
const STEP_TIMEOUT = 30_000
let currentStep = 'launch'
let browser = null
let page = null
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

const waitForVisible = async selector => {
  await page.waitForFunction(
    value => {
      const element = document.querySelector(value)
      if (!element) return false
      const rect = element.getBoundingClientRect()
      const style = window.getComputedStyle(element)
      return rect.width > 0
        && rect.height > 0
        && style.visibility !== 'hidden'
        && style.display !== 'none'
    },
    { timeout: STEP_TIMEOUT },
    selector,
  )
}

const step = async (name, action) => {
  currentStep = name
  console.log(`RUN ${name}`)
  try {
    await action()
    console.log(`PASS ${name}`)
  } catch (error) {
    const context = await page.evaluate(() => ({
      url: location.href,
      text: (document.body?.innerText || '').slice(0, 1200),
    })).catch(() => ({ url: 'unavailable', text: 'unavailable' }))
    throw new Error(
      `[${name}] ${error instanceof Error ? error.message : String(error)}`
      + `\nURL: ${context.url}\nVisible text:\n${context.text}`,
    )
  }
}

const assertText = async text => {
  const found = await page.evaluate(value => (
    (document.body?.innerText || '').includes(value)
  ), text)
  if (!found) throw new Error(`missing text: ${text}`)
}

const assertSelector = async selector => {
  await waitForVisible(selector)
}

const assertAbsent = async selector => {
  const found = await page.$(selector)
  if (found) throw new Error(`unexpected selector: ${selector}`)
}

const assertNoDrawer = async () => {
  const count = await page.$$eval('.ant-drawer', elements => elements.length)
  if (count !== 0) throw new Error(`expected no .ant-drawer, found ${count}`)
}

const clickAria = async label => {
  const selector = ['筛选', '列设置'].includes(label)
    ? `button[aria-label="${label}"]`
    : `[aria-label="${label}"]`
  await waitForVisible(selector)
  await page.$eval(selector, element => {
    const control = element.matches('button,input')
      ? element
      : element.closest('label')?.querySelector('input')
        ?? element.closest('.ant-select')?.querySelector('input')
        ?? element
    control.focus()
  })
  await page.keyboard.press(
    ['列表视图', '筛选', '列设置'].includes(label) ? 'Space' : 'Enter',
  )
}

const clickExactText = async (scope, selector, text) => {
  const root = await page.$(scope)
  if (!root) throw new Error(`missing click scope: ${scope}`)
  const candidates = await root.$$(selector)
  for (const candidate of candidates) {
    const matches = await candidate.evaluate((element, value) => {
        const rect = element.getBoundingClientRect()
        return rect.width > 0
          && rect.height > 0
          && (element.textContent || '').trim() === value
    }, text)
    if (!matches) continue
    await candidate.focus()
    await page.keyboard.press('Enter')
    return
  }
  throw new Error(`unable to click exact text "${text}" in ${scope}`)
}

const clickCategory = async label => {
  const buttons = await page.$$('[aria-label="项目分类筛选"] button')
  for (const button of buttons) {
    const matches = await button.evaluate((element, value) => (
      (element.textContent || '').trim().startsWith(value)
    ), label)
    if (!matches) continue
    await button.focus()
    await page.keyboard.press('Enter')
    return
  }
  throw new Error(`missing project category: ${label}`)
}

const chooseVisibleOption = async label => {
  await waitForVisible('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
  const options = await page.$$(
    '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option',
  )
  for (const option of options) {
    const matches = await option.evaluate((element, value) => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0
        && rect.height > 0
        && (element.textContent || '').trim() === value
    }, label)
    if (!matches) continue
    await page.keyboard.press('Enter')
    return
  }
  throw new Error(`missing visible select option: ${label}`)
}

const assertSelectText = async (ariaLabel, expected) => {
  const actual = await page.$eval(
    `[aria-label="${ariaLabel}"]`,
    element => (
      element.closest('.ant-select')?.textContent
      || element.parentElement?.textContent
      || element.textContent
      || ''
    ).trim(),
  )
  if (!actual.includes(expected)) {
    throw new Error(`${ariaLabel} expected "${expected}", got "${actual}"`)
  }
}

const waitForPanelFirstControlFocus = async ariaLabel => {
  await page.waitForFunction(label => {
    const panel = document.querySelector(
      `.pms-floating-config-panel[aria-label="${label}"]`,
    )
    if (!panel) return false
    const firstControl = Array.from(panel.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), '
      + 'select:not([disabled]), textarea:not([disabled]), '
      + '[tabindex]:not([tabindex="-1"])',
    )).find(element => element.getClientRects().length > 0)
    return Boolean(firstControl) && document.activeElement === firstControl
  }, { timeout: STEP_TIMEOUT }, ariaLabel)
}

const waitForTriggerFocus = async ariaLabel => {
  await page.waitForFunction(label => (
    document.activeElement?.matches(`button[aria-label="${label}"]`)
  ), { timeout: STEP_TIMEOUT }, ariaLabel)
}

try {
  browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: { width: 1440, height: 1000 },
    args: ['--no-sandbox', '--window-size=1440,1000'],
  })
  page = await browser.newPage()
  page.setDefaultTimeout(STEP_TIMEOUT)
  page.on('pageerror', error => {
    console.error(`[pageerror:${currentStep}] ${error.message}`)
  })
  page.on('console', message => {
    if (message.type() === 'error') {
      console.error(`[console:${currentStep}] ${message.text()}`)
    }
  })

  await step('open workbench', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 30_000 })
    await assertText('项目列表')
  })

  await step('switch to list view and show category prompt', async () => {
    console.log('  action: assert project-list text')
    await assertText('项目列表')
    console.log('  action: click list-view aria')
    await clickAria('列表视图')
    console.log('  action: assert category prompt')
    await assertText('请选择项目分类')
  })

  await step('select machine category and expose quick controls', async () => {
    await clickCategory('整机产品项目')
    await assertSelector('[aria-label="项目二级分类快捷筛选"]')
    await assertSelector('[aria-label="状态快捷筛选"]')
    for (const label of [
      '首销 tOS 版本',
      '芯片编码',
      '品牌',
      '产品系列',
      '产品类型',
    ]) {
      await assertSelector(`[aria-label="快捷筛选-${label}"]`)
    }
  })

  await step('apply linked brand quick filter', async () => {
    await clickAria('快捷筛选-品牌')
    await page.keyboard.type('TECNO')
    await chooseVisibleOption('TECNO')
    await assertSelectText('快捷筛选-品牌', 'TECNO')
  })

  await step('verify advanced filter mirrors brand', async () => {
    console.log('  action: open advanced filter')
    await clickAria('筛选')
    console.log('  action: assert advanced header')
    await assertText('筛选符合以下所有条件的结果')
    console.log('  action: wait for brand value aria')
    await assertSelector('[aria-label="品牌筛选值"]')
    await assertSelectText('品牌筛选值', 'TECNO')
    await waitForPanelFirstControlFocus('筛选')
    await assertNoDrawer()
    await clickExactText(
      '.pms-floating-config-popover',
      'button',
      '取消',
    )
    await waitForTriggerFocus('筛选')
  })

  await step('verify column settings is anchored and Esc closes', async () => {
    console.log('  action: open column settings')
    await clickAria('列设置')
    console.log('  action: assert column panel')
    await assertSelector(
      '.pms-floating-config-panel[aria-label="列设置"]',
    )
    await waitForPanelFirstControlFocus('列设置')
    console.log('  action: assert no drawer')
    await assertNoDrawer()
    await wait(150)
    console.log('  action: press Escape')
    await page.keyboard.press('Escape')
    console.log('  action: wait column panel hidden')
    await page.waitForFunction(selector => {
      const panel = document.querySelector(selector)
      if (!panel) return true
      const rect = panel.getBoundingClientRect()
      const hiddenAncestor = panel.closest('.ant-popover-hidden')
      const popover = panel.closest('.ant-popover')
      const popoverStyle = popover ? window.getComputedStyle(popover) : null
      return Boolean(hiddenAncestor)
        || popoverStyle?.opacity === '0'
        || popoverStyle?.pointerEvents === 'none'
        || rect.width === 0
        || rect.height === 0
        || panel.getClientRects().length === 0
    }, { timeout: STEP_TIMEOUT }, '.pms-floating-config-panel[aria-label="列设置"]')
    await waitForTriggerFocus('列设置')
  })

  await step('switch to tOS category and verify quick-control matrix', async () => {
    await clickCategory('tOS版本项目')
    await assertAbsent('[aria-label="项目二级分类快捷筛选"]')
    await assertAbsent('[aria-label="状态快捷筛选"]')
    await assertSelector('[aria-label="快捷筛选-版本类型"]')
    await assertSelector('[aria-label="快捷筛选-tOS 版本"]')
    await assertAbsent('[aria-label="快捷筛选-品牌"]')
  })

  console.log(`PASS workbench summary floating panels (${BASE_URL})`)
} catch (error) {
  console.error(`FAIL workbench summary floating panels\n${error.stack || error}`)
  process.exitCode = 1
} finally {
  await browser?.close().catch(error => {
    console.error(`[cleanup] ${error instanceof Error ? error.message : String(error)}`)
  })
}
