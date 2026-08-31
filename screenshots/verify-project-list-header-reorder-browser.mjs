#!/usr/bin/env node

import assert from 'node:assert/strict'
import puppeteer from 'puppeteer'

const BASE_URL = process.env.PMS_BASE_URL || 'http://127.0.0.1:3004'
const TIMEOUT = 30_000
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const browserErrors = []
let browser
let page

const clickExact = async (selector, text, scope = 'body') => {
  const clicked = await page.evaluate((candidateSelector, expected, rootSelector) => {
    const root = document.querySelector(rootSelector)
    const candidate = Array.from(root?.querySelectorAll(candidateSelector) ?? [])
      .find(element => {
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && (element.textContent || '').trim() === expected
      })
    candidate?.click()
    return Boolean(candidate)
  }, selector, text, scope)
  if (!clicked) throw new Error(`找不到可见控件：${text}`)
  await wait(220)
}

const clickCategory = async label => {
  const clicked = await page.evaluate(expected => {
    const button = Array.from(document.querySelectorAll('[aria-label="项目分类筛选"] button'))
      .find(element => {
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && (element.textContent || '').trim().startsWith(expected)
      })
    button?.click()
    return Boolean(button)
  }, label)
  if (!clicked) throw new Error(`找不到项目分类：${label}`)
  await wait(300)
}

const ensureProjectList = async (category = '整机产品项目') => {
  const hasList = await page.$('[aria-label="项目列表视图"]')
  if (!hasList) await clickExact('[role="menuitem"]', '项目列表')
  await page.waitForSelector('[aria-label="项目列表视图"]', { visible: true, timeout: TIMEOUT })
  const listControl = await page.$('[aria-label="列表视图"]')
  if (listControl) await listControl.click()
  await clickCategory(category)
  await page.waitForSelector('.pms-project-summary-table thead', { visible: true, timeout: TIMEOUT })
}

const unitOrder = async () => page.$$eval(
  '.pms-project-summary-table thead th[data-project-list-column-unit]',
  elements => {
    const ordered = elements
      .filter(element => {
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })
      .map(element => ({
        unit: element.getAttribute('data-project-list-column-unit'),
        label: (element.textContent || '').replace(/\s+/g, ' ').trim(),
        left: element.getBoundingClientRect().left,
        top: element.getBoundingClientRect().top,
      }))
      .sort((left, right) => left.left - right.left || left.top - right.top)
    const seen = new Set()
    return ordered.flatMap(item => {
      if (!item.unit || seen.has(item.unit)) return []
      seen.add(item.unit)
      return [item.unit === 'milestone' ? 'milestone' : item.label]
    })
  },
)

const leafHeaderUnits = async () => page.$$eval(
  '.pms-project-summary-table thead th[data-project-list-header-id^="leaf::"]',
  elements => elements
    .filter(element => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })
    .map(element => ({
      unit: element.getAttribute('data-project-list-column-unit'),
      left: element.getBoundingClientRect().left,
    }))
    .sort((left, right) => left.left - right.left)
    .map(item => item.unit),
)

const assertMilestoneLeavesContiguous = async () => {
  const leaves = await leafHeaderUnits()
  const indices = leaves.flatMap((unit, index) => unit === 'milestone' ? [index] : [])
  assert.ok(indices.length > 1, `预期多个里程碑叶子，实际 ${JSON.stringify(leaves)}`)
  assert.equal(indices.at(-1) - indices[0] + 1, indices.length, '里程碑叶子必须连续呈现')
}

const headerForUnit = async unit => {
  const handles = await page.$$(`.pms-project-summary-table thead th[data-project-list-column-unit="${unit}"][data-project-list-draggable="true"]`)
  for (const handle of handles) {
    if (await handle.evaluate(element => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })) return handle
  }
  throw new Error(`找不到可拖动表头单元：${unit}`)
}

const headerForSelector = async selector => {
  const handles = await page.$$(selector)
  for (const handle of handles) {
    if (await handle.evaluate(element => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })) return handle
  }
  throw new Error(`找不到可见表头：${selector}`)
}

