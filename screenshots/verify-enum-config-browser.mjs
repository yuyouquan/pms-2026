#!/usr/bin/env node
import { mkdir } from 'node:fs/promises'
import puppeteer from 'puppeteer'

const TIMEOUT = 30_000
const STORAGE_KEY = 'pms-enum-values'
const OUTPUT = 'output/playwright'
const TYPES = [
  ['first-sale-tos', '首销tOS版本'], ['roadmap-tos', 'tOS版本-路标'],
  ['machine-project-status', '项目状态-整机产品项目'], ['technical-project-status', '项目状态-技术项目'],
  ['tos-capability-project-status', '项目状态-tOS版本项目/能力建设项目'], ['machine-health-status', '健康状态'],
  ['version-type', '版本类型'], ['software-project-level', '软件项目等级'], ['product-series', '产品系列'],
  ['research-mode', '研发模式'], ['machine-development-mode', '开发模式-整机产品项目'],
  ['technical-development-mode', '开发模式-技术项目'], ['upgrade-strategy', '升级策略'],
  ['system-type', '系统类型'], ['kernel-version', 'Kernel版本'],
  ['chip-mapping', '芯片编码/芯片型号/芯片平台'], ['memory-size', '内存大小'],
  ['project-category-mapping', '项目分类'], ['build-option', '编译选项'], ['build-market', '编译市场'],
  ['tmg-subdomain-mapping', 'TMG及技术领域&子领域'], ['core-value', '核心价值'],
  ['android-version', '安卓版本'], ['package-mode-mapping', '组包方式'],
]
const single = (type, values) => values.map((value, index) => ({ id: `fx-${type}-${index + 1}`, value }))
const ROWS = {
  'first-sale-tos': single('first-sale-tos', ['16.0', '16.0.1']),
  'roadmap-tos': single('roadmap-tos', ['16.0', '17.2']),
  'machine-project-status': single('machine-project-status', ['整机在研', '整机转维']),
  'technical-project-status': single('technical-project-status', ['技术在研', '技术已迁移']),
  'tos-capability-project-status': single('tos-capability-project-status', ['软件在研', '软件完成']),
  'machine-health-status': single('machine-health-status', ['正常', '风险']),
  'version-type': single('version-type', ['Full', 'Slim']),
  'software-project-level': single('software-project-level', ['S', 'A']),
  'product-series': single('product-series', ['Series-A', 'Series-B']),
  'research-mode': single('research-mode', ['自研']),
  'machine-development-mode': single('machine-development-mode', ['ODC']),
  'technical-development-mode': single('technical-development-mode', ['高校合作']),
  'upgrade-strategy': single('upgrade-strategy', ['维2']),
  'system-type': single('system-type', ['64bit']),
  'kernel-version': single('kernel-version', ['6.6']),
  'chip-mapping': [
    { id: 'fx-chip-1', chipCode: 'D100', chipModel: 'M100', chipPlatform: 'MTK' },
    { id: 'fx-chip-2', chipCode: 'D100', chipModel: 'M101', chipPlatform: 'QCOM' },
  ],
  'memory-size': single('memory-size', ['8GB']),
  'project-category-mapping': [
    { id: 'fx-cat-1', ipmProjectCategory: '整机产品-基线IPD', pmsProjectCategory: '整机产品项目', pmsSecondaryCategory: '整机-手机' },
    { id: 'fx-cat-2', ipmProjectCategory: '软件产品项目', pmsProjectCategory: 'tOS版本项目', pmsSecondaryCategory: '' },
    { id: 'fx-cat-3', ipmProjectCategory: '研发级-基础研究-重点项目', pmsProjectCategory: '技术项目', pmsSecondaryCategory: '' },
    { id: 'fx-cat-4', ipmProjectCategory: '公司级能力建设', pmsProjectCategory: '能力建设项目', pmsSecondaryCategory: '' },
  ],
  'build-option': single('build-option', ['build_fx']),
  'build-market': single('build-market', ['fx']),
  'tmg-subdomain-mapping': [
    { id: 'fx-tmg-1', domain: '系统应用', subdomain: 'AIOS' },
    { id: 'fx-tmg-2', domain: '系统应用', subdomain: '应用' },
    { id: 'fx-tmg-3', domain: '基础架构TMG', subdomain: '无' },
  ],
  'core-value': single('core-value', ['追赶']),
  'android-version': single('android-version', ['Android 16']),
  'package-mode-mapping': [
    { id: 'fx-package-1', androidVersion: 'Android 16', chipModel: 'M100', packageMode: '整包' },
    { id: 'fx-package-history', androidVersion: 'Android 14', chipModel: 'M099', packageMode: '历史组包' },
  ],
}
const envelope = () => JSON.stringify({ state: { rowsByType: ROWS }, version: 3 })
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

