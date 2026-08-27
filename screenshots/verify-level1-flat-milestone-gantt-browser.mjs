#!/usr/bin/env node
/**
 * Real-browser acceptance for hierarchical machine/tOS level-one plans and
 * the unchanged technical-plan contract. This intentionally uses the public UI only; every scenario gets
 * a fresh browser context so persisted drafts cannot hide regressions.
 */
import assert from 'node:assert/strict'
import puppeteer from 'puppeteer'

const BASE_URL = process.env.PMS_BASE_URL || 'http://127.0.0.1:3004'
const TIMEOUT = Number(process.env.PMS_BROWSER_TIMEOUT || 30_000)
const ONLY_CASE = process.env.PMS_BROWSER_CASE || ''
const VALID_BROWSER_CASES = new Set(['', 'all', 'machine', 'machine-structure', 'machine-permission', 'tos', 'technical'])
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const isAllowedConsoleMessage = message => {
  const text = message.text()
  const location = message.location()
  return text.includes('Download the React DevTools')
    || location.url?.endsWith('/favicon.ico')
    || /^Warning: \[antd: (Modal|message)\] Static function can not consume context like dynamic theme\. Please use 'App' component instead\.$/.test(text)
}

if (!VALID_BROWSER_CASES.has(ONLY_CASE)) {
  throw new Error(`unknown PMS_BROWSER_CASE=${JSON.stringify(ONLY_CASE)}; expected all, machine, machine-structure, machine-permission, tos, or technical`)
}

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

const clickButtonStartingWith = async (page, prefix) => {
  const box = await page.evaluate(value => {
    const button = [...document.querySelectorAll('button')].find(node => {
      const rect = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
        && node.textContent?.trim().startsWith(value)
    })
    if (!button) return null
    const rect = button.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  }, prefix)
  if (!box) throw new Error(`missing visible button starting with: ${prefix}`)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await wait(220)
}