const dragElement = async (source, target) => {
  await source.evaluate(element => element.scrollIntoView({ block: 'nearest', inline: 'nearest' }))
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  if (!sourceBox || !targetBox) throw new Error('拖动目标不可见')
  const from = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 }
  const to = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 8, from.y, { steps: 3 })
  await page.mouse.move(to.x, to.y, { steps: 14 })
  await page.mouse.up()
  await wait(420)
}

const dragMilestoneHeaderWithFeedback = async (sourceSelector, targetUnit) => {
  const source = await headerForSelector(sourceSelector)
  await source.evaluate(element => element.scrollIntoView({ block: 'nearest', inline: 'center' }))
  await wait(120)
  const target = await headerForUnit(targetUnit)
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  if (!sourceBox || !targetBox) throw new Error('里程碑拖动目标不可见')
  const from = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 }
  const to = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + (to.x >= from.x ? 8 : -8), from.y, { steps: 3 })
  await page.mouse.move(to.x, to.y, { steps: 18 })
  await wait(180)
  const feedback = await page.evaluate(() => {
    const milestoneHeaders = Array.from(document.querySelectorAll(
      '.pms-project-summary-table thead th[data-project-list-column-unit="milestone"]',
    )).filter(element => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })
    return {
      overlay: document.querySelector('.pms-project-list-drag-overlay')?.textContent?.trim() ?? '',
      headerCount: milestoneHeaders.length,
      placeholderCount: milestoneHeaders.filter(element => (
        element.getAttribute('data-project-list-unit-placeholder') === 'true'
      )).length,
      transformedMilestones: milestoneHeaders.filter(element => (
        element.style.transform && element.style.transform !== 'none'
      )).map(element => element.getAttribute('data-project-list-header-id')),
      sourceBodyCellCount: document.querySelectorAll(
        '.pms-project-summary-table tbody td.pms-project-list-column-drag-source',
      ).length,
      targetHeaderEdgeCount: document.querySelectorAll(
        '.pms-project-summary-table thead th.is-drop-before, .pms-project-summary-table thead th.is-drop-after',
      ).length,
      targetBodyEdgeCount: document.querySelectorAll(
        '.pms-project-summary-table tbody td.pms-project-list-column-drop-before, .pms-project-summary-table tbody td.pms-project-list-column-drop-after',
      ).length,
      shellDropIndicator: document.querySelector(
        '.pms-project-summary-table-shell[data-column-drop-active="true"]',
      )?.style.getPropertyValue('--pms-project-list-drop-x') ?? '',
    }
  })
  await page.mouse.up()
  await wait(420)
  assert.equal(feedback.overlay, '里程碑', '拖动任一计划表头只显示一个里程碑区块浮层')
  assert.equal(feedback.placeholderCount, feedback.headerCount, '全部里程碑表头共享一个占位状态')
  assert.deepEqual(feedback.transformedMilestones, [], '里程碑内部表头不得分别位移')
  assert.ok(feedback.sourceBodyCellCount > 0, '拖动里程碑时必须高亮整块来源列的内容单元格')
  assert.equal(feedback.targetHeaderEdgeCount, 1, '飞书式目标位置只显示一条表头插入边')
  assert.ok(feedback.targetBodyEdgeCount > 0, '飞书式目标插入边必须贯穿表格内容区')
  assert.match(feedback.shellDropIndicator, /^\d+px$/, '目标位置必须生成贯穿表格外壳的连续插入线')
}

const dragHeader = async (sourceUnit, targetUnit) => {
  const source = await headerForUnit(sourceUnit)
  const target = await headerForUnit(targetUnit)
  await dragElement(source, target)
}

const dragHeaderToLockedUnit = async (sourceUnit, targetUnit) => {
  const source = await headerForUnit(sourceUnit)
  const target = await headerForSelector(
    `.pms-project-summary-table thead th[data-project-list-column-unit="${targetUnit}"]`,
  )
  await dragElement(source, target)
}

const assertKeyboardAnnouncement = async (selector, expectedLabel) => {
  const header = await headerForSelector(selector)
  await header.evaluate(element => element.scrollIntoView({ block: 'nearest', inline: 'center' }))
  await header.focus()
  await page.keyboard.press('Space')
  await wait(180)
  const announcement = await page.$$eval(
    '[id^="DndLiveRegion"]',
    regions => regions.map(region => region.textContent ?? '').join(' '),
  )
  assert.match(announcement, new RegExp(expectedLabel), '键盘拖动播报使用中文展示单元名称')
  assert.doesNotMatch(announcement, /(?:leaf|group)::/, '键盘播报不得泄露技术拖动 ID')
  await page.keyboard.press('Escape')
  await wait(120)
}

