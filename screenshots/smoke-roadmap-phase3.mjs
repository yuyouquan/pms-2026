import puppeteer from 'puppeteer'

const BASE = process.env.PMS_BASE_URL || 'http://localhost:3004'
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

function fail(message) {
  throw new Error(message)
}

async function clickByText(page, text) {
  const clickable = await page.$$('.ant-menu-title-content, button, .ant-tabs-tab, [role="tab"], [role="menuitem"]')
  for (const handle of clickable) {
    const label = await page.evaluate(el => (el.textContent || '').trim(), handle)
    if (label.includes(text)) {
      await handle.click()
      await wait(700)
      return
    }
  }

  const fallback = await page.$$('span, div')
  for (const handle of fallback) {
    const match = await page.evaluate((el, target) => {
      const rect = el.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && (el.textContent || '').trim() === target
    }, handle, text)
    if (match) {
      await handle.click()
      await wait(700)
      return
    }
  }

  fail(`Unable to click text: ${text}`)
  await wait(700)
}

async function assertText(page, text, scope = 'body') {
  const found = await page.evaluate((target, selector) => {
    const roots = Array.from(document.querySelectorAll(selector))
    return roots.some(root => (root.textContent || '').includes(target))
  }, text, scope)
  if (!found) fail(`Missing text "${text}" in ${scope}`)
}

async function assertNoCheckboxLabel(page, text) {
  const found = await page.evaluate((target) => {
    const labels = Array.from(document.querySelectorAll('.ant-checkbox-wrapper'))
    return labels.some(label => (label.textContent || '').trim() === target)
  }, text)
  if (found) fail(`Checkbox "${text}" should not be configurable`)
}

async function closeDrawer(page) {
  const closed = await page.evaluate(() => {
    const button = document.querySelector('.ant-drawer.ant-drawer-open .ant-drawer-close')
    if (!button) return false
    button.click()
    return true
  })
  if (!closed) fail('Unable to close drawer')
  await wait(500)
}

const browser = await puppeteer.launch({
  headless: 'new',
  defaultViewport: { width: 1500, height: 950 },
  args: ['--no-sandbox', '--window-size=1500,950'],
})

try {
  const page = await browser.newPage()
  page.on('pageerror', err => console.log('[pageerror]', err.message))

  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 })

  await clickByText(page, '配置中心')
  await assertText(page, '计划模板配置')
  await assertText(page, '默认路标')

  await clickByText(page, '项目路标视图')
  await assertText(page, '项目名称')
  await assertText(page, '项目状态')
  await assertText(page, '当前节点')
  await assertText(page, '开发模式')
  await assertText(page, 'SPM')

  await clickByText(page, '列设置')
  await assertText(page, '项目信息字段', '.ant-drawer')
  await assertText(page, '里程碑信息字段', '.ant-drawer')
  await assertText(page, '健康状态', '.ant-drawer')
  await assertNoCheckboxLabel(page, '项目名称')
  await closeDrawer(page)

  await clickByText(page, '筛选')
  await assertText(page, '添加条件', '.ant-drawer')
  await assertText(page, '筛选字段', '.ant-drawer')
  await assertText(page, '包含', '.ant-drawer')
  await closeDrawer(page)

  await clickByText(page, '整机产品项目')
  await assertText(page, '项目名')
  await assertText(page, '市场')
  await assertText(page, '合作形式')
  await assertText(page, '芯片平台')
  await assertText(page, 'OP')
  await assertText(page, 'TR')

  console.log('Roadmap phase 3 smoke passed.')
} finally {
  await browser.close()
}
