#!/usr/bin/env node
/**
 * Real-browser acceptance for the level-one flat milestones / technical-plan
 * contract.  This intentionally uses the public UI only; every scenario gets
 * a fresh browser context so persisted drafts cannot hide regressions.
 */
import assert from 'node:assert/strict'
import puppeteer from 'puppeteer'

const BASE_URL = process.env.PMS_BASE_URL || 'http://127.0.0.1:3004'
const TIMEOUT = Number(process.env.PMS_BROWSER_TIMEOUT || 30_000)
const ONLY_CASE = process.env.PMS_BROWSER_CASE || ''
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const allowed = ['favicon.ico', 'Download the React DevTools', '[antd:', 'ResizeObserver loop']

const clickExact = async (page, text, selector = 'button,[role="menuitem"],[role="tab"],td,div,span,label') => {
  const activation = await page.evaluate(({ text, selector }) => {
    const isVisible = item => {
      const box = item.getBoundingClientRect()
      const style = getComputedStyle(item)
      return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    }
    const candidates = [...document.querySelectorAll(selector)]
    const element = candidates.find(item => isVisible(item) && item.textContent?.trim() === text)
    if (!element) return 'missing'
    const target = element.closest('button,[role="menuitem"],[role="tab"],td,label,.ant-radio-button-wrapper') || element
    if (target instanceof HTMLButtonElement) {
      target.focus()
      return document.activeElement === target ? 'keyboard' : 'missing'
    }
    target.click()
    return 'click'
  }, { text, selector })
  if (activation === 'missing') throw new Error(`missing visible control: ${text}`)
  if (activation === 'keyboard') await page.keyboard.press('Enter')
  await wait(220)
}

const clickRoleText = async (page, role, text) => {
  const clicked = await page.evaluate(({ role, text }) => {
    const element = [...document.querySelectorAll(`[role="${role}"]`)]
      .find(element => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && (element.textContent || '').trim() === text
      })
    element?.click()
    return Boolean(element)
  }, { role, text })
  if (!clicked) throw new Error(`missing ${role}: ${text}`)
  await wait(250)
}

const clickButtonText = async (page, text) => {
  const handle = await page.evaluateHandle(value => [...document.querySelectorAll('button')].find(button => {
    const box = button.getBoundingClientRect()
    const style = getComputedStyle(button)
    return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
      && button.textContent?.trim() === value
  }) || null, text)
  const button = handle.asElement()
  if (!button) throw new Error(`missing visible button: ${text}`)
  const box = await button.boundingBox()
  await handle.dispose()
  if (!box) throw new Error(`hidden button: ${text}`)
  // The subproject tab includes a settings button on the right; activate its
  // label side so the actual AntD tab receives the pointer event.
  await page.mouse.click(box.x + Math.min(18, box.width / 3), box.y + box.height / 2)
  await wait(220)
}

const clickTabContaining = async (page, text) => {
  const handle = await page.evaluateHandle(value => {
    const tab = [...document.querySelectorAll('[role="tab"]')]
      .find(node => node.textContent?.includes(value))
    return tab || null
  }, text)
  const tab = handle.asElement()
  if (!tab) throw new Error(`missing tab containing: ${text}`)
  if (!await tab.boundingBox()) throw new Error(`hidden tab containing: ${text}`)
  await tab.click()
  await handle.dispose()
  await page.waitForFunction(value => {
    const visible = node => {
      const box = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    }
    return [...document.querySelectorAll('[role="tab"]')]
      .some(tab => tab.textContent?.includes(value) && tab.getAttribute('aria-selected') === 'true')
      || [...document.querySelectorAll('[role="dialog"]')]
        .some(dialog => visible(dialog) && dialog.textContent?.includes('离开确认'))
  }, { timeout: TIMEOUT }, text)
  const dialogHandle = await page.evaluateHandle(() => {
    const visible = node => {
      const box = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    }
    return [...document.querySelectorAll('[role="dialog"]')]
      .find(dialog => visible(dialog) && dialog.textContent?.includes('离开确认')) || null
  })
  const dialog = dialogHandle.asElement()
  if (dialog) {
    const confirmHandle = await dialog.evaluateHandle(node => [...node.querySelectorAll('button')]
      .find(button => button.textContent?.trim() === '确认离开') || null)
    const confirm = confirmHandle.asElement()
    if (!confirm) throw new Error('leave confirmation has no confirm button')
    await confirm.click()
    await confirmHandle.dispose()
    await page.waitForFunction(value => [...document.querySelectorAll('[role="tab"]')]
      .some(tab => tab.textContent?.includes(value) && tab.getAttribute('aria-selected') === 'true'), { timeout: TIMEOUT }, text)
  }
  await dialogHandle.dispose()
}