const keyboardDrop = async (selector, arrowKey) => {
  const header = await headerForSelector(selector)
  await header.evaluate(element => element.scrollIntoView({ block: 'nearest', inline: 'center' }))
  await header.focus()
  await page.keyboard.press('Space')
  await wait(120)
  await page.keyboard.press(arrowKey)
  await wait(120)
  await page.keyboard.press('Space')
  await wait(220)
  return page.$$eval(
    '[id^="DndLiveRegion"]',
    regions => regions.map(region => region.textContent ?? '').join(' '),
  )
}

const assertRepresentativeListInteractions = async () => {
  const toggle = await page.$('.pms-machine-series-toggle')
  assert.ok(toggle, '整机列表保留产品系列层级控制')
  const beforeExpanded = await toggle.evaluate(element => element.getAttribute('aria-expanded'))
  await toggle.click()
  await wait(220)
  assert.notEqual(
    await toggle.evaluate(element => element.getAttribute('aria-expanded')),
    beforeExpanded,
    '产品系列层级可收起',
  )
  await toggle.click()
  await wait(220)

  const next = await page.$('.pms-project-list-pagination .ant-pagination-next button:not([disabled])')
  assert.ok(next, '整机列表保留分页')
  await next.click()
  await wait(260)
  assert.equal(
    await page.$eval('.pms-project-list-pagination .ant-pagination-item-active', element => element.textContent?.trim()),
    '2',
    '分页可切换到第二页',
  )
  const previous = await page.$('.pms-project-list-pagination .ant-pagination-prev button')
  await previous.click()
  await wait(260)

  await clickExact('button', '整机-手机', '[aria-label="项目二级分类快捷筛选"]')
  assert.notEqual(
    await page.evaluate(() => Array.from(
      document.querySelectorAll('[aria-label="项目二级分类快捷筛选"] button'),
    ).find(element => element.textContent?.trim() === '整机-手机')?.style.background),
    'transparent',
    '快捷筛选仍可激活',
  )
  await clickExact('button', '全部', '[aria-label="项目二级分类快捷筛选"]')
}

const openFieldSettings = async () => {
  const button = await page.$('button[aria-label="字段配置"]')
  if (!button) throw new Error('找不到字段配置入口')
  await button.click()
  await page.waitForSelector(
    '.pms-floating-config-panel[aria-label="字段配置"] .pms-sortable-column-row',
    { visible: true, timeout: TIMEOUT },
  )
}

const fieldSettingsVisibleOrder = async () => page.$$eval(
  '.pms-floating-config-panel[aria-label="字段配置"] .pms-sortable-column-row',
  rows => rows.flatMap(row => {
    const rect = row.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return []
    const visibility = row.querySelector('.pms-sortable-column-visibility')
    if (!visibility?.getAttribute('aria-label')?.endsWith('列已显示')) return []
    return [(row.querySelector('.pms-sortable-column-title')?.textContent || '').trim()]
  }),
)

const fieldSettingUnits = async () => page.$$eval(
  '.pms-floating-config-panel[aria-label="字段配置"] .pms-sortable-column-row',
  rows => rows.flatMap(row => {
    const rect = row.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return []
    const label = (row.querySelector('.pms-sortable-column-title')?.textContent || '').trim()
    const visibility = row.querySelector('.pms-sortable-column-visibility')
    if (!visibility?.getAttribute('aria-label')?.endsWith('列已显示')) return []
    return [label === '里程碑' ? 'milestone' : row.getAttribute('aria-label')]
  }),
)

const fieldRow = async label => {
  const rows = await page.$$('.pms-floating-config-panel[aria-label="字段配置"] .pms-sortable-column-row')
  for (const row of rows) {
    const matches = await row.evaluate((element, expected) => (
      element.getBoundingClientRect().width > 0
      && element.getBoundingClientRect().height > 0
      && (element.querySelector('.pms-sortable-column-title')?.textContent || '').trim() === expected
    ), label)
    if (matches) return row
  }
  throw new Error(`字段配置缺少：${label}`)
}

