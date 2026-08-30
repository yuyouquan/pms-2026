#!/usr/bin/env node

import puppeteer from 'puppeteer'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const BASE_URL = process.env.PMS_BASE_URL || 'http://127.0.0.1:3004'
const TIMEOUT = 30_000
const SCENARIO_FROM = Number.parseInt(process.env.PMS_SCENARIO_FROM || '1', 10)
const SCENARIO_ONLY = Number.parseInt(process.env.PMS_SCENARIO_ONLY || '0', 10)
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const MACHINE_CREATE_LABELS = [
  '首销tOS版本', '项目状态', '版本类型', '软件项目等级', '是否首发项目', '产品系列',
  '研发模式', '开发模式', '升级策略', '系统类型', 'Kernel版本', '是否大版本升级',
  '机型分类', '保密级别', '芯片编码', '芯片型号', '芯片平台', '内存大小', '起步RAM',
  '是否二段式', '是否外研Mini版本', '整机PD', 'PCBA表', '出货国家表', '关键器件选型表',
  'JIRA项目', 'SPM', 'SPP', 'CMO', '软件SE', '质量代表', '开发代表', '测试代表', '其他',
]
const MACHINE_CONDITIONAL_LABELS = new Set(['是否二段式', '是否外研Mini版本'])
const MACHINE_READ_ONLY_FIELD_KEYS = [
  'researchMode', 'androidMajorUpgrade', 'modelCategory', 'confidentialityLevel',
  'chipModel', 'chipPlatform', 'memorySize', 'startingRam',
]
const TECHNICAL_CREATE_LABELS = [
  '项目分类', '技术赛道', '子项目名称', '项目状态', 'TMG 及技术领域', '子领域',
  '项目价值', '项目年份', '前置项目', '技术项目负责人', '技术项目经理', '测试代表',
  '质量代表', '产品代表', '标准化代表', '其他', '项目KPI文件', '概设', 'Charter报告',
  'PDCP报告', 'TDCP报告', 'EDCP报告',
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
    return Array.from(document.querySelectorAll(`[aria-label="${CSS.escape(value)}"]`)).some(element => {
      const target = element.getBoundingClientRect().width > 0 ? element : element.closest('label')
      const rect = target?.getBoundingClientRect()
      const style = target ? getComputedStyle(target) : null
      return Boolean(rect && rect.width > 0 && rect.height > 0 && style?.display !== 'none' && style?.visibility !== 'hidden')
    })
  }, { timeout: TIMEOUT }, label)
  const clicked = await page.evaluate(value => {
    for (const element of document.querySelectorAll(`[aria-label="${CSS.escape(value)}"]`)) {
      const target = element.getBoundingClientRect().width > 0 ? element : element.closest('label')
      const rect = target?.getBoundingClientRect()
      const style = target ? getComputedStyle(target) : null
      if (!rect || rect.width <= 0 || rect.height <= 0 || style?.display === 'none' || style?.visibility === 'hidden') continue
      target.click()
      return true
    }
    return false
  }, label)
  if (!clicked) throw new Error(`找不到可见 ARIA 控件：${label}`)
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

const assertCreateFieldLabelOrder = async (page, expectedLabels) => {
  const actualLabels = await page.$$eval('.ant-modal [data-project-create-field]', elements => elements
    .filter(element => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    })
    .map(element => (element.querySelector('.ant-form-item-label')?.textContent || '').replace(/\s+/g, ' ').trim()))
  if (JSON.stringify(actualLabels) !== JSON.stringify(expectedLabels)) {
    throw new Error(`新建字段 DOM 顺序错误：${JSON.stringify(actualLabels)}`)
  }
  if (new Set(actualLabels).size !== actualLabels.length) throw new Error(`新建字段重复：${JSON.stringify(actualLabels)}`)
}

const assertIpmSourceBeforeCreateFields = async page => {
  const sourceIsFirst = await page.evaluate(() => {
    const source = document.querySelector('.ant-modal [aria-label="IPM项目来源"]')
    const firstField = document.querySelector('.ant-modal [data-project-create-field]')
    return Boolean(source && firstField && (source.compareDocumentPosition(firstField) & Node.DOCUMENT_POSITION_FOLLOWING))
  })
  if (!sourceIsFirst) throw new Error('IPM 项目来源选择器未位于业务字段前')
}

const assertNoCreateFieldErrors = async (page, fieldKeys) => {
  const invalid = await page.evaluate(keys => keys.filter(key => {
    const item = document.querySelector(`.ant-modal [data-project-create-field="${CSS.escape(key)}"]`)
    return Boolean(item?.querySelector('.ant-form-item-explain-error'))
  }), fieldKeys)
  if (invalid.length) throw new Error(`默认或只读字段不应误报必填：${invalid.join(',')}`)
}

const assertDisabledCreateFields = async (page, fieldKeys) => {
  const enabled = await page.evaluate(keys => keys.filter(key => {
    const item = document.querySelector(`.ant-modal [data-project-create-field="${CSS.escape(key)}"]`)
    const control = item?.querySelector('input,textarea,button,[role="combobox"]')
    return !control || !(control.disabled || control.getAttribute('aria-disabled') === 'true')
  }), fieldKeys)
  if (enabled.length) throw new Error(`来源快照未禁用：${enabled.join(',')}`)
}

const assertCollapsed = async (page, label, scope = 'body') => {
  await page.waitForFunction((expected, rootSelector) => {
    const root = document.querySelector(rootSelector)
    return Array.from(root?.querySelectorAll('button,[role="button"]') || []).some(control => {
      const rect = control.getBoundingClientRect()
      const style = getComputedStyle(control)
      return control.getAttribute('aria-expanded') === 'false'
        && (control.textContent || '').trim().startsWith(expected)
        && rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    })
  }, { timeout: TIMEOUT }, label, scope)
}

const assertNoCollapseSection = async (page, label, scope = 'body') => {
  const found = await page.$eval(scope, (root, expected) => Array.from(root.querySelectorAll('button,[role="button"]')).some(control => {
    const rect = control.getBoundingClientRect()
    const style = getComputedStyle(control)
    return (control.textContent || '').trim().startsWith(expected)
      && rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
  }), label)
  if (found) throw new Error(`不应显示折叠模块：${label}`)
}

const assertCheckedAria = async (page, label) => {
  await page.waitForFunction(value => document.querySelector(`[aria-label="${CSS.escape(value)}"]`)?.checked === true, { timeout: TIMEOUT }, label)
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
    const item = Array.from(document.querySelectorAll('.ant-modal .ant-form-item')).find(candidate => (
      (candidate.querySelector('.ant-form-item-label')?.textContent || '').trim().startsWith(expected)
    ))
    return item?.querySelector('input[role="combobox"]') || null
  }, label)
  const input = handle.asElement()
  if (!input) throw new Error(`找不到表单下拉：${label}`)
  return input
}

const waitForControlledPopupCandidates = async (page, input, label) => {
  await page.waitForFunction(element => {
    const popupId = element?.getAttribute('aria-controls') || element?.getAttribute('aria-owns')
    const controlled = popupId ? document.getElementById(popupId) : null
    const popup = controlled?.closest('.ant-select-dropdown') || controlled
    return Boolean(popup && Array.from(popup.querySelectorAll('.ant-select-item-option')).some(option => {
      const rect = option.getBoundingClientRect()
      const style = getComputedStyle(option)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    }))
  }, { timeout: TIMEOUT }, input)
  const popupId = await input.evaluate(element => element.getAttribute('aria-controls') || element.getAttribute('aria-owns'))
  if (!popupId) throw new Error(`下拉控件未声明受控弹层：${label}`)
}

const openComboInput = async (page, input, label) => {
  await input.focus()
  await page.keyboard.press('ArrowDown')
  await waitForControlledPopupCandidates(page, input, label)
  return input
}

const openFormCombo = async (page, label) => {
  const input = await formCombo(page, label)
  return openComboInput(page, input, label)
}

