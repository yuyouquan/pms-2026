#!/usr/bin/env node

import puppeteer from 'puppeteer'

const BASE_URL = process.env.PMS_BASE_URL || 'http://127.0.0.1:3004'
const STEP_TIMEOUT = 30_000
let currentStep = 'launch'
let browser = null
let page = null
const unexpectedBrowserErrors = []
const ALLOWED_ANTD_DEPRECATIONS = [
  'Warning: [antd: ConfigProvider] `autoInsertSpaceInButton` is deprecated. Please use `{ button: { autoInsertSpace: boolean }}` instead.',
  'Warning: [antd: Space] `split` is deprecated. Please use `separator` instead.',
  'Warning: [antd: Divider] `type` is deprecated. Please use `orientation` instead.',
  'Warning: [antd: Drawer] `width` is deprecated. Please use `size` instead.',
]
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
  await page.waitForFunction(value => (
    (document.body?.innerText || '').includes(value)
  ), { timeout: STEP_TIMEOUT }, text)
}

const assertSelector = async selector => {
  await waitForVisible(selector)
}

const waitForReactControl = async (selector, handler) => {
  await page.waitForFunction((controlSelector, handlerName) => {
    const element = document.querySelector(controlSelector)
    if (!element) return false
    return Object.keys(element).some(key => (
      key.startsWith('__reactProps$') && typeof element[key]?.[handlerName] === 'function'
    ))
  }, { timeout: STEP_TIMEOUT }, selector, handler)
}

const assertAbsent = async selector => {
  const found = await page.$(selector)
  if (found) throw new Error(`unexpected selector: ${selector}`)
}

const assertNoDrawer = async () => {
  const count = await page.$$eval('.ant-drawer', elements => elements.length)
  if (count !== 0) throw new Error(`expected no .ant-drawer, found ${count}`)
}

const assertSelectedTopNav = async expected => {
  await page.waitForFunction(value => (
    (document.querySelector('.ant-menu-item-selected')?.textContent || '').trim() === value
  ), { timeout: STEP_TIMEOUT }, expected)
}

const clickTodoSource = async label => {
  const sourceLabel = ({ 计划待办: '计划', 转维待办: '转维' })[label] || label
  const clicked = await page.evaluate(value => {
    const item = Array.from(document.querySelectorAll('.pms-todo-directory__item'))
      .find(element => {
        const text = (element.textContent || '').trim()
        return text === value || element.getAttribute('aria-label')?.startsWith(`${value}，`)
      })
    if (!item) return false
    item.click()
    return true
  }, sourceLabel)
  if (!clicked) throw new Error(`missing todo source: ${label}`)
  await assertSelectedTodoSource(sourceLabel)
}

const assertSelectedTodoSource = async label => {
  await page.waitForFunction(value => {
    const selected = document.querySelector('.pms-todo-directory__item[aria-current="page"]')
    if (!selected) return false
    return (selected.textContent || '').trim() === value
      || selected.getAttribute('aria-label')?.startsWith(`${value}，`)
  }, { timeout: STEP_TIMEOUT }, label)
}

const readTodoCount = async () => page.$eval(
  '.pms-todo-center__result-status[role="status"]',
  element => {
    const match = (element.textContent || '').match(/共\s*(\d+)\s*条任务/)
    if (!match) throw new Error(`unreadable todo result status: ${element.textContent || ''}`)
    return Number(match[1])
  },
)

const waitForTodoCount = async expected => {
  await page.waitForFunction(expectedCount => {
    const element = document.querySelector('.pms-todo-center__result-status[role="status"]')
    const match = (element?.textContent || '').match(/共\s*(\d+)\s*条任务/)
    return Number(match?.[1]) === expectedCount
  }, { timeout: STEP_TIMEOUT }, expected)
}

const openTodoRowWithKeyboard = async title => {
  const selector = `button[aria-label="前往处理 ${title}"]`
  await waitForVisible(selector)
  await page.focus(selector)
  await page.keyboard.press('Enter')
}

const assertCurrentPlanVersion = async versionLabel => {
  await waitForVisible(`.ant-select-content[title="${versionLabel}"]`)
}

