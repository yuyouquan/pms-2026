#!/usr/bin/env node

import puppeteer from 'puppeteer'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const BASE_URL = process.env.PMS_BASE_URL || 'http://127.0.0.1:3004'
const TIMEOUT = 30_000
const SCENARIO_FROM = Number.parseInt(process.env.PMS_SCENARIO_FROM || '1', 10)
const SCENARIO_ONLY = Number.parseInt(process.env.PMS_SCENARIO_ONLY || '0', 10)
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const allowedConsoleErrors = [
  'Warning: [antd: ConfigProvider] `autoInsertSpaceInButton` is deprecated.',
  'Warning: [antd: Space] `split` is deprecated.',
  'Warning: [antd: Space] `direction` is deprecated.',
  'Warning: [antd: Divider] `type` is deprecated.',
  'Warning: [antd: Drawer] `width` is deprecated.',
  'Warning: [antd: Descriptions] Sum of column `span` in a line not match `column` of Descriptions.',
]

let browser
const results = []

const visible = element => {
  if (!element) return false
  const rect = element.getBoundingClientRect()
  const style = getComputedStyle(element)
  return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
}

const clickExact = async (page, selector, text, scope = 'body') => {
  const clicked = await page.evaluate((candidateSelector, expected, rootSelector) => {
    const root = document.querySelector(rootSelector)
    if (!root) return false
    const candidate = Array.from(root.querySelectorAll(candidateSelector)).find(element => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && (element.textContent || '').trim() === expected
    })
    if (!candidate) return false
    candidate.click()
    return true
  }, selector, text, scope)
  if (!clicked) throw new Error(`找不到可见控件：${selector} ${text}`)
  await wait(160)
}

const clickAria = async (page, label) => {
  await page.waitForFunction(value => {
    const element = document.querySelector(`[aria-label="${CSS.escape(value)}"]`)
    if (!element) return false
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }, { timeout: TIMEOUT }, label)
  await page.$eval(`[aria-label="${label.replaceAll('"', '\\"')}"]`, element => element.click())
  await wait(160)
}

const clickButtonPrefix = async (page, scope, prefix) => {
  const clicked = await page.evaluate((rootSelector, value) => {
    const root = document.querySelector(rootSelector)
    const button = Array.from(root?.querySelectorAll('button') || []).find(element => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && (element.textContent || '').trim().startsWith(value)
    })
    if (!button) return false
    button.click()
    return true
  }, scope, prefix)
  if (!clicked) throw new Error(`找不到按钮：${scope} ${prefix}`)
  await wait(160)
}

const clickVisibleButton = async (page, scope, text) => {
  const root = await page.$(scope)
  if (!root) throw new Error(`找不到按钮范围：${scope}`)
  for (const button of await root.$$('button')) {
    const matches = await button.evaluate((element, expected) => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && (element.textContent || '').trim() === expected
    }, text)
    if (!matches) continue
    await button.click()
    await wait(160)
    return
  }
  throw new Error(`找不到可见按钮：${text}`)
}

const assertText = async (page, text, scope = 'body') => {
  await page.waitForFunction((value, rootSelector) => (
    (document.querySelector(rootSelector)?.textContent || '').includes(value)
  ), { timeout: TIMEOUT }, text, scope)
}

const assertNoText = async (page, text, scope = 'body') => {
  const found = await page.$eval(scope, (root, value) => (root.textContent || '').includes(value), text)
  if (found) throw new Error(`不应显示：${text}`)
}

const openMain = async (page, label) => {
  const deadline = Date.now() + TIMEOUT
  while (Date.now() < deadline) {
    const active = await page.evaluate(value => (
      (document.querySelector('.ant-menu-item-selected')?.textContent || '').trim() === value
    ), label)
    if (active) return

    const items = await page.$$('[role="menuitem"]')
    let target = null
    for (const item of items) {
      const matches = await item.evaluate((element, expected) => {
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && (element.textContent || '').trim() === expected
      }, label)
      if (matches) {
        target = item
        break
      }
    }
    if (target) {
      // Native clicks are intentionally retried: a menu item may be visible from
      // SSR before React attaches its handler, in which case the first click is lost.
      await target.evaluate(element => element.click()).catch(() => undefined)
      const activated = await page.waitForFunction(value => (
        (document.querySelector('.ant-menu-item-selected')?.textContent || '').trim() === value
      ), { timeout: 900 }, label).then(() => true).catch(() => false)
      if (activated) return
    }
    await wait(120)
  }
  throw new Error(`主导航在 ${TIMEOUT}ms 内未激活：${label}`)
}

const formCombo = async (page, label) => {
  const handle = await page.evaluateHandle(expected => {
    const item = Array.from(document.querySelectorAll('.ant-form-item')).find(candidate => (
      (candidate.querySelector('.ant-form-item-label')?.textContent || '').trim().startsWith(expected)
    ))
    return item?.querySelector('input[role="combobox"]') || null
  }, label)
  const input = handle.asElement()
  if (!input) throw new Error(`找不到表单下拉：${label}`)
  return input
}

const openFormCombo = async (page, label) => {
  const input = await formCombo(page, label)
  await input.focus()
  await page.keyboard.press('ArrowDown')
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.ant-select-item-option')).some(element => {
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }))
}

const selectOption = async (page, text, { contains = false } = {}) => {
  const clicked = await page.evaluate((value, useContains) => {
    const option = Array.from(document.querySelectorAll('.ant-select-item-option:not(.ant-select-item-option-disabled)'))
      .filter(element => {
        const rect = element.getBoundingClientRect()
        const content = (element.textContent || '').trim()
        return rect.width > 0 && rect.height > 0 && (useContains ? content.includes(value) : content === value)
      }).at(-1)
    if (!option) return false
    option.click()
    return true
  }, text, contains)
  if (!clicked) throw new Error(`找不到下拉选项：${text}`)
  await wait(180)
}

