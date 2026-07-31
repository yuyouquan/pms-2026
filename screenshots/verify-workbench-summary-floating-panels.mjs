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
  await page.waitForFunction(value => (
    (document.body?.innerText || '').includes(value)
  ), { timeout: STEP_TIMEOUT }, text)
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

const assertVisibleTabLabels = async expected => {
  await page.waitForFunction(labels => {
    const visibleLabels = Array.from(document.querySelectorAll('[role="tab"]'))
      .filter(element => {
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })
      .map(element => (element.textContent || '').trim().replace(/^Tab \d+ of \d+\s*/, ''))
    return JSON.stringify(visibleLabels) === JSON.stringify(labels)
  }, { timeout: STEP_TIMEOUT }, expected)
}

const assertSelectedWorkbenchTab = async expected => {
  await page.waitForFunction(value => {
    const selectedTab = Array.from(document.querySelectorAll('[role="tab"][aria-selected="true"]'))
      .find(element => {
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })
    const label = (selectedTab?.textContent || '').trim().replace(/^Tab \d+ of \d+\s*/, '')
    return label === value
  }, { timeout: STEP_TIMEOUT }, expected)
}

const assertSelectedTopNav = async expected => {
  await page.waitForFunction(value => (
    (document.querySelector('.ant-menu-item-selected')?.textContent || '').trim() === value
  ), { timeout: STEP_TIMEOUT }, expected)
}

const clickTodoSource = async label => {
  const clicked = await page.evaluate(value => {
    const item = Array.from(document.querySelectorAll('[aria-label="待办来源"] .ant-segmented-item'))
      .find(element => (element.textContent || '').trim() === value)
    if (!item) return false
    item.click()
    return true
  }, label)
  if (!clicked) throw new Error(`missing todo source: ${label}`)
}

const readTodoMetric = async label => page.$eval(
  `[aria-label^="${label} "]`,
  element => Number((element.textContent || '').trim()),
)

const waitForTodoMetric = async (label, expected) => {
  await page.waitForFunction((metricLabel, metricValue) => {
    const element = Array.from(document.querySelectorAll('[aria-label]'))
      .find(candidate => candidate.getAttribute('aria-label')?.startsWith(`${metricLabel} `))
    return Number((element?.textContent || '').trim()) === metricValue
  }, { timeout: STEP_TIMEOUT }, label, expected)
}

const openTodoRowWithKeyboard = async title => {
  const selector = `tr[role="button"][aria-label="打开待办 ${title}"]`
  await waitForVisible(selector)
  await page.focus(selector)
  await page.keyboard.press('Enter')
}

const clickProjectMarket = async market => {
  const selector = `[aria-label="市场 ${market}"]`
  await waitForVisible(selector)
  await page.focus(selector)
  await page.keyboard.press('Enter')
}

const assertSelectedProjectMarket = async market => {
  await waitForVisible(`[aria-label="市场 ${market}"][aria-pressed="true"]`)
}

const assertCurrentPlanVersion = async versionLabel => {
  await waitForVisible(`.ant-select-content[title="${versionLabel}"]`)
}