const selectOption = async (page, input, text, { contains = false } = {}) => {
  await waitForControlledPopupCandidates(page, input, text)
  try {
    const selectedOption = await page.waitForFunction((targetInput, value, useContains) => {
      const controlledId = targetInput?.getAttribute('aria-controls') || targetInput?.getAttribute('aria-owns')
      const controlled = controlledId ? document.getElementById(controlledId) : null
      const popup = controlled?.closest('.ant-select-dropdown') || controlled
      const option = Array.from(popup?.querySelectorAll('.ant-select-item-option:not(.ant-select-item-option-disabled)') || [])
        .find(element => {
          const rect = element.getBoundingClientRect()
          const style = getComputedStyle(element)
          const content = (element.textContent || '').trim()
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
            && (useContains ? content.includes(value) : content === value)
        })
      if (!(option instanceof HTMLElement)) return false
      option.click()
      return true
    }, { timeout: TIMEOUT, polling: 'raf' }, input, text, contains)
    await selectedOption.dispose()
  } catch (error) {
    const candidateState = await input.evaluate(targetInput => {
      const popupId = targetInput?.getAttribute('aria-controls') || targetInput?.getAttribute('aria-owns')
      const controlled = popupId ? document.getElementById(popupId) : null
      const popup = controlled?.closest('.ant-select-dropdown') || controlled
      return {
        popupId,
        options: Array.from(popup?.querySelectorAll('.ant-select-item-option:not(.ant-select-item-option-disabled)') || [])
          .filter(element => {
            const rect = element.getBoundingClientRect()
            const style = getComputedStyle(element)
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
          })
          .map(element => (element.textContent || '').trim()),
      }
    }).catch(() => ({ popupId: null, options: [] }))
    throw new Error(`受控弹层找不到下拉选项 ${text}：${JSON.stringify(candidateState)}；${error instanceof Error ? error.message : String(error)}`)
  }
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
  const input = await openFormCombo(page, label)
  await selectOption(page, input, option, options)
}

const selectFormYear = async (page, label, year) => {
  const input = await page.evaluateHandle(expected => {
    const item = Array.from(document.querySelectorAll('.ant-modal .ant-form-item')).find(candidate => (
      (candidate.querySelector('.ant-form-item-label')?.textContent || '').trim().startsWith(expected)
    ))
    return item?.querySelector('.ant-picker input') || null
  }, label)
  const inputElement = input.asElement()
  if (!inputElement) throw new Error(`找不到年份字段：${label}`)
  await inputElement.evaluate(element => element.click())
  const selectedYear = await page.waitForFunction((fieldInput, expectedYear) => {
    if (!fieldInput?.isConnected) return false
    const visibleDropdowns = Array.from(document.querySelectorAll('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)'))
      .filter(element => {
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
      })
    if (visibleDropdowns.length !== 1) return false
    const exactCells = Array.from(visibleDropdowns[0].querySelectorAll('.ant-picker-cell-inner')).filter(element => {
      const cell = element.closest('.ant-picker-cell')
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
        && (element.textContent || '').trim() === expectedYear
        && cell?.getAttribute('aria-disabled') !== 'true'
    })
    if (exactCells.length !== 1 || !(exactCells[0] instanceof HTMLElement)) return false
    exactCells[0].click()
    return true
  }, { timeout: TIMEOUT, polling: 'raf' }, inputElement, year)
  await selectedYear.dispose()
  await page.waitForFunction((expected, value) => {
    const item = Array.from(document.querySelectorAll('.ant-modal .ant-form-item')).find(candidate => (
      (candidate.querySelector('.ant-form-item-label')?.textContent || '').trim().startsWith(expected)
    ))
    const current = item?.querySelector('.ant-picker input')?.value || ''
    return current === value
  }, { timeout: TIMEOUT }, label, year)
}

const waitForPersistedEnumRow = async (page, type, field, value, editLabel) => {
  await page.waitForFunction(({ enumType, fieldKey, expectedValue, expectedLabel }) => {
    let persisted = null
    try { persisted = JSON.parse(localStorage.getItem('pms-enum-values') || 'null') } catch { return false }
    const stored = persisted?.state?.rowsByType?.[enumType]?.some(row => row?.[fieldKey] === expectedValue)
    const editButton = Array.from(document.querySelectorAll('button')).find(element => (
      element.getAttribute('aria-label') === expectedLabel && element.getBoundingClientRect().height > 0
    ))
    return Boolean(stored && editButton)
  }, { timeout: TIMEOUT }, { enumType: type, fieldKey: field, expectedValue: value, expectedLabel: editLabel })
}

const configureMachineCreationEnums = async page => {
  await clickButtonPrefix(page, '.pms-enum-type-list', '产品系列')
  await page.$eval('[data-testid="enum-add-button"]', element => element.click())
  await fillInput(page, 'input[aria-label="产品系列"]', 'NOTE 60')
  await clickExact(page, '.ant-modal button', '新增')
  await waitForPersistedEnumRow(page, 'product-series', 'value', 'NOTE 60', '编辑配置值 NOTE 60')
  await clickButtonPrefix(page, '.pms-enum-type-list', '芯片编码/芯片型号/芯片平台')
  await page.$eval('[data-testid="enum-add-button"]', element => element.click())
  await fillInput(page, 'input[aria-label="芯片编码"]', 'D8600')
  await fillInput(page, 'input[aria-label="芯片型号"]', 'MT6899')
  await fillInput(page, 'input[aria-label="芯片平台"]', 'MTK')
  await clickExact(page, '.ant-modal button', '新增')
  await waitForPersistedEnumRow(page, 'chip-mapping', 'chipCode', 'D8600', '编辑配置值 D8600 / MT6899 / MTK')
}

const selectExternalProject = async (page, bid) => {
  const input = await openFormCombo(page, '项目名')
  await selectOption(page, input, bid, { contains: true })
}

const completeMachineProjectForm = async (page, { bid, version }) => {
  console.log(`    FORM source ${bid}`)
  await selectExternalProject(page, bid)
  console.log(`    FORM selected source ${bid}`)
  await assertIpmSourceBeforeCreateFields(page)
  console.log('    FORM source precedes fields')
  await assertCreateFieldLabelOrder(page, MACHINE_CREATE_LABELS.filter(label => !MACHINE_CONDITIONAL_LABELS.has(label)))
  await assertNoText(page, '当前tOS版本', '.ant-modal')
  await assertDisabledCreateFields(page, MACHINE_READ_ONLY_FIELD_KEYS)
  console.log('    FORM fixed machine fields verified')
  console.log('    FORM development')
  await selectFormOption(page, '开发模式', 'ODC')
  await assertCreateFieldLabelOrder(page, MACHINE_CREATE_LABELS)
  await selectFormOption(page, '是否二段式', '是')
  await selectFormOption(page, '是否外研Mini版本', '否')
  if (version) {
    console.log('    FORM 首销tOS版本')
    await selectFormOption(page, '首销tOS版本', `tOS${version}`)
  } else {
    await page.waitForFunction(() => {
      const item = document.querySelector('.ant-modal [data-project-create-field="firstSaleTosVersion"]')
      return (item?.textContent || '').includes('tOS14.0.0')
    })
  }
  console.log('    FORM first launch')
  await selectFormOption(page, '是否首发项目', '否')
  console.log('    FORM level')
  await selectFormOption(page, '软件项目等级', 'A')
  console.log('    FORM upgrade strategy')
  await selectFormOption(page, '升级策略', '不维护')
  console.log('    FORM system')
  await selectFormOption(page, '系统类型', '64bit')
  console.log('    FORM kernel')
  await selectFormOption(page, 'Kernel版本', '6.1')
  console.log('    FORM chip')
  await selectFormOption(page, '芯片编码', 'D8600', { contains: true })
  console.log('    FORM complete')
}

