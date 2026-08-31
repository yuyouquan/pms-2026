#!/usr/bin/env node

import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import puppeteer from 'puppeteer'

const BASE_URL = process.env.BASE_URL || process.env.PMS_BASE_URL || 'http://127.0.0.1:3021'
const TIMEOUT = 30_000
const ARTIFACT_DIR = process.env.PMS_BROWSER_ARTIFACT_DIR || '/tmp/pms-project-surface-browser'
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const STORAGE_KEYS = [
  'pms-projects',
  'pms-plan-store',
  'pms-technical-projects',
  'pms-technical-plans',
  'pms-project-permissions',
]
const TECHNICAL_CORE_LABELS = [
  '项目分类', '技术赛道', 'TMG及技术领域', '子领域', '项目状态', '项目阶段',
  '项目年份', '前置项目', '项目价值',
]

let browser
const passed = []

const waitForAnimationFrame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))

const clickExact = async (page, selector, text, scope = 'body') => {
  const clicked = await page.evaluate((candidateSelector, expected, rootSelector) => {
    const root = document.querySelector(rootSelector)
    const target = Array.from(root?.querySelectorAll(candidateSelector) || []).find(element => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
        && (element.textContent || '').replace(/\s+/g, ' ').trim() === expected
    })
    target?.click()
    return Boolean(target)
  }, selector, text, scope)
  if (!clicked) throw new Error(`找不到可见控件：${scope} ${selector} ${text}`)
  await waitForAnimationFrame(page)
}

const clickAria = async (page, label) => {
  await page.waitForFunction(value => Array.from(document.querySelectorAll(`[aria-label="${CSS.escape(value)}"]`)).some(element => {
    const target = element.getBoundingClientRect().width > 0 ? element : element.closest('label')
    return target && target.getBoundingClientRect().width > 0 && target.getBoundingClientRect().height > 0
  }), { timeout: TIMEOUT }, label)
  const clicked = await page.evaluate(value => {
    const element = Array.from(document.querySelectorAll(`[aria-label="${CSS.escape(value)}"]`)).find(candidate => {
      const target = candidate.getBoundingClientRect().width > 0 ? candidate : candidate.closest('label')
      return target && target.getBoundingClientRect().width > 0 && target.getBoundingClientRect().height > 0
    })
    const target = element?.getBoundingClientRect().width ? element : element?.closest('label')
    target?.click()
    return Boolean(target)
  }, label)
  if (!clicked) throw new Error(`找不到可见 ARIA 控件：${label}`)
  await waitForAnimationFrame(page)
}

const openMain = async (page, label) => {
  const selected = await page.evaluate(value => (document.querySelector('.ant-menu-item-selected')?.textContent || '').trim() === value, label)
  if (!selected) await clickExact(page, '[role="menuitem"]', label)
  await page.waitForFunction(value => (document.querySelector('.ant-menu-item-selected')?.textContent || '').trim() === value, { timeout: TIMEOUT }, label)
}

const clickCategory = async (page, label) => {
  const clicked = await page.evaluate(expected => {
    const button = Array.from(document.querySelectorAll('[aria-label="项目分类筛选"] button')).find(element => (
      element.getBoundingClientRect().height > 0 && (element.textContent || '').trim().startsWith(expected)
    ))
    button?.click()
    return Boolean(button)
  }, label)
  if (!clicked) throw new Error(`找不到项目分类：${label}`)
  await page.waitForFunction(expected => Array.from(document.querySelectorAll('[aria-label="项目分类筛选"] button')).some(element => (
    (element.textContent || '').trim().startsWith(expected)
      && getComputedStyle(element).backgroundColor === 'rgb(255, 255, 255)'
  )), { timeout: TIMEOUT }, label)
  await waitForAnimationFrame(page)
}

