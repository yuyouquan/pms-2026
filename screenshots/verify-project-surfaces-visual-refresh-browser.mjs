#!/usr/bin/env node

import assert from 'node:assert/strict'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import puppeteer from 'puppeteer'

const BASE_URL = process.env.BASE_URL || process.env.PMS_BASE_URL || 'http://127.0.0.1:3021'
const TIMEOUT = 30_000
const ARTIFACT_DIR = '/tmp/pms-project-surface-browser'
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
const technicalTask = (id, taskName, planStartDate, planEndDate, actualStartDate, actualEndDate) => ({
  id, stableId: taskName, source: 'template', role: '技术项目负责人', order: Number(id), taskName,
  responsible: '技术项目负责人', predecessor: '', planStartDate, planEndDate, estimatedDays: 20,
  actualStartDate, actualEndDate, actualDays: 18, status: '已完成', progress: 100, defaultRoadmap: true,
})
const TECHNICAL_PLAN_STORAGE_SEED = JSON.stringify({
  version: 8,
  state: {
    plansByKey: {
      'mock-tech-aios-v3:tdt': {
        planKey: 'mock-tech-aios-v3:tdt', templateKind: 'tdt', currentVersionId: 'tech-mock-tech-aios-v3-v1',
        columnSettings: { order: [], visible: [] }, collapsedRows: [],
        versions: [{
          id: 'tech-mock-tech-aios-v3-v1', versionNo: 'V1', templateType: 'tdt', status: '已发布', publishedAt: '2026-02-01T00:00:00Z',
          tasks: [technicalTask('1', '规划启动', '2026-01-15', '2026-02-10', '2026-01-16', '2026-02-08')],
        }],
      },
      'mock-tech-aios-v3:subproject:IPM-AIOS-001': {
        planKey: 'mock-tech-aios-v3:subproject:IPM-AIOS-001', templateKind: 'subproject', currentVersionId: 'tech-ipm-aios-001-v1',
        columnSettings: { order: [], visible: [] }, collapsedRows: [],
        versions: [{
          id: 'tech-ipm-aios-001-v1', versionNo: 'V1', templateType: 'subproject', status: '已发布', publishedAt: '2026-02-02T00:00:00Z',
          tasks: [
            technicalTask('1', '第1版转测', '2026-01-15', '2026-03-15', '2026-01-18', '2026-03-12'),
            technicalTask('2', '第2版转测', '2026-03-16', '2026-06-01', '2026-03-18', '2026-05-29'),
            technicalTask('3', 'TDR3', '2026-06-02', '2026-08-31', '2026-06-05', '2026-08-28'),
          ],
        }],
      },
    },
  },
})

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
    const elements = Array.from(document.querySelectorAll(selector)).filter(candidate => {
      const rect = candidate.getBoundingClientRect()
      const style = getComputedStyle(candidate)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    })
    return {
      selector,
      missing: elements.length === 0,
      elements: elements.map((element, index) => {
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        const hasMeaningfulContent = Boolean((element.textContent || '').replace(/\s+/g, ' ').trim() || element.querySelector('img,svg,input,button,select'))
        const intentionalTableScroll = Boolean(element.closest('.ant-table-body, .ant-table-content'))
        const intentionalEllipsis = style.textOverflow === 'ellipsis' && ['hidden', 'clip'].includes(style.overflowX)
        const childOverflow = Array.from(element.children).flatMap(child => {
          const childRect = child.getBoundingClientRect()
          const childStyle = getComputedStyle(child)
          if (childRect.width <= 0 || childRect.height <= 0 || childStyle.position === 'fixed') return []
          const outside = childRect.left < rect.left - 1 || childRect.right > rect.right + 1
            || childRect.top < rect.top - 1 || childRect.bottom > rect.bottom + 1
          if (!outside || intentionalTableScroll) return []
          return [{
            tag: child.tagName,
            className: typeof child.className === 'string' ? child.className : '',
            rect: { left: childRect.left, right: childRect.right, top: childRect.top, bottom: childRect.bottom },
          }]
        })
        return {
          index,
          rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
          hasMeaningfulContent,
          contentOverflow: element.scrollWidth > element.clientWidth + 1,
          intentionalTableScroll,
          intentionalEllipsis,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          childOverflow,
        }
      }),
    }
  }), selectors)
  for (const group of result) {
    assert.equal(group.missing, false, `${label} 缺少关键元素 ${group.selector}`)
    for (const item of group.elements) {
      assert.ok(item.rect.width > 0 && item.rect.height > 0, `${label} 元素被裁空：${JSON.stringify({ selector: group.selector, ...item })}`)
      assert.ok(!item.hasMeaningfulContent || !item.contentOverflow || item.intentionalTableScroll || item.intentionalEllipsis,
        `${label} 内容发生非预期水平裁切：${JSON.stringify({ selector: group.selector, ...item })}`)
      assert.deepEqual(item.childOverflow, [], `${label} 子元素超出预期区域：${JSON.stringify({ selector: group.selector, ...item })}`)
    }
  }
  for (let groupIndex = 0; groupIndex < result.length; groupIndex += 1) {
    for (let otherGroupIndex = groupIndex + 1; otherGroupIndex < result.length; otherGroupIndex += 1) {
      for (const leftItem of result[groupIndex].elements) {
        for (const rightItem of result[otherGroupIndex].elements) {
          const left = leftItem.rect
          const right = rightItem.rect
          const overlapWidth = Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left))
          const overlapHeight = Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top))
          assert.equal(overlapWidth * overlapHeight, 0, `${label} 关键元素不得重叠：${JSON.stringify([
            { selector: result[groupIndex].selector, ...leftItem },
            { selector: result[otherGroupIndex].selector, ...rightItem },
          ])}`)
        }
      }
    }
  }
}