const pressAriaButton = async (page, label) => {
  const focused = await page.evaluate(value => {
    const button = document.querySelector(`button[aria-label="${value}"]`)
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false
    button.focus()
    return document.activeElement === button
  }, label)
  if (!focused) throw new Error(`missing enabled button: ${label}`)
  await page.keyboard.press('Enter')
  await wait(220)
}

const textOf = async (page, selector) => page.$eval(selector, element => element.textContent || '')
const headers = async (page, selector) => page.$$eval(`${selector} th`, nodes => nodes.map(node => node.textContent?.trim()).filter(Boolean))
const assertHeaders = async (page, selector, expected) => assert.deepEqual(await headers(page, selector), expected, `${selector} headers`)
const flatMilestoneDate = async (page, table, name) => page.$eval(table, (element, taskName) => {
  const row = [...element.querySelectorAll('tbody tr')].find(item => item.textContent?.includes(taskName))
  if (!row) return null
  const cells = [...row.querySelectorAll('td')].map(cell => (
    cell.querySelector('input')?.value || cell.textContent?.trim() || ''
  ))
  return cells[4] || null
}, name)
const taskDates = async (page, table, name) => page.$eval(table, (element, taskName) => {
  const row = [...element.querySelectorAll('tbody tr')].find(item => item.textContent?.includes(taskName))
  if (!row) return null
  const cells = [...row.querySelectorAll('td')].map(cell => (
    cell.querySelector('input')?.value || cell.textContent?.trim() || ''
  ))
  return { planStart: cells[3] || null, planEnd: cells[4] || null }
}, name)
const ganttTaskIdForName = async (page, name) => page.$$eval('.gantt_row[task_id]', (rows, taskName) => {
  const row = rows.find(item => item.textContent?.includes(taskName))
  return row?.getAttribute('task_id') || null
}, name)

const chooseVersion = async (page, matching) => {
  await page.click('[aria-label="计划版本"]')
  await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { timeout: TIMEOUT })
  const clicked = await page.evaluate(value => {
    const option = [...document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')]
      .find(item => item.textContent?.includes(value))
    option?.click()
    return Boolean(option)
  }, matching)
  if (!clicked) {
    const options = await page.$$eval('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option', nodes => nodes.map(node => node.textContent?.trim() || ''))
    throw new Error(`missing plan version ${matching}; options: ${JSON.stringify(options)}`)
  }
  await wait(240)
}

const chooseSelectOption = async (page, ariaLabel, matching) => {
  const focused = await page.evaluate(label => {
    const control = document.querySelector(`[aria-label="${label}"]`)
    if (!(control instanceof HTMLElement)) return false
    control.focus()
    return document.activeElement === control
  }, ariaLabel)
  if (!focused) throw new Error(`missing select: ${ariaLabel}`)
  await page.keyboard.press('Enter')
  await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { timeout: TIMEOUT })
  const selected = await page.evaluate(value => {
    const option = [...document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')]
      .find(item => item.textContent?.includes(value))
    option?.click()
    return Boolean(option)
  }, matching)
  if (!selected) throw new Error(`missing ${ariaLabel} option: ${matching}`)
  await wait(220)
}

const clickProjectCell = async (page, project) => {
  const rowHandle = await page.evaluateHandle(name => {
    const cell = [...document.querySelectorAll('td')].find(element => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
        && (element.textContent || '').trim() === name
    })
    const row = cell?.closest('tr')
    return row && getComputedStyle(row).cursor === 'pointer' ? row : null
  }, project)
  const row = rowHandle.asElement()
  if (!row) throw new Error(`missing clickable project row ${project}`)
  const box = await row.boundingBox()
  if (!box) throw new Error(`hidden project row ${project}`)
  console.log(`browser click row ${project}: ${await row.evaluate(element => element.textContent?.trim() || '')}`)
  // AntD's fixed-column overlay can cover the geometric row centre. Dispatch
  // the standard composed DOM click on the already verified public row.
  await row.evaluate(element => element.dispatchEvent(new MouseEvent('click', {
    bubbles: true, cancelable: true, composed: true, view: window,
  })))
  await rowHandle.dispose()
  await wait(250)
}