const clickProjectCard = async (page, name) => {
  await page.waitForFunction(expected => Array.from(document.querySelectorAll('.pms-project-card-title')).some(element => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
      && (element.textContent || '').trim() === expected
  }), { timeout: TIMEOUT }, name)
  const clicked = await page.evaluate(expected => {
    const title = Array.from(document.querySelectorAll('.pms-project-card-title')).find(element => (
      element.getBoundingClientRect().height > 0 && (element.textContent || '').trim() === expected
    ))
    const card = title?.closest('.pms-project-card[role="button"]')
    card?.click()
    return Boolean(card)
  }, name)
  if (!clicked) throw new Error(`找不到项目卡片：${name}`)
  await page.waitForSelector('#section-plan', { visible: true, timeout: TIMEOUT })
}

const openExternalProject = async (page, bid) => {
  const input = await page.evaluateHandle(() => {
    const source = document.querySelector('.ant-modal [aria-label="IPM项目来源"]')
    return source?.querySelector('input[role="combobox"]') || null
  })
  const element = input.asElement()
  if (!element) throw new Error('找不到 IPM 项目来源下拉')
  await element.focus()
  await page.keyboard.press('ArrowDown')
  await page.waitForFunction((sourceInput, expected) => {
    const popupId = sourceInput?.getAttribute('aria-controls') || sourceInput?.getAttribute('aria-owns')
    const popup = popupId ? document.getElementById(popupId)?.closest('.ant-select-dropdown') : null
    const option = Array.from(popup?.querySelectorAll('.ant-select-item-option:not(.ant-select-item-option-disabled)') || []).find(item => (
      item.getBoundingClientRect().height > 0 && (item.textContent || '').includes(expected)
    ))
    if (!(option instanceof HTMLElement)) return false
    option.click()
    return true
  }, { timeout: TIMEOUT, polling: 'raf' }, element, bid)
  await page.waitForSelector('.ant-modal [data-project-create-field]', { visible: true, timeout: TIMEOUT })
  await input.dispose()
}

const assertLightSurface = async (page, selector, label) => {
  const state = await page.$eval(selector, element => {
    const style = getComputedStyle(element)
    const rgb = style.backgroundColor.match(/[\d.]+/g)?.slice(0, 3).map(Number) || []
    return { background: style.backgroundColor, radius: Number.parseFloat(style.borderRadius), rgb }
  })
  assert.equal(state.rgb.length, 3, `${label} 必须有可计算背景色：${JSON.stringify(state)}`)
  assert.ok(state.rgb.every(channel => channel >= 238), `${label} 必须保持白色/浅色表面：${JSON.stringify(state)}`)
  assert.ok(state.radius >= 6, `${label} 必须保留圆角：${JSON.stringify(state)}`)
}

const assertNoClippingOrOverlap = async (page, selectors, label) => {
  const result = await page.evaluate(candidateSelectors => candidateSelectors.map(selector => {
    const element = Array.from(document.querySelectorAll(selector)).find(candidate => {
      const rect = candidate.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })
    if (!element) return { selector, missing: true }
    const rect = element.getBoundingClientRect()
    return {
      selector,
      rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
    }
  }), selectors)
  for (const item of result) {
    assert.equal(item.missing, undefined, `${label} 缺少关键元素 ${item.selector}`)
    assert.ok(item.rect.width > 0 && item.rect.height > 0, `${label} 元素被裁空：${JSON.stringify(item)}`)
    assert.ok(item.rect.right > 0 && item.rect.left < item.viewportWidth, `${label} 元素超出水平视口：${JSON.stringify(item)}`)
    assert.ok(item.rect.bottom > 0 && item.rect.top < item.viewportHeight, `${label} 元素超出垂直视口：${JSON.stringify(item)}`)
  }
  for (let index = 0; index < result.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < result.length; otherIndex += 1) {
      const left = result[index].rect
      const right = result[otherIndex].rect
      const overlapWidth = Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left))
      const overlapHeight = Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top))
      assert.equal(overlapWidth * overlapHeight, 0, `${label} 关键元素不得重叠：${JSON.stringify([result[index], result[otherIndex]])}`)
    }
  }
}

