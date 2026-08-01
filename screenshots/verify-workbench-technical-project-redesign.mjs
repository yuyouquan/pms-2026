#!/usr/bin/env node

import puppeteer from 'puppeteer'

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
  await clickExact(page, '[role="menuitem"]', label)
  await page.waitForFunction(value => (
    (document.querySelector('.ant-menu-item-selected')?.textContent || '').trim() === value
  ), { timeout: TIMEOUT }, label)
}

const formCombo = async (page, label) => {
  const handle = await page.evaluateHandle(expected => {
    const item = Array.from(document.querySelectorAll('.ant-form-item')).find(candidate => (
      (candidate.querySelector('.ant-form-item-label')?.textContent || '').trim() === expected
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
  })

  await runScenario('04 machine tos technical quick filters are linked', {}, async page => {
    await openMain(page, '项目列表')
    await clickAria(page, '列表视图')
    for (const label of ['快捷筛选-首销 tOS 版本', '快捷筛选-芯片编码', '快捷筛选-品牌', '快捷筛选-产品系列', '快捷筛选-产品类型']) {
      await page.waitForSelector(`[aria-label="${label}"]`, { visible: true })
    }
    console.log('  STEP apply machine brand quick filter and verify rows')
    await openAriaCombo(page, '快捷筛选-品牌')
    await selectOption(page, 'Infinix')
    await page.keyboard.press('Escape')
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
    await page.waitForSelector('[aria-label="TDT项目列表"]', { visible: true })
    await page.waitForSelector('[aria-label="子项目列表"]', { visible: true })
    console.log('  STEP apply technical name filter and verify TDT result')
    await fillInput(page, '[aria-label="快捷筛选-项目名称"]', 'AI-Engine')
    await page.waitForFunction(() => {
      const section = document.querySelector('[aria-label="TDT项目列表"]')
      const rows = Array.from(section?.querySelectorAll('.ant-table-tbody tr[data-row-key]') || []).filter(element => element.getBoundingClientRect().height > 0)
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
  })

  await runScenario('08 IPM child config inactive and reactivation semantics', {}, async page => {
    await openMain(page, '项目列表')
    await clickButtonPrefix(page, '[aria-label="项目分类筛选"]', '技术项目')
    await clickProjectByName(page, 'AI-Engine-V2')
    await clickExact(page, '[role="menuitem"]', '计划')
    await page.waitForSelector('[aria-label="技术项目计划"]', { visible: true })
    await assertText(page, 'TDT项目计划')
    await assertText(page, 'AI推理引擎子项目计划')
    await clickAria(page, '配置子项目 AI推理引擎子项目')
    await assertText(page, '核心价值', '.ant-modal')
    await assertText(page, '开发模式', '.ant-modal')
    await clickExact(page, '.ant-modal button', '取消')
    await clickAria(page, '显示已停用子项目计划')
    await assertText(page, '端侧训练子项目计划')
    await assertText(page, '已停用')
    console.log('  STEP reactivate the same stable IPM child and rehydrate UI')
    await page.evaluate(() => {
      localStorage.setItem('pms-technical-projects', JSON.stringify({ state: { subprojects: [
        { id: 'IPM-AI-001', parentProjectId: '9', name: 'AI推理引擎子项目', active: true, ipmOrder: 1, configuration: { coreValue: '追赶', developmentMode: '自研', firstTosVersion: '16.0', firstMachineProjectId: '1' } },
        { id: 'IPM-AI-002', parentProjectId: '9', name: '多模态子项目', active: true, ipmOrder: 2, configuration: { coreValue: '', developmentMode: '', firstTosVersion: '', firstMachineProjectId: '' } },
        { id: 'IPM-AI-003', parentProjectId: '9', name: '端侧训练子项目', active: true, ipmOrder: 3, configuration: { coreValue: '人无我有', developmentMode: '高校合作', firstTosVersion: '', firstMachineProjectId: '' } },
      ] }, version: 2 }))
    })
    await page.reload({ waitUntil: 'networkidle0' })
    await openMain(page, '项目列表')
    await clickButtonPrefix(page, '[aria-label="项目分类筛选"]', '技术项目')
    await clickProjectByName(page, 'AI-Engine-V2')
    await clickExact(page, '[role="menuitem"]', '计划')
    await assertText(page, '端侧训练子项目计划')
    await page.waitForSelector('[aria-label="配置子项目 端侧训练子项目"]', { visible: true })
    const stableIds = await page.evaluate(() => JSON.parse(localStorage.getItem('pms-technical-projects') || '{}').state.subprojects.filter(item => item.name === '端侧训练子项目').map(item => item.id))
    if (JSON.stringify(stableIds) !== JSON.stringify(['IPM-AI-003'])) throw new Error(`恢复时稳定ID不唯一：${JSON.stringify(stableIds)}`)
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
    await page.waitForSelector('[aria-label="TDT项目列表"]', { visible: true })
    for (const label of ['规划阶段', '概念阶段', '计划阶段', '开发验证阶段', '迁移阶段']) await assertText(page, label)
    await assertText(page, '项目阶段')
    await page.waitForSelector('[aria-label="子项目列表"]', { visible: true })
    for (const label of ['第1版转测', '第2版转测', '第X版转测', 'TDR3']) await assertText(page, label)
  })

  await runScenario('11 technical one-way and tOS last-write role surfaces', {}, async page => {
    await openMain(page, '项目列表')
    await clickButtonPrefix(page, '[aria-label="项目分类筛选"]', '技术项目')
    await clickProjectByName(page, 'AI-Engine-V2')
    await clickExact(page, '[role="menuitem"]', '权限配置')
    for (const role of ['技术项目负责人', '技术项目经理', '测试代表', '质量代表', '产品代表', '标准化代表']) await assertText(page, role)
    await page.waitForFunction(() => document.querySelectorAll('.ant-table-tbody .ant-select-disabled').length === 6)

    await clickExact(page, 'button', '返回项目列表')
    await clickButtonPrefix(page, '[aria-label="项目分类筛选"]', 'tOS版本项目')
    await clickAria(page, '卡片视图')
    await clickAria(page, '打开项目 6')
    await clickExact(page, '[role="menuitem"]', '权限配置')
    for (const role of ['版本项目经理', '规划代表', 'SE', 'SQA', 'CMO', 'UX']) await assertText(page, role)
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