const fillInput = async (page, selector, value) => {
  await page.waitForSelector(selector, { visible: true })
  await page.$eval(selector, element => { element.focus(); element.select() })
  await page.keyboard.type(value)
}

const fillFormText = async (page, label, value) => {
  const selector = await page.evaluate(expected => {
    const items = Array.from(document.querySelectorAll('.ant-form-item'))
    const index = items.findIndex(item => (item.querySelector('.ant-form-item-label')?.textContent || '').trim() === expected)
    return index
  }, label)
  if (selector < 0) throw new Error(`找不到表单输入：${label}`)
  const items = await page.$$('.ant-form-item')
  const item = items[selector]
  const input = await item.$('input:not([role="combobox"]),textarea')
  if (!input) throw new Error(`表单字段没有文本输入：${label}`)
  await input.focus()
  await input.evaluate(element => { element.select?.() })
  await page.keyboard.type(value)
}

const selectFormOption = async (page, label, option, options) => {
  await openFormCombo(page, label)
  await selectOption(page, option, options)
}

const selectExternalProject = async (page, bid) => {
  const input = await formCombo(page, '项目名')
  await input.focus()
  await page.keyboard.type(bid)
  await page.waitForFunction(value => Array.from(document.querySelectorAll('.ant-select-item-option')).some(element => (
    element.getBoundingClientRect().height > 0 && (element.textContent || '').includes(value)
  )), {}, bid)
  await selectOption(page, bid, { contains: true })
}

const completeMachineProjectForm = async (page, { bid, versionLabel, version }) => {
  console.log(`    FORM source ${bid}`)
  await selectExternalProject(page, bid)
  console.log('    FORM health')
  await selectFormOption(page, '健康状态', '正常')
  console.log('    FORM development')
  await selectFormOption(page, '开发模式', '自研')
  console.log(`    FORM ${versionLabel}`)
  await selectFormOption(page, versionLabel, `tOS${version}`)
  console.log('    FORM first launch')
  await selectFormOption(page, '是否首发项目', '否')
  console.log('    FORM level')
  await selectFormOption(page, '软件项目等级', 'A')
  console.log('    FORM upgrade strategy')
  await selectFormOption(page, '升维策略', '不维护')
  console.log('    FORM system')
  await selectFormOption(page, '系统类型', '64bit')
  console.log('    FORM kernel')
  await selectFormOption(page, 'Kernel 版本', '6.1')
  console.log('    FORM documents')
  for (const label of ['整机 PD', 'PCBA 表', '出货国家表', '关键器件选型表']) {
    console.log(`      DOC ${label}`)
    await fillFormText(page, label, `https://example.com/${bid}/${encodeURIComponent(label)}`)
  }
  console.log('    FORM complete')
}

const submitProjectCreate = async page => {
  await clickExact(page, '.ant-modal button', '创建')
  await wait(800)
  const state = await page.evaluate(() => ({
    success: (document.body?.innerText || '').includes('项目创建成功'),
    errors: Array.from(document.querySelectorAll('.ant-form-item-explain-error')).map(element => (element.textContent || '').trim()).filter(Boolean),
  }))
  if (!state.success) throw new Error(`项目创建未成功：${state.errors.join('；') || '未显示校验错误'}`)
  await assertText(page, '项目空间')
}

const openAriaCombo = async (page, label) => {
  const selector = `[aria-label="${label.replaceAll('"', '\\"')}"]`
  await page.waitForSelector(selector, { visible: true })
  const handle = await page.$(selector)
  const input = await handle.$('input[role="combobox"]') || (await handle.evaluate(element => element.matches('input[role="combobox"]')) ? handle : null)
  if (!input) throw new Error(`找不到可访问下拉：${label}`)
  await input.focus()
  await page.keyboard.press('ArrowDown')
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.ant-select-item-option')).some(element => element.getBoundingClientRect().height > 0))
}

const selectAriaOption = async (page, label, optionText) => {
  await openAriaCombo(page, label)
  const clicked = await page.evaluate((ariaLabel, expected) => {
    const root = document.querySelector(`[aria-label="${CSS.escape(ariaLabel)}"]`)
    const input = root?.matches('input[role="combobox"]') ? root : root?.querySelector('input[role="combobox"]')
    const popupId = input?.getAttribute('aria-controls') || input?.getAttribute('aria-owns')
    const popup = popupId ? document.getElementById(popupId) : null
    const option = Array.from(popup?.querySelectorAll('.ant-select-item-option:not(.ant-select-item-option-disabled)') || []).find(element => (
      element.getBoundingClientRect().height > 0 && (element.textContent || '').trim() === expected
    ))
    if (!option) return false
    option.click()
    return true
  }, label, optionText)
  if (!clicked) throw new Error(`找不到 ${label} 对应弹层选项：${optionText}`)
  await wait(180)
}

const chooseMultiSelectValues = async (page, label, values) => {
  for (const value of values) {
    await openFormCombo(page, label)
    await selectOption(page, value)
  }
}

const replaceFormMultiValues = async (page, label, values) => {
  const item = await page.evaluateHandle(expected => Array.from(document.querySelectorAll('.ant-form-item')).find(candidate => (
    (candidate.querySelector('.ant-form-item-label')?.textContent || '').trim().startsWith(expected)
  )) || null, label)
  const element = item.asElement()
  if (!element) throw new Error(`找不到多人字段：${label}`)
  for (let index = 0; index < 20; index += 1) {
    const removed = await element.evaluate(root => {
      const button = root.querySelector('.ant-select-selection-item-remove')
      if (!button) return false
      button.click()
      return true
    })
    if (!removed) break
    await wait(80)
  }
  for (const value of values) {
    const input = await element.$('input[role="combobox"]')
    await input.focus()
    await page.keyboard.press('ArrowDown')
    await selectOption(page, value)
  }
}