const collectProjectHeaderMetadata = async page => page.evaluate(() => {
  const visible = element => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
  }
  const headers = Array.from(document.querySelectorAll('.pms-project-summary-table thead th[data-project-list-column-unit]')).filter(visible)
  const rawVisibleUnitKeys = headers.map(header => header.getAttribute('data-project-list-column-unit'))
  const rawVisibleHeaderIds = headers.map(header => header.getAttribute('data-project-list-header-id'))
  const canonicalEntries = []
  for (const header of headers) {
    const unitKey = header.getAttribute('data-project-list-column-unit')
    if (!unitKey || canonicalEntries.some(candidate => candidate.unitKey === unitKey)) continue
    const unitHeaders = headers.filter(candidate => candidate.getAttribute('data-project-list-column-unit') === unitKey)
    const canonical = unitHeaders.find(candidate => candidate.getAttribute('data-project-list-header-id')?.startsWith('group::'))
      || unitHeaders.find(candidate => candidate.getAttribute('data-project-list-draggable') === 'true' || candidate.getAttribute('data-project-list-column-locked') === 'true')
      || unitHeaders[0]
    canonicalEntries.push({
      unitKey,
      headerId: canonical.getAttribute('data-project-list-header-id'),
      draggable: canonical.getAttribute('data-project-list-draggable') === 'true',
      locked: canonical.getAttribute('data-project-list-column-locked') === 'true',
    })
  }
  return {
    rawVisibleUnitKeys,
    rawVisibleHeaderIds,
    repeatedDomUnits: rawVisibleUnitKeys.filter((unit, index) => rawVisibleUnitKeys.indexOf(unit) !== index),
    canonicalEntries,
    canonicalUnitKeys: canonicalEntries.map(entry => entry.unitKey),
    draggableUnits: [...new Set(headers.filter(header => header.getAttribute('data-project-list-draggable') === 'true').map(header => header.getAttribute('data-project-list-column-unit')).filter(Boolean))],
    lockedUnits: [...new Set(headers.filter(header => header.getAttribute('data-project-list-column-locked') === 'true').map(header => header.getAttribute('data-project-list-column-unit')).filter(Boolean))],
    inconsistentUnits: [...new Set(rawVisibleUnitKeys.filter(Boolean))].filter(unit => {
      const matches = headers.filter(header => header.getAttribute('data-project-list-column-unit') === unit)
      return matches.some(header => header.getAttribute('data-project-list-draggable') === 'true')
        && matches.some(header => header.getAttribute('data-project-list-column-locked') === 'true')
    }),
  }
})