async function baseUrl() {
  for (const url of [...new Set([process.env.PMS_BASE_URL, 'http://127.0.0.1:3004', 'http://localhost:3004'].filter(Boolean))]) {
    try { if ((await fetch(url, { signal: AbortSignal.timeout(2500) })).ok) return url } catch {}
  }
  throw new Error('dev server unavailable')
}
const clickExact = async (page, selector, text) => {
  const clicked = await page.evaluate((s, value) => {
    const element = Array.from(document.querySelectorAll(s)).find(candidate => {
      const rect = candidate.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && (candidate.textContent || '').trim() === value
    })
    if (!element) return false
    element.click(); return true
  }, selector, text)
  if (!clicked) throw new Error(`missing ${selector}: ${text}`)
  await wait(120)
}
const waitText = (page, text) => page.waitForFunction(value => (document.body?.innerText || '').includes(value), {}, text)
const openConfig = async (page, waitForRows = true) => {
  await clickExact(page, '[role="menuitem"]', '配置中心')
  await page.waitForSelector('[aria-label="配置中心模块"]', { visible: true })
  await clickExact(page, '.ant-segmented-item', '枚举值配置')
  if (waitForRows) await page.waitForSelector('[data-testid="enum-type-first-sale-tos"]', { visible: true })
}
const selectType = async (page, type) => {
  await page.$eval(`[data-testid="enum-type-${type}"]`, element => element.click())
  await page.waitForFunction(value => document.querySelector(`[data-testid="enum-type-${value}"]`)?.getAttribute('aria-current') === 'page', {}, type)
}
const setInput = async (page, label, value) => {
  const selector = `input[aria-label="${label}"]`
  await page.waitForSelector(selector, { visible: true })
  await page.$eval(selector, (input, next) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, next)
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: next }))
  }, value)
}
const selectOption = async (page, label, value) => {
  const selector = `input[aria-label="${label}"]`
  await page.$eval(selector, input => {
    const target = input.closest('.ant-select-selector') || input
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    target.click()
  })
  await wait(300)
  const visible = await page.$$eval('.ant-select-item-option', options => options.filter(option => option.getBoundingClientRect().height > 0).map(option => (option.textContent || '').trim()))
  if (!visible.includes(value)) throw new Error(`select ${label} options ${JSON.stringify(visible)} missing ${value}`)
  await clickExact(page, '.ant-select-item-option', value)
}
const searchSelectOption = async (page, label, query, value) => {
  const selector = `input[aria-label="${label}"]`
  await page.$eval(selector, input => {
    const target = input.closest('.ant-select-selector') || input
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    target.click()
  })
  await wait(200)
  await page.type(selector, query)
  await wait(300)
  const visible = await page.$$eval('.ant-select-item-option', options => options
    .filter(option => option.getBoundingClientRect().height > 0)
    .map(option => (option.textContent || '').trim()))
  if (!visible.includes(value)) throw new Error(`searchable select ${label} options ${JSON.stringify(visible)} missing ${value}`)
  await clickExact(page, '.ant-select-item-option', value)
}
const assertDisabledHistoricalOption = async (page, label, value) => {
  const selector = `input[aria-label="${label}"]`
  await page.click(selector)
  await wait(200)
  const state = await page.$$eval('.ant-select-item-option', (options, expected) => {
    const option = options.find(candidate => (
      candidate.getBoundingClientRect().height > 0
      && (candidate.textContent || '').trim() === expected
    ))
    return option ? {
      disabled: option.classList.contains('ant-select-item-option-disabled') || option.getAttribute('aria-disabled') === 'true',
      text: (option.textContent || '').trim(),
    } : null
  }, `${value}（已停用）`)
  if (!state?.disabled) throw new Error(`historical ${label} option is not disabled: ${JSON.stringify(state)}`)
  await page.keyboard.press('Escape')
}
const add = async page => {
  await page.$eval('[data-testid="enum-add-button"]', element => element.click())
  await page.waitForSelector('.ant-modal', { visible: true })
}
const modalButton = (page, text) => clickExact(page, '.ant-modal-footer button', text)
const confirmDelete = async page => {
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.ant-modal-confirm-btns .ant-btn-primary')).some(button => button.getBoundingClientRect().height > 0))
  const clicked = await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('.ant-modal-confirm-btns .ant-btn-primary')).find(candidate => candidate.getBoundingClientRect().height > 0)
    if (!button) return false
    button.click(); return true
  })
  if (!clicked) throw new Error('visible delete confirmation missing')
}
const rowId = async (page, text) => {
  const id = await page.evaluate(value => Array.from(document.querySelectorAll('[data-testid^="enum-row-"]')).find(row => (
    row.getBoundingClientRect().height > 0 && (row.textContent || '').includes(value)
  ))?.getAttribute('data-testid') || '', text)
  if (!id) throw new Error(`missing enum row: ${text}`)
  return id.replace('enum-row-', '')
}
const headers = async (page, expected) => {
  const actual = await page.$$eval('.pms-enum-table thead th', cells => cells.filter(cell => cell.getBoundingClientRect().height > 0).map(cell => (cell.textContent || '').trim()))
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`headers: ${JSON.stringify(actual)}`)
}
const switchUser = async (page, user) => {
  await page.$eval('[aria-label="切换当前用户"]', element => element.click())
  await page.waitForSelector('.ant-dropdown:not(.ant-dropdown-hidden)', { visible: true })
  await page.waitForFunction(value => Array.from(document.querySelectorAll('.pms-user-menu__name')).some(element => (
    element.getBoundingClientRect().height > 0 && (element.textContent || '').trim() === value
  )), {}, user)
  const clicked = await page.evaluate(value => {
    const name = Array.from(document.querySelectorAll('.pms-user-menu__name')).find(element => (
      element.getBoundingClientRect().height > 0 && (element.textContent || '').trim() === value
    ))
    const item = name?.closest('[role="menuitem"],li')
    if (!item) return false
    item.click(); return true
  }, user)
  if (!clicked) throw new Error(`user switch target missing: ${user}`)
  await page.waitForFunction(value => document.querySelector('[aria-label="切换当前用户"]')?.getAttribute('data-current-user') === value, {}, user)
}
const seed = page => page.evaluateOnNewDocument((key, value) => localStorage.setItem(key, value), STORAGE_KEY, envelope())