const submitProjectCreate = async (page, sourceBid) => {
  await clickExact(page, '.ant-modal button', '创建')
  await wait(800)
  const state = await page.evaluate(() => ({
    success: (document.body?.innerText || '').includes('项目创建成功'),
    errors: Array.from(document.querySelectorAll('.ant-form-item-explain-error')).map(element => (element.textContent || '').trim()).filter(Boolean),
    feedback: Array.from(document.querySelectorAll('.ant-message-notice-content')).map(element => (element.textContent || '').trim()).filter(Boolean),
  }))
  if (sourceBid) {
    const persisted = await page.evaluate(bid => {
      const envelope = JSON.parse(localStorage.getItem('pms-projects') || '{}')
      return Boolean(envelope?.state?.projects?.some(project => project.sourceBid === bid))
    }, sourceBid)
    if (!persisted) throw new Error(`项目 ${sourceBid} 未持久化：${[...state.errors, ...state.feedback].join('；') || '无可见反馈'}`)
  }
  if (!state.success) throw new Error(`项目创建未成功：${state.errors.join('；') || '未显示校验错误'}`)
  await assertText(page, '项目空间')
}

const openAriaCombo = async (page, label) => {
  const handle = await page.evaluateHandle(expected => Array.from(document.querySelectorAll(`[aria-label="${CSS.escape(expected)}"]`)).find(element => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
  }) || null, label)
  const root = handle.asElement()
  if (!root) throw new Error(`找不到可访问下拉：${label}`)
  const input = await root.$('input[role="combobox"]') || (await root.evaluate(element => element.matches('input[role="combobox"]')) ? root : null)
  if (!input) throw new Error(`找不到可访问下拉：${label}`)
  return openComboInput(page, input, label)
}

const selectAriaOption = async (page, label, optionText) => {
  const input = await openAriaCombo(page, label)
  await selectOption(page, input, optionText)
}

const chooseMultiSelectValues = async (page, label, values) => {
  for (const value of values) {
    const input = await openFormCombo(page, label)
    await selectOption(page, input, value)
  }
}

const FORM_MULTI_SELECT_ATTEMPTS = 3

const waitForFormSelectionValues = async (page, element, expectedValues) => {
  await page.waitForFunction((root, expected) => {
    const actual = Array.from(root?.querySelectorAll('.ant-select-selection-item') || [])
      .map(item => (item.getAttribute('title') || item.textContent || '').trim())
      .filter(Boolean)
    return JSON.stringify(actual) === JSON.stringify(expected)
  }, { timeout: 4_000 }, element, expectedValues)
}

const clearFormSelectionValues = async (page, element) => {
  for (let index = 0; index < 20; index += 1) {
    const before = await element.$$eval('.ant-select-selection-item', items => items.length)
    if (before === 0) break
    const removed = await element.evaluate(root => {
      const button = root.querySelector('.ant-select-selection-item-remove')
      if (!button) return false
      button.click()
      return true
    })
    if (!removed) throw new Error('多人字段存在选中项但无法移除')
    await page.waitForFunction((root, maximum) => root.querySelectorAll('.ant-select-selection-item').length <= maximum, { timeout: 2_000 }, element, before - 1)
  }
  await waitForFormSelectionValues(page, element, [])
}

const replaceFormMultiValues = async (page, label, values) => {
  const item = await page.evaluateHandle(expected => Array.from(document.querySelectorAll('.ant-modal .ant-form-item')).find(candidate => (
    (candidate.querySelector('.ant-form-item-label')?.textContent || '').trim().startsWith(expected)
  )) || null, label)
  const element = item.asElement()
  if (!element) throw new Error(`找不到多人字段：${label}`)
  let latestError = null
  for (let attempt = 1; attempt <= FORM_MULTI_SELECT_ATTEMPTS; attempt += 1) {
    try {
      await clearFormSelectionValues(page, element)
      for (let index = 0; index < values.length; index += 1) {
        const value = values[index]
        const input = await element.$('input[role="combobox"]')
        if (!input) throw new Error(`多人字段没有下拉输入：${label}`)
        await openComboInput(page, input, label)
        await selectOption(page, input, value)
        const expectedValues = values.slice(0, index + 1)
        await waitForFormSelectionValues(page, element, expectedValues)
      }
      return
    } catch (error) {
      latestError = error
      if (attempt < FORM_MULTI_SELECT_ATTEMPTS) await wait(200)
    }
  }
  throw new Error(`多人字段 ${label} 在 ${FORM_MULTI_SELECT_ATTEMPTS} 次回读后仍未稳定：${latestError instanceof Error ? latestError.message : String(latestError)}`)
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
    if (!input) throw new Error(`权限角色没有成员下拉：${roleName}`)
    await openComboInput(page, input, roleName)
    await selectOption(page, input, member)
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

const isColdCompileTransient = message => /^(?:Invalid or unexpected token|ChunkLoadError\b|Loading chunk .+ failed|Failed to fetch dynamically imported module)/i.test(message.trim())

const prewarmBrowser = async browserInstance => {
  const context = await browserInstance.createBrowserContext()
  try {
    let latestError = null
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const page = await context.newPage()
      const pageErrors = []
      let mainResponseFailed = false
      page.setDefaultTimeout(TIMEOUT)
      page.setDefaultNavigationTimeout(TIMEOUT)
      page.on('pageerror', error => pageErrors.push(error.message))
      try {
        const response = await page.goto(BASE_URL, { waitUntil: 'networkidle0' })
        if (!response || response.status() >= 400) {
          mainResponseFailed = true
          throw new Error(`HTTP ${response?.status() || '无响应'}`)
        }
        await page.waitForSelector('[role="menuitem"]', { visible: true })
        await page.waitForFunction(() => document.readyState === 'complete' && (document.body?.innerText || '').includes('工作台'))
        await wait(250)
        if (pageErrors.length) throw new Error(`pageerror：${pageErrors.join('；')}`)
        console.log(`PASS prewarm health attempt=${attempt} (${BASE_URL})`)
        return
      } catch (error) {
        if (mainResponseFailed || !pageErrors.length || !pageErrors.every(isColdCompileTransient)) throw error
        latestError = error
        if (attempt < 2) console.log(`RETRY prewarm cold compile attempt=${attempt}: ${pageErrors.join('；')}`)
      } finally {
        await page.close()
      }
    }
    throw new Error(`预热健康检查连续失败：${latestError instanceof Error ? latestError.message : String(latestError)}`)
  } finally {
    await context.close()
  }
}