const assertDateCells = async (page, selector, label, minimum = 2) => {
  const values = await page.$$eval(`${selector} td`, cells => cells.flatMap(cell => {
    const text = (cell.textContent || '').trim()
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? [text] : []
  }))
  assert.ok(values.length >= minimum && values.every(value => DATE_PATTERN.test(value)), `${label} 必须保留至少 ${minimum} 个日期单元格：${JSON.stringify(values)}`)
}

const assertHorizontalPlanDateBindings = async (page, selector, label) => {
  const rows = await page.$$eval(`${selector} tbody tr`, elements => elements.filter(element => element.getBoundingClientRect().height > 0).map(row => (
    Array.from(row.querySelectorAll('td')).map(cell => (cell.textContent || '').trim())
  )))
  const planned = rows.find(row => /^V\d+/.test(row[0] || '') && row.filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value)).length >= 2)
  const actual = rows.find(row => row[0] === '实际' && row.filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value)).length >= 2)
  assert.ok(planned, `${label} 必须显示版本绑定的计划日期：${JSON.stringify(rows)}`)
  assert.ok(actual, `${label} 必须显示“实际”行绑定的实际日期：${JSON.stringify(rows)}`)
}

const installStorageReset = async (page, storage = {}) => {
  await page.evaluateOnNewDocument((keys, values) => {
    for (const key of keys) localStorage.removeItem(key)
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('pms:project-summary:') || key.startsWith('pms:project-creation-draft:')) localStorage.removeItem(key)
    }
    sessionStorage.removeItem('pms:technical-project-list-target-child')
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value)
  }, STORAGE_KEYS, storage)
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

const runScenario = async (name, options, exercise) => {
  if (typeof options === 'function') {
    exercise = options
    options = {}
  }
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
  await installStorageReset(page, options.storage)
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
    const originalError = error instanceof Error ? error : new Error(String(error))
    throw new Error(`${name}: ${originalError.stack || originalError.message}\nerrors=${JSON.stringify(applicationErrors)}\ndiagnostics=${JSON.stringify(diagnostics)}`, { cause: originalError })
  } finally {
    await context.close()
  }
}