const dragFieldSetting = async (sourceLabel, targetLabel) => {
  const sourceRow = await fieldRow(sourceLabel)
  await sourceRow.evaluate(element => element.scrollIntoView({ block: 'center' }))
  await wait(120)
  const targetRow = await fieldRow(targetLabel)
  const sourceHandle = await sourceRow.$('.pms-sortable-column-handle')
  if (!sourceHandle) throw new Error(`字段配置缺少拖动手柄：${sourceLabel}`)
  await dragElement(sourceHandle, targetRow)
}

const toggleMilestone = async expectedVisible => {
  const row = await fieldRow('里程碑')
  const button = await row.$('.pms-sortable-column-visibility')
  if (!button) throw new Error('里程碑缺少显隐按钮')
  const currentlyVisible = await button.evaluate(element => element.getAttribute('aria-label')?.endsWith('列已显示'))
  if (currentlyVisible !== expectedVisible) await button.click()
  await wait(350)
}

const closeFieldSettings = async () => {
  await page.keyboard.press('Escape')
  await wait(260)
}

const milestoneHeaderCount = async () => page.$$eval(
  '.pms-project-summary-table thead th[data-project-list-column-unit="milestone"]',
  elements => elements.filter(element => {
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }).length,
)

const assertFixedUnit = async unit => {
  const state = await page.$eval(
    `.pms-project-summary-table thead th[data-project-list-column-unit="${unit}"]`,
    element => ({
      locked: element.getAttribute('data-project-list-column-locked'),
      draggable: element.getAttribute('data-project-list-draggable'),
    }),
  )
  assert.deepEqual(state, { locked: 'true', draggable: null }, `${unit} 必须锁定且不可拖动`)
}

