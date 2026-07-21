import puppeteer from 'puppeteer'

const BASE = process.env.PMS_BASE_URL || 'http://localhost:3004'

const fail = message => { throw new Error(message) }

async function waitForVisibleText(page, text, selector = 'body') {
  await page.waitForFunction((target, rootSelector) => (
    Array.from(document.querySelectorAll(rootSelector)).some(root => {
      const rect = root.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && (root.textContent || '').includes(target)
    })
  ), { timeout: 5000 }, text, selector)
}

async function clickVisibleText(page, selector, text) {
  const clicked = await page.evaluate((candidateSelector, target) => {
    const candidates = Array.from(document.querySelectorAll(candidateSelector))
    const element = candidates.find(node => {
      const rect = node.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && (node.textContent || '').trim() === target
    })
    if (!element) return false
    element.click()
    return true
  }, selector, text)
  if (!clicked) fail(`Unable to click visible text: ${text}`)
}

async function clickProject(page, projectName) {
  const clicked = await page.evaluate((target) => {
    const title = Array.from(document.querySelectorAll('span, div'))
      .find(node => (node.textContent || '').trim() === target && node.getBoundingClientRect().width > 0)
    if (!title) return false
    const card = title.closest('.ant-card') || title.parentElement
    card?.click()
    return !!card
  }, projectName)
  if (!clicked) fail(`Project card not found: ${projectName}`)
  await waitForVisibleText(page, projectName, '#section-header')
}

async function assertVisibleText(page, text, selector = 'body') {
  const found = await page.evaluate((target, rootSelector) => (
    Array.from(document.querySelectorAll(rootSelector)).some(root => {
      const rect = root.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && (root.textContent || '').includes(target)
    })
  ), text, selector)
  if (!found) {
    const visibleContents = await page.evaluate((rootSelector) => (
      Array.from(document.querySelectorAll(rootSelector))
        .filter(root => {
          const rect = root.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0
        })
        .map(root => (root.textContent || '').trim().replace(/\s+/g, ' '))
    ), selector)
    fail(`Missing visible text "${text}" in ${selector}; visible contents: ${visibleContents.join(' | ')}`)
  }
}

async function assertNoVisibleText(page, text, selector = 'body') {
  const found = await page.evaluate((target, rootSelector) => (
    Array.from(document.querySelectorAll(rootSelector)).some(root => {
      const rect = root.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && (root.textContent || '').includes(target)
    })
  ), text, selector)
  if (found) fail(`Unexpected visible text "${text}" in ${selector}`)
}

async function assertProjectInformationOrder(page) {
  const order = await page.evaluate(() => ({
    core: document.querySelector('#section-header')?.getBoundingClientRect().top,
    plan: document.querySelector('#section-plan')?.getBoundingClientRect().top,
    sections: document.querySelector('#section-basic')?.getBoundingClientRect().top,
  }))
  if (![order.core, order.plan, order.sections].every(Number.isFinite)) {
    fail(`Missing project-information section: ${JSON.stringify(order)}`)
  }
  if (!(order.core < order.plan && order.plan < order.sections)) {
    fail(`Unexpected project-information order: ${JSON.stringify(order)}`)
  }
}

async function findTypeEditorRow(page, type) {
  return page.evaluateHandle((target) => (
    Array.from(document.querySelectorAll('.ant-modal .ant-table-tbody tr')).find(row => (
      (row.querySelector('td:first-child')?.textContent || '').trim() === target
    )) || null
  ), type)
}

async function typeEditorHasRow(page, type) {
  return page.evaluate((target) => (
    Array.from(document.querySelectorAll('.ant-modal .ant-table-tbody tr')).some(row => (
      (row.querySelector('td:first-child')?.textContent || '').trim() === target
    ))
  ), type)
}

async function ensureTypeEditorRow(page, type) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await typeEditorHasRow(page, type)) return
    const previousRowCount = await page.$$eval('.ant-modal .ant-table-tbody tr', rows => rows.length)
    await clickVisibleText(page, '.ant-modal button', '添加类型')
    try {
      await page.waitForFunction((count) => (
        document.querySelectorAll('.ant-modal .ant-table-tbody tr').length > count
      ), { timeout: 3000 }, previousRowCount)
    } catch {
      const currentRows = await page.$$eval(
        '.ant-modal .ant-table-tbody tr td:first-child',
        cells => cells.map(cell => (cell.textContent || '').trim()),
      )
      fail(`Adding ${type} did not add a row; existing rows: ${currentRows.join(', ')}`)
    }
  }
  if (!(await typeEditorHasRow(page, type))) {
    const existingTypes = await page.$$eval(
      '.ant-modal .ant-table-tbody tr td:first-child',
      cells => cells.map(cell => (cell.textContent || '').trim()),
    )
    fail(`Unable to add tOS type: ${type}; existing rows: ${existingTypes.join(', ')}`)
  }
}