const clickTabContaining = async (page, text) => {
  const tabBox = await page.evaluate(value => {
    const tab = [...document.querySelectorAll('[role="tab"]')]
      .find(node => node.textContent?.includes(value))
    if (!tab) return null
    const box = tab.getBoundingClientRect()
    return box.width > 0 && box.height > 0
      ? { x: box.x, y: box.y, width: box.width, height: box.height }
      : null
  }, text)
  if (!tabBox) throw new Error(`missing visible tab containing: ${text}`)
  await page.mouse.click(tabBox.x + Math.min(18, tabBox.width / 3), tabBox.y + tabBox.height / 2)
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
  const confirmBox = await page.evaluate(() => {
    const visible = node => {
      const box = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    }
    const dialog = [...document.querySelectorAll('[role="dialog"]')]
      .find(dialog => visible(dialog) && dialog.textContent?.includes('离开确认'))
    const button = [...(dialog?.querySelectorAll('button') || [])]
      .find(button => button.textContent?.trim() === '确认离开')
    if (!button) return null
    const box = button.getBoundingClientRect()
    return { x: box.x, y: box.y, width: box.width, height: box.height }
  })
  if (confirmBox) {
    await page.mouse.click(confirmBox.x + confirmBox.width / 2, confirmBox.y + confirmBox.height / 2)
    await page.waitForFunction(value => [...document.querySelectorAll('[role="tab"]')]
      .some(tab => tab.textContent?.includes(value) && tab.getAttribute('aria-selected') === 'true'), { timeout: TIMEOUT }, text)
  }
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

const clickAriaButton = async (page, label) => {
  const button = await page.$(`button[aria-label="${label}"]`)
  if (!button) throw new Error(`missing enabled button: ${label}`)
  const box = await button.boundingBox()
  if (!box) throw new Error(`hidden button: ${label}`)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await wait(220)
}

const textOf = async (page, selector) => page.$eval(selector, element => element.textContent || '')
const headers = async (page, selector) => page.$$eval(`${selector} th`, nodes => nodes.map(node => node.textContent?.trim()).filter(Boolean))
const assertHeaders = async (page, selector, expected) => assert.deepEqual(await headers(page, selector), expected, `${selector} headers`)
const visibleCompareDialogText = async page => page.evaluate(() => {
  const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => {
    const box = node.getBoundingClientRect()
    const style = getComputedStyle(node)
    return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
      && node.textContent?.includes('历史版本对比')
  })
  return dialog?.textContent || ''
})
const visibleCompareTableText = async page => page.evaluate(() => {
  const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => {
    const box = node.getBoundingClientRect()
    const style = getComputedStyle(node)
    return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
      && node.textContent?.includes('历史版本对比')
  })
  return dialog?.querySelector('.ant-table')?.textContent || ''
})
const visibleCompareHeaders = async page => page.evaluate(() => {
  const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => {
    const box = node.getBoundingClientRect()
    const style = getComputedStyle(node)
    return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
      && node.textContent?.includes('历史版本对比')
  })
  return [...(dialog?.querySelectorAll('.ant-table th') || [])].map(node => node.textContent?.trim()).filter(Boolean)
})
const waitForVisibleCompareDialog = page => page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')].some(node => {
  const box = node.getBoundingClientRect()
  const style = getComputedStyle(node)
  return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    && node.textContent?.includes('历史版本对比')
}), { timeout: TIMEOUT })
const waitForCompareChange = page => page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')].some(node => {
  const box = node.getBoundingClientRect()
  return box.width > 0 && box.height > 0 && node.textContent?.includes('历史版本对比')
    && /[1-9]\d*\s*变更总计/.test(node.textContent || '')
}), { timeout: TIMEOUT })
const waitForDialogToClose = (page, title) => page.waitForFunction(value => ![...document.querySelectorAll('[role="dialog"]')].some(node => {
  const box = node.getBoundingClientRect()
  const style = getComputedStyle(node)
  return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    && node.textContent?.includes(value)
}), { timeout: TIMEOUT }, title)
const assertCompareHasChange = async (page, expectedTaskName) => {
  const content = await visibleCompareDialogText(page)
  assert.match(content, /[1-9]\d*\s*变更总计/, 'version compare reports a nonzero change total')
  assert.ok((await visibleCompareTableText(page)).includes(expectedTaskName), `version compare includes changed task ${expectedTaskName}`)
}
const flatMilestoneDate = async (page, table, name) => page.$eval(table, (element, taskName) => {
  const row = [...element.querySelectorAll('tbody tr')].find(item => item.textContent?.includes(taskName))
  if (!row) return null
  const cells = [...row.querySelectorAll('td')].map(cell => (
    cell.querySelector('input')?.value || cell.textContent?.trim() || ''
  ))
  return cells[4] || null
}, name)
const flatMilestoneCycles = async (page, table, name) => page.$eval(table, (element, taskName) => {
  const row = [...element.querySelectorAll('tbody tr')].find(item => item.textContent?.includes(taskName))
  if (!row) return null
  const cells = [...row.querySelectorAll('td')].map(cell => cell.textContent?.trim() || '')
  return { planned: cells[5] || '', actual: cells[7] || '' }
}, name)
const flatActualEnd = async (page, table, name) => page.$eval(table, (element, taskName) => {
  const row = [...element.querySelectorAll('tbody tr')].find(item => item.textContent?.includes(taskName))
  if (!row) return null
  const cell = row.querySelectorAll('td')[6]
  return cell?.querySelector('input')?.value || cell?.textContent?.trim() || null
}, name)
const treeDate = async (page, table, name, field) => page.$eval(table, (element, { taskName, fieldName }) => {
  const row = [...element.querySelectorAll('tbody tr')].find(item => item.textContent?.includes(taskName))
  const cell = row?.querySelector(`td[data-field="${fieldName}"]`)
  return cell?.querySelector('input')?.value || cell?.textContent?.trim() || null
}, { taskName: name, fieldName: field })
const editTreeDate = async (page, table, taskName, field, nextValue) => {
  const inputBox = await page.evaluate(({ selector, name, fieldName }) => {
    const root = document.querySelector(selector)
    const row = [...(root?.querySelectorAll('tbody tr') || [])].find(item => item.textContent?.includes(name))
    const input = row?.querySelector(`td[data-field="${fieldName}"] input`)
    if (!input) return null
    const box = input.getBoundingClientRect()
    return { x: box.x, y: box.y, width: box.width, height: box.height }
  }, { selector: table, name: taskName, fieldName: field })
  if (!inputBox) throw new Error(`missing editable ${field} DatePicker for ${taskName}`)
  await page.mouse.click(inputBox.x + inputBox.width / 2, inputBox.y + inputBox.height / 2, { clickCount: 3 })
  await page.keyboard.down('Control')
  await page.keyboard.press('A')
  await page.keyboard.up('Control')
  await page.keyboard.type(nextValue)
  await page.keyboard.press('Enter')
  await page.waitForFunction(({ selector, name, fieldName, value }) => {
    const root = document.querySelector(selector)
    const row = [...(root?.querySelectorAll('tbody tr') || [])].find(item => item.textContent?.includes(name))
    return row?.querySelector(`td[data-field="${fieldName}"] input`)?.value === value
  }, { timeout: TIMEOUT }, { selector: table, name: taskName, fieldName: field, value: nextValue })
}
const collapseTreeStage = async (page, table, stageName) => {
  const collapsed = await page.$eval(table, (root, name) => {
    const row = [...root.querySelectorAll('tbody tr')].find(item => item.querySelectorAll('td')[1]?.textContent?.trim() === name)
    const control = row?.querySelector('.ant-table-row-expand-icon-expanded')
    if (!(control instanceof HTMLElement)) return false
    control.click()
    return true
  }, stageName)
  if (!collapsed) throw new Error(`missing expanded tree stage ${stageName}`)
  await wait(120)
}
const addIsoDays = (value, days) => {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
const taskDates = async (page, table, name) => page.$eval(table, (element, taskName) => {
  const row = [...element.querySelectorAll('tbody tr')].find(item => item.textContent?.includes(taskName))
  if (!row) return null
  const cells = [...row.querySelectorAll('td')].map(cell => (
    cell.querySelector('input')?.value || cell.textContent?.trim() || ''
  ))
  return { planStart: cells[3] || null, planEnd: cells[4] || null }
}, name)
const editFlatActualEnd = async (page, table, taskName, nextValue) => {
  const opened = await page.$eval(table, (element, { taskName, nextValue }) => {
    const row = [...element.querySelectorAll('tbody tr')].find(item => item.textContent?.includes(taskName))
    const cell = row?.querySelectorAll('td')[6]
    const editor = cell?.querySelector('div')
    editor?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, view: window }))
    return Boolean(editor)
  }, { taskName, nextValue })
  if (!opened) throw new Error(`missing latest-published actual completion editor for ${taskName}`)
  await page.waitForSelector('.ant-picker:not(.ant-picker-disabled) input', { timeout: TIMEOUT })
  const inputBox = await page.evaluate(() => {
    const input = [...document.querySelectorAll('.ant-picker:not(.ant-picker-disabled) input')]
      .find(node => {
        const box = node.getBoundingClientRect()
        return box.width > 0 && box.height > 0
      })
    if (!input) return null
    const box = input.getBoundingClientRect()
    return { x: box.x, y: box.y, width: box.width, height: box.height }
  })
  if (!inputBox) throw new Error(`missing visible actual completion DatePicker input for ${taskName}`)
  await page.mouse.click(inputBox.x + inputBox.width / 2, inputBox.y + inputBox.height / 2)
  await page.waitForSelector(`.ant-picker-dropdown:not(.ant-picker-dropdown-hidden) td[title="${nextValue}"]:not(.ant-picker-cell-disabled) .ant-picker-cell-inner`, { timeout: TIMEOUT })
  const clickedDay = await page.evaluate(value => {
    const day = document.querySelector(`.ant-picker-dropdown:not(.ant-picker-dropdown-hidden) td[title="${value}"]:not(.ant-picker-cell-disabled) .ant-picker-cell-inner`)
    if (!(day instanceof HTMLElement)) return false
    // AntD delegates DatePicker selection from the public calendar cell. This
    // avoids a transient duplicate animation layer with no pointer geometry.
    day.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, view: window }))
    return true
  }, nextValue)
  if (!clickedDay) throw new Error(`missing visible DatePicker day ${nextValue}`)
  await page.waitForFunction(({ table, taskName, nextValue }) => {
    const row = [...document.querySelectorAll(`${table} tbody tr`)].find(item => item.textContent?.includes(taskName))
    return row?.querySelectorAll('td')[6]?.textContent?.includes(nextValue)
  }, { timeout: TIMEOUT }, { table, taskName, nextValue })
}
const ganttTaskIdForName = async (page, name) => {
  const findVisibleTask = () => page.$$eval('.gantt_row[task_id]', (rows, taskName) => {
    const viewport = document.querySelector('.gantt_grid_data')?.getBoundingClientRect()
    const row = rows.find(item => {
      if (!item.textContent?.includes(taskName)) return false
      if (!viewport) return true
      const box = item.getBoundingClientRect()
      return box.bottom > viewport.top && box.top < viewport.bottom
    })
    return row?.getAttribute('task_id') || null
  }, name)
  const visibleTaskId = await findVisibleTask()
  if (visibleTaskId) return visibleTaskId
  const scrolled = await page.evaluate(() => {
    const scrollbar = document.querySelector('.gantt_ver_scroll')
    if (!(scrollbar instanceof HTMLElement)) return false
    scrollbar.scrollTop = scrollbar.scrollHeight
    scrollbar.dispatchEvent(new Event('scroll', { bubbles: true }))
    return true
  })
  if (!scrolled) throw new Error(`missing public gantt vertical scrollbar for ${name}`)
  await wait(300)
  return findVisibleTask()
}
const scrollGanttToEnd = async page => {
  const scrolled = await page.evaluate(() => {
    const scrollbar = document.querySelector('.gantt_hor_scroll')
    if (!(scrollbar instanceof HTMLElement)) return false
    scrollbar.scrollLeft = scrollbar.scrollWidth
    scrollbar.dispatchEvent(new Event('scroll', { bubbles: true }))
    return true
  })
  if (!scrolled) throw new Error('missing public gantt horizontal scrollbar')
  await wait(300)
}
const selectGanttScale = async (page, label) => {
  await clickExact(page, label, 'label')
  await page.waitForFunction(value => [...document.querySelectorAll('.ant-radio-button-wrapper-checked')]
    .some(node => node.textContent?.trim() === value), { timeout: TIMEOUT }, label)
  await wait(300)
}