const run = async (browser, url, name, exercise, { beforeLoad = seed, viewport = { width: 1440, height: 900 } } = {}) => {
  console.log(`\n[${name}] RUN`)
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.setDefaultTimeout(TIMEOUT); page.setDefaultNavigationTimeout(TIMEOUT)
  await page.setViewport(viewport); await beforeLoad(page)
  try {
    await page.goto(url, { waitUntil: 'networkidle0' })
    await exercise(page)
    console.log(`[${name}] PASS`)
  } finally {
    await page.evaluate(key => {
      try { localStorage.removeItem(key); localStorage.removeItem(`${key}-neighbor`) } catch {}
    }, STORAGE_KEY).catch(() => undefined)
    await context.close()
  }
}

const url = await baseUrl()
await mkdir(OUTPUT, { recursive: true })
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
try {
  await run(browser, url, 'registry-crud-mappings-permission-responsive', async page => {
    await openConfig(page)
    const actualTypes = await page.$$eval('[data-testid^="enum-type-"]', buttons => buttons.map(button => [
      button.getAttribute('data-testid')?.replace('enum-type-', ''), button.querySelector('.pms-enum-type-copy')?.textContent?.trim(),
    ]))
    if (JSON.stringify(actualTypes) !== JSON.stringify(TYPES)) throw new Error(`24 exact order mismatch: ${JSON.stringify(actualTypes)}`)
    console.log('  PASS registry/order')
    const registryText = await page.$eval('.pms-enum-workspace-shell', element => element.textContent || '')
    if (registryText.includes('通用') || registryText.includes('人力资源管道')) throw new Error('legacy categories remain')
    await headers(page, ['序号', '首销tOS版本', '操作'])
    await selectType(page, 'chip-mapping'); await headers(page, ['序号', '芯片编码', '芯片型号', '芯片平台', '操作'])
    await selectType(page, 'project-category-mapping'); await headers(page, ['序号', 'IPM项目分类', 'PMS项目分类', 'PMS二级项目分类', '操作'])
    await selectType(page, 'tmg-subdomain-mapping'); await headers(page, ['序号', 'TMG及技术领域', '子领域', '操作'])
    await selectType(page, 'android-version'); await headers(page, ['序号', '安卓版本', '操作'])
    await selectType(page, 'package-mode-mapping'); await headers(page, ['序号', '安卓版本', '芯片型号', '组包方式', '操作'])
    console.log('  PASS table shapes')

    await selectType(page, 'product-series'); await add(page); await modalButton(page, '新增'); await waitText(page, '不能为空'); console.log('    CRUD empty')
    await setInput(page, '产品系列', 'Series-A'); await modalButton(page, '新增'); await waitText(page, '枚举值不能重复'); console.log('    CRUD duplicate')
    await setInput(page, '产品系列', 'Series-C'); await modalButton(page, '新增'); await waitText(page, '配置值已新增'); console.log('    CRUD added')
    let sequence = await page.$$eval('[data-testid^="enum-row-"]', rows => rows.map(row => row.querySelector('td')?.textContent?.trim()))
    if (sequence.join(',') !== '1,2,3') throw new Error(`append sequence ${sequence}`)
    const editId = await rowId(page, 'Series-C')
    await page.$eval(`[data-testid="enum-edit-${editId}"]`, element => element.click())
    await setInput(page, '产品系列', 'Series-C2'); await modalButton(page, '保存'); await waitText(page, '配置值已更新'); console.log('    CRUD edited')
    const deleteId = await rowId(page, 'Series-A')
    await page.$eval(`[data-testid="enum-delete-${deleteId}"]`, element => element.click())
    await confirmDelete(page); await wait(500); await page.keyboard.press('Escape'); console.log('    CRUD delete clicked')
    if (await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid^="enum-row-"]')).some(row => (row.textContent || '').includes('Series-A')))) {
      const detail = await page.evaluate(key => ({
        rows: Array.from(document.querySelectorAll('[data-testid^="enum-row-"]')).map(row => row.textContent?.trim()),
        stored: JSON.parse(localStorage.getItem(key)).state.rowsByType['product-series'],
        messages: Array.from(document.querySelectorAll('.ant-message-notice-content')).map(node => node.textContent?.trim()),
        confirms: Array.from(document.querySelectorAll('.ant-modal-confirm')).map(node => ({ text: node.textContent?.trim(), height: node.getBoundingClientRect().height })),
      }), STORAGE_KEY)
      throw new Error(`confirmed delete retained Series-A: ${JSON.stringify(detail)}`)
    }
    sequence = await page.$$eval('[data-testid^="enum-row-"]', rows => rows.map(row => row.querySelector('td')?.textContent?.trim()))
    if (sequence.join(',') !== '1,2') throw new Error(`reindex ${sequence}`)
    console.log('  PASS single CRUD')

    await selectType(page, 'android-version'); await add(page); await setInput(page, '安卓版本', 'Android 17')
    await modalButton(page, '新增'); await waitText(page, '配置值已新增')
    const androidEditId = await rowId(page, 'Android 17')
    await page.$eval(`[data-testid="enum-edit-${androidEditId}"]`, element => element.click())
    await setInput(page, '安卓版本', 'Android 18'); await modalButton(page, '保存'); await waitText(page, '配置值已更新')
    const androidDeleteId = await rowId(page, 'Android 18')
    await page.$eval(`[data-testid="enum-delete-${androidDeleteId}"]`, element => element.click())
    await confirmDelete(page); await wait(500)
    if ((await page.$eval('.pms-enum-table', element => element.textContent || '')).includes('Android 18')) throw new Error('Android CRUD delete retained edited row')
    console.log('  PASS Android CRUD')

    await selectType(page, 'first-sale-tos'); await add(page); await setInput(page, '首销tOS版本', 'tOS18.preview'); await modalButton(page, '新增')
    await page.waitForFunction(() => (document.body?.innerText || '').includes('tOS18.preview'))
    const tosBody = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).state.rowsByType['first-sale-tos'].find(row => row.value === '18.preview')?.value, STORAGE_KEY)
    if (tosBody !== '18.preview' || (await page.$eval('.pms-enum-table', element => element.textContent || '')).includes('tOStOS')) throw new Error(`tOS body/prefix ${tosBody}`)
    console.log('  PASS tOS prefix/body')

    await selectType(page, 'chip-mapping'); await add(page)
    for (const [label, value] of [['芯片编码', 'D100'], ['芯片型号', 'M100'], ['芯片平台', 'MTK']]) await setInput(page, label, value)
    await modalButton(page, '新增'); await waitText(page, '该行已存在'); await setInput(page, '芯片型号', 'M102'); await modalButton(page, '新增'); await waitText(page, 'M102')
    console.log('  PASS chip tuples')

    await selectType(page, 'project-category-mapping'); await add(page)
    await setInput(page, 'IPM项目分类', '整机产品-基线IPD'); await selectOption(page, 'PMS项目分类', '整机产品项目'); await setInput(page, 'PMS二级项目分类', '整机-新品')
    await modalButton(page, '新增'); await waitText(page, 'IPM项目分类不能重复')
    await setInput(page, 'IPM项目分类', '新增技术映射'); await selectOption(page, 'PMS项目分类', '技术项目')
    const secondary = await page.$eval('input[aria-label="PMS二级项目分类"]', input => ({ disabled: input.disabled, value: input.value }))
    if (!secondary.disabled || secondary.value) throw new Error(`secondary clear/disable ${JSON.stringify(secondary)}`)
    await modalButton(page, '新增'); await waitText(page, '新增技术映射')
    await add(page); await setInput(page, 'IPM项目分类', '整机缺二级'); await selectOption(page, 'PMS项目分类', '整机产品项目'); await modalButton(page, '新增'); await waitText(page, '不能为空'); await modalButton(page, '取消')
    console.log('  PASS category mapping')

    await selectType(page, 'tmg-subdomain-mapping'); await add(page); await setInput(page, 'TMG及技术领域', '系统应用'); await setInput(page, '子领域', 'AIOS')
    await modalButton(page, '新增'); await waitText(page, '该行已存在'); await setInput(page, '子领域', '图形'); await modalButton(page, '新增'); await waitText(page, '图形')
    console.log('  PASS TMG tuples')

    await selectType(page, 'package-mode-mapping'); await add(page)
    await searchSelectOption(page, '安卓版本', 'Android 16', 'Android 16')
    await searchSelectOption(page, '芯片型号', 'M101', 'M101')
    await setInput(page, '组包方式', '分包'); await modalButton(page, '新增'); await waitText(page, '配置值已新增')
    const packageEditId = await rowId(page, '分包')
    await page.$eval(`[data-testid="enum-edit-${packageEditId}"]`, element => element.click())
    await setInput(page, '组包方式', '分包升级'); await modalButton(page, '保存'); await waitText(page, '配置值已更新')
    await add(page)
    await searchSelectOption(page, '安卓版本', 'Android 16', 'Android 16')
    await searchSelectOption(page, '芯片型号', 'M101', 'M101')
    await setInput(page, '组包方式', '不同方式'); await modalButton(page, '新增'); await waitText(page, '该组合已存在')
    await modalButton(page, '取消')
    const historyId = await rowId(page, '历史组包')
    await page.$eval(`[data-testid="enum-edit-${historyId}"]`, element => element.click())
    await assertDisabledHistoricalOption(page, '安卓版本', 'Android 14')
    await assertDisabledHistoricalOption(page, '芯片型号', 'M099')
    await modalButton(page, '取消')
    console.log('  PASS package mapping add/edit/duplicate/search/history')

    await selectType(page, 'product-series'); await page.$eval('[data-testid^="enum-edit-"]', element => element.click()); await switchUser(page, '孙七')
    await wait(500); await page.keyboard.press('Escape')
    if (await page.$('[data-testid="enum-add-button"]')) throw new Error('viewer retained write controls')
    console.log('  PASS viewer readonly')
    await switchUser(page, '张三')
    await page.waitForSelector('[data-testid="enum-add-button"]', { visible: true })
    console.log('  PASS management write')

    for (const width of [1440, 768]) {
      await page.setViewport({ width, height: 900 }); await wait(180)
      const metrics = await page.evaluate(() => ({ viewport: innerWidth, doc: document.documentElement.scrollWidth, shell: document.querySelector('.pms-enum-workspace-shell')?.getBoundingClientRect().width || 0, tableScroll: document.querySelector('.pms-enum-table .ant-table-content')?.scrollWidth || 0 }))
      if (!metrics.shell || !metrics.tableScroll || metrics.doc > metrics.viewport + 1) throw new Error(`overflow ${width}: ${JSON.stringify(metrics)}`)
      console.log(`  PASS responsive ${width}x900`)
    }
  })

  await run(browser, url, 'corrupt-reset', async page => {
    await openConfig(page, false); await waitText(page, '本地枚举配置无法读取'); await clickExact(page, 'button', '重试'); await waitText(page, '本地枚举配置无法读取'); await clickExact(page, 'button', '重置本地配置')
    await page.waitForSelector('[data-testid="enum-type-first-sale-tos"]', { visible: true })
    const state = await page.evaluate(key => ({ data: JSON.parse(localStorage.getItem(key)), neighbor: localStorage.getItem(`${key}-neighbor`) }), STORAGE_KEY)
    if (state.neighbor !== 'keep-me' || state.data.version !== 3 || Object.keys(state.data.state.rowsByType).length !== 24) throw new Error(`bad reset ${JSON.stringify(state)}`)
    if (!Array.isArray(state.data.state.rowsByType['android-version']) || !Array.isArray(state.data.state.rowsByType['package-mode-mapping'])) throw new Error(`reset omitted new enum arrays ${JSON.stringify(state.data.state.rowsByType)}`)
  }, { beforeLoad: page => page.evaluateOnNewDocument(key => { localStorage.setItem(key, '{broken'); localStorage.setItem(`${key}-neighbor`, 'keep-me') }, STORAGE_KEY) })

  await run(browser, url, 'unavailable-retry', async page => {
    await openConfig(page, false); await waitText(page, '本地枚举存储不可用'); await page.evaluate(() => { window.__blocked = false }); await clickExact(page, 'button', '重试'); await page.waitForSelector('[data-testid="enum-type-first-sale-tos"]', { visible: true })
  }, { beforeLoad: page => page.evaluateOnNewDocument(key => {
    const original = { get: Storage.prototype.getItem, set: Storage.prototype.setItem, remove: Storage.prototype.removeItem }; window.__blocked = true
    Storage.prototype.getItem = function(name) { if (name === key && window.__blocked) throw new DOMException('blocked', 'SecurityError'); return original.get.call(this, name) }
    Storage.prototype.setItem = function(name, value) { if (name === key && window.__blocked) throw new DOMException('blocked', 'SecurityError'); return original.set.call(this, name, value) }
    Storage.prototype.removeItem = function(name) { if (name === key && window.__blocked) throw new DOMException('blocked', 'SecurityError'); return original.remove.call(this, name) }
  }, STORAGE_KEY) })

  await run(browser, url, 'write-rollback', async page => {
    await openConfig(page); await selectType(page, 'product-series')
    const before = await page.$$eval('[data-testid^="enum-row-"]', rows => rows.length)
    await page.evaluate(key => { window.__setItem = Storage.prototype.setItem; Storage.prototype.setItem = function(name, value) { if (name === key) throw new DOMException('blocked', 'SecurityError'); return window.__setItem.call(this, name, value) } }, STORAGE_KEY)
    await add(page); await setInput(page, '产品系列', 'ROLLBACK'); await modalButton(page, '新增'); await waitText(page, '配置未保存')
    const after = await page.$$eval('[data-testid^="enum-row-"]', rows => rows.length)
    if (after !== before || (await page.$eval('.pms-enum-table', element => element.textContent || '')).includes('ROLLBACK')) throw new Error('write failure did not roll back')
    await page.evaluate(() => { Storage.prototype.setItem = window.__setItem }); await clickExact(page, 'button', '重试存储')
  })
  console.log(`\nPASS enum configuration browser (${url})`)
} catch (error) {
  console.error(`\nFAIL enum configuration browser\n${error.stack || error}`); process.exitCode = 1
} finally { await browser.close() }