async function setTypeEditorControl(page, type, selector, checked) {
  const rowHandle = await findTypeEditorRow(page, type)
  const row = rowHandle.asElement()
  if (!row) fail(`Type editor row not found: ${type}`)
  const input = await row.$(selector)
  if (!input) fail(`Control ${selector} not found for type ${type}`)
  const current = await input.evaluate(node => node.checked)
  if (current !== checked) await input.click()
  await page.waitForFunction((target, controlSelector, expected) => {
    const targetRow = Array.from(document.querySelectorAll('.ant-modal .ant-table-tbody tr')).find(candidate => (
      (candidate.querySelector('td:first-child')?.textContent || '').trim() === target
    ))
    return targetRow?.querySelector(controlSelector)?.checked === expected
  }, { timeout: 3000 }, type, selector, checked)
  await rowHandle.dispose()
}

async function saveTypeEditor(page) {
  await clickVisibleText(page, '.ant-modal-footer button', '保存')
  await page.waitForFunction(() => !Array.from(document.querySelectorAll('.ant-modal'))
    .some(node => node.getBoundingClientRect().width > 0 && (node.textContent || '').includes('类型编辑')), { timeout: 5000 })
}

async function openTypeEditor(page, rootSelector) {
  await clickVisibleText(page, `${rootSelector} button`, '类型编辑')
  await waitForVisibleText(page, '跟随主类型计划', '.ant-modal')
}

async function configureGoFollower(page, followsMain) {
  await ensureTypeEditorRow(page, 'GO')
  await setTypeEditorControl(page, 'Full', 'input[type="radio"]', true)
  await setTypeEditorControl(page, 'GO', 'input[type="checkbox"]', followsMain)
  await saveTypeEditor(page)
}

async function clickPlanType(page, type) {
  const clicked = await page.evaluate((target) => {
    const tag = Array.from(document.querySelectorAll('.ant-tag')).find(node => {
      const rect = node.getBoundingClientRect()
      const normalized = (node.textContent || '').replace(/\s+/g, '')
      return rect.width > 0 && rect.height > 0 && normalized.startsWith(target)
    })
    if (!tag) return false
    tag.click()
    return true
  }, type)
  if (!clicked) fail(`Unable to click plan type: ${type}`)

  await page.waitForFunction((target) => (
    Array.from(document.querySelectorAll('.ant-tag')).some(node => (
      (node.textContent || '').replace(/\s+/g, '').startsWith(target)
      && node.getBoundingClientRect().width > 0
      && node.style.fontWeight === '600'
    ))
  ), { timeout: 3000 }, type)
}

async function assertSeparatePlanTypeTags(page, expectedTypes) {
  const tagTexts = await page.evaluate(() => {
    const typeCard = Array.from(document.querySelectorAll('.ant-card')).find(card => (
      Array.from(card.querySelectorAll('span')).some(node => (node.textContent || '').trim() === '类型')
      && card.querySelectorAll('.ant-tag').length > 0
    ))
    return typeCard
      ? Array.from(typeCard.querySelectorAll('.ant-tag')).map(tag => (tag.textContent || '').replace(/\s+/g, ''))
      : []
  })
  for (const type of expectedTypes) {
    if (!tagTexts.some(text => text.startsWith(type))) {
      fail(`Missing separate plan type tag ${type}; tags: ${tagTexts.join(', ')}`)
    }
  }
  if (tagTexts.some(text => text.includes('&'))) {
    fail(`Grouped summary label leaked into plan type tags: ${tagTexts.join(', ')}`)
  }
}

async function assertDisabledButton(page, label) {
  const state = await page.evaluate((target) => {
    const button = Array.from(document.querySelectorAll('button')).find(node => (
      node.getBoundingClientRect().width > 0
      && ((node.getAttribute('aria-label') || '').trim() === target || (node.textContent || '').trim() === target)
    ))
    return button ? { found: true, disabled: button.disabled } : { found: false, disabled: false }
  }, label)
  if (!state.found) fail(`Button not found: ${label}`)
  if (!state.disabled) fail(`Button should be disabled: ${label}`)
}

async function assertEnabledButton(page, label) {
  const state = await page.evaluate((target) => {
    const button = Array.from(document.querySelectorAll('button')).find(node => (
      node.getBoundingClientRect().width > 0 && (node.textContent || '').trim() === target
    ))
    return button ? { found: true, disabled: button.disabled } : { found: false, disabled: true }
  }, label)
  if (!state.found) fail(`Button not found: ${label}`)
  if (state.disabled) fail(`Button should be enabled: ${label}`)
}

