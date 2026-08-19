#!/usr/bin/env node

import puppeteer from 'puppeteer'

const BASE_URL = process.env.PMS_BASE_URL || 'http://127.0.0.1:3004'
const TIMEOUT = 30_000
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const allowedWarnings = [
  '[antd: Divider] `type` is deprecated',
  '[antd: Space] `split` is deprecated',
  'Download the React DevTools',
]

const clickExactText = async (page, selector, text) => {
  const candidates = await page.$$(selector)
  let target = null
  for (const candidate of candidates) {
    const box = await candidate.boundingBox()
    if (box && box.width > 0 && box.height > 0 && (await candidate.evaluate(element => (element.textContent || '').trim())) === text) {
      target = candidate
      break
    }
  }
  if (!target) throw new Error(`missing ${selector} with text ${text}`)
  const box = await target.boundingBox()
  if (!box) throw new Error(`hidden ${selector} with text ${text}`)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await wait(250)
}

const selectVersion = async (page, optionText) => {
  const selector = await page.$('.pms-config-template-toolbar .ant-select-content')
  if (!selector) throw new Error('version selector is unavailable')
  const currentText = (await selector.evaluate(element => (element.textContent || '').trim()))
  await selector.click()
  await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
  const options = await page.$$eval('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option', elements => elements.map(element => (element.textContent || '').trim()))
  const currentIndex = options.indexOf(currentText)
  const targetIndex = options.indexOf(optionText)
  if (currentIndex < 0 || targetIndex < 0) throw new Error(`missing version ${optionText}`)
  const key = targetIndex > currentIndex ? 'ArrowDown' : 'ArrowUp'
  for (let index = 0; index < Math.abs(targetIndex - currentIndex); index += 1) await page.keyboard.press(key)
  await page.keyboard.press('Enter')
  await wait(200)
}

const switchUser = async (page, userName) => {
  await page.$eval('button[aria-label="切换当前用户"]', element => element.click())
  await page.waitForSelector('.ant-dropdown:not(.ant-dropdown-hidden)')
  const switched = await page.evaluate(expected => {
    const item = Array.from(document.querySelectorAll('.ant-dropdown:not(.ant-dropdown-hidden) [role="menuitem"]'))
      .find(element => (element.textContent || '').includes(expected))
    if (!item) return false
    item.click()
    return true
  }, userName)
  if (!switched) throw new Error(`user ${userName} is unavailable`)
  await page.waitForFunction(expected => document.querySelector('button[aria-label="切换当前用户"]')?.getAttribute('data-current-user') === expected, {}, userName)
}

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
page.setDefaultTimeout(TIMEOUT)
const errors = []
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
page.on('console', message => {
  if (!['error', 'warning'].includes(message.type())) return
  if (allowedWarnings.some(warning => message.text().includes(warning))) return
  errors.push(`${message.type()}: ${message.text()}`)
})

try {
  await page.setViewport({ width: 1440, height: 1000 })
  await page.goto(BASE_URL, { waitUntil: 'networkidle0' })
  await clickExactText(page, '[role="menuitem"]', '配置中心')
  await page.waitForFunction(() => document.body.innerText.includes('计划模板配置'))
  const planConfigVisible = await page.evaluate(() => document.body.innerText.includes('配置和管理项目计划模板'))
  if (!planConfigVisible) await clickExactText(page, 'label, button', '计划模板配置')
  await page.waitForFunction(() => document.body.innerText.includes('配置和管理项目计划模板'))
  await clickExactText(page, '[role="tab"]', '三级计划')
  await page.waitForSelector('.pms-level3-template-table')

  const expectedHeaders = [
    '序号', '活动名称', '责任人', '责任部门', '计划开始时间', '计划结束时间', '预估工期',
    '关键节点', '实际开始时间', '实际完成时间', '实际工期', '状态', '任务风险', '备注', '创建者',
  ]
  const headers = await page.$$eval('.pms-level3-template-table th', cells => cells.map(cell => (cell.textContent || '').trim()).filter(Boolean))
  for (const header of expectedHeaders) if (!headers.includes(header)) throw new Error(`missing level3 template header ${header}`)
  const readOnlyInputs = await page.$$('.pms-level3-template-table input')
  if (readOnlyInputs.length) throw new Error('published level3 template exposed editable fields')

  await page.type('input[placeholder="搜索任务..."]', 'Beta')
  await wait(150)
  const filteredText = await page.$eval('.pms-level3-template-table', element => element.innerText)
  if (!filteredText.includes('Beta NPS调研计划') || filteredText.includes('IR计划输出')) throw new Error('level3 template search did not filter rows')

  await page.click('input[placeholder="搜索任务..."]', { clickCount: 3 })
  await page.keyboard.press('Backspace')
  const hasCreateRevisionButton = await page.evaluate(() => Array.from(document.querySelectorAll('button'))
    .some(button => (button.textContent || '').trim() === '创建修订'))
  if (hasCreateRevisionButton) {
    await clickExactText(page, 'button', '创建修订')
    await page.waitForSelector('.ant-dropdown:not(.ant-dropdown-hidden)')
    await clickExactText(page, '[role="menuitem"]', '创建正式版本')
  } else {
    await selectVersion(page, 'V4 (修订中)')
  }
  await page.waitForSelector('input[aria-label="活动名称-1"]')
  const revisedName = 'IR计划输出-修订验证'
  await page.$eval('input[aria-label="活动名称-1"]', element => { element.focus(); element.select() })
  await page.keyboard.type(revisedName)
  await selectVersion(page, 'V3 (已发布)')
  await page.waitForFunction(() => !document.querySelector('input[aria-label="活动名称-1"]'))
  const publishedText = await page.$eval('.pms-level3-template-table', element => element.innerText)
  if (!publishedText.includes('IR计划输出') || publishedText.includes(revisedName)) throw new Error('published version leaked draft content')
  await selectVersion(page, 'V4 (修订中)')
  await page.waitForSelector('input[aria-label="活动名称-1"]')
  const restoredDraft = await page.$eval('input[aria-label="活动名称-1"]', element => element.value)
  if (restoredDraft !== revisedName) throw new Error(`draft version was not restored: ${restoredDraft}`)

  await switchUser(page, '孙七')
  if (await page.$('input[aria-label="活动名称-1"]')) throw new Error('view-only user can edit level3 template')
  const unauthorizedActions = await page.evaluate(() => Array.from(document.querySelectorAll('button')).some(button => ['发布', '取消修订'].includes((button.textContent || '').trim())))
  if (unauthorizedActions) throw new Error('view-only user can publish or cancel level3 template')
  await switchUser(page, '张三')

  if (errors.length) throw new Error(errors.join('\n'))
  console.log(`PASS level3 template configuration browser smoke (${BASE_URL})`)
} catch (error) {
  console.error(`FAIL level3 template browser smoke\n${error.stack || error}`)
  process.exitCode = 1
} finally {
  await browser.close()
}