const switchUser = async (currentUser, nextUser) => {
  const trigger = 'button[aria-label="切换当前用户"]'
  console.log(`    switch user: locate ${currentUser}`)
  await waitForVisible(trigger)
  await page.$eval(trigger, element => element.click())
  console.log('    switch user: menu opened')
  await waitForVisible('.ant-dropdown:not(.ant-dropdown-hidden)')
  const clicked = await page.evaluate(user => {
    const item = Array.from(document.querySelectorAll('.ant-dropdown-menu-item'))
      .find(element => Array.from(element.querySelectorAll('span')).some(span => (span.textContent || '').trim() === user))
    if (!item) return false
    item.click()
    return true
  }, nextUser)
  if (!clicked) throw new Error(`missing user switch option: ${nextUser}`)
  console.log(`    switch user: selected ${nextUser}`)
  await page.waitForFunction(user => (
    document.querySelector('button[aria-label="切换当前用户"]')?.getAttribute('data-current-user') === user
  ), { timeout: STEP_TIMEOUT }, nextUser)
  console.log(`    switch user: rendered ${nextUser}`)
}

const fillReactInput = async (selector, value) => {
  await waitForVisible(selector)
  await waitForReactControl(selector, 'onChange')
  await page.click(selector, { clickCount: 3 })
  await page.keyboard.press('Backspace')
  await page.keyboard.sendCharacter(value)
  await page.waitForFunction((inputSelector, expected) => (
    document.querySelector(inputSelector)?.value === expected
  ), { timeout: STEP_TIMEOUT }, selector, value)
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
    ['卡片视图', '列表视图', '筛选', '列设置'].includes(label) ? 'Space' : 'Enter',
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

const clickVisibleTextCard = async (scope, text) => {
  const clicked = await page.evaluate((scopeSelector, value) => {
    const root = document.querySelector(scopeSelector)
    if (!root) return false
    const candidates = Array.from(root.querySelectorAll('*'))
    for (const candidate of candidates) {
      const rect = candidate.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      if ((candidate.textContent || '').trim() !== value) continue
      let clickable = candidate
      while (clickable && clickable !== root) {
        if (window.getComputedStyle(clickable).cursor === 'pointer') {
          clickable.click()
          return true
        }
        clickable = clickable.parentElement
      }
    }
    return false
  }, scope, text)
  if (!clicked) throw new Error(`unable to click card containing exact text "${text}"`)
}

const clickExactButtonIfVisible = async text => {
  const buttons = await page.$$('button')
  for (const button of buttons) {
    const matches = await button.evaluate((element, value) => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0
        && rect.height > 0
        && (element.textContent || '').trim() === value
    }, text)
    if (!matches) continue
    await button.click()
    return true
  }
  return false
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

const waitForTriggerFocus = async ariaLabel => {
  await page.waitForFunction(label => (
    document.activeElement?.matches(`button[aria-label="${label}"]`)
  ), { timeout: STEP_TIMEOUT }, ariaLabel)
}

const attachPageObservers = targetPage => {
  targetPage.setDefaultTimeout(STEP_TIMEOUT)
  targetPage.on('pageerror', error => {
    const detail = `[pageerror:${currentStep}] ${error.message}`
    unexpectedBrowserErrors.push(detail)
    console.error(detail)
  })
  targetPage.on('console', message => {
    if (message.type() !== 'error') return
    if (ALLOWED_ANTD_DEPRECATIONS.includes(message.text())) {
      console.warn(`[console:${currentStep}] ${message.text()}`)
      return
    }
    const detail = `[console:${currentStep}] ${message.text()}`
    unexpectedBrowserErrors.push(detail)
    console.error(detail)
  })
  targetPage.on('response', response => {
    if (response.status() < 400) return
    const url = response.url()
    if (response.status() === 404 && /\/favicon\.ico(?:\?|$)/.test(url)) return
    const detail = `[response:${currentStep}] ${response.status()} ${url}`
    unexpectedBrowserErrors.push(detail)
    console.error(detail)
  })
}

try {
  browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PMS_CHROME_EXECUTABLE || undefined,
    defaultViewport: { width: 1440, height: 1000 },
    args: ['--no-sandbox', '--window-size=1440,1000'],
  })
  page = await browser.newPage()
  attachPageObservers(page)

  await step('open default workbench task directory', async () => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await assertSelectedTopNav('工作台')
    await assertAbsent('[aria-label="项目列表视图"]')
    await assertSelector('[aria-label="个人工作台任务"]')
    await assertSelector('[aria-label="任务目录"]')
    await assertSelector('.pms-todo-directory__item[aria-label^="计划，"]')
    await assertSelector('.pms-todo-directory__item[aria-label^="转维，"]')
    await assertSelector('[role="tablist"][aria-label="任务状态"]')
    for (const label of ['全部', '待处理', '已完成']) {
      await page.waitForFunction(value => Array.from(
        document.querySelectorAll('[role="tablist"][aria-label="任务状态"] [role="tab"]'),
      ).some(element => (element.textContent || '').trim().startsWith(value)), { timeout: STEP_TIMEOUT }, label)
    }
    await assertSelector('[aria-label="搜索待办"]')
    await assertSelector('[aria-label="项目筛选"]')
    await assertSelector('[aria-label="生成时间"]')
    await assertSelector('[aria-label="清空筛选"]')
    await waitForReactControl('[aria-label="搜索待办"]', 'onChange')
  })

  await step('todo directory and filters update the result count', async () => {
    console.log('  action: select transfer source')
    await clickTodoSource('转维待办')
    console.log('  action: wait transfer result count')
    await waitForTodoCount(1)
    await assertText('转维资料录入')
    await fillReactInput('[aria-label="搜索待办"]', '不存在的待办')
    await waitForTodoCount(0)
    await assertText('暂无符合条件的任务')
    await clickExactText('body', 'button', '清空筛选')
    await waitForTodoCount(1)

    console.log('  action: select empty plan source')
    await clickTodoSource('计划待办')
    await waitForTodoCount(0)
    await assertText('暂无待处理任务')
    await clickTodoSource('转维待办')
    await waitForTodoCount(1)
  })

  await step('open transfer todo and return to todo origin', async () => {
    await clickTodoSource('转维待办')
    await waitForTodoCount(1)
    await openTodoRowWithKeyboard('转维资料录入')
    await assertText('X6877-D8400_H991 - 资料录入')
    await assertText('返回工作台')
    await clickExactText('body', 'button', '返回工作台')
    await assertSelectedTopNav('工作台')
    await assertSelector('[aria-label="个人工作台任务"]')
    await assertSelectedTodoSource('转维')
  })

  await step('navigate to dedicated project list', async () => {
    await clickExactText('body', '[role="menuitem"]', '项目列表')
    await assertSelectedTopNav('项目列表')
    await assertSelector('[aria-label="项目列表视图"]')
  })

  await step('switch to list view and keep default machine category', async () => {
    console.log('  action: assert project-list text')
    await assertText('项目列表')
    console.log('  action: click list-view aria')
    await clickAria('列表视图')
    console.log('  action: assert default machine matrix and no first-level all option')
    await assertText('产品系列')
    await assertText('首销tOS版本')
    const categoryLabels = await page.$$eval('[aria-label="项目分类筛选"] button', buttons => (
      buttons.map(button => (button.textContent || '').trim().replace(/\s+\d+$/, ''))
    ))
    if (categoryLabels.includes('全部') || categoryLabels[0] !== '整机产品项目') {
      throw new Error(`unexpected category labels: ${JSON.stringify(categoryLabels)}`)
    }
  })

  await step('select machine category and expose current category controls', async () => {
    await clickCategory('整机产品项目')
    console.log('  action: assert secondary/status quick rows')
    await assertSelector('[aria-label="项目二级分类快捷筛选"]')
    await assertSelector('[aria-label="状态快捷筛选"]')
  })

  await step('verify advanced filter is layered and applies immediately', async () => {
    console.log('  action: open advanced filter')
    await clickAria('筛选')
    console.log('  action: assert advanced header')
    await assertText('项目筛选')
    await assertText('符合以下所有条件')
    console.log('  action: assert the empty current filter condition')
    await assertSelector('[aria-label="筛选字段"]')
    await assertNoDrawer()
    const obsoleteActions = await page.$$eval(
      '.pms-floating-config-popover button',
      buttons => buttons
        .map(button => (button.textContent || '').trim())
        .filter(text => ['确认', '取消'].includes(text)),
    )
    if (obsoleteActions.length) throw new Error(`obsolete filter actions: ${obsoleteActions.join(',')}`)
    console.log('  action: open filter-field dropdown')
    await clickAria('筛选字段')
    await waitForVisible('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
    console.log('  action: verify popup layers')
    const popupLayers = await page.evaluate(() => {
      const panel = Array.from(document.querySelectorAll('.pms-floating-config-popover'))
        .find(element => element.getClientRects().length > 0)
      const dropdown = Array.from(document.querySelectorAll('.ant-select-dropdown'))
        .find(element => element.getClientRects().length > 0)
      return {
        panel: Number(window.getComputedStyle(panel).zIndex),
        dropdown: Number(window.getComputedStyle(dropdown).zIndex),
      }
    })
    if (!(popupLayers.dropdown > popupLayers.panel)) {
      throw new Error(`filter dropdown must be above panel: ${JSON.stringify(popupLayers)}`)
    }
    await page.keyboard.press('Escape')
    console.log('  action: remove condition and close filter')
    await page.$eval(
      '.pms-floating-config-popover button[aria-label="删除筛选条件"]',
      element => element.click(),
    )
    await page.$eval(
      '.pms-floating-config-popover button[aria-label="关闭筛选"]',
      element => element.click(),
    )
    console.log('  action: wait filter trigger focus restored')
    await waitForTriggerFocus('筛选')
  })

  await step('verify column settings is anchored and Esc closes', async () => {
    console.log('  action: open column settings')
    await clickAria('字段配置')
    console.log('  action: assert column panel')
    await assertSelector(
      '.pms-floating-config-panel[aria-label="字段配置"]',
    )
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
    }, { timeout: STEP_TIMEOUT }, '.pms-floating-config-panel[aria-label="字段配置"]')
    await waitForTriggerFocus('字段配置')
  })

  await step('switch to tOS category and verify current category controls', async () => {
    await clickCategory('tOS版本项目')
    await assertSelector('[aria-label="项目二级分类快捷筛选"]')
    await assertSelector('[aria-label="状态快捷筛选"]')
    await assertText('tOS版本')
  })

  await step('return from project space to project list origin', async () => {
    console.log('  action: switch back to machine category and card view')
    await clickCategory('整机产品项目')
    await clickAria('卡片视图')
    console.log('  action: enter project space from a project card')
    await clickVisibleTextCard('body', 'X6877-D8400_H991')
    console.log('  action: assert project-list return label')
    await assertText('返回项目列表')
    console.log('  action: ordinary admin entry uses the latest published version')
    await clickExactText('body', '[role="menuitem"]', '计划')
    await assertCurrentPlanVersion('V3 (已发布)')
    console.log('  action: return before restricted-user entry')
    await clickExactText('body', 'button', '返回项目列表')
    await assertSelectedTopNav('项目列表')
    console.log('  action: user without draft visibility falls back to published')
    await switchUser('张三', '李四')
    await clickVisibleTextCard('body', 'X6877-D8400_H991')
    await clickExactText('body', '[role="menuitem"]', '计划')
    await assertCurrentPlanVersion('V3 (已发布)')
    console.log('  action: return to project list as restricted user')
    await clickExactText('body', 'button', '返回项目列表')
    console.log('  action: assert project-list origin restored')
    await assertSelectedTopNav('项目列表')
    await assertSelector('[aria-label="项目列表视图"]')
    console.log('  action: restore admin after permission verification')
    await switchUser('李四', '张三')
    await assertSelectedTopNav('项目列表')
  })

  await step('todo center uses the current narrow single-column layout', async () => {
    await clickExactText('body', '[role="menuitem"]', '工作台')
    await assertSelectedTopNav('工作台')
    await assertSelector('[aria-label="个人工作台任务"]')
    await assertSelectedTodoSource('转维')
    await page.setViewport({ width: 700, height: 900 })
    await page.waitForFunction(() => {
      const center = document.querySelector('.pms-todo-center')
      const directory = document.querySelector('.pms-todo-directory')
      const directoryItems = document.querySelector('.pms-todo-directory__items')
      const filters = document.querySelector('.pms-todo-center__filters')
      const search = document.querySelector('.pms-todo-filter--search')
      if (!center || !directory || !directoryItems || !filters || !search) return false
      const centerColumns = getComputedStyle(center).gridTemplateColumns.split(' ')
      const filterColumns = getComputedStyle(filters).gridTemplateColumns.split(' ')
      return centerColumns.length === 1
        && getComputedStyle(directory).display === 'flex'
        && getComputedStyle(directoryItems).display === 'flex'
        && filterColumns.length === 2
        && getComputedStyle(search).gridColumnStart === '1'
        && getComputedStyle(search).gridColumnEnd === '-1'
    }, { timeout: STEP_TIMEOUT })
    await page.setViewport({ width: 1440, height: 1000 })
    await page.waitForFunction(() => (
      getComputedStyle(document.querySelector('.pms-todo-center')).gridTemplateColumns.split(' ').length === 2
    ), { timeout: STEP_TIMEOUT })
  })

  if (unexpectedBrowserErrors.length > 0) {
    throw new Error(`unexpected browser errors:\n${unexpectedBrowserErrors.join('\n')}`)
  }
  console.log(`PASS workbench summary floating panels (${BASE_URL})`)
} catch (error) {
  console.error(`FAIL workbench summary floating panels\n${error.stack || error}`)
  process.exitCode = 1
} finally {
  await browser?.close().catch(error => {
    console.error(`[cleanup] ${error instanceof Error ? error.message : String(error)}`)
  })
}