const enterProject = async (page, project) => {
  // The Next development websocket deliberately keeps the network busy.
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT })
  await wait(2_000)
  console.log(`browser entered root for ${project}`)
  await clickRoleText(page, 'menuitem', '项目列表')
  console.log(`browser opened list for ${project}`)
  // AntD's navigation item can retain its focus/active class without the
  // selected class during its exit animation. The public list-view control is
  // the stable, rendered proof that the destination has loaded.
  await page.waitForSelector('[aria-label="项目列表视图"]', { timeout: TIMEOUT })
  const category = project.startsWith('tOS') ? 'tOS版本项目 5'
    : project === 'AIOS架构演进V3' ? '技术项目 5'
      : null
  if (category) await clickButtonText(page, category)
  const cardViewSelected = await page.evaluate(() => {
    const option = document.querySelector('[aria-label="卡片视图"]')
    ;(option?.closest('label,.ant-segmented-item') || option)?.click()
    return Boolean(option)
  })
  if (!cardViewSelected) throw new Error('missing project-list card view control')
  await page.waitForSelector('.pms-project-card', { timeout: TIMEOUT })
  await page.waitForFunction(name => document.body.innerText.includes(name), { timeout: TIMEOUT }, project)
  console.log(`browser found ${project}`)
  const cardHandle = await page.evaluateHandle(name => [...document.querySelectorAll('.pms-project-card')]
    .find(card => {
      const box = card.getBoundingClientRect()
      const style = getComputedStyle(card)
      return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
        && card.textContent?.includes(name)
    }), project)
  const card = cardHandle.asElement()
  if (!card) throw new Error(`missing project card ${project}`)
  const cardLabel = await card.evaluate(element => element.getAttribute('aria-label'))
  await cardHandle.dispose()
  if (!cardLabel) throw new Error(`project card ${project} is missing its public aria-label`)
  // The card's documented keyboard activation is also a real public UI path,
  // and bypasses the fixed table overlay that blocks pointer synthesis in
  // headless Chromium.
  const activateCard = await page.evaluate(label => {
    const element = document.querySelector(`[role="button"][aria-label="${label}"]`)
    if (!(element instanceof HTMLElement)) return false
    element.focus()
    return document.activeElement === element
  }, cardLabel)
  if (!activateCard) throw new Error(`could not focus project card ${project}`)
  await page.keyboard.press('Enter')
  console.log(`browser clicked ${project}`)
  await page.waitForFunction(() => document.body.innerText.includes('项目空间'), { timeout: TIMEOUT })
  await clickRoleText(page, 'menuitem', '计划')
  await page.waitForFunction(() => document.body.innerText.includes('一级计划') || document.body.innerText.includes('TDT项目计划'), { timeout: TIMEOUT })
}

const selectView = async (page, name) => {
  await page.waitForFunction(value => {
    const isVisible = node => {
      const box = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    }
    return [...document.querySelectorAll('.pms-plan-view-mode-switcher input[aria-label]')]
      .some(node => node.getAttribute('aria-label') === value && isVisible(node.closest('label') || node))
  }, {}, name)
  const clicked = await page.evaluate(value => {
    const isVisible = node => {
      const box = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    }
    const radio = [...document.querySelectorAll('.pms-plan-view-mode-switcher input[aria-label]')]
      .find(node => node.getAttribute('aria-label') === value && isVisible(node.closest('label') || node))
    ;(radio?.closest('label,.ant-radio-button-wrapper,.ant-segmented-item') || radio)?.click()
    return Boolean(radio)
  }, name)
  if (!clicked) throw new Error(`missing plan view ${name}`)
  await wait(400)
}