const permissionRoleMembers = async (page, roleName) => page.evaluate(name => {
  const row = Array.from(document.querySelectorAll('.ant-table-tbody tr')).find(candidate => {
    const firstCell = candidate.querySelector('.ant-table-cell')
    return (firstCell?.textContent || '').trim().startsWith(name)
  })
  return row ? Array.from(row.querySelectorAll('.ant-select-selection-item')).map(item => (item.textContent || '').trim()) : null
}, roleName)

const replacePermissionRoleMembers = async (page, roleName, members) => {
  const rowHandle = await page.evaluateHandle(name => Array.from(document.querySelectorAll('.ant-table-tbody tr')).find(candidate => (
    (candidate.querySelector('.ant-table-cell')?.textContent || '').trim().startsWith(name)
  )) || null, roleName)
  const row = rowHandle.asElement()
  if (!row) throw new Error(`找不到权限角色：${roleName}`)
  for (let index = 0; index < 20; index += 1) {
    const removed = await row.evaluate(root => {
      const button = root.querySelector('.ant-select-selection-item-remove')
      if (!button) return false
      button.click()
      return true
    })
    if (!removed) break
    await wait(80)
  }
  for (const member of members) {
    const input = await row.$('input[role="combobox"]')
    await input.focus()
    await page.keyboard.press('ArrowDown')
    await selectOption(page, member)
  }
  await wait(300)
}

const currentProjectEnvelope = async page => page.evaluate(() => JSON.parse(localStorage.getItem('pms-projects') || '{}'))

const returnToProjectList = async page => {
  const button = await page.$('button')
  const hasReturn = await page.evaluate(() => Array.from(document.querySelectorAll('button')).some(element => (
    element.getBoundingClientRect().height > 0 && (element.textContent || '').trim() === '返回项目列表'
  )))
  if (hasReturn) await clickExact(page, 'button', '返回项目列表')
  else await openMain(page, '项目列表')
  await page.waitForSelector('[aria-label="项目列表视图"]', { visible: true })
  await button?.dispose()
}

const clickProjectByName = async (page, projectName) => {
  const clicked = await page.evaluate(name => {
    const element = Array.from(document.querySelectorAll('button,[role="button"],.ant-table-cell,*'))
      .find(candidate => {
        const rect = candidate.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && (candidate.textContent || '').trim() === name
      })
    if (!element) return false
    let target = element
    while (target && target !== document.body) {
      if (target.matches('button,[role="button"]') || getComputedStyle(target).cursor === 'pointer') {
        target.click()
        return true
      }
      target = target.parentElement
    }
    return false
  }, projectName)
  if (!clicked) throw new Error(`无法打开项目：${projectName}`)
  await assertText(page, '项目空间')
}

const seedEnvelope = state => JSON.stringify({ state, version: 1 })