const chooseSelectOption = async (page, ariaLabel, matching, attempt = 0) => {
  const currentText = await page.evaluate(label => {
    const control = [...document.querySelectorAll(`[aria-label="${label}"]`)].find(node => {
      const box = node.getBoundingClientRect()
      return box.width > 0 && box.height > 0
    })
    return control?.closest('.ant-select')?.textContent?.trim() || ''
  }, ariaLabel)
  if (currentText.includes(matching)) return
  const focused = await page.evaluate(label => {
    const control = [...document.querySelectorAll(`[aria-label="${label}"]`)].find(node => {
      const box = node.getBoundingClientRect()
      return box.width > 0 && box.height > 0
    })
    if (!(control instanceof HTMLElement)) return false
    control.focus()
    return document.activeElement === control
  }, ariaLabel)
  if (!focused) throw new Error(`missing select: ${ariaLabel}`)
  await page.keyboard.press('Enter')
  const dropdownId = await page.waitForFunction(label => {
    const control = [...document.querySelectorAll(`[aria-label="${label}"]`)].find(node => {
      const box = node.getBoundingClientRect()
      return box.width > 0 && box.height > 0
    })
    return control?.getAttribute('aria-controls') || null
  }, { timeout: TIMEOUT }, ariaLabel).then(handle => handle.jsonValue())
  await page.waitForFunction(id => {
    const dropdown = document.getElementById(id)?.closest('.ant-select-dropdown')
    if (!dropdown) return false
    const box = dropdown.getBoundingClientRect()
    const style = getComputedStyle(dropdown)
    return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
  }, { timeout: TIMEOUT }, dropdownId)
  const optionBox = await page.evaluate(({ id, value }) => {
    const dropdown = document.getElementById(id)?.closest('.ant-select-dropdown')
    const option = [...(dropdown?.querySelectorAll('.ant-select-item-option') || [])]
      .find(item => {
        const box = item.getBoundingClientRect()
        return box.width > 0 && box.height > 0 && item.textContent?.toLowerCase().includes(value.toLowerCase())
      })
    if (!option) return null
    const box = option.getBoundingClientRect()
    return { x: box.x, y: box.y, width: box.width, height: box.height }
  }, { id: dropdownId, value: matching })
  if (!optionBox) {
    const diagnostic = await page.evaluate(({ id, label }) => {
      const control = document.querySelector(`[aria-label="${label}"]`)
      const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => {
        const box = node.getBoundingClientRect()
        return box.width > 0 && box.height > 0
      })
      return {
        id,
        controlText: control?.closest('.ant-select')?.textContent?.trim() || '',
        listText: document.getElementById(id)?.textContent?.trim() || '',
        dialogText: dialog?.textContent?.trim() || '',
      }
    }, { id: dropdownId, label: ariaLabel })
    throw new Error(`missing ${ariaLabel} option: ${matching}; DOM=${JSON.stringify(diagnostic)}`)
  }
  await page.mouse.click(optionBox.x + optionBox.width / 2, optionBox.y + optionBox.height / 2)
  await wait(300)
  const selectedText = await page.evaluate(label => {
    const control = [...document.querySelectorAll(`[aria-label="${label}"]`)].find(node => {
      const box = node.getBoundingClientRect()
      return box.width > 0 && box.height > 0
    })
    return control?.closest('.ant-select')?.textContent?.trim() || ''
  }, ariaLabel)
  if (!selectedText.includes(matching) && attempt < 1) {
    await page.keyboard.press('Escape')
    await wait(250)
    return chooseSelectOption(page, ariaLabel, matching, attempt + 1)
  }
  assert.ok(selectedText.includes(matching), `${ariaLabel} selection is ${JSON.stringify(selectedText)}, expected ${matching}`)
}

