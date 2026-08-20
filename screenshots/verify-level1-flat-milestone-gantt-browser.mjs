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
const flatActualEnd = async (page, table, name) => page.$eval(table, (element, taskName) => {
  const row = [...element.querySelectorAll('tbody tr')].find(item => item.textContent?.includes(taskName))
  if (!row) return null
  const cell = row.querySelectorAll('td')[6]
  return cell?.querySelector('input')?.value || cell?.textContent?.trim() || null
}, name)
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
const ganttTaskIdForName = async (page, name) => page.$$eval('.gantt_row[task_id]', (rows, taskName) => {
  const row = rows.find(item => item.textContent?.includes(taskName))
  return row?.getAttribute('task_id') || null
}, name)

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
  await page.mouse.move(startX + dx, startY + dy, { steps: 2 })
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
  if (!ONLY_CASE || ONLY_CASE === 'all' || ONLY_CASE === 'machine' || ONLY_CASE === 'machine-structure') await runCase('machine flat table, guarded MR, history, permission, compare', async (initialPage, errors) => {
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
    await waitForDialogToClose(page, '确认添加上市阶段 MR 里程碑？')
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
    const afterDate = await flatMilestoneDate(page, table, draggedMilestoneName)
    assert.match(afterDate || '', /^\d{4}-\d{2}-\d{2}$/, 'milestone drag writes an ISO plan date')
    assert.ok(afterDate && beforeDate && afterDate > beforeDate, `milestone ${before} forward drag writes a later plan date to the flat table`)
    console.log(`browser machine milestone date ${beforeDate} -> ${afterDate}`)
    const invalidMilestoneName = 'STR1'
    const invalidBeforeDate = await flatMilestoneDate(page, table, invalidMilestoneName)
    await selectView(page, '甘特图')
    const invalidTaskId = await ganttTaskIdForName(page, invalidMilestoneName)
    assert.ok(invalidBeforeDate && invalidTaskId, 'STR1 has a dated public gantt task for rollback coverage')
    const invalidMilestone = `.gantt_task_line.pms-gantt-milestone.pms-gantt-task-editable[task_id="${invalidTaskId}"]`
    const priorMilestone = `.gantt_task_line.pms-gantt-milestone.pms-gantt-task-editable[task_id="${milestoneTaskId}"]`
    const priorX = await page.$eval(priorMilestone, node => node.getBoundingClientRect().x)
    const invalidX = await page.$eval(invalidMilestone, node => node.getBoundingClientRect().x)
    const invalidDrag = await dragTask(page, invalidMilestone, priorX - invalidX - 10)
    assert.equal(invalidDrag.hitTaskId, invalidTaskId, 'invalid drag starts on the resolved STR1 milestone')
    const invalidToast = await page.waitForFunction(expected => [...document.querySelectorAll('.ant-message-notice-error .ant-message-notice-content')]
      .map(node => node.textContent?.trim() || '').find(text => text === expected) || null,
    { timeout: TIMEOUT }, `计划完成时间必须晚于上一节点“概念启动”的${afterDate}`)
    assert.equal(await invalidToast.jsonValue(), `计划完成时间必须晚于上一节点“概念启动”的${afterDate}`, 'invalid STR1 drag shows the exact sequence-validation toast')
    const rolledBackX = await page.$eval(invalidMilestone, node => node.getBoundingClientRect().x)
    assert.ok(Math.abs(rolledBackX - invalidX) < 1, 'invalid STR1 drag returns the gantt diamond to its original x position')
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

  if (!ONLY_CASE || ONLY_CASE === 'all' || ONLY_CASE === 'machine' || ONLY_CASE === 'machine-permission') await runCase('machine permission, history and compare', async (initialPage, errors) => {
    let page = initialPage
    await enterProject(page, 'X6877-D8400_H991')
    console.log('browser machine permission entered project')
    await selectView(page, '竖版表格')
    console.log('browser machine permission selected vertical')
    const table = '.pms-level1-flat-milestone-table'
    await switchUser(page, '王五')
    console.log('browser machine permission switched to 王五')
    assert.ok(await page.$(table), 'view-only project member can still see the machine flat table')
    assert.ok((await textOf(page, table)).includes('概念启动'), 'view-only project member can see plan rows before permission assertions')
    assert.equal(await page.$('button[aria-label="添加上市阶段 MR 里程碑"]'), null, 'view-only user cannot add MR')
    await selectView(page, '甘特图')
    assert.equal(await page.$('.gantt_task_line.pms-gantt-task-editable'), null, 'view-only gantt is fully locked')
    console.log('browser machine permission view-only contract passed')
    await switchUser(page, '张三')
    await selectView(page, '竖版表格')
    console.log('browser machine permission switched back to 张三')
    await chooseVersion(page, 'V2 (已发布)')
    assert.equal(await page.$('button[aria-label="添加上市阶段 MR 里程碑"]'), null, 'published history has no MR command')
    await selectView(page, '甘特图')
    await page.waitForSelector('.gantt_task_line', { timeout: TIMEOUT })
    assert.equal(await page.$('.gantt_task_line.pms-gantt-task-editable'), null, 'published history has no editable gantt tasks')
    await selectView(page, '竖版表格')
    const v2ActualBefore = await flatActualEnd(page, table, '概念启动')
    console.log(`browser machine history V2 actual ${v2ActualBefore}`)
    await chooseVersion(page, 'V3 (已发布)')
    console.log('browser machine selected V3 latest published')
    const v3ActualBefore = await flatActualEnd(page, table, '概念启动')
    assert.match(v3ActualBefore || '', /^\d{4}-\d{2}-\d{2}$/, 'latest published actual completion starts as an ISO date before editing')
    const latestActualDate = addIsoDays(v3ActualBefore, 1)
    console.log(`browser machine editing latest actual to ${latestActualDate}`)
    await editFlatActualEnd(page, table, '概念启动', latestActualDate)
    assert.notEqual(latestActualDate, v3ActualBefore, 'latest published actual completion edit chooses a different legal date')
    assert.equal(await flatActualEnd(page, table, '概念启动'), latestActualDate, 'latest published actual completion saves through the public DatePicker')
    console.log(`browser machine latest actual ${v3ActualBefore} -> ${latestActualDate}`)
    page = await reopenProjectInContext(page, errors, 'X6877-D8400_H991')
    await selectView(page, '竖版表格')
    await chooseVersion(page, 'V3 (已发布)')
    assert.equal(await flatActualEnd(page, table, '概念启动'), latestActualDate, 'latest published actual completion survives same-context new-page persistence before comparison')
    await chooseVersion(page, 'V2 (已发布)')
    assert.equal(await flatActualEnd(page, table, '概念启动'), v2ActualBefore, 'older V2 actual completion remains unchanged after editing V3')
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

  if (!ONLY_CASE || ONLY_CASE === 'all' || ONLY_CASE === 'tos') await runCase('tOS flat contract', async (initialPage, errors) => {
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
    const tosDrag = await dragTask(page, milestone, 24)
    assert.equal(tosDrag.hitTaskId, milestoneId, `tOS drag starts on the resolved DHTMLX milestone: ${JSON.stringify(tosDrag)}`)
    assert.ok(tosDrag.sawDragMove, 'tOS drag enters DHTMLX move state')
    await selectView(page, '竖版表格')
    const afterDate = await flatMilestoneDate(page, table, milestoneName)
    assert.match(afterDate || '', /^\d{4}-\d{2}-\d{2}$/, 'tOS milestone drag writes an ISO date')
    assert.ok(afterDate && beforeDate && afterDate > beforeDate, 'tOS forward drag writes a later date')
    console.log(`browser tOS milestone date ${beforeDate} -> ${afterDate}`)
    page = await reopenProjectInContext(page, errors, 'tOS16.1')
    await selectView(page, '竖版表格')
    assert.equal(await flatMilestoneDate(page, table, milestoneName), afterDate, 'tOS milestone drag survives same-context new-page persistence')
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