async function openProjectTypeSelect(page) {
  const clicked = await page.evaluate(() => {
    const item = Array.from(document.querySelectorAll('.pms-project-info-modal .ant-form-item')).find(node => (
      (node.querySelector('label')?.textContent || '').trim() === '项目类型'
    ))
    const selector = item?.querySelector('.ant-select-selector') || item?.querySelector('[role="combobox"]')?.parentElement
    if (!selector) return false
    selector.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    selector.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return true
  })
  if (!clicked) {
    const labels = await page.$$eval(
      '.pms-project-info-modal .ant-form-item label',
      nodes => nodes.map(node => (node.textContent || '').trim()),
    )
    fail(`Project type form item not found; labels: ${labels.join(', ')}`)
  }
  await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { visible: true, timeout: 5000 })
}

async function assertFourColumnProjectForm(page) {
  const layout = await page.evaluate(() => {
    const grid = document.querySelector('.pms-project-info-modal .pms-project-info-universal')
    if (!grid) return null
    const columns = getComputedStyle(grid).gridTemplateColumns
      .split(' ')
      .filter(Boolean)
    return { display: getComputedStyle(grid).display, count: columns.length, columns }
  })
  if (!layout || layout.display !== 'grid' || layout.count !== 4) {
    fail(`Expected four-column project form: ${JSON.stringify(layout)}`)
  }
}

const browser = await puppeteer.launch({
  headless: 'new',
  defaultViewport: { width: 1600, height: 1000 },
  args: ['--no-sandbox', '--window-size=1600,1000'],
})

try {
  const page = await browser.newPage()
  const runtimeErrors = []
  const consoleErrors = []
  page.on('pageerror', error => runtimeErrors.push(error.message))
  page.on('console', message => {
    if (message.type() !== 'error') return
    const text = message.text()
    const sourceUrl = message.location().url || ''
    const isKnownAntdDeprecation = text.startsWith('Warning: [antd:') && text.includes('deprecated')
    const isMissingFavicon = text.includes('Failed to load resource') && sourceUrl.endsWith('/favicon.ico')
    if (!isKnownAntdDeprecation && !isMissingFavicon) {
      consoleErrors.push(sourceUrl ? `${text} @ ${sourceUrl}` : text)
    }
  })

  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 })
  await clickProject(page, 'tOS16.1')

  await assertVisibleText(page, '计划信息', '#section-plan')
  await assertProjectInformationOrder(page)
  await assertNoVisibleText(page, '基础信息', '#section-basic')
  await assertVisibleText(page, '团队信息', '#section-basic')
  for (const hiddenStatistic of ['计划开始时间', '计划结束时间', '开发周期（工作日）', '健康状态']) {
    await assertNoVisibleText(page, hiddenStatistic, '#section-plan')
  }
  await assertVisibleText(page, '里程碑计划（横排视图）', '#section-plan')
  await assertVisibleText(page, '版本', '#section-plan table')

  await openTypeEditor(page, '#section-plan')
  await configureGoFollower(page, false)
  await assertVisibleText(page, 'GO', '#section-plan')

  await openTypeEditor(page, '#section-plan')
  await configureGoFollower(page, true)
  await assertVisibleText(page, 'Full&GO', '#section-plan')

  await clickVisibleText(page, '[role="menuitem"], .ant-menu-item', '计划')
  await waitForVisibleText(page, '一级计划', '.ant-tabs-tab')
  await assertSeparatePlanTypeTags(page, ['Full', 'Slim', 'PAD', 'GO'])

  await clickVisibleText(page, '.ant-tabs-tab', '一级计划')
  await clickPlanType(page, 'GO')
  await assertVisibleText(page, '当前类型跟随 Full', '.ant-alert')
  await assertVisibleText(page, '一级计划来自 Full', '.ant-alert')
  await assertDisabledButton(page, '创建修订')

  await clickVisibleText(page, '.ant-tabs-tab', '二级计划')
  await waitForVisibleText(page, '创建二级计划', 'button')
  await assertNoVisibleText(page, '当前类型跟随 Full', '.ant-alert')
  await assertEnabledButton(page, '创建二级计划')
  await clickPlanType(page, 'GO')

  await clickVisibleText(page, 'button', '返回工作台')
  await waitForVisibleText(page, '新增项目', 'button')
  await clickVisibleText(page, 'button', '新增项目')
  await waitForVisibleText(page, '新增项目', '.pms-project-info-modal')
  await assertFourColumnProjectForm(page)
  await openProjectTypeSelect(page)
  for (const type of ['整机产品-手机', '整机产品-PAD', '整机产品-笔电']) {
    await assertVisibleText(page, type, '.ant-select-dropdown')
  }
  await assertNoVisibleText(page, '整机产品项目', '.ant-select-dropdown')

  if (runtimeErrors.length > 0) fail(`Runtime errors: ${runtimeErrors.join(' | ')}`)
  if (consoleErrors.length > 0) fail(`Console errors: ${consoleErrors.join(' | ')}`)
  console.log('tOS type plan smoke passed.')
} catch (error) {
  console.error(`tOS type plan smoke failed: ${error.message}`)
  process.exitCode = 1
} finally {
  await browser.close()
}