const chooseVersion = async (page, matching) => {
  await chooseSelectOption(page, '计划版本', matching)
  const selected = await page.$eval('[aria-label="计划版本"]', control => control.closest('.ant-select')?.textContent?.trim() || '')
  assert.ok(selected.includes(matching), `plan version selection is ${JSON.stringify(selected)}, expected ${matching}`)
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
  const category = project.startsWith('tOS') ? 'tOS版本项目'
    : project === 'AIOS架构演进V3' ? '技术项目'
      : null
  if (category) await clickButtonStartingWith(page, category)
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
  console.log(`browser entered project space for ${project}`)
  await clickRoleText(page, 'menuitem', '计划')
  console.log(`browser opened plan for ${project}`)
  await page.waitForFunction(() => document.body.innerText.includes('一级计划') || document.body.innerText.includes('TDT项目计划'), { timeout: TIMEOUT })
  console.log(`browser plan ready for ${project}`)
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
  }, { timeout: TIMEOUT }, name)
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
  await page.waitForFunction(value => [...document.querySelectorAll('.pms-plan-view-mode-switcher input[aria-label]')]
    .some(node => node.getAttribute('aria-label') === value && node.checked), { timeout: TIMEOUT }, name)
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
  // The header state is committed first; permit the permission-driven React
  // subtree to settle before issuing a fresh CDP DOM query.
  await wait(250)
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
  const hit = await page.evaluate(({ x, y }) => {
    const target = document.elementFromPoint(x, y)
    return {
      taskId: target?.closest('.gantt_task_line')?.getAttribute('task_id') || null,
      className: typeof target?.className === 'string' ? target.className : '',
      tagName: target?.tagName || '',
      text: target?.textContent?.trim().slice(0, 120) || '',
    }
  }, { x: startX, y: startY })
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + dx, startY + dy, { steps: 6 })
  await wait(150)
  const sawDragMove = await page.$eval(selector, node => node.classList.contains('gantt_drag_move'))
  await page.mouse.up()
  await wait(500)
  return { hitTaskId: hit.taskId, hitClassName: hit.className, hitTagName: hit.tagName, hitText: hit.text, sawDragMove }
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
    if (isAllowedConsoleMessage(message)) return
    errors.push(`${message.type()}: ${message.text()}`)
  })
}

let executedCases = 0
const runCase = async (title, test) => {
  executedCases += 1
  console.log(`RUN browser ${title}`)
  const browser = await puppeteer.launch({ headless: 'new', protocolTimeout: Math.max(60_000, TIMEOUT * 2), args: ['--no-sandbox'] })
  try {
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    const errors = []
    attachPageChecks(page, errors)
    try {
      await page.setViewport({ width: 1600, height: 1080 })
      await test(page, errors)
      await wait(350)
      assertNoErrors(errors)
      console.log(`PASS browser ${title}`)
    } finally {
      try {
        await context.close()
      } catch (cleanupError) {
        console.warn(`browser cleanup warning (${title}): ${cleanupError.message}`)
      }
    }
  } finally {
    try {
      await browser.close()
    } catch (cleanupError) {
      console.warn(`browser close warning (${title}): ${cleanupError.message}`)
    }
  }
}