const assertDateCells = async (page, selector, label) => {
  const values = await page.$$eval(`${selector} td`, cells => cells.flatMap(cell => {
    const text = (cell.textContent || '').trim()
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? [text] : []
  }))
  assert.ok(values.length > 0 && values.every(value => DATE_PATTERN.test(value)), `${label} 必须保留日期单元格：${JSON.stringify(values)}`)
}

const installStorageReset = async page => {
  await page.evaluateOnNewDocument(keys => {
    for (const key of keys) localStorage.removeItem(key)
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('pms:project-summary:') || key.startsWith('pms:project-creation-draft:')) localStorage.removeItem(key)
    }
    sessionStorage.removeItem('pms:technical-project-list-target-child')
  }, STORAGE_KEYS)
}

const prewarm = async () => {
  const context = await browser.createBrowserContext()
  try {
    const page = await context.newPage()
    page.setDefaultTimeout(TIMEOUT)
    const response = await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: TIMEOUT })
    assert.ok(response && response.status() < 400, `预热主文档 HTTP ${response?.status() || '无响应'}`)
    await page.waitForSelector('[role="menuitem"]', { visible: true, timeout: TIMEOUT })
    console.log(`PASS prewarm (${BASE_URL})`)
  } finally {
    await context.close()
  }
}