await rm(ARTIFACT_DIR, { recursive: true, force: true })
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
    const representativeCardStatus = await page.evaluate(() => {
      const card = Array.from(document.querySelectorAll('.pms-project-card')).find(element => (
        (element.querySelector('.pms-project-card-title')?.textContent || '').trim() === 'X6877-D8400_H991'
      ))
      const status = card?.querySelector('.pms-project-card-status')
      const rect = status?.getBoundingClientRect()
      return { text: (status?.textContent || '').trim(), visible: Boolean(rect && rect.width > 0 && rect.height > 0) }
    })
    assert.deepEqual(representativeCardStatus, { text: '在研', visible: true }, `代表项目状态必须保持可见：${JSON.stringify(representativeCardStatus)}`)
    await assertLightSurface(page, '.pms-project-card-surface', '项目卡片')
    await assertNoClippingOrOverlap(page, ['.pms-project-card-header', '.pms-project-card-footer'], '项目卡片')
    await page.screenshot({ path: join(ARTIFACT_DIR, '01-card-view.png'), fullPage: false })

    await clickAria(page, '列表视图')
    await page.waitForSelector('.pms-project-summary-table thead', { visible: true, timeout: TIMEOUT })
    await page.waitForSelector('[aria-label="筛选"]', { visible: true, timeout: TIMEOUT })
    await page.waitForSelector('.pms-project-list-pagination', { visible: true, timeout: TIMEOUT })
    const tableVisualState = await page.evaluate(() => {
      const visible = element => {
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
      }
      const fixedCells = Array.from(document.querySelectorAll('.pms-project-summary-table .ant-table-cell-fix-left, .pms-project-summary-table .ant-table-cell-fix-start')).filter(visible)
      const opaque = fixedCells.every(cell => {
        const color = getComputedStyle(cell).backgroundColor
        return color !== 'transparent' && !/rgba\([^)]*,\s*0(?:\.0+)?\)/.test(color)
      })
      return {
        scope: Boolean(document.querySelector('.pms-project-summary-surface')),
        fixedCount: fixedCells.length, opaque,
      }
    })
    const tableState = { ...await collectProjectHeaderMetadata(page), ...tableVisualState }
    assert.equal(tableState.scope, true, '列表必须暴露 pms-project-summary-surface 语义范围')
    assert.ok(tableState.rawVisibleUnitKeys.length > 0 && tableState.rawVisibleUnitKeys.every(Boolean), `列表表头必须暴露列单元元数据：${JSON.stringify(tableState)}`)
    assert.deepEqual([...new Set(tableState.repeatedDomUnits)], ['milestone'], `只有分组/叶子表头允许在 DOM 中共享 milestone 单元：${JSON.stringify(tableState)}`)
    assert.ok(tableState.rawVisibleHeaderIds.every(Boolean), `每个可见表头必须有原始 header ID：${JSON.stringify(tableState)}`)
    assert.equal(new Set(tableState.rawVisibleHeaderIds).size, tableState.rawVisibleHeaderIds.length, `所有可见表头的原始 header ID 必须全局唯一：${JSON.stringify(tableState)}`)
    assert.equal(new Set(tableState.canonicalUnitKeys).size, tableState.canonicalUnitKeys.length, `规范拖动单元 key 必须唯一：${JSON.stringify(tableState)}`)
    assert.ok(tableState.draggableUnits.length > 0, `列表必须有可移动表头元数据：${JSON.stringify(tableState)}`)
    assert.deepEqual(tableState.lockedUnits, [], `整机矩阵已明确取消固定列：${JSON.stringify(tableState)}`)
    assert.deepEqual(tableState.inconsistentUnits, [], `同一逻辑单元不得同时锁定和可拖动：${JSON.stringify(tableState)}`)
    assert.equal(tableState.fixedCount, 0, `整机矩阵不得残留固定单元格：${JSON.stringify(tableState)}`)
    await assertLightSurface(page, '.pms-project-summary-surface', '项目列表表格')
    await assertNoClippingOrOverlap(page, ['.pms-project-list-filter-grid', '.pms-project-summary-table thead'], '项目列表')

    await page.setViewport({ width: 1100, height: 900, deviceScaleFactor: 1 })
    await clickCategory(page, 'tOS版本项目')
    await page.waitForSelector('.pms-project-summary-table thead th[data-project-list-column-unit="tosVersion"]', { visible: true, timeout: TIMEOUT })
    console.log('  STEP tOS table rendered; scroll fixed columns')
    await page.waitForFunction(() => {
      const body = document.querySelector('.pms-project-summary-table .ant-table-body')
      if (!body || body.scrollWidth <= body.clientWidth) return false
      body.scrollLeft = body.scrollWidth - body.clientWidth
      return body.scrollLeft > 0
    }, { timeout: TIMEOUT, polling: 'raf' })
    const scrollState = await page.$eval('.pms-project-summary-table .ant-table-body', body => ({ scrollLeft: body.scrollLeft, scrollWidth: body.scrollWidth, clientWidth: body.clientWidth }))
    assert.ok(scrollState.scrollWidth > scrollState.clientWidth, `tOS 表格必须存在真实水平滚动范围：${JSON.stringify(scrollState)}`)
    const fixedVisualState = await page.evaluate(() => {
      const visible = element => {
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
      }
      const fixedCells = Array.from(document.querySelectorAll('.pms-project-summary-table .ant-table-cell-fix-left, .pms-project-summary-table .ant-table-cell-fix-start')).filter(visible)
      return {
        scrollLeft: document.querySelector('.pms-project-summary-table .ant-table-body')?.scrollLeft || 0,
        fixedCount: fixedCells.length,
        backgrounds: fixedCells.map(cell => getComputedStyle(cell).backgroundColor),
      }
    })
    const fixedState = { ...await collectProjectHeaderMetadata(page), ...fixedVisualState }
    assert.ok(fixedState.scrollLeft > 0, `必须在水平滚动后检查固定单元格：${JSON.stringify(fixedState)}`)
    assert.deepEqual([...new Set(fixedState.repeatedDomUnits)], ['milestone'], `tOS 只有分组/叶子表头允许共享 milestone 单元：${JSON.stringify(fixedState)}`)
    assert.ok(fixedState.rawVisibleHeaderIds.every(Boolean), `tOS 每个可见表头必须有原始 header ID：${JSON.stringify(fixedState)}`)
    assert.equal(new Set(fixedState.rawVisibleHeaderIds).size, fixedState.rawVisibleHeaderIds.length, `tOS 所有可见表头的原始 header ID 必须全局唯一：${JSON.stringify(fixedState)}`)
    assert.equal(new Set(fixedState.canonicalUnitKeys).size, fixedState.canonicalUnitKeys.length, `tOS 规范拖动单元 key 必须唯一：${JSON.stringify(fixedState)}`)
    assert.ok(fixedState.lockedUnits.length > 0, `tOS 列表必须有锁定表头元数据：${JSON.stringify(fixedState)}`)
    assert.ok(fixedState.draggableUnits.length > 0, `tOS 列表必须同时保留可移动表头：${JSON.stringify(fixedState)}`)
    assert.deepEqual(fixedState.lockedUnits.filter(unit => fixedState.draggableUnits.includes(unit)), [], `锁定与可拖动逻辑单元必须互斥：${JSON.stringify(fixedState)}`)
    assert.ok(fixedState.fixedCount > 0, `tOS 列表必须渲染固定单元格：${JSON.stringify(fixedState)}`)
    assert.ok(fixedState.backgrounds.every(color => color !== 'transparent' && !/rgba\([^)]*,\s*0(?:\.0+)?\)/.test(color)), `固定单元格必须为不透明表面：${JSON.stringify(fixedState)}`)
    console.log(`  STEP fixed columns sampled after scrollLeft=${fixedState.scrollLeft}`)

    await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 })
    await clickCategory(page, '整机产品项目')
    console.log('  STEP returned to machine category; open create modal')
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
    const createControlState = await page.evaluate(() => Object.fromEntries([
      'secondaryCategory', 'technicalTrack', 'projectName', 'status',
    ].map(key => {
      const wrapper = document.querySelector(`.ant-modal [data-project-create-field="${key}"]`)
      const control = wrapper?.querySelector('input, select, [role="combobox"]')
      const rect = control?.getBoundingClientRect()
      const style = control ? getComputedStyle(control) : null
      return [key, {
        wrapper: Boolean(wrapper),
        tag: control?.tagName || '',
        role: control?.getAttribute('role') || '',
        type: control instanceof HTMLInputElement ? control.type : '',
        value: control instanceof HTMLInputElement || control instanceof HTMLSelectElement ? control.value : (control?.textContent || '').trim(),
        disabled: control instanceof HTMLInputElement || control instanceof HTMLSelectElement ? control.disabled : control?.getAttribute('aria-disabled') === 'true',
        readOnly: control instanceof HTMLInputElement ? control.readOnly : false,
        visible: Boolean(rect && rect.width > 0 && rect.height > 0 && style?.display !== 'none' && style?.visibility !== 'hidden'),
      }]
    })))
    for (const key of ['secondaryCategory', 'technicalTrack', 'projectName', 'status']) {
      assert.equal(createControlState[key].wrapper, true, `${key} 必须位于对应 data-project-create-field 包装器：${JSON.stringify(createControlState)}`)
      assert.equal(createControlState[key].visible, true, `${key} 必须有可见真实控件：${JSON.stringify(createControlState)}`)
      assert.equal(createControlState[key].tag, 'INPUT', `${key} IPM 快照必须渲染为输入控件：${JSON.stringify(createControlState)}`)
      assert.ok(createControlState[key].disabled || createControlState[key].readOnly, `${key} IPM 快照控件必须只读或禁用：${JSON.stringify(createControlState)}`)
    }
    assert.equal(createControlState.secondaryCategory.value, '研发级-基础研究-重点项目', `项目分类必须预填 IPM 来源值：${JSON.stringify(createControlState)}`)
    assert.equal(createControlState.technicalTrack.value, 'AIOS', `技术赛道必须预填非空 IPM 来源值：${JSON.stringify(createControlState)}`)
    assert.equal(createControlState.projectName.value, 'AI-Engine-V3', `子项目名称必须预填 IPM 来源值：${JSON.stringify(createControlState)}`)
    assert.equal(createControlState.status.value, '待立项', `项目状态必须保留配置初始化状态：${JSON.stringify(createControlState)}`)
    await page.screenshot({ path: join(ARTIFACT_DIR, '01-add-modal.png'), fullPage: false })
    await clickExact(page, '.ant-modal button', '取消')
    await page.waitForFunction(() => !Array.from(document.querySelectorAll('.pms-project-info-modal-surface')).some(element => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    }), { timeout: TIMEOUT })
  })

  await runScenario('02-technical', { storage: { 'pms-technical-plans': TECHNICAL_PLAN_STORAGE_SEED } }, async page => {
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
    assert.ok(actualRow.slice(2).filter(value => DATE_PATTERN.test(value)).length >= 2, `技术子项目实际行必须显示已播种的实际日期：${JSON.stringify(actualRow)}`)
    await assertNoClippingOrOverlap(page, ['[aria-label="技术信息分类"]', 'table[aria-label="分布式服务框架版本活动"] thead'], '技术项目信息')
    const planElement = await page.$('table[aria-label="分布式服务框架版本活动"]')
    await planElement.screenshot({ path: join(ARTIFACT_DIR, '02-technical-child-plan.png') })
    await clickExact(page, '[role="menuitem"]', '计划', '[aria-label="项目空间导航"]')
    await page.waitForSelector('[aria-label="技术项目计划"]', { visible: true, timeout: TIMEOUT })
    await clickExact(page, '[role="tab"]', '分布式服务框架计划', '[aria-label="计划作用域"]')
    await page.waitForFunction(() => {
      const selected = (document.querySelector('[aria-label="计划作用域"] [role="tab"][aria-selected="true"]')?.textContent || '').includes('分布式服务框架')
      const confirm = Array.from(document.querySelectorAll('.ant-modal button')).some(element => (
        element.getBoundingClientRect().height > 0 && (element.textContent || '').trim() === '确认离开'
      ))
      return selected || confirm
    }, { timeout: TIMEOUT })
    const leaveConfirmVisible = await page.evaluate(() => Array.from(document.querySelectorAll('.ant-modal button')).some(element => (
      element.getBoundingClientRect().height > 0 && (element.textContent || '').trim() === '确认离开'
    )))
    if (leaveConfirmVisible) {
      await clickExact(page, '.ant-modal button', '确认离开')
      await page.waitForFunction(() => !Array.from(document.querySelectorAll('.ant-modal button')).some(element => (
        element.getBoundingClientRect().height > 0 && (element.textContent || '').trim() === '确认离开'
      )), { timeout: TIMEOUT })
    }
    await page.waitForFunction(() => (document.querySelector('[aria-label="计划作用域"] [role="tab"][aria-selected="true"]')?.textContent || '').includes('分布式服务框架'), { timeout: TIMEOUT })
    await page.waitForSelector('[aria-label="计划版本"]', { visible: true, timeout: TIMEOUT })
    const technicalWorkspaceState = await page.evaluate(() => ({
      version: (document.querySelector('[aria-label="计划版本"]')?.closest('.ant-select')?.textContent || '').trim(),
      createRevisionVisible: Boolean(Array.from(document.querySelectorAll('button[aria-label="创建修订"]')).find(element => element.getBoundingClientRect().height > 0)),
      viewValues: Array.from(document.querySelectorAll('[aria-label="计划视图"] input[type="radio"]')).map(element => element.getAttribute('value')),
      horizontalChecked: Boolean(document.querySelector('[aria-label="计划视图"] input[value="horizontal"]:checked')),
      planContent: Boolean(document.querySelector('[aria-label="计划内容"]')),
    }))
    assert.equal(technicalWorkspaceState.version, 'V1', `技术子项目计划必须保留已发布版本状态：${JSON.stringify(technicalWorkspaceState)}`)
    assert.equal(technicalWorkspaceState.createRevisionVisible, true, `技术子项目计划必须保留创建修订入口：${JSON.stringify(technicalWorkspaceState)}`)
    assert.deepEqual(technicalWorkspaceState.viewValues, ['vertical', 'horizontal', 'gantt'], `技术子项目计划必须保留竖版/横版/甘特图视图控制：${JSON.stringify(technicalWorkspaceState)}`)
    assert.equal(technicalWorkspaceState.horizontalChecked, true, `技术子项目计划默认横版视图必须可观察：${JSON.stringify(technicalWorkspaceState)}`)
    assert.equal(technicalWorkspaceState.planContent, true, `技术子项目计划内容区域必须存在：${JSON.stringify(technicalWorkspaceState)}`)
    const workspacePlan = await page.$('[aria-label="计划内容"] table:has(thead tr[data-technical-plan-header="single-row"])')
    assert.ok(workspacePlan, '技术子项目计划工作区必须显示单行横版表头')
    await workspacePlan.screenshot({ path: join(ARTIFACT_DIR, '02-technical-workspace-plan.png') })
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
      const summaryState = await page.$eval('#section-plan', section => {
        const visible = element => {
          const rect = element.getBoundingClientRect()
          const style = getComputedStyle(element)
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
        }
        const summaryRegions = Array.from(section.querySelectorAll('[aria-label="一级计划最新发布摘要"]')).filter(visible)
        const exactSummaryLabelsOutsidePlanTables = Array.from(section.querySelectorAll('*')).filter(element => {
          if (!visible(element) || element.closest('table[aria-label="一级计划横版"]')) return false
          const ownText = Array.from(element.childNodes).filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent || '').join('').trim()
          return ['计划开始', '计划完成', '实际开始', '实际完成'].includes(ownText)
        }).map(element => (element.textContent || '').trim())
        return {
          summaryRegionCount: summaryRegions.length,
          summaryRegionText: summaryRegions.map(element => (element.textContent || '').replace(/\s+/g, ' ').trim()),
          summaryFields: Array.from(section.querySelectorAll('[data-summary-field]')).filter(visible).map(element => element.getAttribute('data-summary-field')),
          exactSummaryLabelsOutsidePlanTables,
        }
      })
      assert.equal(summaryState.summaryRegionCount, 0, `${sample.name} 基础信息不得渲染一级计划最新发布摘要区域：${JSON.stringify(summaryState)}`)
      assert.deepEqual(summaryState.summaryFields, [], `${sample.name} 基础信息不得显示最新发布四项摘要：${JSON.stringify(summaryState)}`)
      assert.deepEqual(summaryState.summaryRegionText, [], `${sample.name} 最新发布摘要区域不得残留日期摘要文本：${JSON.stringify(summaryState)}`)
      assert.deepEqual(summaryState.exactSummaryLabelsOutsidePlanTables, [], `${sample.name} 基础信息计划区不得残留四项摘要标签：${JSON.stringify(summaryState)}`)
      await page.waitForSelector('#section-plan table[aria-label="一级计划横版"]', { visible: true, timeout: TIMEOUT })
      await assertDateCells(page, '#section-plan table[aria-label="一级计划横版"]', `${sample.name} 基础信息横版计划`, 4)
      await assertHorizontalPlanDateBindings(page, '#section-plan table[aria-label="一级计划横版"]', `${sample.name} 基础信息横版计划`)
      await assertNoClippingOrOverlap(page, ['#section-plan .ant-card-head', '#section-plan table[aria-label="一级计划横版"] thead'], `${sample.name} 基础信息计划`)
      const planSection = await page.$('#section-plan')
      await planSection.screenshot({ path: join(ARTIFACT_DIR, `03-${sample.category === '整机产品项目' ? 'machine' : 'tos'}-basic-plan.png`) })

      await clickExact(page, '[role="menuitem"]', '计划', '[aria-label="项目空间导航"]')
      await page.waitForSelector('[aria-label="计划版本"]', { visible: true, timeout: TIMEOUT })
      await page.waitForSelector('table[aria-label="一级计划横版"]', { visible: true, timeout: TIMEOUT })
      await assertDateCells(page, 'table[aria-label="一级计划横版"]', `${sample.name} 项目空间计划内容`, 4)
      await assertHorizontalPlanDateBindings(page, 'table[aria-label="一级计划横版"]', `${sample.name} 项目空间计划内容`)
      const planTable = await page.$('table[aria-label="一级计划横版"]')
      await planTable.screenshot({ path: join(ARTIFACT_DIR, `03-${sample.category === '整机产品项目' ? 'machine' : 'tos'}-workspace-plan.png`) })
    }
  })

  await runScenario('04-capability-information', async page => {
    await openMain(page, '项目列表')
    await clickCategory(page, '整机产品项目')
    await clickAria(page, '卡片视图')
    await clickProjectCard(page, 'X6877-D8400_H991')
    await clickExact(page, 'span', 'X6877-D8400_H991')
    await page.waitForSelector('input[placeholder="搜索项目名称..."]', { visible: true, timeout: TIMEOUT })
    await page.type('input[placeholder="搜索项目名称..."]', 'X6873_H972')
    await clickExact(page, 'div', 'X6873_H972')
    await page.waitForSelector('.pms-project-information-surface--legacy', { visible: true, timeout: TIMEOUT })
    await assertLightSurface(page, '.pms-project-information-surface--legacy > .ant-card', '能力建设项目基础信息卡片')
    const capabilityState = await page.$eval('.pms-project-information-surface--legacy', element => ({
      text: (element.textContent || '').replace(/\s+/g, ' ').trim(),
      cards: element.querySelectorAll(':scope > .ant-card').length,
      descriptions: element.querySelectorAll('.ant-descriptions').length,
      titleColor: getComputedStyle(Array.from(element.querySelectorAll('#section-header .ant-card-head-title *')).find(candidate => (
        (candidate.textContent || '').trim() === 'X6873_H972'
      )) || element).color,
    }))
    assert.ok(capabilityState.cards >= 2, `能力建设项目必须保留原有基础信息卡片结构：${JSON.stringify(capabilityState)}`)
    assert.ok(capabilityState.descriptions >= 1, `能力建设项目必须保留字段明细：${JSON.stringify(capabilityState)}`)
    for (const label of ['项目名称', '项目分类', '项目状态', '健康状态', '团队成员', '项目描述']) {
      assert.ok(capabilityState.text.includes(label), `能力建设项目基础信息不得缺少“${label}”：${JSON.stringify(capabilityState)}`)
    }
    const titleRgb = capabilityState.titleColor.match(/[\d.]+/g)?.slice(0, 3).map(Number) || []
    assert.equal(titleRgb.length, 3, `能力建设项目名称必须有可计算文字颜色：${JSON.stringify(capabilityState)}`)
    assert.ok(titleRgb.every(channel => channel < 180), `能力建设项目名称必须在浅紫表头上保持深色可读：${JSON.stringify(capabilityState)}`)
    const capabilitySurface = await page.$('.pms-project-information-surface--legacy')
    await capabilitySurface.screenshot({ path: join(ARTIFACT_DIR, '04-capability-information.png') })
  })

  assert.equal(passed.length, 4, `预期 4 个场景，实际 ${passed.length}`)
  console.log(`PASS project surfaces visual refresh browser acceptance ${passed.length}/4 (${BASE_URL})`)
  console.log(`Artifacts: ${ARTIFACT_DIR}`)
} catch (error) {
  console.error(`FAIL project surfaces visual refresh browser acceptance\n${error.stack || error}`)
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
}