const runScenario = async (name, { storage = {}, viewport = { width: 1440, height: 960 } } = {}, exercise) => {
  const scenarioNumber = Number.parseInt(name, 10)
  if (scenarioNumber < SCENARIO_FROM || (SCENARIO_ONLY && scenarioNumber !== SCENARIO_ONLY)) return
  console.log(`RUN ${name}`)
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  const errors = []
  page.setDefaultTimeout(TIMEOUT)
  page.setDefaultNavigationTimeout(TIMEOUT)
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
  page.on('console', message => {
    if (message.type() !== 'error') return
    if (allowedConsoleErrors.some(prefix => message.text().startsWith(prefix))) return
    errors.push(`console.error: ${message.text()}`)
  })
  try {
    await page.setViewport(viewport)
    await page.evaluateOnNewDocument(values => {
      Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value))
    }, storage)
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' })
    await exercise(page)
    if (errors.length) throw new Error(errors.join('\n'))
    results.push(name)
    console.log(`PASS ${name}`)
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      url: location.href,
      text: (document.body?.innerText || '').slice(0, 2400),
    })).catch(() => ({ url: 'unavailable', text: 'unavailable' }))
    throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}\nURL: ${diagnostics.url}\n${diagnostics.text}`)
  } finally {
    await context.close()
  }
}

try {
  browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })

  await runScenario('01 header order and workbench default todo', {}, async page => {
    const menuLabels = await page.$$eval('[role="menuitem"]', elements => elements
      .filter(element => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 })
      .map(element => (element.textContent || '').trim()).filter(Boolean))
    const expected = ['工作台', '项目列表', '项目视图', '人力资源管道', '配置中心']
    if (JSON.stringify(menuLabels.slice(0, 5)) !== JSON.stringify(expected)) {
      throw new Error(`Header 顺序错误：${JSON.stringify(menuLabels)}`)
    }
    const tabs = await page.$$eval('[role="tab"]', elements => elements
      .filter(element => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 })
      .map(element => (element.textContent || '').trim()))
    if (JSON.stringify(tabs) !== JSON.stringify(['待办中心', '工作跟踪'])) throw new Error(`工作台 Tab 错误：${JSON.stringify(tabs)}`)
    await page.waitForSelector('[aria-label="分类待办中心"]', { visible: true })
    const selected = await page.$eval('[role="tab"][aria-selected="true"]', element => (element.textContent || '').trim())
    if (selected !== '待办中心') throw new Error(`默认 Tab 为 ${selected}`)
  })

  await runScenario('02 todo categories counts and plan transfer navigation', {}, async page => {
    for (const label of ['待办总数', '今日到期', '已逾期', '本周完成']) {
      await page.waitForSelector(`[aria-label^="${label} "]`, { visible: true })
    }
    await clickExact(page, '.ant-segmented-item', '计划待办', '[aria-label="待办来源"]')
    await assertText(page, '计划待办')
    await clickAria(page, '打开待办 OP · 概念启动')
    await assertText(page, '一级计划')

    await page.goto(BASE_URL, { waitUntil: 'networkidle0' })
    await clickExact(page, '.ant-segmented-item', '转维待办', '[aria-label="待办来源"]')
    await clickAria(page, '打开待办 转维资料录入')
    await assertText(page, '转维')
  })

  await runScenario('03 project list defaults to machine without all category', {}, async page => {
    await openMain(page, '项目列表')
    const categoryLabels = await page.$$eval('[aria-label="项目分类筛选"] button', buttons => buttons.map(button => (button.textContent || '').trim().replace(/\s+\d+$/, '')))
    if (categoryLabels.includes('全部')) throw new Error('一级项目分类仍包含“全部”')
    if (categoryLabels[0] !== '整机产品项目') throw new Error(`默认分类顺序错误：${categoryLabels.join(',')}`)
    const active = await page.$eval('[aria-label="项目分类筛选"] button', button => getComputedStyle(button).color)
    if (!active) throw new Error('整机默认分类未激活')
    await clickAria(page, '列表视图')
    await assertText(page, '产品系列')
    await assertText(page, '首销 tOS 版本')
    const layout = await page.evaluate(() => {
      const category = document.querySelector('[aria-label="项目分类筛选"]')?.getBoundingClientRect()
      const actions = document.querySelector('.pms-project-list-category-actions')?.getBoundingClientRect()
      const fixedHeaders = Array.from(document.querySelectorAll('.ant-table-thead th.ant-table-cell-fix-start, .ant-table-thead th.ant-table-cell-fix-left'))
        .map(element => (element.textContent || '').trim())
      return { categoryTop: category?.top, actionsTop: actions?.top, fixedHeaders }
    })
    if (layout.categoryTop !== layout.actionsTop) throw new Error(`项目分类与操作区未同行：${JSON.stringify(layout)}`)
    if (!layout.fixedHeaders.some(text => text.includes('产品系列')) || !layout.fixedHeaders.some(text => text.includes('项目名称'))) {
      throw new Error(`整机固定列错误：${JSON.stringify(layout.fixedHeaders)}`)
    }
    const firstSeries = await page.$('.pms-project-series-toggle')
    if (!firstSeries) throw new Error('整机列表没有产品系列聚合')
    const beforeCollapse = await page.$$eval('.ant-table-tbody tr[data-row-key]', rows => rows.filter(row => row.getBoundingClientRect().height > 0).length)
    await firstSeries.click()
    await page.waitForFunction(before => (
      Array.from(document.querySelectorAll('.ant-table-tbody tr[data-row-key]')).filter(row => row.getBoundingClientRect().height > 0).length < before
    ), {}, beforeCollapse)
    await page.$eval('.pms-project-series-toggle', element => element.click())
  })

  await runScenario('04 machine tos technical quick filters are linked', {}, async page => {
    await openMain(page, '项目列表')
    await clickAria(page, '卡片视图')
    for (const label of ['快捷筛选-首销 tOS 版本', '快捷筛选-芯片编码', '快捷筛选-品牌', '快捷筛选-产品系列', '快捷筛选-产品类型']) {
      await page.waitForSelector(`[aria-label="${label}"]`, { visible: true })
    }
    console.log('  STEP apply machine brand quick filter in card view')
    await openAriaCombo(page, '快捷筛选-品牌')
    await selectOption(page, 'Infinix')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => {
      const cards = Array.from(document.querySelectorAll('.pms-project-list-content .ant-card')).filter(element => element.getBoundingClientRect().height > 0)
      return cards.length === 2 && cards.every(card => (card.textContent || '').includes('Infinix'))
    })
    console.log('  STEP switch to list and preserve the same filtered result')
    await clickAria(page, '列表视图')
    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('.ant-table-tbody tr[data-row-key]')).filter(element => element.getBoundingClientRect().height > 0)
      return rows.length === 2 && rows.every(row => (row.textContent || '').includes('Infinix'))
    })
    console.log('  STEP verify quick-to-advanced mirror')
    await clickAria(page, '筛选')
    await page.waitForFunction(() => {
      const control = document.querySelector('[aria-label="品牌筛选值"]')
      const input = control?.matches('input') ? control : control?.querySelector('input')
      const selector = control?.closest('.ant-select-selector') || control?.querySelector('.ant-select-selector')
      return input?.value === 'Infinix'
        || (selector?.textContent || '').includes('Infinix')
        || (control?.parentElement?.parentElement?.textContent || '').includes('Infinix')
    })
    await clickExact(page, '.pms-floating-config-popover button', '取消')

    await clickButtonPrefix(page, '[aria-label="项目分类筛选"]', 'tOS版本项目')
    for (const label of ['快捷筛选-版本类型', '快捷筛选-tOS 版本']) await page.waitForSelector(`[aria-label="${label}"]`, { visible: true })
    console.log('  STEP apply tOS version-type filter and verify rows')
    await openAriaCombo(page, '快捷筛选-版本类型')
    await selectOption(page, 'Full')
    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('.ant-table-tbody tr[data-row-key]')).filter(element => element.getBoundingClientRect().height > 0)
      return rows.length > 0 && rows.every(row => (row.textContent || '').includes('Full'))
    })
    await clickButtonPrefix(page, '[aria-label="项目分类筛选"]', '技术项目')
    await page.waitForSelector('[aria-label="技术项目类型快捷筛选"]', { visible: true })
    for (const label of ['快捷筛选-项目名称', '快捷筛选-技术赛道', '快捷筛选-项目阶段']) await page.waitForSelector(`[aria-label="${label}"]`, { visible: true })
    await assertText(page, 'TDT项目名称')
    const hasChildHeader = await page.evaluate(() => Array.from(document.querySelectorAll('.ant-table-thead th')).some(element => (
      (element.textContent || '').includes('子任务名称')
    )))
    if (hasChildHeader) throw new Error('默认 TDT 类型仍同时显示子项目表')
    console.log('  STEP apply technical name filter and verify TDT result')
    await fillInput(page, '[aria-label="快捷筛选-项目名称"]', 'AI-Engine')
    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('.ant-table-tbody tr[data-row-key]')).filter(element => element.getBoundingClientRect().height > 0)
      return rows.length === 1 && (rows[0].textContent || '').includes('AI-Engine-V2')
    })
  })

  await runScenario('05 enum CRUD validation duplicate and historical snapshot', {}, async page => {
    await openMain(page, '配置中心')
    await clickExact(page, '[role="tab"]', '枚举值配置')
    await clickButtonPrefix(page, '.pms-enum-type-list', 'tOS版本（3位）')
    await page.$eval('[data-enum-add-value]', element => element.click())
    await fillInput(page, 'input[aria-label="枚举值"]', '19.4')
    await clickAria(page, '确认枚举值')
    await assertText(page, '格式不正确，请按当前枚举类型的格式输入')
    await fillInput(page, 'input[aria-label="枚举值"]', '19.4.1')
    await clickAria(page, '确认枚举值')
    await page.waitForSelector('button[aria-label="编辑枚举值 19.4.1"]', { visible: true })
    await page.$eval('[data-enum-add-value]', element => element.click())
    await fillInput(page, 'input[aria-label="枚举值"]', '19.4.1')
    await clickAria(page, '确认枚举值')
    await assertText(page, '枚举值已存在')
    await clickAria(page, '取消枚举值编辑')
    await clickAria(page, '编辑枚举值 19.4.1')
    await fillInput(page, 'input[aria-label="枚举值"]', '19.4.2')
    await clickAria(page, '确认枚举值')

    console.log('  STEP save the newly configured enum through a real machine-project form')
    await openMain(page, '项目列表')
    await clickAria(page, '新增项目')
    await completeMachineProjectForm(page, { bid: 'EXT-001', versionLabel: '首销 tOS 版本', version: '19.4.2' })
    await submitProjectCreate(page)

    console.log('  STEP delete enum through UI and reopen the saved business form')
    console.log('    HIST return list')
    await returnToProjectList(page)
    console.log('    HIST open config')
    await openMain(page, '配置中心')
    await clickExact(page, '[role="tab"]', '枚举值配置')
    await clickButtonPrefix(page, '.pms-enum-type-list', 'tOS版本（3位）')
    console.log('    HIST delete enum')
    await clickAria(page, '删除枚举值 19.4.2')
    await clickExact(page, '.ant-popconfirm-buttons button', '删除')
    await page.waitForFunction(() => !document.querySelector('button[aria-label="编辑枚举值 19.4.2"]'))
    console.log('    HIST reopen project')
    await openMain(page, '项目列表')
    await clickAria(page, '卡片视图')
    await clickExact(page, '.ant-pagination-item', '2')
    await clickAria(page, '打开项目 EXT-001')
    console.log('    HIST open edit')
    await clickExact(page, 'button', '编辑')
    console.log('    HIST inspect disabled option')
    await openFormCombo(page, '首销 tOS 版本')
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.ant-select-item-option')).some(element => (
      element.getBoundingClientRect().height > 0
      && (element.textContent || '').trim() === 'tOS19.4.2（已停用）'
      && element.classList.contains('ant-select-item-option-disabled')
    )))
    const availableForNewChoice = await page.evaluate(() => Array.from(document.querySelectorAll('.ant-select-item-option:not(.ant-select-item-option-disabled)')).some(element => (
      element.getBoundingClientRect().height > 0 && (element.textContent || '').includes('19.4.2')
    )))
    if (availableForNewChoice) throw new Error('已删除枚举仍可作为新值选择')
  })

  await runScenario('06 machine new and two legacy versions resolve maximum', {}, async page => {
    console.log('  STEP configure the three required versions through enum UI')
    await openMain(page, '配置中心')
    await clickExact(page, '[role="tab"]', '枚举值配置')
    await clickButtonPrefix(page, '.pms-enum-type-list', 'tOS版本（3位）')
    for (const value of ['14.0.0', '15.0.0', '17.10.0']) {
      await page.$eval('[data-enum-add-value]', element => element.click())
      await fillInput(page, 'input[aria-label="枚举值"]', value)
      await clickAria(page, '确认枚举值')
      await page.waitForSelector(`button[aria-label="编辑枚举值 ${value}"]`, { visible: true })
    }

    await openMain(page, '项目列表')
    for (const input of [
      { bid: 'EXT-010', versionLabel: '首销 tOS 版本', version: '14.0.0' },
      { bid: 'EXT-011', versionLabel: '当前 tOS 版本', version: '15.0.0' },
      { bid: 'EXT-012', versionLabel: '当前 tOS 版本', version: '17.10.0' },
    ]) {
      console.log(`  STEP create ${input.bid} through project UI`)
      await clickAria(page, '新增项目')
      await completeMachineProjectForm(page, input)
      await submitProjectCreate(page)
      await returnToProjectList(page)
    }

    console.log('  STEP verify all three persisted projects came from real submits')
    const envelope = await currentProjectEnvelope(page)
    const lineage = envelope?.state?.projects?.filter(project => ['EXT-010', 'EXT-011', 'EXT-012'].includes(project.sourceBid)) || []
    if (lineage.length !== 3) throw new Error(`真实创建项目数量错误：${lineage.length}`)
    const byBid = Object.fromEntries(lineage.map(project => [project.sourceBid, project]))
    if (byBid['EXT-010']?.firstSaleTosVersionId !== '14.0.0' || byBid['EXT-010']?.currentTosVersionId !== '17.10.0') {
      throw new Error(`新品版本联动错误：${JSON.stringify(byBid['EXT-010'])}`)
    }
    if (byBid['EXT-011']?.firstSaleTosVersionId !== '14.0.0' || byBid['EXT-011']?.currentTosVersionId !== '15.0.0') {
      throw new Error(`首个老品版本错误：${JSON.stringify(byBid['EXT-011'])}`)
    }
    if (byBid['EXT-012']?.firstSaleTosVersionId !== '14.0.0' || byBid['EXT-012']?.currentTosVersionId !== '17.10.0') {
      throw new Error(`第二个老品版本错误：${JSON.stringify(byBid['EXT-012'])}`)
    }

    console.log('  STEP reopen the new X6870 and verify first/current values in edit UI')
    await clickAria(page, '卡片视图')
    await clickExact(page, '.ant-pagination-item', '2')
    await clickAria(page, '打开项目 EXT-010')
    await clickExact(page, 'button', '编辑')
    await page.waitForFunction(() => {
      const itemFor = label => {
        const item = Array.from(document.querySelectorAll('.ant-form-item')).find(candidate => (candidate.querySelector('.ant-form-item-label')?.textContent || '').trim() === label)
        return item || null
      }
      const first = itemFor('首销 tOS 版本')
      const current = itemFor('当前 tOS 版本')
      return (first?.textContent || '').includes('tOS14.0.0')
        && ((current?.querySelector('input')?.value || '') === 'tOS17.10.0' || (current?.textContent || '').includes('tOS17.10.0'))
    })
  })

  await runScenario('07 TDT create validation mapping team and deliverables', {}, async page => {
    console.log('  STEP open predecessor-work technical source')
    await openMain(page, '项目列表')
    await clickAria(page, '新增项目')
    const sourceInput = await formCombo(page, '项目名')
    await sourceInput.focus()
    await page.keyboard.type('AIOS-Architecture')
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.ant-select-item-option')).some(element => (
      element.getBoundingClientRect().height > 0 && (element.textContent || '').includes('EXT-013')
    )))
    await selectOption(page, 'EXT-013', { contains: true })
    console.log('  STEP verify mapped fields and create validation')
    for (const label of ['技术赛道', 'TMG 及技术领域', '子领域', '前置项目', '技术项目负责人', '技术项目经理', '测试代表', '质量代表', '产品代表', '标准化代表', '项目KPI文件', '概设', 'charter报告', 'PDCP报告', 'TDCP报告', 'EDCP报告']) {
      await assertText(page, label, '.ant-modal')
    }
    await clickExact(page, '.ant-modal button', '创建')
    await assertText(page, '请选择技术项目负责人')
    await openFormCombo(page, 'TMG 及技术领域')
    await selectOption(page, '基础架构TMG')
    const subdomain = await formCombo(page, '子领域')
    const subdomainValue = await subdomain.evaluate(input => ({
      disabled: input.disabled,
      formItemText: input.closest('.ant-form-item')?.textContent || '',
    }))
    if (!subdomainValue.formItemText.includes('无') || !subdomainValue.disabled) throw new Error(`无子领域联动错误：${JSON.stringify(subdomainValue)}`)
    await assertText(page, '链接', '.ant-modal')
    await assertText(page, '文件', '.ant-modal')

    console.log('  STEP fill predecessor, team and URL deliverable, then submit real TDT project')
    await openFormCombo(page, '前置项目')
    await selectOption(page, 'X6877-D8400_H991', { contains: true })
    for (const [label, person] of [
      ['技术项目负责人', '张三'],
      ['技术项目经理', '李白'],
      ['测试代表', '王五'],
      ['质量代表', '赵六'],
      ['产品代表', '孙七'],
      ['标准化代表', '周八'],
    ]) await selectFormOption(page, label, person)
    await fillInput(page, '[aria-label="项目KPI文件链接"]', 'https://example.com/technical/kpi')
    await submitProjectCreate(page)

    const created = await page.evaluate(() => {
      const envelope = JSON.parse(localStorage.getItem('pms-projects') || '{}')
      return envelope?.state?.projects?.find(project => project.sourceBid === 'EXT-013') || null
    })
    if (!created || created.leader !== '张三' || JSON.stringify(created.responsiblePersons) !== JSON.stringify(['张三'])) {
      throw new Error(`技术项目负责人未同步项目责任人：${JSON.stringify(created)}`)
    }
    const expectedTeam = {
      technicalLead: '张三', technicalProjectManager: '李白', testRepresentative: '王五', qualityRepresentative: '赵六', productRepresentative: '孙七', standardizationRepresentative: '周八',
    }
    for (const [key, value] of Object.entries(expectedTeam)) {
      if (created.fieldValues?.[key] !== value) throw new Error(`技术团队保存错误 ${key}：${JSON.stringify(created.fieldValues)}`)
    }
    if (created.fieldValues?.projectKpi?.url !== 'https://example.com/technical/kpi') throw new Error('技术项目 KPI 链接未保存')

    console.log('  STEP edit the same TDT project and switch KPI from URL to file upload')
    await clickExact(page, '[role="menuitem"]', '概况')
    console.log('    EDIT open modal')
    await clickExact(page, 'button', '编辑', '[aria-label="技术项目概况"]')
    await wait(500)
    const editorOpened = await page.evaluate(() => Boolean(document.querySelector('[aria-label="项目KPI文件录入方式"]')))
    if (!editorOpened) throw new Error('技术项目信息编辑弹窗未打开')
    console.log('    EDIT switch file mode')
    await page.$eval('[aria-label="项目KPI文件录入方式"] input[value="file"]', element => element.click())
    await page.waitForSelector('input[type="file"]')
    const upload = await page.$('input[type="file"]')
    await upload.uploadFile(resolve(process.cwd(), 'package.json'))
    await page.waitForFunction(() => (document.querySelector('.ant-modal')?.textContent || '').includes('package.json'))
    await clickExact(page, '.ant-modal button', '保存')
    await assertText(page, '项目信息已保存')
    const edited = await page.evaluate(projectId => {
      const envelope = JSON.parse(localStorage.getItem('pms-projects') || '{}')
      return envelope?.state?.projects?.find(project => project.id === projectId) || null
    }, created.id)
    if (edited?.fieldValues?.projectKpi?.kind !== 'file' || edited.fieldValues.projectKpi.name !== 'package.json') {
      throw new Error(`技术项目 KPI 文件切换未保存：${JSON.stringify(edited?.fieldValues?.projectKpi)}`)
    }
  })

  await runScenario('08 IPM child config inactive and reactivation semantics', {}, async page => {
    await openMain(page, '项目列表')
    await clickButtonPrefix(page, '[aria-label="项目分类筛选"]', '技术项目')
    await clickProjectByName(page, 'AI-Engine-V2')
    await page.waitForSelector('[aria-label="技术项目基础信息"]', { visible: true })
    await page.waitForFunction(() => Array.from(document.querySelectorAll('[role="tab"]')).some(element => (
      (element.textContent || '').includes('多模态子项目') && (element.textContent || '').includes('待配置')
    )))
    console.log('  STEP configure the pending child through the real modal')
    await clickAria(page, '配置子项目 多模态子项目')
    await assertText(page, '待配置', '.ant-modal')
    await assertText(page, '核心价值', '.ant-modal')
    await assertText(page, '开发模式', '.ant-modal')
    await selectFormOption(page, '核心价值', '人无我有')
    await selectFormOption(page, '开发模式', '谷歌合作')
    await selectFormOption(page, '首导tOS', '16.0')
    await openFormCombo(page, '首导整机产品')
    await selectOption(page, 'X6877-D8400_H991')
    await clickExact(page, '.ant-modal button', '确认')
    await assertText(page, '子项目信息已保存')
    await page.waitForFunction(() => Array.from(document.querySelectorAll('[role="tab"]')).some(element => (
      (element.textContent || '').includes('多模态子项目') && !(element.textContent || '').includes('待配置')
    )))
    const savedConfiguration = await page.evaluate(() => {
      const envelope = JSON.parse(localStorage.getItem('pms-technical-projects') || '{}')
      return envelope?.state?.subprojects?.find(item => item.id === 'IPM-AI-002')?.configuration || null
    })
    if (JSON.stringify(savedConfiguration) !== JSON.stringify({ coreValue: '人无我有', developmentMode: '谷歌合作', firstTosVersion: '16.0', firstMachineProjectId: '1' })) {
      throw new Error(`子项目配置保存错误：${JSON.stringify(savedConfiguration)}`)
    }

    console.log('  STEP supplemental executable store sync contract (soft deactivate/reactivate)')
    const storeContract = spawnSync(process.execPath, ['scripts/verify-technical-project.mjs'], { cwd: process.cwd(), encoding: 'utf8' })
    if (storeContract.status !== 0) throw new Error(`技术子项目同步契约失败：${storeContract.stderr || storeContract.stdout}`)
  })

  await runScenario('09 TDT and child revisions are independently published', {}, async page => {
    await openMain(page, '项目列表')
    await clickButtonPrefix(page, '[aria-label="项目分类筛选"]', '技术项目')
    await clickProjectByName(page, 'AI-Engine-V2')
    await clickExact(page, '[role="menuitem"]', '计划')
    await page.waitForSelector('[aria-label="技术项目计划"]', { visible: true })
    await clickAria(page, '发布技术计划')
    await assertText(page, '计划已发布')
    await clickExact(page, '[role="tab"]', 'AI推理引擎子项目计划')
    await clickExact(page, 'button', '创建修订')
    await assertText(page, '已创建 V1 修订')
    await clickAria(page, '发布技术计划')
    await assertText(page, '计划已发布')
    await clickExact(page, '[role="tab"]', 'TDT项目计划')
    await assertText(page, 'V2')
  })

  await runScenario('10 technical stage and grouped milestone columns', {}, async page => {
    await openMain(page, '项目列表')
    await clickAria(page, '列表视图')
    await clickButtonPrefix(page, '[aria-label="项目分类筛选"]', '技术项目')
    await assertText(page, 'TDT项目名称')
    for (const label of ['规划阶段', '概念阶段', '计划阶段', '开发验证阶段', '迁移阶段']) await assertText(page, label)
    await assertText(page, '项目阶段')
    await clickExact(page, '[aria-label="技术项目类型快捷筛选"] button', '子项目')
    await assertText(page, '子任务名称')
    for (const label of ['第1版转测', '第2版转测', '第X版转测', 'TDR3']) await assertText(page, label)
  })

  await runScenario('11 technical one-way and tOS last-write role surfaces', {}, async page => {
    console.log('  STEP edit technical team and verify read-only permission synchronization')
    await openMain(page, '项目列表')
    await clickButtonPrefix(page, '[aria-label="项目分类筛选"]', '技术项目')
    await clickProjectByName(page, 'AI-Engine-V2')
    await clickExact(page, '[role="menuitem"]', '概况')
    await clickExact(page, 'button', '编辑', '[aria-label="技术项目概况"]')
    await page.waitForSelector('.ant-modal', { visible: true })
    await selectFormOption(page, 'TMG 及技术领域', '系统应用')
    await selectFormOption(page, '子领域', 'AIOS')
    for (const [label, person] of [
      ['技术项目负责人', '李四'],
      ['技术项目经理', '王五'],
      ['测试代表', '赵六'],
      ['质量代表', '孙七'],
      ['产品代表', '周八'],
      ['标准化代表', '杜甫'],
    ]) await selectFormOption(page, label, person)
    await clickExact(page, '.ant-modal button', '保存')
    await assertText(page, '项目信息已保存')
    await clickExact(page, '[role="menuitem"]', '权限配置')
    const expectedTechnicalRoles = {
      技术项目负责人: ['李四'], 技术项目经理: ['王五'], 测试代表: ['赵六'], 质量代表: ['孙七'], 产品代表: ['周八'], 标准化代表: ['杜甫'],
    }
    for (const [role, members] of Object.entries(expectedTechnicalRoles)) {
      await page.waitForFunction((name, expected) => {
        const row = Array.from(document.querySelectorAll('.ant-table-tbody tr')).find(candidate => (candidate.querySelector('.ant-table-cell')?.textContent || '').trim().startsWith(name))
        const actual = row ? Array.from(row.querySelectorAll('.ant-select-selection-item')).map(item => (item.textContent || '').trim()) : []
        return JSON.stringify(actual) === JSON.stringify(expected)
      }, {}, role, members)
    }
    await page.waitForFunction(() => document.querySelectorAll('.ant-table-tbody .ant-select-disabled').length === 6)
    const technicalProject = await page.evaluate(() => {
      const envelope = JSON.parse(localStorage.getItem('pms-projects') || '{}')
      return envelope?.state?.projects?.find(project => project.id === '9') || null
    })
    if (technicalProject?.leader !== '李四' || JSON.stringify(technicalProject?.responsiblePersons) !== JSON.stringify(['李四'])) {
      throw new Error(`技术项目责任人同步错误：${JSON.stringify(technicalProject)}`)
    }

    console.log('  STEP edit tOS team, then overwrite fixed role in permission UI (last write wins)')
    await clickExact(page, 'button', '返回项目列表')
    await clickButtonPrefix(page, '[aria-label="项目分类筛选"]', 'tOS版本项目')
    await clickAria(page, '卡片视图')
    await clickAria(page, '打开项目 6')
    console.log('    TOS open edit')
    await clickExact(page, 'button', '编辑')
    console.log('    TOS replace manager in team')
    for (const [label, member] of [
      ['版本项目经理', '李四'], ['规划代表', '赵六'], ['SE', '李白'], ['测试代表', '王五'], ['SQA', '张三'],
      ['CMO', '孙七'], ['UX', '周八'], ['稳定性代表', '杜甫'], ['性能代表', '赵六'], ['功耗代表', '王五'],
      ['系统应用开发代表', '张三'], ['底软通信开发代表', '李四'], ['集成维护开发代表', '孙七'],
      ['软件架设与技术规划部开发代表', '周八'], ['创新产品开发代表', '杜甫'], ['TEX AI 开发代表', '李白'],
      ['影像开发代表', '赵六'], ['预装管理开发代表', '王五'], ['研发战略生态合作部代表', '张三'],
    ]) await replaceFormMultiValues(page, label, [member])
    await page.waitForFunction(() => {
      const item = Array.from(document.querySelectorAll('.ant-form-item')).find(candidate => (candidate.querySelector('.ant-form-item-label')?.textContent || '').trim().startsWith('版本项目经理'))
      return Array.from(item?.querySelectorAll('.ant-select-selection-item') || []).map(element => (element.textContent || '').trim()).join(',') === '李四'
    })
    console.log('    TOS save team')
    await clickExact(page, '.ant-modal button', '保存')
    await wait(600)
    const savedTosTeam = await page.evaluate(() => {
      const envelope = JSON.parse(localStorage.getItem('pms-projects') || '{}')
      const project = envelope?.state?.projects?.find(item => item.id === '6')
      return { members: project?.fieldValues?.tosVersionProjectManager, modalOpen: Boolean(document.querySelector('.ant-modal')), errors: Array.from(document.querySelectorAll('.ant-form-item-explain-error')).map(element => (element.textContent || '').trim()).filter(Boolean) }
    })
    if (JSON.stringify(savedTosTeam.members) !== JSON.stringify(['李四'])) throw new Error(`tOS 团队保存失败：${JSON.stringify(savedTosTeam)}`)
    console.log('    TOS open permission')
    await clickExact(page, '[role="menuitem"]', '权限配置')
    for (const role of ['版本项目经理', '规划代表', 'SE', 'SQA', 'CMO', 'UX']) await assertText(page, role)
    await page.waitForFunction(() => {
      const row = Array.from(document.querySelectorAll('.ant-table-tbody tr')).find(candidate => (candidate.querySelector('.ant-table-cell')?.textContent || '').trim().startsWith('版本项目经理'))
      return Array.from(row?.querySelectorAll('.ant-select-selection-item') || []).map(item => (item.textContent || '').trim()).join(',') === '李四'
    })
    console.log('    TOS overwrite permission manager')
    await replacePermissionRoleMembers(page, '版本项目经理', ['王五'])
    const permissionMembers = await permissionRoleMembers(page, '版本项目经理')
    if (JSON.stringify(permissionMembers) !== JSON.stringify(['王五'])) throw new Error(`权限侧 tOS 角色修改失败：${JSON.stringify(permissionMembers)}`)
    console.log('    TOS reopen team edit')
    await clickExact(page, '[role="menuitem"]', '基础信息')
    await clickExact(page, 'button', '编辑')
    await page.waitForFunction(() => {
      const item = Array.from(document.querySelectorAll('.ant-form-item')).find(candidate => (candidate.querySelector('.ant-form-item-label')?.textContent || '').trim().startsWith('版本项目经理'))
      return Array.from(item?.querySelectorAll('.ant-select-selection-item') || []).map(element => (element.textContent || '').trim()).join(',') === '王五'
    })
    const tosProject = await page.evaluate(() => {
      const envelope = JSON.parse(localStorage.getItem('pms-projects') || '{}')
      return envelope?.state?.projects?.find(project => project.id === '6') || null
    })
    if (tosProject?.leader !== '王五' || JSON.stringify(tosProject?.responsiblePersons) !== JSON.stringify(['王五'])) {
      throw new Error(`tOS 版本项目责任人最终同步错误：${JSON.stringify(tosProject)}`)
    }
  })

  await runScenario('12 source-aware project-space return', {}, async page => {
    await openMain(page, '项目列表')
    await clickProjectByName(page, 'X6877-D8400_H991')
    await assertText(page, '返回项目列表')
    await clickExact(page, 'button', '返回项目列表')
    await page.waitForFunction(() => (document.querySelector('.ant-menu-item-selected')?.textContent || '').trim() === '项目列表')
    await assertText(page, '项目分类')
  })

  const expectedCount = SCENARIO_ONLY ? 1 : 13 - Math.max(1, SCENARIO_FROM)
  if (results.length !== expectedCount) throw new Error(`场景数量错误：${results.length}/${expectedCount}`)
  console.log(`PASS redesigned project workflows: ${results.length}/${expectedCount} scenarios (${BASE_URL})`)
} catch (error) {
  console.error(`FAIL redesigned project workflows\n${error.stack || error}`)
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
}
