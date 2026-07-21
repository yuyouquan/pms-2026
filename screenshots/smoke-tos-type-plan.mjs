import puppeteer from 'puppeteer'

const BASE = process.env.PMS_BASE_URL || 'http://localhost:3004'

const fail = message => { throw new Error(message) }

async function waitForVisibleText(page, text, selector = 'body') {
  await page.waitForFunction((target, rootSelector) => {
    const isVisible = (element) => {
      if (!(element instanceof Element)) return false
      for (let current = element; current; current = current.parentElement) {
        const style = getComputedStyle(current)
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false
      }
      return Array.from(element.getClientRects()).some(rect => rect.width > 0 && rect.height > 0)
    }
    const ownText = element => Array.from(element.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    return Array.from(document.querySelectorAll(rootSelector)).some(root => (
      [root, ...root.querySelectorAll('*')].some(element => (
        isVisible(element) && ownText(element).includes(target)
      ))
    ))
  }, { timeout: 5000 }, text, selector)
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
  const found = await page.evaluate((target, rootSelector) => {
    const isVisible = (element) => {
      if (!(element instanceof Element)) return false
      for (let current = element; current; current = current.parentElement) {
        const style = getComputedStyle(current)
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false
      }
      return Array.from(element.getClientRects()).some(rect => rect.width > 0 && rect.height > 0)
    }
    const ownText = element => Array.from(element.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    return Array.from(document.querySelectorAll(rootSelector)).some(root => (
      [root, ...root.querySelectorAll('*')].some(element => (
        isVisible(element) && ownText(element).includes(target)
      ))
    ))
  }, text, selector)
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
  const found = await page.evaluate((target, rootSelector) => {
    const isVisible = (element) => {
      if (!(element instanceof Element)) return false
      for (let current = element; current; current = current.parentElement) {
        const style = getComputedStyle(current)
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false
      }
      return Array.from(element.getClientRects()).some(rect => rect.width > 0 && rect.height > 0)
    }
    const ownText = element => Array.from(element.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    return Array.from(document.querySelectorAll(rootSelector)).some(root => (
      [root, ...root.querySelectorAll('*')].some(element => (
        isVisible(element) && ownText(element).includes(target)
      ))
    ))
  }, text, selector)
  if (found) fail(`Unexpected visible text "${text}" in ${selector}`)
}

async function assertNoElement(page, selector) {
  const count = await page.$$eval(selector, nodes => nodes.length)
  if (count !== 0) fail(`Unexpected element ${selector}; count: ${count}`)
}

async function expandInformationGroup(page, groupKey) {
  const selector = `.pms-project-info-collapse--${groupKey}`
  const active = await page.$eval(selector, node => node.querySelector('.ant-collapse-item')?.classList.contains('ant-collapse-item-active'))
  if (!active) {
    await page.click(`${selector} .ant-collapse-header`)
    await page.waitForFunction((target) => (
      document.querySelector(target)?.querySelector('.ant-collapse-item')?.classList.contains('ant-collapse-item-active')
    ), { timeout: 3000 }, selector)
  }
  await page.waitForFunction((target) => {
    const grid = document.querySelector(`${target} .pms-project-info-display-grid`)
    const firstItem = grid?.querySelector('.pms-project-info-display-item')
    const panel = grid?.closest('.ant-collapse-panel')
    const rect = firstItem?.getBoundingClientRect()
    const panelRect = panel?.getBoundingClientRect()
    return !!grid && !!firstItem && !!panel
      && getComputedStyle(panel).display !== 'none'
      && !!rect && rect.width > 0 && rect.height > 0
      && !!panelRect && panelRect.height >= rect.height
  }, { timeout: 3000 }, selector)
}

async function assertFixedFiveColumnInformationGrid(page, groupKey) {
  const selector = `.pms-project-info-collapse--${groupKey} .pms-project-info-display-grid`
  const layout = await page.$eval(selector, grid => {
    const items = Array.from(grid.querySelectorAll('.pms-project-info-display-item'))
    const style = getComputedStyle(grid)
    const widths = items.map(item => item.getBoundingClientRect().width)
    return {
      columns: style.gridTemplateColumns.split(' ').filter(Boolean),
      gridBackground: style.backgroundColor,
      itemBackgrounds: items.map(item => getComputedStyle(item).backgroundColor),
      itemCount: items.length,
      firstWidth: widths[0],
      lastWidth: widths.at(-1),
    }
  })
  if (layout.columns.length !== 5) fail(`${groupKey} must use five fixed columns: ${JSON.stringify(layout)}`)
  if (layout.firstWidth <= 0 || layout.lastWidth <= 0) fail(`${groupKey} grid items must be visible: ${JSON.stringify(layout)}`)
  if (layout.gridBackground !== 'rgb(255, 255, 255)') fail(`${groupKey} grid must be white: ${JSON.stringify(layout)}`)
  if (layout.itemBackgrounds.some(color => color !== 'rgb(255, 255, 255)')) fail(`${groupKey} cells must be white: ${JSON.stringify(layout)}`)
  if (layout.itemCount > 5 && Math.abs(layout.firstWidth - layout.lastWidth) > 0.5) {
    fail(`${groupKey} final-row cells must not stretch: ${JSON.stringify(layout)}`)
  }
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

async function getTypeEditorColumns(page) {
  return page.$$eval('.ant-modal .ant-table-thead th', headers => {
    const supportedTypes = ['Full', 'Slim', 'PAD', 'GO']
    return headers.slice(1).flatMap((header, offset) => {
      const rect = header.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return []
      const normalizedText = (header.textContent || '').replace(/\s+/g, '')
      const type = supportedTypes.find(candidate => normalizedText.startsWith(candidate))
      return type ? [{ type, columnIndex: offset + 1 }] : []
    })
  })
}

async function findTypeEditorColumn(page, type) {
  return (await getTypeEditorColumns(page)).find(column => column.type === type)
}

async function ensureTypeEditorColumn(page, type) {
  if (await findTypeEditorColumn(page, type)) return

  try {
    const toolbarSelect = await page.$('.ant-modal .pms-dimension-matrix-toolbar .ant-select')
    if (!toolbarSelect) fail(`Type editor toolbar select not found while adding ${type}`)
    await toolbarSelect.click()
    await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', {
      visible: true,
      timeout: 3000,
    })
    await clickVisibleText(
      page,
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option-content',
      type,
    )
    await clickVisibleText(page, '.ant-modal button', '增加类型')
    await page.waitForFunction((target) => {
      const supportedTypes = ['Full', 'Slim', 'PAD', 'GO']
      return Array.from(document.querySelectorAll('.ant-modal .ant-table-thead th'))
        .slice(1)
        .some(header => {
          const rect = header.getBoundingClientRect()
          const normalizedText = (header.textContent || '').replace(/\s+/g, '')
          const headerType = supportedTypes.find(candidate => normalizedText.startsWith(candidate))
          return rect.width > 0 && rect.height > 0 && headerType === target
        })
    }, { timeout: 3000 }, type)
  } catch (error) {
    const currentTypes = (await getTypeEditorColumns(page)).map(column => column.type)
    fail(`Unable to add ${type}; current header types: ${currentTypes.join(', ')}; cause: ${error.message}`)
  }
}

async function setTypeEditorControl(page, type, fieldLabel, selector, checked) {
  const typeColumn = await findTypeEditorColumn(page, type)
  if (!typeColumn) {
    const currentTypes = (await getTypeEditorColumns(page)).map(column => column.type)
    fail(`Type editor column not found: ${type}; current header types: ${currentTypes.join(', ')}`)
  }

  const fieldRows = await page.$$('.ant-modal .ant-table-tbody tr')
  let targetRow = null
  for (const row of fieldRows) {
    const label = await row.$eval('td:first-child', cell => (cell.textContent || '').replace(/\s+/g, '').trim())
      .catch(() => '')
    if (label === fieldLabel) {
      targetRow = row
      break
    }
  }
  if (!targetRow) {
    const currentFields = await page.$$eval(
      '.ant-modal .ant-table-tbody tr td:first-child',
      cells => cells.map(cell => (cell.textContent || '').replace(/\s+/g, '').trim()),
    )
    fail(`Type editor field row not found: ${fieldLabel}; current fields: ${currentFields.join(', ')}`)
  }

  const cells = await targetRow.$$('td')
  const targetCell = cells[typeColumn.columnIndex]
  if (!targetCell) fail(`Type editor cell not found for ${fieldLabel}/${type} at column ${typeColumn.columnIndex}`)
  const input = await targetCell.$(selector)
  if (!input) fail(`Control ${selector} not found for ${fieldLabel}/${type}`)
  const current = await input.evaluate(node => node.checked)
  if (current !== checked) await input.click()

  await page.waitForFunction((targetType, targetField, controlSelector, expected) => {
    const supportedTypes = ['Full', 'Slim', 'PAD', 'GO']
    const headers = Array.from(document.querySelectorAll('.ant-modal .ant-table-thead th'))
    const columnIndex = headers.findIndex((header, index) => {
      if (index === 0) return false
      const normalizedText = (header.textContent || '').replace(/\s+/g, '')
      return supportedTypes.find(candidate => normalizedText.startsWith(candidate)) === targetType
    })
    const row = Array.from(document.querySelectorAll('.ant-modal .ant-table-tbody tr')).find(candidate => (
      (candidate.querySelector('td:first-child')?.textContent || '').replace(/\s+/g, '').trim() === targetField
    ))
    const cell = columnIndex >= 0 ? row?.querySelectorAll('td')[columnIndex] : undefined
    return cell?.querySelector(controlSelector)?.checked === expected
  }, { timeout: 3000 }, type, fieldLabel, selector, checked)
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
  await ensureTypeEditorColumn(page, 'GO')
  await setTypeEditorControl(page, 'Full', '主类型', 'input[type="radio"]', true)
  await setTypeEditorControl(page, 'GO', '跟随主类型', 'input[type="checkbox"]', followsMain)
  await saveTypeEditor(page)
}

async function clickPlanType(page, type) {
  const clicked = await page.evaluate((target) => {
    const typeCard = Array.from(document.querySelectorAll('.ant-card')).find(card => (
      Array.from(card.querySelectorAll('span')).some(node => (node.textContent || '').trim() === '类型')
      && card.querySelectorAll('.ant-tag').length > 0
    ))
    const tag = Array.from(typeCard?.querySelectorAll('.ant-tag') || []).find(node => {
      const rect = node.getBoundingClientRect()
      const normalized = (node.textContent || '').replace(/\s+/g, '')
      return rect.width > 0 && rect.height > 0 && normalized.startsWith(target)
    })
    if (!tag) return false
    tag.click()
    return true
  }, type)
  if (!clicked) fail(`Unable to click plan type: ${type}`)

  await assertActivePlanType(page, type)
}

async function assertActivePlanType(page, type) {
  await page.waitForFunction((target) => {
    const typeCard = Array.from(document.querySelectorAll('.ant-card')).find(card => (
      Array.from(card.querySelectorAll('span')).some(node => (node.textContent || '').trim() === '类型')
      && card.querySelectorAll('.ant-tag').length > 0
    ))
    return Array.from(typeCard?.querySelectorAll('.ant-tag') || []).some(node => (
      (node.textContent || '').replace(/\s+/g, '').startsWith(target)
      && node.getBoundingClientRect().width > 0
      && node.style.fontWeight === '600'
      && node.style.borderColor !== 'rgb(217, 217, 217)'
    ))
  }, { timeout: 3000 }, type)
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
  const formItems = await page.$$('.pms-project-info-modal .ant-form-item')
  let projectTypeItem = null
  for (const item of formItems) {
    const label = await item.$eval('label', node => (node.textContent || '').trim()).catch(() => '')
    if (label === '项目类型') {
      projectTypeItem = item
      break
    }
  }
  if (!projectTypeItem) {
    const labels = await page.$$eval(
      '.pms-project-info-modal .ant-form-item label',
      nodes => nodes.map(node => (node.textContent || '').trim()),
    )
    fail(`Project type form item not found; labels: ${labels.join(', ')}`)
  }
  const selector = await projectTypeItem.$('.ant-select-selector') || await projectTypeItem.$('[role="combobox"]')
  if (!selector) fail('Project type select trigger not found')
  await selector.click()
  await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { visible: true, timeout: 5000 })
  for (const type of ['整机产品-手机', '整机产品-PAD', '整机产品-笔电']) {
    await waitForVisibleText(page, type, '.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
  }
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

async function findVisibleModalFormItem(page, label) {
  const items = await page.$$('.ant-modal .ant-form-item')
  for (const item of items) {
    const itemLabel = await item.$eval('label', node => (node.textContent || '').trim()).catch(() => '')
    const visible = await item.evaluate(node => {
      const rect = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    })
    if (visible && itemLabel === label) return item
  }
  fail(`Visible modal form item not found: ${label}`)
}

async function selectVisibleModalOption(page, label, optionText) {
  const item = await findVisibleModalFormItem(page, label)
  const trigger = await item.$('.ant-select-selector') || await item.$('[role="combobox"]')
  if (!trigger) fail(`Select trigger not found for modal field: ${label}`)
  await trigger.click()
  await waitForVisibleText(page, optionText, '.ant-select-dropdown:not(.ant-select-dropdown-hidden)')

  const options = await page.$$('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option-content')
  const option = await (async () => {
    for (const candidate of options) {
      const matches = await candidate.evaluate((node, target) => {
        const rect = node.getBoundingClientRect()
        const style = getComputedStyle(node)
        return rect.width > 0 && rect.height > 0
          && style.display !== 'none'
          && style.visibility !== 'hidden'
          && (node.textContent || '').trim() === target
      }, optionText)
      if (matches) return candidate
    }
    return null
  })()
  if (!option) fail(`Visible option not found for ${label}: ${optionText}`)
  await option.click()
  await page.waitForFunction((formLabel, selectedText) => {
    const formItem = Array.from(document.querySelectorAll('.ant-modal .ant-form-item')).find(node => (
      (node.querySelector('label')?.textContent || '').trim() === formLabel
      && node.getBoundingClientRect().width > 0
    ))
    const selectorText = (formItem?.querySelector('.ant-select-selector')?.textContent || '').trim()
    const comboboxValue = (formItem?.querySelector('[role="combobox"]')?.value || '').trim()
    return selectorText === selectedText || comboboxValue === selectedText || (formItem?.textContent || '').includes(selectedText)
  }, { timeout: 3000 }, label, optionText)
}

async function fillVisibleModalInput(page, label, value) {
  const item = await findVisibleModalFormItem(page, label)
  const input = await item.$('input:not([disabled])')
  if (!input) fail(`Editable input not found for modal field: ${label}`)
  await input.click({ clickCount: 3 })
  await page.keyboard.press('Backspace')
  await input.type(value)
  await page.waitForFunction((formLabel, expected) => {
    const formItem = Array.from(document.querySelectorAll('.ant-modal .ant-form-item')).find(node => (
      (node.querySelector('label')?.textContent || '').trim() === formLabel
      && node.getBoundingClientRect().width > 0
    ))
    return formItem?.querySelector('input')?.value === expected
  }, { timeout: 3000 }, label, value)
}

async function assertGoLevel2PlanIsIndependent(page) {
  const uniquePlanName = `GO独立二级-${Date.now()}`
  await assertActivePlanType(page, 'GO')
  await assertEnabledButton(page, '创建二级计划')
  await clickVisibleText(page, 'button', '创建二级计划')
  await waitForVisibleText(page, '创建二级计划', '.ant-modal')
  await selectVisibleModalOption(page, '计划模板类型', '无')
  await fillVisibleModalInput(page, '二级计划名称', uniquePlanName)
  await clickVisibleText(page, '.ant-modal-footer button', '创建')
  await waitForVisibleText(page, uniquePlanName, '.ant-tabs-tab')

  await clickPlanType(page, 'Full')
  await assertActivePlanType(page, 'Full')
  await assertNoVisibleText(page, uniquePlanName, '.ant-tabs-tab')

  await clickPlanType(page, 'GO')
  await assertActivePlanType(page, 'GO')
  await assertVisibleText(page, uniquePlanName, '.ant-tabs-tab')
}

const browser = await puppeteer.launch({
  headless: 'shell',
  defaultViewport: { width: 1600, height: 1000 },
  args: [
    '--no-sandbox',
    '--window-size=1600,1000',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--disable-features=CalculateNativeWinOcclusion',
  ],
})

try {
  const page = await browser.newPage()
  await page.bringToFront()
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
  await assertNoElement(page, '#section-config')
  await assertNoVisibleText(page, '配置信息')
  for (const hiddenStatistic of ['计划开始时间', '计划结束时间', '开发周期（工作日）', '健康状态']) {
    await assertNoVisibleText(page, hiddenStatistic, '#section-plan')
  }
  await assertVisibleText(page, '里程碑计划（横排视图）', '#section-plan')
  await assertVisibleText(page, '版本', '#section-plan table')

  await openTypeEditor(page, '#section-plan')
  await ensureTypeEditorColumn(page, 'PAD')
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
  await clickPlanType(page, 'GO')
  await assertActivePlanType(page, 'GO')
  await assertNoVisibleText(page, '当前类型跟随 Full', '.ant-alert')
  await assertGoLevel2PlanIsIndependent(page)

  await clickVisibleText(page, 'button', '返回工作台')
  await waitForVisibleText(page, '新增项目', 'button')
  await clickProject(page, 'X6877-D8400_H991')
  await assertVisibleText(page, '计划信息', '#section-plan')
  await assertNoVisibleText(page, '计划信息与配置信息', '#section-plan')
  await assertNoVisibleText(page, '配置信息', '#section-plan')
  await assertNoElement(page, '#section-config')
  await new Promise(resolve => setTimeout(resolve, 3500))
  const planSection = await page.$('#section-plan')
  if (!planSection) fail('Whole-machine plan section must exist for the PRD screenshot')
  await planSection.screenshot({ path: 'screenshots/smoke-project-plan-information.png' })
  await expandInformationGroup(page, 'basic')
  await expandInformationGroup(page, 'extended')
  await assertFixedFiveColumnInformationGrid(page, 'basic')
  await assertFixedFiveColumnInformationGrid(page, 'extended')
  await page.$eval('#section-basic', node => node.scrollIntoView({ block: 'start' }))
  await page.waitForFunction(() => {
    const section = document.querySelector('#section-basic')?.getBoundingClientRect()
    return !!section && section.top >= 0 && section.top < innerHeight
  }, { timeout: 3000 })
  const informationSection = await page.$('#section-basic')
  if (!informationSection) fail('Whole-machine information section must exist for the PRD screenshot')
  await informationSection.screenshot({ path: 'screenshots/smoke-project-info-five-columns.png' })

  await clickVisibleText(page, 'button', '返回工作台')
  await waitForVisibleText(page, '新增项目', 'button')
  await clickVisibleText(page, 'button', '新增项目')
  await waitForVisibleText(page, '新增项目', '.pms-project-info-modal')
  await assertFourColumnProjectForm(page)
  await openProjectTypeSelect(page)
  for (const type of ['整机产品-手机', '整机产品-PAD', '整机产品-笔电']) {
    await assertVisibleText(page, type, '.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
  }
  await assertNoVisibleText(page, '整机产品项目', '.ant-select-dropdown:not(.ant-select-dropdown-hidden)')

  if (runtimeErrors.length > 0) fail(`Runtime errors: ${runtimeErrors.join(' | ')}`)
  if (consoleErrors.length > 0) fail(`Console errors: ${consoleErrors.join(' | ')}`)
  console.log('tOS type plan smoke passed.')
} catch (error) {
  console.error(`tOS type plan smoke failed: ${error.stack || error.message}`)
  process.exitCode = 1
} finally {
  await browser.close()
}