try {
  if (!ONLY_CASE || ONLY_CASE === 'all' || ONLY_CASE === 'machine' || ONLY_CASE === 'machine-structure') await runCase('machine tree table, governed business nodes and mixed gantt', async (initialPage, errors) => {
    let page = initialPage
    await enterProject(page, 'X6877-D8400_H991')
    assert.ok(await page.$('.pms-plan-view-mode-switcher input[aria-label="横版表格"]:checked'), 'machine level-one plan defaults to horizontal view')
    await selectView(page, '竖版表格')
    const table = '.pms-level1-tree-table'
    await page.waitForSelector(table, { timeout: TIMEOUT })
    await assertHeaders(page, table, ['序号', '阶段/节点', '计划开始时间', '计划完成时间', '预估工期', '实际开始时间', '实际完成时间', '实际工期', '是否延期'])
    assert.ok(await page.$(`${table} .ant-table-row-expand-icon`), 'tree table renders real expanders')
    console.log('browser machine tree table contract passed')

    await clickButtonText(page, '添加MR里程碑')
    await page.waitForFunction(() => document.body.innerText.includes('确认添加 MR 里程碑？'), { timeout: TIMEOUT })
    assert.match(await page.$eval('[aria-label="业务父阶段"]', node => node.closest('.ant-select')?.textContent || ''), /上市阶段|生命周期阶段/, 'machine insertion explicitly selects an allowed business parent')
    await clickButtonText(page, '确认添加')
    await page.waitForFunction(() => document.body.innerText.includes('MR4'), { timeout: TIMEOUT })
    await waitForDialogToClose(page, '确认添加 MR 里程碑？')
    assert.ok((await textOf(page, table)).includes('MR4'), 'confirmed MR4 is visible under its selected tree parent')
    assert.ok(await page.$('button[aria-label="删除节点 MR4"]'), 'custom business node has a delete affordance')
    assert.ok(await page.$('button[aria-label="删除节点 概念启动"]'), 'super-admin can discover the fixed-template delete exception')
    console.log('browser machine MR confirmation and structure contract passed')

    await editTreeDate(page, table, 'MR4', 'planStartDate', '2028-01-04')
    await editTreeDate(page, table, 'MR4', 'planEndDate', '2028-01-08')
    assert.deepEqual({
      start: await treeDate(page, table, 'MR4', 'planStartDate'),
      end: await treeDate(page, table, 'MR4', 'planEndDate'),
    }, { start: '2028-01-04', end: '2028-01-08' }, 'business period accepts a planned range through public DatePickers')

    const draggedMilestoneName = '概念启动'
    const beforeDate = await treeDate(page, table, draggedMilestoneName, 'planEndDate')
    assert.ok(beforeDate, `${draggedMilestoneName} has a plan completion date before gantt drag`)

    await selectView(page, '甘特图')
    await page.waitForSelector('.gantt_task_line', { timeout: TIMEOUT })
    console.log('browser machine gantt rendered')
    assert.ok(await page.$('.gantt_task_line.pms-gantt-project.pms-gantt-task-readonly'), 'stage is rendered readonly')
    assert.ok(await page.$('.gantt_task_line.pms-gantt-milestone.pms-gantt-task-editable'), 'draft milestone is rendered editable')
    console.log('browser machine gantt readonly/editable class contract passed')
    assertNoErrors(errors)
    const milestoneTaskId = await ganttTaskIdForName(page, draggedMilestoneName)
    assert.ok(milestoneTaskId, `${draggedMilestoneName} has a public DHTMLX task_id`)
    const milestone = `.gantt_task_line.pms-gantt-milestone.pms-gantt-task-editable[task_id="${milestoneTaskId}"]`
    const before = await page.$eval(milestone, node => node.getAttribute('task_id'))
    const validDrag = await dragTask(page, milestone, 24)
    assert.equal(validDrag.hitTaskId, milestoneTaskId, `valid milestone drag starts on the resolved DHTMLX milestone: ${JSON.stringify(validDrag)}`)
    assert.ok(validDrag.sawDragMove, 'valid milestone drag enters DHTMLX move state')
    console.log('browser machine milestone drag completed')
    await selectView(page, '竖版表格')
    const afterDate = await treeDate(page, table, draggedMilestoneName, 'planEndDate')
    assert.match(afterDate || '', /^\d{4}-\d{2}-\d{2}$/, 'milestone drag writes an ISO plan date')
    assert.notEqual(afterDate, beforeDate, `milestone ${before} drag writes a changed plan date to the tree table`)
    console.log(`browser machine milestone date ${beforeDate} -> ${afterDate}`)

    for (const stageName of ['概念阶段', '计划阶段', '开发阶段', '验证阶段']) {
      await collapseTreeStage(page, table, stageName)
    }
    await selectView(page, '甘特图')
    await selectGanttScale(page, '日')
    const businessTaskId = await ganttTaskIdForName(page, 'MR4')
    assert.ok(businessTaskId, 'business period has a public DHTMLX task_id')
    await scrollGanttToEnd(page)
    const business = `.gantt_task_line.pms-gantt-task.pms-gantt-task-editable[task_id="${businessTaskId}"]`
    assert.ok(await page.$(business), 'business period renders as an editable bar')
    const businessMove = await dragTask(page, business, -60)
    assert.equal(businessMove.hitTaskId, businessTaskId, `business drag starts on the resolved DHTMLX bar: ${JSON.stringify(businessMove)}`)
    await selectView(page, '竖版表格')
    const movedBusiness = {
      start: await treeDate(page, table, 'MR4', 'planStartDate'),
      end: await treeDate(page, table, 'MR4', 'planEndDate'),
    }
    assert.notEqual(movedBusiness.start, '2028-01-04', 'business move writes the planned start boundary')
    assert.notEqual(movedBusiness.end, '2028-01-08', 'business move writes the planned completion boundary')
    await selectView(page, '甘特图')
    const resizedBusinessTaskId = await ganttTaskIdForName(page, 'MR4')
    assert.ok(resizedBusinessTaskId, 'moved business period remains in the public gantt grid')
    await scrollGanttToEnd(page)
    await resizeTaskEnd(page, `.gantt_task_line.pms-gantt-task.pms-gantt-task-editable[task_id="${resizedBusinessTaskId}"]`, -60)
    await selectView(page, '竖版表格')
    const resizedBusinessEnd = await treeDate(page, table, 'MR4', 'planEndDate')
    assert.notEqual(resizedBusinessEnd, movedBusiness.end, 'business resize writes a changed planned completion')

    page = await reopenProjectInContext(page, errors, 'X6877-D8400_H991')
    await selectView(page, '竖版表格')
    await page.waitForSelector(table, { timeout: TIMEOUT })
    assert.ok((await textOf(page, table)).includes('MR4'), `business node ${before} survives same-context new-page persistence`)
    assert.equal(await treeDate(page, table, draggedMilestoneName, 'planEndDate'), afterDate, 'machine milestone drag survives same-context new-page persistence')
    assert.equal(await treeDate(page, table, 'MR4', 'planEndDate'), resizedBusinessEnd, 'business resize survives same-context new-page persistence')
    console.log(`browser machine milestone date after reopening ${afterDate}`)
    console.log('browser machine MR4 persisted after reopening')

    const invalidStart = addIsoDays(resizedBusinessEnd, 3)
    await editTreeDate(page, table, 'MR4', 'planStartDate', invalidStart)
    assert.ok(await page.$(`${table} tr[data-row-key^="business-period-"] td[data-field="planStartDate"] .pms-level1-date-input-invalid`), 'invalid business range renders a red DatePicker')
    await pressAriaButton(page, '发布')
    await page.waitForFunction(() => document.body.innerText.includes('任务校验不通过，无法发布'), { timeout: TIMEOUT })
    const focusedInvalid = await page.evaluate(() => ({
      field: document.activeElement?.closest('[data-field]')?.getAttribute('data-field'),
      row: document.activeElement?.closest('tr')?.textContent || '',
    }))
    assert.equal(focusedInvalid.field, 'planStartDate', 'publish focuses the first invalid planned-start field')
    assert.ok(focusedInvalid.row.includes('MR4'), 'publish focus uses the stable MR4 row key')

  })

  if (!ONLY_CASE || ONLY_CASE === 'all' || ONLY_CASE === 'machine' || ONLY_CASE === 'machine-permission') await runCase('machine permission, history and compare', async (initialPage, errors) => {
    let page = initialPage
    await enterProject(page, 'X6877-D8400_H991')
    console.log('browser machine permission entered project')
    await selectView(page, '竖版表格')
    console.log('browser machine permission selected vertical')
    const table = '.pms-level1-tree-table'
    await switchUser(page, '王五')
    console.log('browser machine permission switched to 王五')
    assert.ok(await page.$(table), 'view-only project member can still see the machine tree table')
    assert.ok((await textOf(page, table)).includes('概念启动'), 'view-only project member can see plan rows before permission assertions')
    assert.equal(await page.$('button[aria-label="添加MR里程碑"]'), null, 'view-only user cannot add MR')
    await selectView(page, '甘特图')
    assert.equal(await page.$('.gantt_task_line.pms-gantt-task-editable'), null, 'view-only gantt is fully locked')
    console.log('browser machine permission view-only contract passed')
    await switchUser(page, '赵六')
    await selectView(page, '竖版表格')
    assert.ok(await page.$('button[aria-label="添加MR里程碑"]'), 'project-manager role member receives the SPM business action')
    assert.equal(await page.$('button[aria-label="添加一级阶段"]'), null, 'SPM cannot use the super-admin generic stage action')
    assert.equal(await page.$('button[aria-label="删除节点 概念启动"]'), null, 'SPM cannot delete a fixed template node')
    assert.equal(await page.$('button[aria-label="删除节点 验证阶段"]'), null, 'SPM cannot delete a fixed template stage')
    await switchUser(page, '张三')
    await selectView(page, '竖版表格')
    console.log('browser machine permission switched back to 张三')
    assert.ok(await page.$('button[aria-label="删除节点 概念启动"]'), 'super-admin can delete a fixed template node in a draft')
    assert.ok(await page.$('button[aria-label="删除节点 验证阶段"]'), 'super-admin can delete a fixed template stage in a draft')
    await pressAriaButton(page, '添加一级阶段')
    await page.waitForFunction(() => document.body.innerText.includes('确认添加一级阶段？'), { timeout: TIMEOUT })
    await clickButtonText(page, '确认添加')
    await waitForDialogToClose(page, '确认添加一级阶段？')
    await page.waitForFunction(selector => document.querySelector(selector)?.textContent?.includes('新阶段'), { timeout: TIMEOUT }, table)
    await pressAriaButton(page, '添加子节点 新阶段')
    await page.waitForFunction(() => document.body.innerText.includes('确认添加子节点？'), { timeout: TIMEOUT })
    assert.match(await page.$eval('[aria-label="业务父阶段"]', node => node.closest('.ant-select')?.textContent || ''), /新阶段/, 'generic child confirmation stays bound to the selected custom stage')
    await clickButtonText(page, '确认添加')
    await waitForDialogToClose(page, '确认添加子节点？')
    await page.waitForFunction(selector => document.querySelector(selector)?.textContent?.includes('新子节点'), { timeout: TIMEOUT }, table)
    assert.ok(await page.$('button[aria-label="删除节点 新子节点"]'), 'super-admin generic child is discoverable and deletable')
    await pressAriaButton(page, '删除节点 新子节点')
    await clickButtonText(page, '确认')
    await page.waitForFunction(selector => !document.querySelector(selector)?.textContent?.includes('新子节点'), { timeout: TIMEOUT }, table)
    assert.ok(await page.$('button[aria-label="删除节点 新阶段"]'), 'super-admin custom stage remains deletable after its child is removed')
    await pressAriaButton(page, '删除节点 新阶段')
    await clickButtonText(page, '确认')
    await page.waitForFunction(selector => !document.querySelector(selector)?.textContent?.includes('新阶段'), { timeout: TIMEOUT }, table)
    console.log('browser machine super-admin generic stage/child add-delete contract passed')
    await pressAriaButton(page, '删除节点 概念启动')
    await clickButtonText(page, '确认')
    await page.waitForFunction(selector => !document.querySelector(selector)?.textContent?.includes('概念启动'), { timeout: TIMEOUT }, table)
    await pressAriaButton(page, '删除节点 验证阶段')
    await clickButtonText(page, '确认')
    await page.waitForFunction(selector => {
      const text = document.querySelector(selector)?.textContent || ''
      return !text.includes('验证阶段') && !text.includes('STR5')
    }, { timeout: TIMEOUT }, table)
    page = await reopenProjectInContext(page, errors, 'X6877-D8400_H991')
    await selectView(page, '竖版表格')
    const deletedTemplateText = await textOf(page, table)
    assert.ok(!deletedTemplateText.includes('概念启动') && !deletedTemplateText.includes('验证阶段') && !deletedTemplateText.includes('STR5'), 'super-admin fixed node/stage deletion survives same-context new-page persistence')
    console.log('browser machine super-admin fixed node/stage delete contract passed')
    await chooseVersion(page, 'V2 (已发布)')
    assert.equal(await page.$('button[aria-label="添加MR里程碑"]'), null, 'published history has no MR command')
    await selectView(page, '甘特图')
    await page.waitForSelector('.gantt_task_line', { timeout: TIMEOUT })
    assert.equal(await page.$('.gantt_task_line.pms-gantt-task-editable'), null, 'published history has no editable gantt tasks')
    await selectView(page, '竖版表格')
    const v2ActualBefore = await treeDate(page, table, '概念启动', 'actualEndDate')
    console.log(`browser machine history V2 actual ${v2ActualBefore}`)
    await chooseVersion(page, 'V3 (已发布)')
    console.log('browser machine selected V3 latest published')
    const v3ActualBefore = await treeDate(page, table, '概念启动', 'actualEndDate')
    assert.match(v3ActualBefore || '', /^\d{4}-\d{2}-\d{2}$/, 'latest published actual completion starts as an ISO date before editing')
    const latestActualDate = addIsoDays(v3ActualBefore, 1)
    console.log(`browser machine editing latest actual to ${latestActualDate}`)
    await editTreeDate(page, table, '概念启动', 'actualEndDate', latestActualDate)
    assert.notEqual(latestActualDate, v3ActualBefore, 'latest published actual completion edit chooses a different legal date')
    assert.equal(await treeDate(page, table, '概念启动', 'actualEndDate'), latestActualDate, 'latest published actual completion saves through the public DatePicker')
    console.log(`browser machine latest actual ${v3ActualBefore} -> ${latestActualDate}`)
    page = await reopenProjectInContext(page, errors, 'X6877-D8400_H991')
    await selectView(page, '竖版表格')
    await chooseVersion(page, 'V3 (已发布)')
    assert.equal(await treeDate(page, table, '概念启动', 'actualEndDate'), latestActualDate, 'latest published actual completion survives same-context new-page persistence before comparison')
    await chooseVersion(page, 'V2 (已发布)')
    assert.equal(await treeDate(page, table, '概念启动', 'actualEndDate'), v2ActualBefore, 'older V2 actual completion remains unchanged after editing V3')
    assert.notEqual(v2ActualBefore, latestActualDate, 'published comparison inputs contain a real actual-completion difference')
    await clickAriaButton(page, '版本对比')
    await waitForVisibleCompareDialog(page)
    await chooseSelectOption(page, '基准版本', 'V2')
    assert.match(await page.evaluate(() => [...document.querySelectorAll('[aria-label="对比版本"]')]
      .find(node => node.getBoundingClientRect().width > 0)?.closest('.ant-select')?.textContent || ''), /V3 \(已发布\)/, 'compare target is the latest published V3')
    await clickButtonText(page, '开始对比')
    await waitForCompareChange(page)
    const compareText = await visibleCompareTableText(page)
    const compareDialogText = await visibleCompareDialogText(page)
    assert.match(compareDialogText, /[1-9]\d*\s*变更总计/, 'published comparison reports a nonzero change total')
    assert.ok(compareText.includes('概念启动') && compareText.includes('实际完成'), 'published comparison shows the changed milestone actual completion field')
    await pressAriaButton(page, 'Close')
  })

  if (!ONLY_CASE || ONLY_CASE === 'all' || ONLY_CASE === 'tos') await runCase('tOS tree and business-version contract', async (initialPage, errors) => {
    let page = initialPage
    await enterProject(page, 'tOS16.1')
    assert.ok(await page.$('.pms-plan-view-mode-switcher input[aria-label="横版表格"]:checked'), 'tOS level-one plan defaults to horizontal view')
    await selectView(page, '竖版表格')
    const table = '.pms-level1-tree-table'
    await page.waitForSelector(table, { timeout: TIMEOUT })
    await assertHeaders(page, table, ['序号', '阶段/节点', '计划开始时间', '计划完成时间', '预估工期', '实际开始时间', '实际完成时间', '实际工期', '是否延期'])
    assert.equal(await page.$('button[aria-label="添加MR里程碑"]'), null, 'tOS does not expose MR insertion')
    assert.ok(await page.$(`${table} .ant-table-row-expand-icon`), 'tOS tree table renders real expanders')
    const draftSource = await ensureDraft(page)
    console.log(`browser tOS draft source ${draftSource}`)
    await page.waitForSelector('button[aria-label="添加tOS版本"]', { timeout: TIMEOUT })
    await pressAriaButton(page, '添加tOS版本')
    await page.waitForFunction(() => document.body.innerText.includes('确认添加 tOS 版本？'), { timeout: TIMEOUT })
    assert.match(await page.$eval('[aria-label="业务父阶段"]', node => node.closest('.ant-select')?.textContent || ''), /上市迭代阶段|维护阶段/, 'tOS insertion explicitly selects an allowed business parent')
    const tosBusinessName = await page.$eval('[aria-label="业务节点名称"]', node => node.value)
    assert.match(tosBusinessName, /^16\.1\.0\.\d{3}$/, 'tOS business version uses the project version prefix')
    await clickButtonText(page, '确认添加')
    await waitForDialogToClose(page, '确认添加 tOS 版本？')
    await page.waitForFunction((selector, taskName) => document.querySelector(selector)?.textContent?.includes(taskName), { timeout: TIMEOUT }, table, tosBusinessName)
    assert.ok(await page.$(`button[aria-label="删除节点 ${tosBusinessName}"]`), 'custom tOS business version has a delete affordance')
    console.log(`browser tOS inserted ${tosBusinessName}`)

    await editTreeDate(page, table, tosBusinessName, 'planStartDate', '2027-05-01')
    await editTreeDate(page, table, tosBusinessName, 'planEndDate', '2027-05-05')
    assert.deepEqual({
      start: await treeDate(page, table, tosBusinessName, 'planStartDate'),
      end: await treeDate(page, table, tosBusinessName, 'planEndDate'),
    }, { start: '2027-05-01', end: '2027-05-05' }, 'tOS business version accepts a planned range through public DatePickers')

    const milestoneName = '概念启动'
    const beforeDate = await treeDate(page, table, milestoneName, 'planEndDate')
    await selectView(page, '甘特图')
    assert.ok(await page.$('.gantt_task_line.pms-gantt-project.pms-gantt-task-readonly'), 'tOS stages are locked')
    const milestoneId = await ganttTaskIdForName(page, milestoneName)
    assert.ok(milestoneId, 'tOS dated milestone has a public DHTMLX task_id')
    const milestone = `.gantt_task_line.pms-gantt-milestone.pms-gantt-task-editable[task_id="${milestoneId}"]`
    assert.ok(await page.$(milestone), 'tOS draft milestone is editable while stages remain locked')
    const tosDrag = await dragTask(page, milestone, -24)
    assert.equal(tosDrag.hitTaskId, milestoneId, `tOS drag starts on the resolved DHTMLX milestone: ${JSON.stringify(tosDrag)}`)
    assert.ok(tosDrag.sawDragMove, 'tOS drag enters DHTMLX move state')
    console.log(`browser tOS drag notices ${JSON.stringify(await page.$$eval('.ant-message-notice-content', nodes => nodes.map(node => node.textContent?.trim() || '')))}`)
    await selectView(page, '竖版表格')
    const afterDate = await treeDate(page, table, milestoneName, 'planEndDate')
    console.log(`browser tOS milestone candidate ${beforeDate} -> ${afterDate}`)
    assert.match(afterDate || '', /^\d{4}-\d{2}-\d{2}$/, 'tOS milestone drag writes an ISO date')
    assert.notEqual(afterDate, beforeDate, 'tOS milestone drag writes a changed date')
    console.log(`browser tOS milestone date ${beforeDate} -> ${afterDate}`)

    for (const stageName of ['规划阶段', '概念阶段', '计划阶段', '开发验证阶段']) {
      await collapseTreeStage(page, table, stageName)
    }
    await selectView(page, '甘特图')
    await selectGanttScale(page, '日')
    const businessTaskId = await ganttTaskIdForName(page, tosBusinessName)
    assert.ok(businessTaskId, 'tOS business version has a public DHTMLX task_id')
    await scrollGanttToEnd(page)
    const business = `.gantt_task_line.pms-gantt-task.pms-gantt-task-editable[task_id="${businessTaskId}"]`
    assert.ok(await page.$(business), 'tOS business version renders as an editable bar')
    const businessMove = await dragTask(page, business, -60)
    assert.equal(businessMove.hitTaskId, businessTaskId, `tOS business drag starts on the resolved DHTMLX bar: ${JSON.stringify(businessMove)}`)
    await selectView(page, '竖版表格')
    const movedBusiness = {
      start: await treeDate(page, table, tosBusinessName, 'planStartDate'),
      end: await treeDate(page, table, tosBusinessName, 'planEndDate'),
    }
    assert.notEqual(movedBusiness.start, '2027-05-01', 'tOS business move writes the planned start boundary')
    assert.notEqual(movedBusiness.end, '2027-05-05', 'tOS business move writes the planned completion boundary')
    await selectView(page, '甘特图')
    const resizedBusinessTaskId = await ganttTaskIdForName(page, tosBusinessName)
    assert.ok(resizedBusinessTaskId, 'moved tOS business version remains in the public gantt grid')
    await scrollGanttToEnd(page)
    await resizeTaskEnd(page, `.gantt_task_line.pms-gantt-task.pms-gantt-task-editable[task_id="${resizedBusinessTaskId}"]`, -60)
    await selectView(page, '竖版表格')
    const resizedBusinessEnd = await treeDate(page, table, tosBusinessName, 'planEndDate')
    assert.notEqual(resizedBusinessEnd, movedBusiness.end, 'tOS business resize writes a changed planned completion')

    page = await reopenProjectInContext(page, errors, 'tOS16.1')
    await selectView(page, '竖版表格')
    assert.equal(await treeDate(page, table, milestoneName, 'planEndDate'), afterDate, 'tOS milestone drag survives same-context new-page persistence')
    assert.ok((await textOf(page, table)).includes(tosBusinessName), 'tOS business version survives same-context new-page persistence')
    assert.equal(await treeDate(page, table, tosBusinessName, 'planEndDate'), resizedBusinessEnd, 'tOS business resize survives same-context new-page persistence')
    console.log(`browser tOS ${tosBusinessName} persisted through ${resizedBusinessEnd}`)
  })

  if (!ONLY_CASE || ONLY_CASE === 'all' || ONLY_CASE === 'technical') await runCase('technical TDT and subproject contracts', async (initialPage, errors) => {
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
    const tdtDrag = await dragTask(page, tdtMilestone, -24)
    assert.equal(tdtDrag.hitTaskId, tdtMilestoneId, `TDT drag starts on the resolved DHTMLX milestone: ${JSON.stringify(tdtDrag)}`)
    assert.ok(tdtDrag.sawDragMove, 'TDT drag enters DHTMLX move state')
    await selectView(page, '竖版表格')
    const tdtAfterDate = await flatMilestoneDate(page, tdt, tdtMilestoneName)
    assert.match(tdtAfterDate || '', /^\d{4}-\d{2}-\d{2}$/, 'TDT milestone drag writes an ISO date')
    assert.ok(tdtAfterDate && tdtBeforeDate && tdtAfterDate < tdtBeforeDate, 'TDT backward drag writes an earlier date')
    console.log(`browser TDT milestone date ${tdtBeforeDate} -> ${tdtAfterDate}`)
    await clickAriaButton(page, '版本对比')
    await waitForVisibleCompareDialog(page)
    await chooseSelectOption(page, '基准版本', 'V1')
    await chooseSelectOption(page, '对比版本', 'V2')
    await clickButtonText(page, '开始对比')
    await waitForCompareChange(page)
    const tdtCompareHeaders = await visibleCompareHeaders(page)
    assert.ok(tdtCompareHeaders.includes('阶段') && tdtCompareHeaders.includes('里程碑点'), 'TDT compare exposes stage and milestone columns')
    await assertCompareHasChange(page, tdtMilestoneName)
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
    await waitForDialogToClose(page, '确认添加转测版本？')
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
    const subprojectMove = await dragTask(page, task, 26)
    assert.equal(subprojectMove.hitTaskId, taskId, `subproject move starts on the resolved DHTMLX task: ${JSON.stringify(subprojectMove)}`)
    assert.ok(subprojectMove.sawDragMove, 'subproject move enters DHTMLX move state')
    await selectView(page, '竖版表格')
    const afterMove = await taskDates(page, tdt, taskName)
    assert.ok(afterMove?.planStart && beforeMove.planStart && afterMove.planStart > beforeMove.planStart, 'subproject forward move writes a later planned start')
    assert.ok(afterMove?.planEnd && beforeMove.planEnd && afterMove.planEnd > beforeMove.planEnd, 'subproject forward move writes a later planned end')
    console.log(`browser subproject dates after move ${JSON.stringify(afterMove)}`)
    await selectView(page, '甘特图')
    await resizeTaskEnd(page, task, 26)
    await selectView(page, '竖版表格')
    const afterResize = await taskDates(page, tdt, taskName)
    assert.equal(afterResize?.planStart, afterMove?.planStart, 'resize keeps the task planned start')
    assert.notEqual(afterResize?.planEnd, afterMove?.planEnd, 'resize writes the task planned end')
    console.log(`browser subproject dates after resize ${JSON.stringify(afterResize)}`)
    await clickAriaButton(page, '版本对比')
    await waitForVisibleCompareDialog(page)
    await chooseSelectOption(page, '基准版本', 'V1')
    await chooseSelectOption(page, '对比版本', 'V2')
    await clickButtonText(page, '开始对比')
    await waitForCompareChange(page)
    const subprojectCompareHeaders = await visibleCompareHeaders(page)
    assert.ok(subprojectCompareHeaders.includes('活动名称') && subprojectCompareHeaders.includes('计划开始') && subprojectCompareHeaders.includes('实际开始'), `subproject compare exposes activity and planned/actual start columns: ${JSON.stringify(subprojectCompareHeaders)}`)
    await assertCompareHasChange(page, taskName)
    await pressAriaButton(page, 'Close')
    page = await reopenProjectInContext(page, errors, 'AIOS架构演进V3', '分布式服务框架计划')
    await selectView(page, '竖版表格')
    await page.waitForSelector(tdt, { timeout: TIMEOUT })
    assert.ok((await textOf(page, tdt)).includes('第3版转测'), 'subproject custom transfer survives same-context new-page persistence')
    const persistedDates = await taskDates(page, tdt, taskName)
    assert.deepEqual(persistedDates, afterResize, 'subproject move and resize survive same-context new-page persistence')
    console.log(`browser subproject dates after reopening ${JSON.stringify(persistedDates)}`)
  })

  assert.ok(executedCases > 0, `browser matrix executed no cases for PMS_BROWSER_CASE=${JSON.stringify(ONLY_CASE)}`)
  console.log(`PASS level1 flat milestone gantt browser matrix (${BASE_URL})`)
} catch (error) {
  console.error(`FAIL level1 flat milestone gantt browser matrix\n${error.stack || error}`)
  process.exitCode = 1
}