const switchUser = async (page, user) => {
  const focused = await page.evaluate(() => {
    const button = document.querySelector('button[aria-label="切换当前用户"]')
    if (!(button instanceof HTMLButtonElement)) return false
    button.focus()
    return document.activeElement === button
  })
  if (!focused) throw new Error('missing current-user switcher')
  await page.keyboard.press('Enter')
  await page.waitForSelector('.ant-dropdown:not(.ant-dropdown-hidden)', { timeout: TIMEOUT })
  const clicked = await page.evaluate(value => {
    const isVisible = node => {
      const box = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    }
    const named = [...document.querySelectorAll('.ant-dropdown:not(.ant-dropdown-hidden) *')]
      .find(node => node.children.length === 0 && node.textContent?.trim() === value)
    const namedItem = named?.closest('li,[role="menuitem"],.ant-dropdown-menu-item')
    const option = namedItem
      || [...document.querySelectorAll('.ant-dropdown:not(.ant-dropdown-hidden) [role="menuitem"], .ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item')]
        .find(node => isVisible(node) && node.textContent?.includes(value))
    option?.click()
    return Boolean(option)
  }, user)
  if (!clicked) {
    const dropdownText = await page.$$eval('.ant-dropdown:not(.ant-dropdown-hidden)', nodes => nodes.map(node => node.textContent?.trim() || ''))
    throw new Error(`missing user ${user}; visible dropdowns: ${JSON.stringify(dropdownText)}`)
  }
  await page.waitForFunction(value => document.querySelector('button[aria-label="切换当前用户"]')?.getAttribute('data-current-user') === value, { timeout: TIMEOUT }, user)
}

const dragTask = async (page, selector, dx, dy = 0) => {
  const handle = await page.$(selector)
  if (!handle) throw new Error(`missing gantt task ${selector}`)
  const box = await handle.boundingBox()
  if (!box) throw new Error(`hidden gantt task ${selector}`)
  // DHTMLX renders milestones as a zero-width line whose diamond extends to
  // the right; its task anchor is the hit-tested point at `box.x`.
  const startX = box.width === 0 ? box.x : box.x + box.width / 2
  const startY = box.y + box.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + dx, startY + dy, { steps: 2 })
  await page.mouse.up()
  await wait(500)
}

const resizeTaskEnd = async (page, selector, dx) => {
  const handle = await page.evaluateHandle(value => {
    const line = document.querySelector(value)
    return line?.querySelector('.gantt_task_drag.task_right.task_end_date') || null
  }, selector)
  const end = handle.asElement()
  if (!end) {
    const descendants = await page.$eval(selector, node => [...node.querySelectorAll('*')]
      .map(item => item.className).filter(Boolean))
    throw new Error(`missing DHTMLX end-resize handle for ${selector}: ${JSON.stringify(descendants)}`)
  }
  const box = await end.boundingBox()
  await handle.dispose()
  if (!box) throw new Error(`hidden DHTMLX end-resize handle for ${selector}`)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2, { steps: 2 })
  await page.mouse.up()
  await wait(500)
}

const createFormalRevision = async page => {
  const button = await page.$('button[aria-label="创建修订"]')
  if (!button) return false
  await pressAriaButton(page, '创建修订')
  await page.waitForSelector('.ant-dropdown:not(.ant-dropdown-hidden)', { timeout: TIMEOUT })
  await clickExact(page, '创建正式版本', '[role="menuitem"]')
  await page.waitForFunction(() => !document.querySelector('button[aria-label="创建修订"]'), { timeout: TIMEOUT })
  return true
}

const ensureDraft = async page => {
  if (await createFormalRevision(page)) return 'created'
  const selectedVersion = await page.$eval('[aria-label="计划版本"]', control => (
    control.closest('.ant-select')?.textContent || ''
  ))
  if (!selectedVersion.includes('修订中')) {
    throw new Error(`expected a current draft or create-revision action, got version ${selectedVersion}`)
  }
  return 'existing'
}

const reopenProjectInContext = async (page, errors, project, tab) => {
  const context = page.browserContext()
  await page.close()
  const reopened = await context.newPage()
  attachPageChecks(reopened, errors)
  await reopened.setViewport({ width: 1600, height: 1080 })
  await enterProject(reopened, project)
  if (tab) await clickTabContaining(reopened, tab)
  return reopened
}

const assertNoErrors = errors => assert.deepEqual(errors, [], `browser errors:\n${errors.join('\n')}`)

const attachPageChecks = (page, errors) => {
  page.setDefaultTimeout(TIMEOUT)
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
  page.on('console', message => {
    if (!['error', 'warn'].includes(message.type())) return
    if (allowed.some(item => message.text().includes(item))) return
    errors.push(`${message.type()}: ${message.text()}`)
  })
}