try {
  browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PMS_CHROME_EXECUTABLE || undefined,
    defaultViewport: { width: 1600, height: 1000 },
    args: ['--no-sandbox', '--window-size=1600,1000'],
  })
  page = await browser.newPage()
  page.on('pageerror', error => browserErrors.push(`[pageerror] ${error.message}`))
  page.on('console', message => {
    if (message.type() !== 'error') return
    browserErrors.push(`[console] ${message.text()}`)
  })
  page.on('requestfailed', request => {
    const reason = request.failure()?.errorText || 'unknown'
    if (reason === 'net::ERR_ABORTED' && request.url().includes('/_next/static/')) return
    browserErrors.push(`[requestfailed] ${reason} ${request.url()}`)
  })
  page.on('response', response => {
    if (response.status() < 400) return
    if (response.status() === 404 && /\/favicon\.ico(?:\?|$)/.test(response.url())) return
    browserErrors.push(`[response] ${response.status()} ${response.url()}`)
  })

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT })
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter(key => key.startsWith('pms:project-summary:'))
      .forEach(key => localStorage.removeItem(key))
  })
  await page.reload({ waitUntil: 'networkidle0', timeout: TIMEOUT })
  await ensureProjectList('整机产品项目')
  await assertRepresentativeListInteractions()

  const beforeOrdinaryDrag = await unitOrder()
  await dragHeader('brand', 'productLine')
  const afterOrdinaryDrag = await unitOrder()
  assert.notDeepEqual(afterOrdinaryDrag, beforeOrdinaryDrag, '普通表头拖动必须改变顺序')

  await openFieldSettings()
  assert.deepEqual(await fieldSettingUnits(), afterOrdinaryDrag, '表头拖动后字段配置必须立即同步')
  assert.equal((await fieldSettingsVisibleOrder()).filter(label => label === '里程碑').length, 1)
  assert.equal((await fieldSettingsVisibleOrder()).some(label => /STR|概念启动|转测/.test(label)), false)

  await dragFieldSetting('里程碑', 'SPM')
  await closeFieldSettings()
  const afterFieldDrag = await unitOrder()
  assert.notDeepEqual(afterFieldDrag, afterOrdinaryDrag, '字段配置拖动必须改变表头顺序')
  await assertMilestoneLeavesContiguous()

  const beforePhaseHeaderDrag = await unitOrder()
  await dragMilestoneHeaderWithFeedback(
    '.pms-project-summary-table thead th[data-project-list-header-id^="group::"]',
    'spmDepartment',
  )
  assert.notDeepEqual(await unitOrder(), beforePhaseHeaderDrag, '阶段表头拖动必须移动整个里程碑区块')
  await assertMilestoneLeavesContiguous()

  const beforeLeafHeaderDrag = await unitOrder()
  await dragMilestoneHeaderWithFeedback(
    '.pms-project-summary-table thead th[data-project-list-header-id^="leaf::"][data-project-list-column-unit="milestone"]',
    'spm',
  )
  assert.notDeepEqual(await unitOrder(), beforeLeafHeaderDrag, '子里程碑表头拖动必须移动整个里程碑区块')
  await assertMilestoneLeavesContiguous()
  await assertKeyboardAnnouncement(
    '.pms-project-summary-table thead th[data-project-list-header-id^="leaf::"][data-project-list-column-unit="milestone"]',
    '里程碑',
  )
  const beforeSuccessfulKeyboardDrop = await unitOrder()
  const successfulKeyboardAnnouncement = await keyboardDrop(
    '.pms-project-summary-table thead th[data-project-list-column-unit="spm"]',
    'ArrowRight',
  )
  assert.notDeepEqual(await unitOrder(), beforeSuccessfulKeyboardDrop, '有效键盘放置必须更新顺序')
  assert.match(successfulKeyboardAnnouncement, /已将SPM放到SPM部门（二级部门）附近/)

  const beforeSameUnitKeyboardDrop = await unitOrder()
  const sameUnitKeyboardAnnouncement = await keyboardDrop(
    '.pms-project-summary-table thead th[data-project-list-header-id^="leaf::"][data-project-list-column-unit="milestone"]',
    'ArrowRight',
  )
  assert.deepEqual(await unitOrder(), beforeSameUnitKeyboardDrop, '同一里程碑单元内键盘放置不得改变顺序')
  assert.match(sameUnitKeyboardAnnouncement, /未移动里程碑：.*不可作为放置位置/)

  await openFieldSettings()
  await toggleMilestone(false)
  assert.equal(await milestoneHeaderCount(), 0, '隐藏里程碑必须隐藏整块表头')
  await toggleMilestone(true)
  assert.ok(await milestoneHeaderCount() > 1, '恢复里程碑必须恢复整块表头')
  await closeFieldSettings()
  await assertMilestoneLeavesContiguous()
  const expectedPersistedOrder = await unitOrder()

  await page.reload({ waitUntil: 'networkidle0', timeout: TIMEOUT })
  await ensureProjectList('整机产品项目')
  assert.deepEqual(await unitOrder(), expectedPersistedOrder, '刷新后必须保持共享列顺序')

  await clickCategory('tOS版本项目')
  await page.waitForSelector('.pms-project-summary-table thead', { visible: true, timeout: TIMEOUT })
  await assertFixedUnit('tosVersion')
  assert.ok(await milestoneHeaderCount() > 0, 'tOS 列表必须保持里程碑表头')
  const beforeFixedTargetDrop = await unitOrder()
  await dragHeaderToLockedUnit('status', 'tosVersion')
  assert.deepEqual(await unitOrder(), beforeFixedTargetDrop, '固定列区域不得成为非固定列的插入位置')
  const beforeFixedKeyboardDrop = await unitOrder()
  const fixedKeyboardAnnouncement = await keyboardDrop(
    '.pms-project-summary-table thead th[data-project-list-column-unit="versionType"]',
    'ArrowLeft',
  )
  assert.deepEqual(await unitOrder(), beforeFixedKeyboardDrop, '键盘放到固定列不得改变顺序')
  assert.match(fixedKeyboardAnnouncement, /未移动版本类型：.*不可作为放置位置/)

  await clickCategory('技术项目')
  await page.waitForSelector('.pms-project-summary-table thead', { visible: true, timeout: TIMEOUT })
  await assertFixedUnit('projectName')
  assert.ok(await milestoneHeaderCount() > 0, '技术项目列表必须保持里程碑表头')

  assert.deepEqual(browserErrors, [], `浏览器异常：\n${browserErrors.join('\n')}`)
  console.log(`PASS project list header reorder browser acceptance (${BASE_URL})`)
} catch (error) {
  console.error(`FAIL project list header reorder browser acceptance\n${error.stack || error}`)
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
}