const runScenario = async (name, exercise) => {
  console.log(`RUN ${name}`)
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  const applicationErrors = []
  page.setDefaultTimeout(TIMEOUT)
  page.setDefaultNavigationTimeout(TIMEOUT)
  page.on('pageerror', error => applicationErrors.push(`[pageerror] ${error.message}`))
  page.on('console', message => {
    if (message.type() === 'error') applicationErrors.push(`[console.error] ${message.text()}`)
  })
  page.on('requestfailed', request => {
    applicationErrors.push(`[requestfailed] ${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`)
  })
  page.on('response', response => {
    if (response.status() >= 400) applicationErrors.push(`[http.${response.status()}] ${response.request().method()} ${response.url()}`)
  })
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 })
  await installStorageReset(page)
  try {
    const response = await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: TIMEOUT })
    assert.ok(response && response.status() < 400, `主文档 HTTP ${response?.status() || '无响应'}`)
    await exercise(page)
    assert.deepEqual(applicationErrors, [], `浏览器应用异常：\n${applicationErrors.join('\n')}`)
    await page.screenshot({ path: join(ARTIFACT_DIR, `${name}.png`), fullPage: false })
    passed.push(name)
    console.log(`PASS ${name}`)
  } catch (error) {
    await page.screenshot({ path: join(ARTIFACT_DIR, `${name}-failure.png`), fullPage: false }).catch(() => undefined)
    const diagnostics = await page.evaluate(() => ({ url: location.href, text: (document.body?.innerText || '').slice(0, 2600) })).catch(() => ({}))
    throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}\nerrors=${JSON.stringify(applicationErrors)}\ndiagnostics=${JSON.stringify(diagnostics)}`)
  } finally {
    await context.close()
  }
}

await mkdir(ARTIFACT_DIR, { recursive: true })

try {
  browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PMS_CHROME_EXECUTABLE || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1600,1000'],
  })
  await prewarm()

  await runScenario('01-list-modal', async page => {
    await openMain(page, '项目列表')
    await clickAria(page, '卡片视图')
    await page.waitForSelector('.pms-project-list-content .pms-project-card', { visible: true, timeout: TIMEOUT })
    const cards = await page.$$eval('.pms-project-list-content .pms-project-card', elements => elements.filter(element => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    }).map(element => ({
      title: (element.querySelector('.pms-project-card-title')?.textContent || '').trim(),
      role: element.getAttribute('role'),
      label: element.getAttribute('aria-label'),
    })))
    assert.ok(cards.length > 0, '卡片视图必须显示项目卡片')
    assert.ok(cards.every(card => card.role === 'button' && card.label?.startsWith('打开项目 ')), `项目卡片必须暴露可访问打开按钮：${JSON.stringify(cards)}`)
    assert.ok(cards.some(card => card.title === 'X6877-D8400_H991'), '卡片视图缺少代表整机项目 X6877-D8400_H991')
    await assertLightSurface(page, '.pms-project-card-surface', '项目卡片')
    await assertNoClippingOrOverlap(page, ['.pms-project-card-header', '.pms-project-card-footer'], '项目卡片')
    await page.screenshot({ path: join(ARTIFACT_DIR, '01-card-view.png'), fullPage: false })

    await clickAria(page, '列表视图')
    await page.waitForSelector('.pms-project-summary-table thead', { visible: true, timeout: TIMEOUT })
    await page.waitForSelector('[aria-label="筛选"]', { visible: true, timeout: TIMEOUT })
    await page.waitForSelector('.pms-project-list-pagination', { visible: true, timeout: TIMEOUT })
    const tableState = await page.evaluate(() => {
      const visible = element => {
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
      }
      const headers = Array.from(document.querySelectorAll('.pms-project-summary-table thead th[data-project-list-column-unit]')).filter(visible)
      const fixedCells = Array.from(document.querySelectorAll('.pms-project-summary-table .ant-table-cell-fix-left, .pms-project-summary-table .ant-table-cell-fix-start')).filter(visible)
      const opaque = fixedCells.every(cell => {
        const color = getComputedStyle(cell).backgroundColor
        return color !== 'transparent' && !/rgba\([^)]*,\s*0(?:\.0+)?\)/.test(color)
      })
      return {
        scope: Boolean(document.querySelector('.pms-project-summary-surface')),
        units: headers.map(header => header.getAttribute('data-project-list-column-unit')),
        movable: headers.filter(header => header.getAttribute('data-project-list-draggable') === 'true').length,
        locked: headers.filter(header => header.getAttribute('data-project-list-column-locked') === 'true').length,
        fixedCount: fixedCells.length, opaque,
      }
    })
    assert.equal(tableState.scope, true, '列表必须暴露 pms-project-summary-surface 语义范围')
    assert.ok(tableState.units.length > 0 && tableState.units.every(Boolean), `列表表头必须暴露列单元元数据：${JSON.stringify(tableState)}`)
    assert.ok(tableState.movable > 0, `列表必须有可移动表头元数据：${JSON.stringify(tableState)}`)
    assert.equal(tableState.locked, 0, `整机矩阵已明确取消固定列：${JSON.stringify(tableState)}`)
    assert.equal(tableState.fixedCount, 0, `整机矩阵不得残留固定单元格：${JSON.stringify(tableState)}`)
    await assertLightSurface(page, '.pms-project-summary-surface', '项目列表表格')
    await assertNoClippingOrOverlap(page, ['.pms-project-list-filter-grid', '.pms-project-summary-table thead'], '项目列表')

    await clickCategory(page, 'tOS版本项目')
    await page.waitForSelector('.pms-project-summary-table thead', { visible: true, timeout: TIMEOUT })
    const fixedState = await page.evaluate(() => {
      const visible = element => {
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
      }
      const headers = Array.from(document.querySelectorAll('.pms-project-summary-table thead th[data-project-list-column-unit]')).filter(visible)
      const fixedCells = Array.from(document.querySelectorAll('.pms-project-summary-table .ant-table-cell-fix-left, .pms-project-summary-table .ant-table-cell-fix-start')).filter(visible)
      return {
        locked: headers.filter(header => header.getAttribute('data-project-list-column-locked') === 'true').map(header => header.getAttribute('data-project-list-column-unit')),
        movable: headers.filter(header => header.getAttribute('data-project-list-draggable') === 'true').length,
        fixedCount: fixedCells.length,
        backgrounds: fixedCells.map(cell => getComputedStyle(cell).backgroundColor),
      }
    })
    assert.ok(fixedState.locked.length > 0, `tOS 列表必须有锁定表头元数据：${JSON.stringify(fixedState)}`)
    assert.ok(fixedState.movable > 0, `tOS 列表必须同时保留可移动表头：${JSON.stringify(fixedState)}`)
    assert.ok(fixedState.fixedCount > 0, `tOS 列表必须渲染固定单元格：${JSON.stringify(fixedState)}`)
    assert.ok(fixedState.backgrounds.every(color => color !== 'transparent' && !/rgba\([^)]*,\s*0(?:\.0+)?\)/.test(color)), `固定单元格必须为不透明表面：${JSON.stringify(fixedState)}`)

    await clickCategory(page, '整机产品项目')
    await clickAria(page, '新增项目')
    await page.waitForSelector('.pms-project-info-modal-surface .ant-modal-container', { visible: true, timeout: TIMEOUT })
    const modalState = await page.$eval('.pms-project-info-modal-surface', root => {
      const container = root.querySelector('.ant-modal-container')
      const body = root.querySelector('.ant-modal-body')
      const footer = root.querySelector('.ant-modal-footer')
      const containerStyle = getComputedStyle(container)
      const bodyStyle = getComputedStyle(body)
      const footerStyle = getComputedStyle(footer)
      return {
        classes: root.className,
        container: { display: containerStyle.display, maxHeight: containerStyle.maxHeight, background: containerStyle.backgroundColor, radius: containerStyle.borderRadius },
        body: { overflowY: bodyStyle.overflowY, background: bodyStyle.backgroundColor },
        footer: { flex: footerStyle.flex, flexGrow: footerStyle.flexGrow, flexShrink: footerStyle.flexShrink, background: footerStyle.backgroundColor },
      }
    })
    assert.match(modalState.classes, /\bpms-modal\b/)
    assert.match(modalState.classes, /\bpms-project-info-modal-surface\b/)
    assert.equal(modalState.container.display, 'flex', `Modal 容器必须为 flex：${JSON.stringify(modalState)}`)
    assert.ok(Number.parseFloat(modalState.container.maxHeight) > 0, `Modal 容器必须有 max-height：${JSON.stringify(modalState)}`)
    assert.notEqual(modalState.container.background, 'rgba(0, 0, 0, 0)', `Modal 容器必须有实色背景：${JSON.stringify(modalState)}`)
    assert.equal(modalState.body.overflowY, 'auto', `Modal body 必须内部滚动：${JSON.stringify(modalState)}`)
    assert.equal(modalState.footer.flexGrow, '0', `Modal footer 不得增长：${JSON.stringify(modalState)}`)
    assert.equal(modalState.footer.flexShrink, '0', `Modal footer 不得收缩：${JSON.stringify(modalState)}`)
    assert.notEqual(modalState.footer.background, 'rgba(0, 0, 0, 0)', `Modal footer 必须有实色背景：${JSON.stringify(modalState)}`)
    await assertNoClippingOrOverlap(page, ['.pms-project-info-modal-surface .ant-modal-header', '.pms-project-info-modal-surface .ant-modal-footer'], '新增项目弹窗')
    const sourceBeforeFields = await page.evaluate(() => {
      const source = document.querySelector('.ant-modal [aria-label="IPM项目来源"]')
      const first = document.querySelector('.ant-modal [data-project-create-field]')
      return { source: Boolean(source), first: Boolean(first), before: !first || Boolean(source?.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING) }
    })
    assert.deepEqual(sourceBeforeFields, { source: true, first: false, before: true }, `初始外部/IPM 流程必须从来源选择器开始：${JSON.stringify(sourceBeforeFields)}`)
    await openExternalProject(page, 'EXT-006')
    const fieldOrder = await page.$$eval('.ant-modal [data-project-create-field]', elements => elements.filter(element => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    }).map(element => ({
      key: element.getAttribute('data-project-create-field'),
      label: (element.querySelector('.ant-form-item-label')?.textContent || '').replace(/\s+/g, ' ').trim(),
    })))
    assert.ok(fieldOrder.length >= 4, `选择 IPM 项目后必须显示新建字段：${JSON.stringify(fieldOrder)}`)
    assert.deepEqual(fieldOrder.slice(0, 4).map(field => field.label), ['项目分类', '技术赛道', '子项目名称', '项目状态'], `EXT-006/AI-Engine-V3 外部/IPM 流程起始字段顺序错误：${JSON.stringify(fieldOrder.slice(0, 6))}`)
    assert.ok(fieldOrder.every(field => field.key), `新建字段必须保留 data-project-create-field：${JSON.stringify(fieldOrder)}`)
    await page.screenshot({ path: join(ARTIFACT_DIR, '01-add-modal.png'), fullPage: false })
    await clickExact(page, '.ant-modal button', '取消')
    await page.waitForFunction(() => !Array.from(document.querySelectorAll('.pms-project-info-modal-surface')).some(element => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    }), { timeout: TIMEOUT })
  })

  await runScenario('02-technical', async page => {
    await openMain(page, '项目列表')
    await clickCategory(page, '技术项目')
    await clickAria(page, '卡片视图')
    await clickProjectCard(page, 'AIOS架构演进V3')
    await page.waitForSelector('[aria-label="技术项目基础信息"]', { visible: true, timeout: TIMEOUT })
    const labels = await page.$$eval('[aria-label="技术项目基础信息"] .pms-project-info-core-label', elements => elements.filter(element => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    }).map(element => (element.textContent || '').replace(/\s+/g, '').trim()))
    assert.deepEqual(labels, TECHNICAL_CORE_LABELS, `技术项目核心字段顺序错误：${JSON.stringify(labels)}`)
    assert.equal(labels.includes('TDT和子项目名称'), false, '技术项目核心字段不得显示 TDT和子项目名称')
    await assertLightSurface(page, '[aria-label="技术项目基础信息"] .pms-project-info-core-card', '技术项目核心信息')
    await clickExact(page, '[role="tab"]', '分布式服务框架', '[aria-label="技术信息分类"]')
    await page.waitForSelector('table[aria-label="分布式服务框架版本活动"]', { visible: true, timeout: TIMEOUT })
    const planState = await page.$eval('table[aria-label="分布式服务框架版本活动"]', table => {
      const visible = element => {
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
      }
      const headerRows = Array.from(table.querySelectorAll('thead tr')).filter(visible)
      const headers = Array.from(headerRows[0]?.querySelectorAll('th') || []).map(cell => (cell.textContent || '').replace(/\s+/g, '').trim())
      const rows = Array.from(table.querySelectorAll('tbody tr')).filter(visible).map(row => Array.from(row.querySelectorAll('td')).map(cell => (cell.textContent || '').trim()))
      return {
        headerRows: headerRows.length,
        marker: headerRows[0]?.getAttribute('data-technical-plan-header'),
        grouped: table.querySelectorAll('thead [data-technical-plan-header="grouped"]').length,
        headers,
        rows,
        text: table.textContent || '',
      }
    })
    assert.equal(planState.headerRows, 1, `技术子项目必须只有一行表头：${JSON.stringify(planState)}`)
    assert.equal(planState.marker, 'single-row', `技术子项目必须暴露 single-row 标记：${JSON.stringify(planState)}`)
    assert.equal(planState.grouped, 0, '技术子项目不得出现 grouped 表头')
    assert.equal(planState.text.includes('子项目计划'), false, '技术子项目不得合成“子项目计划”分组')
    assert.deepEqual(planState.headers.slice(0, 2), ['版本', '开发周期'], `技术子项目表头必须从版本/开发周期开始：${JSON.stringify(planState.headers)}`)
    const versionRow = planState.rows.find(row => row[0] === 'V1')
    const actualRow = planState.rows.find(row => row[0] === '实际')
    assert.ok(versionRow, `技术子项目必须显示 V1 行：${JSON.stringify(planState.rows)}`)
    assert.match(versionRow[1], /^\d+(?:天)?$/, `技术子项目开发周期必须为数值：${JSON.stringify(versionRow)}`)
    assert.ok(versionRow.slice(2).some(value => DATE_PATTERN.test(value)), `技术子项目 V1 必须显示日期：${JSON.stringify(versionRow)}`)
    assert.ok(actualRow, `技术子项目必须显示实际行：${JSON.stringify(planState.rows)}`)
    await assertNoClippingOrOverlap(page, ['[aria-label="技术信息分类"]', 'table[aria-label="分布式服务框架版本活动"] thead'], '技术项目信息')
    const planElement = await page.$('table[aria-label="分布式服务框架版本活动"]')
    await planElement.screenshot({ path: join(ARTIFACT_DIR, '02-technical-child-plan.png') })
  })

  await runScenario('03-machine-tos', async page => {
    const samples = [
      { category: '整机产品项目', name: 'X6877-D8400_H991' },
      { category: 'tOS版本项目', name: 'tOS16.1' },
    ]
    for (const sample of samples) {
      const inProjectSpace = await page.evaluate(() => Array.from(document.querySelectorAll('button')).some(element => (
        element.getBoundingClientRect().height > 0 && (element.textContent || '').trim() === '返回项目列表'
      )))
      if (inProjectSpace) {
        await clickExact(page, 'button', '返回项目列表')
        await page.waitForSelector('[aria-label="项目列表视图"]', { visible: true, timeout: TIMEOUT })
      }
      await openMain(page, '项目列表')
      await clickCategory(page, sample.category)
      await clickAria(page, '卡片视图')
      await clickProjectCard(page, sample.name)
      const summaryState = await page.$eval('#section-plan', section => ({
        summaryFields: Array.from(section.querySelectorAll('[data-summary-field]')).map(element => element.getAttribute('data-summary-field')),
        summaryLabels: Array.from(section.querySelectorAll('[data-summary-field]')).map(element => (element.textContent || '').replace(/\s+/g, ' ').trim()),
      }))
      assert.deepEqual(summaryState.summaryFields, [], `${sample.name} 基础信息不得显示最新发布四项摘要：${JSON.stringify(summaryState)}`)
      for (const label of ['计划开始', '计划完成', '实际开始', '实际完成']) {
        assert.equal(summaryState.summaryLabels.some(text => text.includes(label)), false, `${sample.name} 基础信息不得显示摘要标签 ${label}`)
      }
      await page.waitForSelector('#section-plan table[aria-label="一级计划横版"]', { visible: true, timeout: TIMEOUT })
      await assertDateCells(page, '#section-plan table[aria-label="一级计划横版"]', `${sample.name} 基础信息横版计划`)
      await assertNoClippingOrOverlap(page, ['#section-plan .ant-card-head', '#section-plan table[aria-label="一级计划横版"] thead'], `${sample.name} 基础信息计划`)
      const planSection = await page.$('#section-plan')
      await planSection.screenshot({ path: join(ARTIFACT_DIR, `03-${sample.category === '整机产品项目' ? 'machine' : 'tos'}-basic-plan.png`) })

      await clickExact(page, '[role="menuitem"]', '计划', '[aria-label="项目空间导航"]')
      await page.waitForSelector('[aria-label="计划版本"]', { visible: true, timeout: TIMEOUT })
      await page.waitForSelector('table[aria-label="一级计划横版"]', { visible: true, timeout: TIMEOUT })
      await assertDateCells(page, 'table[aria-label="一级计划横版"]', `${sample.name} 项目空间计划内容`)
      const planTable = await page.$('table[aria-label="一级计划横版"]')
      await planTable.screenshot({ path: join(ARTIFACT_DIR, `03-${sample.category === '整机产品项目' ? 'machine' : 'tos'}-workspace-plan.png`) })
    }
  })

  assert.equal(passed.length, 3, `预期 3 个场景，实际 ${passed.length}`)
  console.log(`PASS project surfaces visual refresh browser acceptance ${passed.length}/3 (${BASE_URL})`)
  console.log(`Artifacts: ${ARTIFACT_DIR}`)
} catch (error) {
  console.error(`FAIL project surfaces visual refresh browser acceptance\n${error.stack || error}`)
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
}