const runCase = async (browser, title, test) => {
  console.log(`RUN browser ${title}`)
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  const errors = []
  attachPageChecks(page, errors)
  try {
    await page.setViewport({ width: 1600, height: 1080 })
    await test(page, errors)
    assertNoErrors(errors)
    console.log(`PASS browser ${title}`)
  } finally {
    try {
      await context.close()
    } catch (cleanupError) {
      console.warn(`browser cleanup warning (${title}): ${cleanupError.message}`)
    }
  }
}

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
try {
  if (!ONLY_CASE || ONLY_CASE === 'all' || ONLY_CASE === 'machine') await runCase(browser, 'machine flat table, guarded MR, history, permission, compare', async (initialPage, errors) => {
    let page = initialPage
    await enterProject(page, 'X6877-D8400_H991')
    await selectView(page, '竖版表格')
    const table = '.pms-level1-flat-milestone-table'
    await page.waitForSelector(table, { timeout: TIMEOUT })
    await assertHeaders(page, table, ['序号', '阶段', '里程碑点', '状态', '计划完成时间', '计划开发周期', '实际完成时间', '实际开发周期'])
    assert.equal(await page.$(`${table} .ant-table-row-expand-icon`), null, 'flat table must not render a tree expander')
    console.log('browser machine flat table contract passed')

    await clickButtonText(page, '添加上市阶段 MR 里程碑')
    await page.waitForFunction(() => document.body.innerText.includes('确认添加上市阶段 MR 里程碑？'), { timeout: TIMEOUT })
    await clickButtonText(page, '确认添加')
    await page.waitForFunction(() => document.body.innerText.includes('MR4'), { timeout: TIMEOUT })
    await page.waitForFunction(title => {
      const isVisible = node => {
        const style = getComputedStyle(node)
        const box = node.getBoundingClientRect()
        return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
      }
      return ![...document.querySelectorAll('[role="dialog"]')]
        .some(node => isVisible(node) && node.textContent?.includes(title))
    }, { timeout: TIMEOUT }, '确认添加上市阶段 MR 里程碑？')
    assert.ok((await textOf(page, table)).includes('MR4'), 'confirmed MR4 is visible in the flat table')
    const deleteMr = await page.$('button[aria-label="删除里程碑 MR4"]')
    assert.ok(deleteMr, 'custom MR has a delete affordance')
    assert.equal(await page.$('button[aria-label="删除里程碑 收编完成"]'), null, 'template milestone has no delete affordance')
    console.log('browser machine MR confirmation and structure contract passed')
    const draggedMilestoneName = '概念启动'
    const beforeDate = await flatMilestoneDate(page, table, draggedMilestoneName)
    assert.ok(beforeDate, `${draggedMilestoneName} has a plan completion date before gantt drag`)

    await selectView(page, '甘特图')
    await page.waitForSelector('.gantt_task_line', { timeout: TIMEOUT })
    console.log('browser machine gantt rendered')
    assert.ok(await page.$('.gantt_task_line.pms-gantt-project.pms-gantt-task-readonly'), 'stage is rendered readonly')
    assert.ok(await page.$('.gantt_task_line.pms-gantt-milestone.pms-gantt-task-editable'), 'draft milestone is rendered editable')
    console.log('browser machine gantt readonly/editable class contract passed')
    const milestoneTaskId = await ganttTaskIdForName(page, draggedMilestoneName)
    assert.ok(milestoneTaskId, `${draggedMilestoneName} has a public DHTMLX task_id`)
    const milestone = `.gantt_task_line.pms-gantt-milestone.pms-gantt-task-editable[task_id="${milestoneTaskId}"]`
    const before = await page.$eval(milestone, node => node.getAttribute('task_id'))
    await dragTask(page, milestone, 24)
    console.log('browser machine milestone drag completed')
    await selectView(page, '竖版表格')
    const afterDate = await flatMilestoneDate(page, table, draggedMilestoneName)
    assert.notEqual(afterDate, beforeDate, `milestone ${before} drag writes a changed plan date to the flat table`)
    console.log(`browser machine milestone date ${beforeDate} -> ${afterDate}`)
    const invalidMilestoneName = 'STR1'
    const invalidBeforeDate = await flatMilestoneDate(page, table, invalidMilestoneName)
    await selectView(page, '甘特图')
    const invalidTaskId = await ganttTaskIdForName(page, invalidMilestoneName)
    assert.ok(invalidBeforeDate && invalidTaskId, 'STR1 has a dated public gantt task for rollback coverage')
    await dragTask(page, `.gantt_task_line.pms-gantt-milestone.pms-gantt-task-editable[task_id="${invalidTaskId}"]`, -480)
    await selectView(page, '竖版表格')
    const invalidAfterDate = await flatMilestoneDate(page, table, invalidMilestoneName)
    assert.equal(invalidAfterDate, invalidBeforeDate, 'invalid milestone drag rolls its date back')
    console.log(`browser machine invalid milestone rollback ${invalidBeforeDate} -> ${invalidAfterDate}`)
    page = await reopenProjectInContext(page, errors, 'X6877-D8400_H991')
    await selectView(page, '竖版表格')
    await page.waitForSelector(table, { timeout: TIMEOUT })
    assert.ok((await textOf(page, table)).includes('MR4'), `milestone ${before} survives same-context new-page persistence`)
    assert.equal(await flatMilestoneDate(page, table, draggedMilestoneName), afterDate, 'machine milestone drag survives same-context new-page persistence')
    console.log(`browser machine milestone date after reopening ${afterDate}`)
    console.log('browser machine MR4 persisted after reopening')

  })

  if (!ONLY_CASE || ONLY_CASE === 'all' || ONLY_CASE === 'machine') await runCase(browser, 'machine permission, history and compare', async page => {
    await enterProject(page, 'X6877-D8400_H991')
    await selectView(page, '竖版表格')
    await switchUser(page, '孙七')
    assert.equal(await page.$('button[aria-label="添加上市阶段 MR 里程碑"]'), null, 'view-only user cannot add MR')
    await selectView(page, '甘特图')
    assert.equal(await page.$('.gantt_task_line.pms-gantt-task-editable'), null, 'view-only gantt is fully locked')
    await switchUser(page, '张三')
    await selectView(page, '竖版表格')
    await chooseVersion(page, 'V3 (已发布)')
    assert.equal(await page.$('button[aria-label="添加上市阶段 MR 里程碑"]'), null, 'published history has no MR command')
    await selectView(page, '甘特图')
    await page.waitForSelector('.gantt_task_line', { timeout: TIMEOUT })
    assert.equal(await page.$('.gantt_task_line.pms-gantt-task-editable'), null, 'published history has no editable gantt tasks')
    await pressAriaButton(page, '版本对比')
    await page.waitForSelector('.ant-modal-wrap:not(.ant-modal-wrap-hidden) .ant-modal', { timeout: TIMEOUT })
    await chooseSelectOption(page, '基准版本', 'V2')
    await chooseSelectOption(page, '对比版本', 'V3')
    await clickButtonText(page, '开始对比')
    await page.waitForSelector('.ant-modal-wrap:not(.ant-modal-wrap-hidden) .ant-table', { timeout: TIMEOUT })
    const compareHeaders = await headers(page, '.ant-modal-wrap:not(.ant-modal-wrap-hidden) .ant-table')
    assert.ok(compareHeaders.includes('阶段') && compareHeaders.includes('里程碑点'), 'machine compare exposes stage and milestone columns')
  })

  if (!ONLY_CASE || ONLY_CASE === 'all' || ONLY_CASE === 'tos') await runCase(browser, 'tOS flat contract', async (initialPage, errors) => {
    let page = initialPage
    await enterProject(page, 'tOS16.1')
    await selectView(page, '竖版表格')
    const table = '.pms-level1-flat-milestone-table'
    await page.waitForSelector(table, { timeout: TIMEOUT })
    await assertHeaders(page, table, ['序号', '阶段', '里程碑点', '状态', '计划完成时间', '计划开发周期', '实际完成时间', '实际开发周期'])
    assert.equal(await page.$('button[aria-label="添加上市阶段 MR 里程碑"]'), null, 'tOS does not expose MR insertion')
    assert.equal(await page.$('.ant-table-row-expand-icon'), null, 'tOS flat table has no tree expander')
    const draftSource = await ensureDraft(page)
    console.log(`browser tOS draft source ${draftSource}`)
    const milestoneName = '概念启动'
    const beforeDate = await flatMilestoneDate(page, table, milestoneName)
    await selectView(page, '甘特图')
    assert.ok(await page.$('.gantt_task_line.pms-gantt-project.pms-gantt-task-readonly'), 'tOS stages are locked')
    const milestoneId = await ganttTaskIdForName(page, milestoneName)
    assert.ok(milestoneId, 'tOS dated milestone has a public DHTMLX task_id')
    const milestone = `.gantt_task_line.pms-gantt-milestone.pms-gantt-task-editable[task_id="${milestoneId}"]`
    assert.ok(await page.$(milestone), 'tOS draft milestone is editable while stages remain locked')
    await dragTask(page, milestone, 24)
    await selectView(page, '竖版表格')
    const afterDate = await flatMilestoneDate(page, table, milestoneName)
    assert.notEqual(afterDate, beforeDate, 'tOS milestone drag writes a new date')
    console.log(`browser tOS milestone date ${beforeDate} -> ${afterDate}`)
    page = await reopenProjectInContext(page, errors, 'tOS16.1')
    await selectView(page, '竖版表格')
    assert.equal(await flatMilestoneDate(page, table, milestoneName), afterDate, 'tOS milestone drag survives same-context new-page persistence')
  })

  if (!ONLY_CASE || ONLY_CASE === 'all' || ONLY_CASE === 'technical') await runCase(browser, 'technical TDT and subproject contracts', async (initialPage, errors) => {
    let page = initialPage
    await enterProject(page, 'AIOS架构演进V3')
    await page.waitForFunction(() => document.body.innerText.includes('TDT项目计划'), { timeout: TIMEOUT })
    await selectView(page, '竖版表格')
    const tdt = '.technical-plan-vertical-table'
    await page.waitForSelector(tdt, { timeout: TIMEOUT })
    await assertHeaders(page, tdt, ['序号', '阶段', '里程碑点', '状态', '计划完成时间', '计划开发周期', '实际完成时间', '实际开发周期'])
    assert.equal(await page.$('button[aria-label="添加转测版本"]'), null, 'TDT has no transfer insertion')
    assert.equal(await ensureDraft(page), 'created', 'TDT creates a draft for milestone editing')
    const tdtMilestoneName = 'TDR1'
    const tdtBeforeDate = await flatMilestoneDate(page, tdt, tdtMilestoneName)
    assert.ok(tdtBeforeDate, 'TDT milestone has a date before gantt drag')
    await selectView(page, '甘特图')
    assert.ok(await page.$('.gantt_task_line.pms-gantt-project.pms-gantt-task-readonly'), 'TDT stages are locked')
    assert.ok(await page.$('.gantt_task_line.pms-gantt-milestone.pms-gantt-task-editable'), 'TDT draft milestones are editable')
    const tdtMilestoneId = await ganttTaskIdForName(page, tdtMilestoneName)
    assert.ok(tdtMilestoneId, 'TDT milestone has a public DHTMLX task_id')
    const tdtMilestone = `.gantt_task_line.pms-gantt-milestone.pms-gantt-task-editable[task_id="${tdtMilestoneId}"]`
    // TDR1 starts at its parent stage's end boundary, so moving it forward
    // would deliberately exercise the separately-covered parent-range reject.
    await dragTask(page, tdtMilestone, -24)
    await selectView(page, '竖版表格')
    const tdtAfterDate = await flatMilestoneDate(page, tdt, tdtMilestoneName)
    assert.notEqual(tdtAfterDate, tdtBeforeDate, 'TDT milestone drag writes a changed date')
    console.log(`browser TDT milestone date ${tdtBeforeDate} -> ${tdtAfterDate}`)
    await pressAriaButton(page, '版本对比')
    await page.waitForSelector('.ant-modal-wrap:not(.ant-modal-wrap-hidden) .ant-modal', { timeout: TIMEOUT })
    await chooseSelectOption(page, '基准版本', 'V1')
    await chooseSelectOption(page, '对比版本', 'V2')
    await clickButtonText(page, '开始对比')
    await page.waitForSelector('.ant-modal-wrap:not(.ant-modal-wrap-hidden) .ant-table', { timeout: TIMEOUT })
    const tdtCompareHeaders = await headers(page, '.ant-modal-wrap:not(.ant-modal-wrap-hidden) .ant-table')
    assert.ok(tdtCompareHeaders.includes('阶段') && tdtCompareHeaders.includes('里程碑点'), 'TDT compare exposes stage and milestone columns')
    await pressAriaButton(page, 'Close')

    page = await reopenProjectInContext(page, errors, 'AIOS架构演进V3')
    await selectView(page, '竖版表格')
    assert.equal(await flatMilestoneDate(page, tdt, tdtMilestoneName), tdtAfterDate, 'TDT milestone drag survives same-context new-page persistence')

    await clickTabContaining(page, '分布式服务框架计划')
    await selectView(page, '竖版表格')
    await page.waitForSelector(tdt, { timeout: TIMEOUT })
    await assertHeaders(page, tdt, ['序号', '活动名称', '状态', '计划开始时间', '计划完成时间', '计划周期', '实际开始时间', '实际完成时间', '实际周期'])
    assert.ok(!(await headers(page, tdt)).includes('阶段'), 'subproject has no stage column')
    assert.ok(await createFormalRevision(page), 'subproject can create a draft')
    await page.waitForSelector('button[aria-label="添加转测版本"]', { timeout: TIMEOUT })
    await pressAriaButton(page, '添加转测版本')
    await page.waitForFunction(() => document.body.innerText.includes('确认添加转测版本？'), { timeout: TIMEOUT })
    await clickButtonText(page, '确认添加')
    await page.waitForFunction(() => document.body.innerText.includes('第3版转测'), { timeout: TIMEOUT })
    assert.ok(await page.$('button[aria-label="删除活动 第3版转测"]'), 'custom transfer can be deleted')
    assert.equal(await page.$('button[aria-label="删除活动 第1版转测"]'), null, 'template transfer cannot be deleted')
    await selectView(page, '甘特图')
    assert.ok(await page.$('.gantt_task_line.pms-gantt-task-editable'), 'draft subproject task is editable in gantt')
    const taskName = '第1版转测'
    const taskId = await ganttTaskIdForName(page, taskName)
    assert.ok(taskId, 'subproject task has a public DHTMLX task_id')
    const task = `.gantt_task_line.pms-gantt-task-editable[task_id="${taskId}"]`
    await selectView(page, '竖版表格')
    const beforeMove = await taskDates(page, tdt, taskName)
    assert.ok(beforeMove?.planStart && beforeMove.planEnd, `subproject task has plan start/end before gantt edits: ${JSON.stringify(beforeMove)}`)
    console.log(`browser subproject dates before move ${JSON.stringify(beforeMove)}`)
    await selectView(page, '甘特图')
    await dragTask(page, task, 26)
    await selectView(page, '竖版表格')
    const afterMove = await taskDates(page, tdt, taskName)
    assert.notDeepEqual(afterMove, beforeMove, 'subproject task move writes planned dates')
    console.log(`browser subproject dates after move ${JSON.stringify(afterMove)}`)
    await selectView(page, '甘特图')
    await resizeTaskEnd(page, task, 26)
    await selectView(page, '竖版表格')
    const afterResize = await taskDates(page, tdt, taskName)
    assert.equal(afterResize?.planStart, afterMove?.planStart, 'resize keeps the task planned start')
    assert.notEqual(afterResize?.planEnd, afterMove?.planEnd, 'resize writes the task planned end')
    console.log(`browser subproject dates after resize ${JSON.stringify(afterResize)}`)
    await pressAriaButton(page, '版本对比')
    await page.waitForSelector('.ant-modal-wrap:not(.ant-modal-wrap-hidden) .ant-modal', { timeout: TIMEOUT })
    await chooseSelectOption(page, '基准版本', 'V1')
    await chooseSelectOption(page, '对比版本', 'V2')
    await clickButtonText(page, '开始对比')
    await page.waitForSelector('.ant-modal-wrap:not(.ant-modal-wrap-hidden) .ant-table', { timeout: TIMEOUT })
    const subprojectCompareHeaders = await headers(page, '.ant-modal-wrap:not(.ant-modal-wrap-hidden) .ant-table')
    assert.ok(subprojectCompareHeaders.includes('活动名称') && subprojectCompareHeaders.includes('计划开始') && subprojectCompareHeaders.includes('实际开始'), `subproject compare exposes activity and planned/actual start columns: ${JSON.stringify(subprojectCompareHeaders)}`)
    await pressAriaButton(page, 'Close')
    page = await reopenProjectInContext(page, errors, 'AIOS架构演进V3', '分布式服务框架计划')
    await selectView(page, '竖版表格')
    await page.waitForSelector(tdt, { timeout: TIMEOUT })
    assert.ok((await textOf(page, tdt)).includes('第3版转测'), 'subproject custom transfer survives same-context new-page persistence')
    const persistedDates = await taskDates(page, tdt, taskName)
    assert.deepEqual(persistedDates, afterResize, 'subproject move and resize survive same-context new-page persistence')
    console.log(`browser subproject dates after reopening ${JSON.stringify(persistedDates)}`)
  })

  console.log(`PASS level1 flat milestone gantt browser matrix (${BASE_URL})`)
} catch (error) {
  console.error(`FAIL level1 flat milestone gantt browser matrix\n${error.stack || error}`)
  process.exitCode = 1
} finally {
  await browser.close()
}