const fillReactInput = async (selector, value) => {
  await waitForVisible(selector)
  await page.$eval(selector, (element, nextValue) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(element, nextValue)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
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

const clickButtonInTableRow = async (rowText, buttonText) => {
  const clicked = await page.evaluate((rowValue, buttonValue) => {
    const rows = Array.from(document.querySelectorAll('.ant-tabs-tabpane-active tbody tr'))
      .filter(element => {
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })
    const row = rows.find(element => (element.textContent || '').includes(rowValue))
    if (!row) return false
    const button = Array.from(row.querySelectorAll('button')).find(element => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0
        && rect.height > 0
        && (element.textContent || '').trim() === buttonValue
    })
    if (!button) return false
    button.click()
    return true
  }, rowText, buttonText)
  if (!clicked) {
    throw new Error(`unable to click "${buttonText}" in table row containing "${rowText}"`)
  }
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
  await wait(600)
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

  await step('open default workbench tabs', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 30_000 })
    await assertSelectedTopNav('工作台')
    await assertVisibleTabLabels(['待办中心', '工作跟踪'])
    await assertSelectedWorkbenchTab('待办中心')
    await assertAbsent('[aria-label="项目列表视图"]')
    await assertSelector('[aria-label="分类待办中心"]')
    await assertSelector('[aria-label="搜索待办"]')
    await assertSelector('[aria-label="项目筛选"]')
    await assertSelector('[aria-label="状态筛选"]')
  })

  await step('todo source switch and filters update the same metrics', async () => {
    console.log('  action: read aggregate metric')
    const allCount = await readTodoMetric('待办总数')
    if (allCount < 2) throw new Error(`expected aggregated todo sources, got ${allCount}`)

    console.log('  action: select transfer source')
    await clickTodoSource('转维待办')
    console.log('  action: wait transfer metric')
    await waitForTodoMetric('待办总数', 1)
    await assertText('转维资料录入')
    await fillReactInput('[aria-label="搜索待办"]', '不存在的待办')
    await waitForTodoMetric('待办总数', 0)
    await assertText('暂无转维待办')
    await clickExactText('body', 'button', '清空筛选')
    await waitForTodoMetric('待办总数', allCount)

    console.log('  action: select plan source')
    await clickTodoSource('计划待办')
    console.log('  action: read plan metric')
    const planCount = await readTodoMetric('待办总数')
    if (planCount < 2 || planCount >= allCount) {
      throw new Error(`plan metric expected between 2 and ${allCount - 1}, got ${planCount}`)
    }

    console.log('  action: type todo search')
    await fillReactInput('[aria-label="搜索待办"]', '概念')
    console.log('  action: wait search metric')
    await waitForTodoMetric('待办总数', 2)
    console.log('  action: clear filters')
    await clickExactText('body', 'button', '清空筛选')
    await waitForTodoMetric('待办总数', allCount)
  })

  await step('plan todo restores its market version after another market selection', async () => {
    console.log('  action: open OP plan todo')
    await openTodoRowWithKeyboard('OP · 概念启动')
    await assertText('返回工作台')
    await assertText('一级计划')
    console.log('  action: assert OP V3 route context')
    await assertSelectedProjectMarket('OP')
    await assertCurrentPlanVersion('V3 (已发布)')

    console.log('  action: switch to TR draft')
    await clickProjectMarket('TR')
    await assertSelectedProjectMarket('TR')
    await assertCurrentPlanVersion('V4 (修订中)')
    console.log('  action: return from TR')
    await clickExactText('body', 'button', '返回工作台')
    await wait(200)
    await clickExactButtonIfVisible('确认离开')
    await assertSelectedWorkbenchTab('待办中心')

    console.log('  action: reopen OP todo')
    await openTodoRowWithKeyboard('OP · 概念启动')
    await assertSelectedProjectMarket('OP')
    await assertCurrentPlanVersion('V3 (已发布)')
    await clickExactText('body', 'button', '返回工作台')
    await assertSelectedTopNav('工作台')
    await assertSelectedWorkbenchTab('待办中心')
  })

  await step('open transfer todo and return to todo origin', async () => {
    await clickTodoSource('转维待办')
    await waitForTodoMetric('待办总数', 1)
    await openTodoRowWithKeyboard('转维资料录入')
    await assertText('X6877-D8400_H991 - 资料录入')
    await assertText('返回工作台')
    await clickExactText('body', 'button', '返回工作台')
    await assertSelectedTopNav('工作台')
    await assertSelectedWorkbenchTab('待办中心')
  })

  await step('navigate to dedicated project list', async () => {
    await clickExactText('body', '[role="menuitem"]', '项目列表')
    await assertSelectedTopNav('项目列表')
    await assertSelector('[aria-label="项目列表视图"]')
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

  await step('return from project space to project list origin', async () => {
    console.log('  action: switch back to machine category and card view')
    await clickCategory('整机产品项目')
    await clickAria('卡片视图')
    console.log('  action: enter project space from a project card')
    await clickVisibleTextCard('body', 'X6877-D8400_H991')
    console.log('  action: assert project-list return label')
    await assertText('返回项目列表')
    console.log('  action: return to project list')
    await clickExactText('body', 'button', '返回项目列表')
    console.log('  action: assert project-list origin restored')
    await assertSelectedTopNav('项目列表')
    await assertSelector('[aria-label="项目列表视图"]')
  })

  await step('return from todo preserves selected todo tab', async () => {
    await clickExactText('body', '[role="menuitem"]', '工作台')
    await assertSelectedTopNav('工作台')
    await assertVisibleTabLabels(['待办中心', '工作跟踪'])
    await assertSelectedWorkbenchTab('待办中心')
    await clickVisibleTextCard('.ant-tabs-tabpane-active', 'X6877-D8400_H991')
    await assertText('返回工作台')
    await clickExactText('body', 'button', '返回工作台')
    await wait(200)
    await clickExactButtonIfVisible('确认离开')
    await assertSelectedTopNav('工作台')
    await assertVisibleTabLabels(['待办中心', '工作跟踪'])
    await assertSelectedWorkbenchTab('待办中心')
    await assertAbsent('[aria-label="项目列表视图"]')
  })

  await step('return from work tracker preserves selected work-tracker tab', async () => {
    console.log('  action: select work-tracker tab')
    await clickExactText('[role="tablist"]', '[role="tab"]', '工作跟踪')
    await assertSelectedWorkbenchTab('工作跟踪')
    console.log('  action: open requirement details from a visible work-tracker row')
    await clickButtonInTableRow('AI相机功能需求分析', '详情')
    console.log('  action: assert workbench return label')
    await assertText('返回工作台')
    console.log('  action: return to originating work-tracker tab')
    await clickExactText('body', 'button', '返回工作台')
    await wait(200)
    await clickExactButtonIfVisible('确认离开')
    await assertSelectedTopNav('工作台')
    await assertVisibleTabLabels(['待办中心', '工作跟踪'])
    await assertSelectedWorkbenchTab('工作跟踪')
    await assertAbsent('[aria-label="项目列表视图"]')
  })

  await step('todo center wraps controls below 1100px', async () => {
    await clickExactText('[role="tablist"]', '[role="tab"]', '待办中心')
    await page.setViewport({ width: 1000, height: 900 })
    await page.waitForFunction(() => {
      const sourceRow = document.querySelector('.pms-todo-center__source-row')
      const filters = document.querySelector('.pms-todo-center__filters')
      if (!sourceRow || !filters) return false
      return getComputedStyle(sourceRow).flexDirection === 'column'
        && getComputedStyle(filters).gridTemplateColumns.split(' ').length === 3
    }, { timeout: STEP_TIMEOUT })
    await page.setViewport({ width: 1440, height: 1000 })
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
