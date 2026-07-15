import puppeteer from 'puppeteer'

const BASE = process.env.PMS_BASE_URL || 'http://localhost:3004'
const wait = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms))

const fail = message => { throw new Error(message) }

async function clickVisibleText(page, selector, text) {
  const clicked = await page.evaluate((candidateSelector, target) => {
    const candidates = Array.from(document.querySelectorAll(candidateSelector))
    const element = candidates.find(node => {
      const rect = node.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && (node.textContent || '').trim() === target
    })
    if (!element) return false
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return true
  }, selector, text)
  if (!clicked) fail(`Unable to click visible text: ${text}`)
  await wait()
}

async function clickProject(page, projectName) {
  const clicked = await page.evaluate((target) => {
    const title = Array.from(document.querySelectorAll('span, div'))
      .find(node => (node.textContent || '').trim() === target && node.getBoundingClientRect().width > 0)
    if (!title) return false
    const card = title.closest('.ant-card') || title.parentElement
    card?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return !!card
  }, projectName)
  if (!clicked) fail(`Project card not found: ${projectName}`)
  await wait(900)
}

async function assertVisibleText(page, text, selector = 'body') {
  const found = await page.evaluate((target, rootSelector) => (
    Array.from(document.querySelectorAll(rootSelector)).some(root => {
      const rect = root.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && (root.textContent || '').includes(target)
    })
  ), text, selector)
  if (!found) fail(`Missing visible text "${text}" in ${selector}`)
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

async function clickPlanType(page, type) {
  const clicked = await page.evaluate((target) => {
    const tag = Array.from(document.querySelectorAll('.ant-tag')).find(node => {
      const rect = node.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && (node.textContent || '').trim().startsWith(target)
    })
    if (!tag) return false
    tag.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return true
  }, type)
  if (!clicked) fail(`Unable to click plan type: ${type}`)
  await wait()

  const active = await page.evaluate((target) => (
    Array.from(document.querySelectorAll('.ant-tag')).some(node => (
      (node.textContent || '').trim().startsWith(target)
      && node.getBoundingClientRect().width > 0
      && node.style.fontWeight === '600'
    ))
  ), type)
  if (!active) fail(`Plan type did not become active: ${type}`)
}

const browser = await puppeteer.launch({
  headless: 'new',
  defaultViewport: { width: 1600, height: 1000 },
  args: ['--no-sandbox', '--window-size=1600,1000'],
})

try {
  const page = await browser.newPage()
  const runtimeErrors = []
  page.on('pageerror', error => runtimeErrors.push(error.message))

  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 })
  await clickProject(page, 'tOS16.1')

  await assertVisibleText(page, 'Full', '#section-plan')
  await assertVisibleText(page, 'Slim', '#section-plan')
  await assertVisibleText(page, '类型编辑', '#section-plan')

  await clickVisibleText(page, '#section-plan button', '类型编辑')
  await clickVisibleText(page, '.ant-modal button', '添加类型')
  await assertVisibleText(page, 'PAD', '.ant-modal')
  await clickVisibleText(page, '.ant-modal-footer button', '保存')
  await assertVisibleText(page, 'PAD', '#section-plan')

  await clickVisibleText(page, '[role="menuitem"], .ant-menu-item', '计划')
  for (const level of ['一级计划', '二级计划', '计划总览']) {
    await clickVisibleText(page, '.ant-tabs-tab', level)
    await assertVisibleText(page, 'Full', '.ant-card')
    await assertVisibleText(page, 'Slim', '.ant-card')
    await assertVisibleText(page, 'PAD', '.ant-card')
  }

  for (const type of ['Full', 'Slim', 'PAD']) await clickPlanType(page, type)

  await clickVisibleText(page, 'button', '类型编辑')
  await assertNoVisibleText(page, '跟随主类型', '.ant-modal')
  await assertNoVisibleText(page, '跟随主市场', '.ant-modal')
  await clickVisibleText(page, '.ant-modal-footer button', '取消')

  await clickVisibleText(page, 'button', '返回工作台')
  await clickProject(page, 'X6877-D8400_H991')
  await assertVisibleText(page, '市场编辑', '#section-plan')
  await assertNoVisibleText(page, '类型编辑', '#section-plan')

  if (runtimeErrors.length > 0) fail(`Runtime errors: ${runtimeErrors.join(' | ')}`)
  console.log('tOS type plan smoke passed.')
} catch (error) {
  console.error(`tOS type plan smoke failed: ${error.message}`)
  process.exitCode = 1
} finally {
  await browser.close()
}