const runScenario = async (name, { storage = {}, viewport = { width: 1440, height: 960 } } = {}, exercise) => {
  const scenarioNumber = Number.parseInt(name, 10)
  if (scenarioNumber < SCENARIO_FROM || (SCENARIO_ONLY && scenarioNumber !== SCENARIO_ONLY)) return
  console.log(`RUN ${name}`)
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  const errors = []
  const errorCounts = { page: 0, console: 0, request: 0, http: 0, consoleRaw: 0, consoleIgnored: 0 }
  page.setDefaultTimeout(TIMEOUT)
  page.setDefaultNavigationTimeout(TIMEOUT)
  page.on('pageerror', error => {
    errorCounts.page += 1
    errors.push(`pageerror: ${error.message}`)
  })
  page.on('console', message => {
    if (message.type() !== 'error') return
    errorCounts.consoleRaw += 1
    errorCounts.console += 1
    const location = message.location()
    errors.push(`console.error: ${message.text()} @ ${location.url || 'unknown'}:${location.lineNumber ?? 0}:${location.columnNumber ?? 0}`)
  })
  page.on('requestfailed', request => {
    errorCounts.request += 1
    errors.push(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`)
  })
  page.on('response', response => {
    if (response.status() < 400) return
    errorCounts.http += 1
    errors.push(`http.${response.status()}: ${response.request().method()} ${response.url()}`)
  })
  try {
    await page.setViewport(viewport)
    await page.evaluateOnNewDocument(values => {
      Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value))
    }, storage)
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' })
    await exercise(page)
    if (errorCounts.consoleRaw !== 0 || errorCounts.consoleIgnored !== 0) {
      throw new Error(`console 门禁必须保持 raw=0 且 ignored=0：${JSON.stringify(errorCounts)}`)
    }
    if (errors.length) throw new Error(errors.join('\n'))
    results.push(name)
    console.log(`PASS ${name} errors=${JSON.stringify(errorCounts)}`)
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      url: location.href,
      text: (document.body?.innerText || '').slice(0, 2400),
    })).catch(() => ({ url: 'unavailable', text: 'unavailable' }))
    const capturedErrors = errors.length ? `\ncaptured-errors:\n${errors.join('\n')}` : ''
    throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}\nerrors=${JSON.stringify(errorCounts)}${capturedErrors}\nURL: ${diagnostics.url}\n${diagnostics.text}`)
  } finally {
    await context.close()
  }
}

try {
  browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PMS_CHROME_EXECUTABLE || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  await prewarmBrowser(browser)

  await runScenario('01 header order and workbench default todo', {}, async page => {
    const menuLabels = await page.$$eval('[role="menuitem"]', elements => elements
      .filter(element => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 })
      .map(element => (element.textContent || '').trim()).filter(Boolean))
    const expected = ['工作台', '项目列表', '联合项目空间', 'tOS路标', '人力资源管道', '配置中心']
    if (JSON.stringify(menuLabels.slice(0, expected.length)) !== JSON.stringify(expected)) {
      throw new Error(`Header 顺序错误：${JSON.stringify(menuLabels)}`)
    }
    await page.waitForSelector('[aria-label="任务目录"]', { visible: true })
    const directoryLabels = await page.$$eval('.pms-todo-directory__item', elements => elements.map(element => (
      Array.from(element.querySelectorAll('span')).map(item => (item.textContent || '').trim()).find(text => ['计划', '转维'].includes(text)) || ''
    ).trim()))
    if (JSON.stringify(directoryLabels) !== JSON.stringify(['计划', '转维'])) throw new Error(`任务目录错误：${JSON.stringify(directoryLabels)}`)
    const tabs = await page.$$eval('[aria-label="任务状态"] [role="tab"]', elements => elements.map(element => (
      element.querySelector('span')?.textContent || ''
    ).trim()))
    if (JSON.stringify(tabs) !== JSON.stringify(['全部', '待处理', '已完成'])) throw new Error(`任务状态 Tab 错误：${JSON.stringify(tabs)}`)
    const selected = await page.$eval('[aria-label="任务状态"] [role="tab"][aria-selected="true"] span', element => (element.textContent || '').trim())
    if (selected !== '待处理') throw new Error(`默认任务状态为 ${selected}`)
    const workbenchCounts = await page.evaluate(() => {
      const parseDirectoryCount = prefix => {
        const label = document.querySelector(`[aria-label^="${prefix}"]`)?.getAttribute('aria-label') || ''
        return Number.parseInt(label.match(/(\d+) 条待处理/)?.[1] || '-1', 10)
      }
      const tabs = Object.fromEntries(Array.from(document.querySelectorAll('[aria-label="任务状态"] [role="tab"]')).map(element => {
        const spans = Array.from(element.querySelectorAll('span')).map(span => (span.textContent || '').trim())
        return [spans[0], Number.parseInt(spans[1] || '-1', 10)]
      }))
      const visibleRows = Array.from(document.querySelectorAll('.pms-todo-center__table .ant-table-tbody tr[data-row-key]'))
        .filter(element => element.getBoundingClientRect().height > 0).length
      return { plan: parseDirectoryCount('计划，'), transfer: parseDirectoryCount('转维，'), tabs, visibleRows }
    })
    if (workbenchCounts.plan < 0 || workbenchCounts.transfer < 0) throw new Error(`工作台目录统计无效：${JSON.stringify(workbenchCounts)}`)
    if (workbenchCounts.tabs['待处理'] !== workbenchCounts.transfer || workbenchCounts.visibleRows !== workbenchCounts.transfer) {
      throw new Error(`工作台状态统计与真实行不一致：${JSON.stringify(workbenchCounts)}`)
    }
  })

  await runScenario('02 todo categories counts and plan transfer navigation', {
    storage: {
      'pms-plan-store': JSON.stringify({
        version: 10,
        state: {
          marketPlanData: {
            OP: {
              tasks: [{
                id: 'browser-plan-todo', order: 1, taskName: 'OP 浏览器计划待办', status: '进行中', progress: 50,
                responsible: '张三', planStartDate: '2026-08-01', planEndDate: '2026-09-15',
              }],
              level2Tasks: [],
              createdLevel2Plans: [],
            },
          },
        },
      }),
    },
  }, async page => {
    for (const prefix of ['计划，', '转维，']) {
      await page.waitForSelector(`[aria-label^="${prefix}"]`, { visible: true })
    }
    console.log('  STEP navigate through a persisted real plan task action')
    await page.waitForFunction(() => {
      const label = document.querySelector('[aria-label^="计划，"]')?.getAttribute('aria-label') || ''
      return Number.parseInt(label.match(/(\d+) 条待处理/)?.[1] || '0', 10) > 0
    })
    await page.$eval('[aria-label^="计划，"]', element => element.click())
    await page.waitForSelector('[aria-label^="前往处理 "]', { visible: true })
    const planTaskLabel = await page.$eval('[aria-label^="前往处理 "]', element => element.getAttribute('aria-label') || '')
    await clickAria(page, planTaskLabel)
    await page.waitForFunction(() => (document.querySelector('.ant-menu-item-selected')?.textContent || '').trim() === '计划')
    await page.waitForSelector('[aria-label="计划版本"]', { visible: true })

    console.log('  STEP return to workbench and navigate through the real transfer action')
    await clickExact(page, 'button', '返回工作台')
    await page.waitForSelector('[aria-label="任务目录"]', { visible: true })
    await page.$eval('[aria-label^="转维，"]', element => element.click())
    await clickAria(page, '前往处理 转维资料录入')
    await assertText(page, '转维')
  })

  await runScenario('03 project list defaults to machine without all category', {}, async page => {
    console.log('  STEP open machine project list and verify matrix columns')
    await openMain(page, '项目列表')
    const categoryLabels = await page.$$eval('[aria-label="项目分类筛选"] button', buttons => buttons.map(button => (button.textContent || '').trim().replace(/\s+\d+$/, '')))
    if (categoryLabels.includes('全部')) throw new Error('一级项目分类仍包含“全部”')
    if (categoryLabels[0] !== '整机产品项目') throw new Error(`默认分类顺序错误：${categoryLabels.join(',')}`)
    const active = await page.$eval('[aria-label="项目分类筛选"] button', button => getComputedStyle(button).color)
    if (!active) throw new Error('整机默认分类未激活')
    await clickAria(page, '列表视图')
    await assertText(page, '产品系列')
    await assertText(page, '首销tOS版本')
    const layout = await page.evaluate(() => {
      const category = document.querySelector('[aria-label="项目分类筛选"]')?.getBoundingClientRect()
      const actions = document.querySelector('.pms-project-list-category-actions')?.getBoundingClientRect()
      const tableHeaders = Array.from(document.querySelectorAll('.ant-table-thead th'))
        .map(element => (element.textContent || '').trim())
      const fixedHeaders = Array.from(document.querySelectorAll('.ant-table-thead th.ant-table-cell-fix-left, .ant-table-thead th.ant-table-cell-fix-start'))
        .map(element => (element.textContent || '').trim())
      return { categoryTop: category?.top, actionsTop: actions?.top, tableHeaders, fixedHeaders }
    })
    if (layout.categoryTop !== layout.actionsTop) throw new Error(`项目分类与操作区未同行：${JSON.stringify(layout)}`)
    const expectedLeadingColumns = ['品牌', '产品线', '产品系列', '项目数', '市场名', '项目名']
    if (JSON.stringify(layout.tableHeaders.slice(0, expectedLeadingColumns.length)) !== JSON.stringify(expectedLeadingColumns)) {
      throw new Error(`整机列表列错误：${JSON.stringify(layout.tableHeaders)}`)
    }
    if (layout.fixedHeaders.length !== 0) {
      throw new Error(`当前整机矩阵已明确取消固定列，不应出现固定表头：${JSON.stringify(layout.fixedHeaders)}`)
    }
    await page.waitForSelector('[aria-label="收起产品系列 SPARK 40"]', { visible: true })
    const beforeCollapse = await page.$$eval('.ant-table-tbody tr[data-row-key]', rows => rows.filter(row => row.getBoundingClientRect().height > 0).length)
    console.log('  STEP collapse and expand the first product series')
    await page.$eval('[aria-label="收起产品系列 SPARK 40"]', element => element.click())
    await page.waitForFunction(before => (
      Array.from(document.querySelectorAll('.ant-table-tbody tr[data-row-key]')).filter(row => row.getBoundingClientRect().height > 0).length < before
    ), {}, beforeCollapse)
    await page.$eval('[aria-label="展开产品系列 SPARK 40"]', element => element.click())
    await page.waitForFunction(before => (
      Array.from(document.querySelectorAll('.ant-table-tbody tr[data-row-key]')).filter(row => row.getBoundingClientRect().height > 0).length === before
    ), {}, beforeCollapse)
  })

  await runScenario('04 machine tos technical filters are category scoped', {}, async page => {
    await openMain(page, '项目列表')
    await clickAria(page, '卡片视图')
    console.log('  STEP apply the common machine brand filter in card view')
    await clickAria(page, '筛选')
    await selectAriaOption(page, '筛选字段', '品牌')
    await selectAriaOption(page, '品牌筛选值', 'Infinix')
    await clickAria(page, '关闭筛选')
    await page.waitForFunction(() => {
      const cards = Array.from(document.querySelectorAll('.pms-project-list-content .ant-card')).filter(element => element.getBoundingClientRect().height > 0)
      return cards.length > 0 && cards.every(card => (card.textContent || '').includes('Infinix'))
    })

    console.log('  STEP switch card to list while preserving result and advanced-filter mirror')
    await clickAria(page, '列表视图')
    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('.ant-table-tbody tr[data-row-key]')).filter(element => element.getBoundingClientRect().height > 0)
      const brands = Array.from(document.querySelectorAll('.ant-table-tbody .pms-machine-hierarchy-cell.is-brand'))
        .filter(cell => cell.getBoundingClientRect().height > 0)
        .map(cell => (cell.textContent || '').trim()).filter(Boolean)
      return rows.length > 0 && brands.length > 0 && brands.every(brand => brand === 'Infinix')
    })
    await clickAria(page, '筛选')
    await page.waitForFunction(() => ['品牌', 'Infinix'].every(expected => (
      Array.from(document.querySelectorAll('.ant-select')).some(select => (
        select.getBoundingClientRect().height > 0 && (
          (select.querySelector('.ant-select-content')?.getAttribute('title') || '').trim() === expected
          || Array.from(select.querySelectorAll('.ant-select-selection-item')).map(item => (
            item.getAttribute('title') || item.textContent || ''
          ).trim()).join(',') === expected
        )
      ))
    )))
    const mirror = await page.evaluate(() => {
      const visibleFilterSelect = expected => Array.from(document.querySelectorAll('.ant-select')).find(select => (
        select.getBoundingClientRect().height > 0 && (
          (select.querySelector('.ant-select-content')?.getAttribute('title') || '').trim() === expected
          || Array.from(select.querySelectorAll('.ant-select-selection-item')).map(item => (
            item.getAttribute('title') || item.textContent || ''
          ).trim()).join(',') === expected
        )
      ))
      const readControl = select => {
        const input = select?.querySelector('input')
        const content = select?.querySelector('.ant-select-content')
        const selected = Array.from(select?.querySelectorAll('.ant-select-selection-item') || [])
        return {
          found: Boolean(select),
          inputValue: input instanceof HTMLInputElement ? input.value : null,
          selectorValue: (content?.getAttribute('title') || '').trim(),
          selectedValue: selected.map(item => (item.getAttribute('title') || item.textContent || '').trim()).join(','),
        }
      }
      return { field: readControl(visibleFilterSelect('品牌')), value: readControl(visibleFilterSelect('Infinix')) }
    })
    const mirroredField = [mirror?.field?.inputValue, mirror?.field?.selectedValue, mirror?.field?.selectorValue].filter(Boolean).join('|')
    const mirroredValue = [mirror?.value?.inputValue, mirror?.value?.selectedValue, mirror?.value?.selectorValue].filter(Boolean).join('|')
    if (!mirroredField.includes('品牌') || !mirroredValue.includes('Infinix')) {
      throw new Error(`高级筛选镜像未读取真实输入/选择器值：${JSON.stringify(mirror)}`)
    }
    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('.ant-table-tbody tr[data-row-key]')).filter(element => element.getBoundingClientRect().height > 0)
      const brands = Array.from(document.querySelectorAll('.ant-table-tbody .pms-machine-hierarchy-cell.is-brand'))
        .filter(cell => cell.getBoundingClientRect().height > 0)
        .map(cell => (cell.textContent || '').trim()).filter(Boolean)
      return rows.length > 0 && brands.length > 0 && brands.every(brand => brand === 'Infinix')
    })
    await clickAria(page, '关闭筛选')

    await clickButtonPrefix(page, '[aria-label="项目分类筛选"]', 'tOS版本项目')
    console.log('  STEP apply tOS version-type filter and verify rows')
    await clickAria(page, '筛选')
    await selectAriaOption(page, '筛选字段', '版本类型')
    await selectAriaOption(page, '版本类型筛选值', 'Full')
    await clickAria(page, '关闭筛选')
    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('.ant-table-tbody tr[data-row-key]')).filter(element => element.getBoundingClientRect().height > 0)
      return rows.length > 0 && rows.every(row => (row.textContent || '').includes('Full'))
    })
    await clickButtonPrefix(page, '[aria-label="项目分类筛选"]', '技术项目')
    await page.waitForSelector('[aria-label="技术项目类型快捷筛选"]', { visible: true })
    await assertText(page, 'TDT项目名称')
    const hasChildHeader = await page.evaluate(() => Array.from(document.querySelectorAll('.ant-table-thead th')).some(element => (
      (element.textContent || '').includes('子任务名称')
    )))
    if (hasChildHeader) throw new Error('默认 TDT 类型仍同时显示子项目表')
    console.log('  STEP apply technical name filter and verify TDT result')
    await clickAria(page, '筛选')
    const technicalFilterCount = await page.$$eval('.pms-filter-condition-row', rows => rows.filter(row => row.getBoundingClientRect().height > 0).length)
    await clickExact(page, '.pms-filter-add-button', '增加')
    await page.waitForFunction(before => Array.from(document.querySelectorAll('.pms-filter-condition-row')).filter(row => row.getBoundingClientRect().height > 0).length === before + 1, { timeout: TIMEOUT }, technicalFilterCount)
    const technicalFieldHandle = await page.evaluateHandle(targetIndex => {
      const rows = Array.from(document.querySelectorAll('.pms-filter-condition-row')).filter(row => row.getBoundingClientRect().height > 0)
      const root = rows[targetIndex]?.querySelector('[aria-label="筛选字段"]')
      return root?.matches('input[role="combobox"]') ? root : root?.querySelector('input[role="combobox"]') || null
    }, technicalFilterCount)
    const technicalFieldInput = technicalFieldHandle.asElement()
    if (!technicalFieldInput) throw new Error('找不到新增技术项目筛选字段')
    await openComboInput(page, technicalFieldInput, '新增技术项目筛选字段')
    await selectOption(page, technicalFieldInput, 'TDT项目名称')
    await fillInput(page, '[aria-label="TDT项目名称筛选值"]', 'AI-Engine-V2')
    await clickAria(page, '关闭筛选')
    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('.ant-table-tbody tr[data-row-key]')).filter(element => element.getBoundingClientRect().height > 0)
      return rows.length === 1 && (rows[0].textContent || '').includes('AI-Engine-V2')
    })
  })

  await runScenario('05 enum CRUD validation duplicate and historical snapshot', {}, async page => {
    await openMain(page, '配置中心')
    await clickExact(page, '.ant-segmented-item', '枚举值配置')
    await configureMachineCreationEnums(page)
    await clickButtonPrefix(page, '.pms-enum-type-list', '首销tOS版本')
    await page.$eval('[data-testid="enum-add-button"]', element => element.click())
    await fillInput(page, 'input[aria-label="首销tOS版本"]', '19.4.2')
    await clickExact(page, '.ant-modal button', '新增')
    await waitForPersistedEnumRow(page, 'first-sale-tos', 'value', '19.4.2', '编辑配置值 tOS19.4.2')
    await page.$eval('[data-testid="enum-add-button"]', element => element.click())
    await fillInput(page, 'input[aria-label="首销tOS版本"]', '19.4.2')
    await clickExact(page, '.ant-modal button', '新增')
    await assertText(page, '配置值已存在')
    await clickExact(page, '.ant-modal button', '取消')
    await clickAria(page, '编辑配置值 tOS19.4.2')
    await fillInput(page, 'input[aria-label="首销tOS版本"]', '19.4.3')
    await clickExact(page, '.ant-modal button', '保存')
    await waitForPersistedEnumRow(page, 'first-sale-tos', 'value', '19.4.3', '编辑配置值 tOS19.4.3')

    console.log('  STEP save the newly configured enum through a real machine-project form')
    await openMain(page, '项目列表')
    await clickAria(page, '新增项目')
    await completeMachineProjectForm(page, { bid: 'EXT-001', version: '19.4.3' })
    await submitProjectCreate(page, 'EXT-001')

    console.log('  STEP delete enum through UI and reopen the saved business form')
    console.log('    HIST return list')
    await returnToProjectList(page)
    console.log('    HIST open config')
    await openMain(page, '配置中心')
    await clickExact(page, '.ant-segmented-item', '枚举值配置')
    await clickButtonPrefix(page, '.pms-enum-type-list', '首销tOS版本')
    console.log('    HIST delete enum')
    await clickAria(page, '删除配置值 tOS19.4.3')
    const deletionConfirmed = await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll('button')).find(element => (
        element.getBoundingClientRect().height > 0
        && (element.textContent || '').replace(/\s/g, '') === '删除'
      ))
      button?.click()
      return Boolean(button)
    })
    if (!deletionConfirmed) throw new Error('找不到枚举删除确认按钮')
    await page.waitForFunction(() => !document.querySelector('button[aria-label="编辑配置值 tOS19.4.3"]'))
    console.log('    HIST reopen project')
    await openMain(page, '项目列表')
    await clickAria(page, '卡片视图')
    await clickExact(page, '.ant-pagination-item', '2')
    await clickAria(page, '打开项目 EXT-001')
    console.log('    HIST open edit')
    await clickExact(page, 'button', '编辑')
    console.log('    HIST inspect disabled option')
    const historicalInput = await openFormCombo(page, '首销tOS版本')
    await page.waitForFunction(targetInput => {
      const popupId = targetInput?.getAttribute('aria-controls') || targetInput?.getAttribute('aria-owns')
      const controlled = popupId ? document.getElementById(popupId) : null
      const popup = controlled?.closest('.ant-select-dropdown') || controlled
      return Array.from(popup?.querySelectorAll('.ant-select-item-option') || []).some(element => (
        element.getBoundingClientRect().height > 0
        && (element.textContent || '').trim() === 'tOS19.4.3（已停用）'
        && element.classList.contains('ant-select-item-option-disabled')
      ))
    }, { timeout: TIMEOUT }, historicalInput)
    const availableForNewChoice = await page.evaluate(targetInput => {
      const popupId = targetInput?.getAttribute('aria-controls') || targetInput?.getAttribute('aria-owns')
      const controlled = popupId ? document.getElementById(popupId) : null
      const popup = controlled?.closest('.ant-select-dropdown') || controlled
      return Array.from(popup?.querySelectorAll('.ant-select-item-option:not(.ant-select-item-option-disabled)') || []).some(element => (
        element.getBoundingClientRect().height > 0 && (element.textContent || '').includes('19.4.3')
      ))
    }, historicalInput)
    if (availableForNewChoice) throw new Error('已删除枚举仍可作为新值选择')
  })

  await runScenario('06 machine new and two legacy versions resolve maximum', {
    storage: {
      'pms-enum-values': JSON.stringify({
        version: 2,
        state: {
          rowsByType: {
            'first-sale-tos': [
              { id: 'scenario-06-tos-14', value: '14.0.0' },
              { id: 'scenario-06-tos-15', value: '15.0.0' },
              { id: 'scenario-06-tos-17', value: '17.10.0' },
            ],
            'product-series': [{ id: 'scenario-06-series', value: 'NOTE 60' }],
            'chip-mapping': [{ id: 'scenario-06-chip', chipCode: 'D8600', chipModel: 'MT6899', chipPlatform: 'MTK' }],
          },
        },
      }),
    },
  }, async page => {
    console.log('  STEP verify the scenario-owned enum seed before project creation')
    await page.waitForFunction(() => {
      const envelope = JSON.parse(localStorage.getItem('pms-enum-values') || '{}')
      const rows = envelope?.state?.rowsByType || {}
      return ['14.0.0', '15.0.0', '17.10.0'].every(value => rows['first-sale-tos']?.some(row => row.value === value))
        && rows['product-series']?.some(row => row.value === 'NOTE 60')
        && rows['chip-mapping']?.some(row => row.chipCode === 'D8600' && row.chipModel === 'MT6899' && row.chipPlatform === 'MTK')
    })
    await openMain(page, '项目列表')
    for (const input of [
      { bid: 'EXT-010', version: '14.0.0' },
      { bid: 'EXT-011' },
      { bid: 'EXT-012' },
    ]) {
      console.log(`  STEP create ${input.bid} through project UI`)
      await clickAria(page, '新增项目')
      await completeMachineProjectForm(page, input)
      await submitProjectCreate(page, input.bid)
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
    for (const bid of ['EXT-010', 'EXT-011', 'EXT-012']) {
      if (byBid[bid]?.healthStatus !== 'normal') {
        throw new Error(`整机新建健康状态默认值错误 ${bid}：${JSON.stringify(byBid[bid])}`)
      }
    }

    console.log('  STEP reopen the new X6870 and verify the 34-field edit surface plus project-space current tOS')
    await clickAria(page, '卡片视图')
    await clickExact(page, '.ant-pagination-item', '2')
    await clickAria(page, '打开项目 EXT-010')
    await clickExact(page, 'button', '编辑')
    await page.waitForFunction(() => {
      const itemFor = label => {
        const item = Array.from(document.querySelectorAll('.ant-form-item')).find(candidate => (candidate.querySelector('.ant-form-item-label')?.textContent || '').trim() === label)
        return item || null
      }
      const first = itemFor('首销tOS版本')
      const current = itemFor('当前tOS版本')
      return (first?.textContent || '').includes('tOS14.0.0') && !current
    })
    await clickExact(page, '.ant-modal button', '取消')
    await page.$eval('.pms-project-info-collapse--basic .ant-collapse-header', element => element.click())
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.pms-project-info-collapse--basic .pms-project-info-display-item')).some(item => (
      (item.querySelector('.pms-project-info-display-label')?.textContent || '').trim() === '当前tOS版本'
      && (item.querySelector('.pms-project-info-display-value')?.textContent || '').trim() === 'tOS17.10.0'
    )))
  })

  await runScenario('07 TDT create validation mapping team and deliverables', {
    storage: {
      [`pms:project-creation-draft:${encodeURIComponent('张三')}`]: JSON.stringify({
        schemaVersion: 1,
        ownerId: '张三',
        values: {
          bid: 'EXT-013',
          type: '技术项目',
          secondaryCategory: '旧分类',
          projectName: '旧名称',
          technicalTrack: '旧赛道',
          status: '已取消',
          healthStatus: 'risk',
        },
        activeGroups: [],
        updatedAt: '2026-08-31T00:00:00.000Z',
      }),
    },
  }, async page => {
    console.log('  STEP restore predecessor-work source and replace stale read-only snapshots')
    await openMain(page, '项目列表')
    await clickAria(page, '新增项目')
    console.log('  STEP verify mapped fields and create validation')
    await assertIpmSourceBeforeCreateFields(page)
    await assertCreateFieldLabelOrder(page, TECHNICAL_CREATE_LABELS)
    await assertDisabledCreateFields(page, ['secondaryCategory', 'technicalTrack', 'projectName', 'status'])
    const sourceSnapshots = await page.evaluate(() => Object.fromEntries(
      ['secondaryCategory', 'technicalTrack', 'projectName', 'status'].map(key => {
        const item = document.querySelector(`.ant-modal [data-project-create-field="${key}"]`)
        const control = item?.querySelector('input,textarea')
        return [key, control?.value || '']
      }),
    ))
    const expectedSourceSnapshots = {
      secondaryCategory: '技术项目前置工作',
      technicalTrack: 'AIOS',
      projectName: 'AIOS-Architecture-Prestudy',
      status: '待立项',
    }
    if (JSON.stringify(sourceSnapshots) !== JSON.stringify(expectedSourceSnapshots)) {
      throw new Error(`技术来源快照回填错误：${JSON.stringify(sourceSnapshots)}`)
    }
    await selectFormOption(page, 'TMG 及技术领域', '基础架构TMG')
    const subdomain = await formCombo(page, '子领域')
    const subdomainValue = await subdomain.evaluate(input => ({
      disabled: input.disabled,
      formItemText: input.closest('.ant-form-item')?.textContent || '',
    }))
    if (!subdomainValue.formItemText.includes('无') || !subdomainValue.disabled) throw new Error(`无子领域联动错误：${JSON.stringify(subdomainValue)}`)
    await selectFormOption(page, '项目价值', '人无我有')
    await selectFormYear(page, '项目年份', '2026')
    await selectFormOption(page, '技术项目负责人', '张三')
    const managerBeforeValidation = await page.$eval('.ant-modal [data-project-create-field="technicalProjectManager"] input', input => input.value)
    if (managerBeforeValidation) throw new Error(`技术项目经理校验前不应有值：${managerBeforeValidation}`)
    await clickExact(page, '.ant-modal button', '创建')
    const managerValidationErrors = await page.$$eval('.ant-modal .ant-form-item-explain-error', elements => elements.map(element => (element.textContent || '').trim()))
    if (JSON.stringify(managerValidationErrors) !== JSON.stringify(['请选择技术项目经理'])) {
      throw new Error(`技术项目经理必填校验错误：${JSON.stringify(managerValidationErrors)}`)
    }
    await assertText(page, '请选择技术项目经理')
    await assertNoCreateFieldErrors(page, ['secondaryCategory', 'technicalTrack', 'projectName', 'status'])
    await assertText(page, '链接', '.ant-modal')
    await assertText(page, '文件', '.ant-modal')

    console.log('  STEP fill predecessor, team and URL deliverable, then submit real TDT project')
    await selectFormOption(page, '前置项目', 'X6877-D8400_H991', { contains: true })
    for (const [label, person] of [
      ['技术项目经理', '李白'],
      ['测试代表', '王五'],
      ['质量代表', '赵六'],
      ['产品代表', '孙七'],
      ['标准化代表', '周八'],
      ['其他', '杜甫'],
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
    if (created.secondaryCategory !== '技术项目前置工作') {
      throw new Error(`技术项目分类未持久化：${JSON.stringify(created)}`)
    }
    if (created.healthStatus !== 'normal') {
      throw new Error(`技术项目健康状态默认值错误：${JSON.stringify(created)}`)
    }
    const expectedTeam = {
      technicalLead: '张三', technicalProjectManager: '李白', testRepresentative: '王五', qualityRepresentative: '赵六', productRepresentative: '孙七', standardizationRepresentative: '周八', technicalOther: '杜甫',
    }
    for (const [key, value] of Object.entries(expectedTeam)) {
      if (created.fieldValues?.[key] !== value) throw new Error(`技术团队保存错误 ${key}：${JSON.stringify(created.fieldValues)}`)
    }
    if (created.fieldValues?.projectKpi?.url !== 'https://example.com/technical/kpi') throw new Error('技术项目 KPI 链接未保存')

    console.log('  STEP edit the same TDT project and switch KPI from URL to file upload')
    await clickExact(page, '[role="menuitem"]', '基础信息')
    console.log('    EDIT open modal')
    await clickExact(page, 'button', '编辑', '[aria-label="技术项目基础信息"]')
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
    if (edited.secondaryCategory !== '技术项目前置工作') {
      throw new Error(`技术项目编辑后分类被清空：${JSON.stringify(edited)}`)
    }
    if (edited.healthStatus !== 'normal') {
      throw new Error(`技术项目编辑后健康状态未保留：${JSON.stringify(edited)}`)
    }
  })

  await runScenario('08 IPM child config inactive and reactivation semantics', {
    storage: {
      'pms-technical-projects': JSON.stringify({
        version: 2,
        state: {
          subprojects: [{
            id: 'IPM-AI-002', parentProjectId: '9', name: '多模态子项目', active: true, ipmOrder: 2,
            configuration: { coreValue: '', developmentMode: '', firstTosVersion: '', firstMachineProjectId: '' },
          }],
        },
      }),
    },
  }, async page => {
    console.log('  STEP verify the legally seeded active IPM child starts pending configuration')
    await openMain(page, '项目列表')
    await clickButtonPrefix(page, '[aria-label="项目分类筛选"]', '技术项目')
    await clickProjectByName(page, 'AI-Engine-V2')
    await page.waitForSelector('[aria-label="技术项目基础信息"]', { visible: true })
    await page.waitForSelector('[aria-label="配置子任务 多模态子项目"]', { visible: true })
    await page.waitForFunction(() => Array.from(document.querySelectorAll('[role="tab"]')).some(element => (
      (element.textContent || '').includes('多模态子项目') && (element.textContent || '').includes('待配置')
    )))
    console.log('  STEP configure the pending child through the real modal')
    await clickAria(page, '配置子任务 多模态子项目')
    await assertText(page, '待配置', '.ant-modal')
    await assertText(page, '核心价值', '.ant-modal')
    await assertText(page, '开发模式', '.ant-modal')
    await selectFormOption(page, '核心价值', '人无我有')
    await selectFormOption(page, '开发模式', '谷歌合作')
    await selectFormOption(page, '首导tOS', 'tOS16.0')
    await selectFormOption(page, '首导整机产品', 'X6877-D8400_H991')
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
    await clickAria(page, '发布')
    await assertText(page, '计划已发布')
    await clickExact(page, '[role="tab"]', 'AI推理引擎子项目计划')
    await clickExact(page, 'button', '创建修订')
    await clickExact(page, '[role="menuitem"]', '创建正式版本')
    await assertText(page, '已创建正式修订版本')
    await clickAria(page, '发布')
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
    await clickExact(page, '[role="menuitem"]', '基础信息')
    await clickExact(page, 'button', '编辑', '[aria-label="技术项目基础信息"]')
    await page.waitForSelector('.ant-modal', { visible: true })
    console.log('    TECH fill required information')
    await selectFormOption(page, 'TMG 及技术领域', '系统应用')
    console.log('    TECH selected TMG')
    await selectFormOption(page, '子领域', 'AIOS')
    console.log('    TECH selected subdomain')
    await selectFormOption(page, '项目价值', '人无我有')
    console.log('    TECH selected value')
    await selectFormYear(page, '项目年份', '2026')
    console.log('    TECH selected year')
    for (const [label, person] of [
      ['技术项目负责人', '李四'],
      ['技术项目经理', '王五'],
      ['测试代表', '赵六'],
      ['质量代表', '孙七'],
      ['产品代表', '周八'],
      ['标准化代表', '杜甫'],
      ['其他', '张三'],
    ]) {
      await selectFormOption(page, label, person)
      console.log(`    TECH selected ${label}`)
    }
    console.log('    TECH save information')
    await clickExact(page, '.ant-modal button', '保存')
    await assertText(page, '项目信息已保存')
    console.log('    TECH verify permission synchronization')
    await clickExact(page, '[role="menuitem"]', '权限配置')
    const expectedTechnicalRoles = {
      技术项目负责人: ['李四'], 技术项目经理: ['王五'], 测试代表: ['赵六'], 质量代表: ['孙七'], 产品代表: ['周八'], 标准化代表: ['杜甫'], 其他: ['张三'],
    }
    for (const [role, members] of Object.entries(expectedTechnicalRoles)) {
      await page.waitForFunction((name, expected) => {
        const row = Array.from(document.querySelectorAll('.ant-table-tbody tr')).find(candidate => (candidate.querySelector('.ant-table-cell')?.textContent || '').trim().startsWith(name))
        const actual = row ? Array.from(row.querySelectorAll('.ant-select-selection-item')).map(item => (item.textContent || '').trim()) : []
        return JSON.stringify(actual) === JSON.stringify(expected)
      }, {}, role, members)
    }
    await page.waitForFunction(() => document.querySelectorAll('.ant-table-tbody .ant-select-disabled').length === 7)
    console.log('    TECH permission synchronization complete')
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

  await runScenario('13 technical basic information follows scope tabs', {}, async page => {
    await openMain(page, '项目列表')
    await clickButtonPrefix(page, '[aria-label="项目分类筛选"]', '技术项目')
    await clickProjectByName(page, 'AI-Engine-V2')
    await page.waitForSelector('[aria-label="技术项目基础信息"]', { visible: true })

    for (const label of ['项目名称', '项目分类', '技术赛道', 'TMG及技术领域', '子领域', '项目阶段', '项目年份', '项目价值']) {
      await assertText(page, label, '[aria-label="技术项目基础信息"]')
    }
    await assertNoText(page, '前置项目', '[aria-label="技术项目基础信息"]')
    await assertText(page, 'TDT', '[aria-label="技术信息分类"]')
    await page.waitForSelector('[aria-label="TDT计划信息内容"]', { visible: true })
    await assertNoText(page, '核心价值', '[aria-label="技术信息内容"]')
    await assertNoCollapseSection(page, '基础信息', '.technical-information-plan')
    await assertCollapsed(page, '团队信息', '[aria-label="技术信息内容"]')
    await assertCollapsed(page, '交付物信息', '[aria-label="技术信息内容"]')

    await clickExact(page, '[role="tab"]', 'AI推理引擎子项目', '[aria-label="技术信息分类"]')
    await page.waitForSelector('[aria-label="AI推理引擎子项目计划信息内容"]', { visible: true })
    await assertCollapsed(page, '基础信息', '.technical-information-plan')
    await assertCollapsed(page, '团队信息', '[aria-label="技术信息内容"]')
    await assertCollapsed(page, '交付物信息', '[aria-label="技术信息内容"]')
    await page.evaluate(() => {
      const root = document.querySelector('.technical-information-plan')
      const control = Array.from(root?.querySelectorAll('button,[role="button"]') || [])
        .find(element => (element.textContent || '').trim().startsWith('基础信息'))
      if (!(control instanceof HTMLElement)) throw new Error('找不到子项目基础信息折叠区')
      control.click()
    })
    await wait(160)
    for (const label of ['核心价值', '开发模式', '首导tOS', '首导整机产品']) await assertText(page, label, '[aria-label="AI推理引擎子项目基础信息"]')
    await clickExact(page, '[role="tab"]', 'TDT', '[aria-label="技术信息分类"]')
    await assertNoCollapseSection(page, '基础信息', '.technical-information-plan')
  })

  await runScenario('14 technical plan shares the whole-machine workspace', {}, async page => {
    await openMain(page, '项目列表')
    await clickButtonPrefix(page, '[aria-label="项目分类筛选"]', '技术项目')
    await clickProjectByName(page, 'AI-Engine-V2')
    await clickExact(page, '[role="menuitem"]', '计划')
    await page.waitForSelector('[aria-label="技术项目计划"]', { visible: true })

    for (const label of ['计划克隆', '发布', '取消修订', '筛选', '字段配置', '版本对比', '导出']) {
      await page.waitForSelector(`[aria-label="${label}"]`, { visible: true })
    }
    for (const removedEntry of ['导入', '分享计划']) {
      const visibleEntryCount = await page.$$eval(`[aria-label="${removedEntry}"]`, elements => elements.filter(element => (
        element.getBoundingClientRect().height > 0 && getComputedStyle(element).visibility !== 'hidden'
      )).length)
      if (visibleEntryCount !== 0) throw new Error(`技术计划当前规则不应显示${removedEntry}入口：${visibleEntryCount}`)
    }
    const tdtAddChildCount = await page.$$eval('[aria-label^="新增二级任务 "]', elements => elements.filter(element => (
      element.getBoundingClientRect().height > 0 && getComputedStyle(element).visibility !== 'hidden'
    )).length)
    if (tdtAddChildCount !== 0) throw new Error(`当前 TDT 扁平维护结构不应显示新增二级任务：${tdtAddChildCount}`)
    for (const label of ['竖版表格', '横版表格', '甘特图']) {
      await page.waitForSelector(`[aria-label="${label}"]`)
    }
    await clickAria(page, '横版表格')
    await assertCheckedAria(page, '横版表格')
    await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() === 'TDT项目计划')
    await page.waitForSelector('[aria-label="计划内容"] .technical-horizontal-plan-table', { visible: true })
    await clickAria(page, '甘特图')
    await assertCheckedAria(page, '甘特图')
    await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() === 'TDT项目计划')
    await page.waitForSelector('[aria-label="计划内容"] .gantt_container', { visible: true })
    for (const label of ['全部展开', '全部收起']) await page.waitForSelector(`[aria-label="${label}"]`, { visible: true })
    await clickAria(page, '竖版表格')
    await assertCheckedAria(page, '竖版表格')
    await page.waitForSelector('[aria-label="计划内容"] .pms-table', { visible: true })
    await page.waitForSelector('[aria-label="计划内容"] .technical-plan-flat-row', { visible: true })
    const legacyNestedRows = await page.$$eval('[aria-label="计划内容"] .technical-plan-child-row', elements => elements.filter(element => (
      element.getBoundingClientRect().height > 0
    )).length)
    if (legacyNestedRows !== 0) throw new Error(`当前 TDT 扁平表不应渲染旧子行：${legacyNestedRows}`)

    await clickExact(page, '[role="tab"]', 'AI推理引擎子项目计划', '[aria-label="计划作用域"]')
    await assertCheckedAria(page, '横版表格')
    await page.waitForSelector('[aria-label="创建修订"]', { visible: true })
    await clickAria(page, '创建修订')
    await clickExact(page, '[role="menuitem"]', '创建正式版本')
    await assertText(page, '已创建正式修订版本')
    console.log('    TECH plan child revision created')
    await page.waitForSelector('[aria-label="计划内容"] .technical-horizontal-plan-table', { visible: true })
    console.log('    TECH plan child horizontal rows visible')
    const childTaskButtonCount = await page.$$eval('[aria-label^="新增二级任务 "]', elements => elements.filter(element => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    }).length)
    if (childTaskButtonCount !== 0) throw new Error(`子项目计划不应允许二级任务：${childTaskButtonCount}`)
    const childScopeHasNestedTask = await page.evaluate(() => {
      const envelope = JSON.parse(localStorage.getItem('pms-technical-plans') || '{}')
      return (envelope?.state?.plansByKey?.['9:subproject:IPM-AI-001']?.versions || [])
        .some(version => (version.tasks || []).some(task => Boolean(task.parentId)))
    })
    if (childScopeHasNestedTask) throw new Error('子项目计划不应保存二级任务')
    console.log('    TECH plan child hierarchy verified')
    await assertCheckedAria(page, '横版表格')
    await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() === 'AI推理引擎子项目计划')
    await page.waitForSelector('[aria-label="计划内容"] .technical-horizontal-plan-table', { visible: true })
  })

  const expectedCount = SCENARIO_ONLY ? 1 : 15 - Math.max(1, SCENARIO_FROM)
  if (results.length !== expectedCount) throw new Error(`场景数量错误：${results.length}/${expectedCount}`)
  console.log(`PASS redesigned project workflows: ${results.length}/${expectedCount} scenarios (${BASE_URL})`)
} catch (error) {
  console.error(`FAIL redesigned project workflows\n${error.stack || error}`)
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
}
