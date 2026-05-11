// End-to-end smoke test for the 新增项目 submit flow.
import puppeteer from 'puppeteer'

const URL = 'http://localhost:3000'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({ headless: 'new', defaultViewport: { width: 1600, height: 1000 } })
const page = await browser.newPage()

const errors = []
page.on('pageerror', err => errors.push(`[pageerror] ${err.message}`))
page.on('console', msg => {
  if (msg.type() === 'error' && !msg.text().includes('antd:') && !msg.text().includes('404')) {
    errors.push(`[console.error] ${msg.text()}`)
  }
})

const log = (...args) => console.log('-', ...args)

// Helper: pick an option in a modal Select by clicking it open then clicking the option text.
// Antd v6 uses .ant-select (not .ant-select-selector) — click the wrapper itself.
async function pickInSelect(page, modalSelectIndex, optionText) {
  const handles = await page.$$('.ant-modal .ant-select')
  const handle = handles[modalSelectIndex]
  if (!handle) throw new Error(`No .ant-select at modal index ${modalSelectIndex}`)
  await handle.click()
  await sleep(500)
  const ok = await page.evaluate((txt) => {
    const items = Array.from(document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option'))
    const target = items.find(el => (el.textContent || '').trim() === txt)
    if (!target) return false
    target.scrollIntoView({ block: 'center' })
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return true
  }, optionText)
  if (!ok) throw new Error(`Option "${optionText}" not found in open dropdown`)
  await sleep(400)
}

try {
  log('1. Load app as 张三')
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 })
  await sleep(800)

  log('2. Click 新增项目')
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').trim().includes('新增项目'))
    btn.click()
  })
  await sleep(500)

  log('3. Open 项目名 Select and pick tOS19.0')
  // Debug: dump all classes that look like select in the modal
  const debug = await page.evaluate(() => {
    const modal = document.querySelector('.ant-modal')
    if (!modal) return { error: 'no modal' }
    const allEls = modal.querySelectorAll('*')
    const selectClasses = new Set()
    allEls.forEach(el => {
      const c = el.className
      if (typeof c === 'string' && c.toLowerCase().includes('select')) {
        c.split(/\s+/).forEach(cls => { if (cls.toLowerCase().includes('select')) selectClasses.add(cls) })
      }
    })
    return { selectClasses: Array.from(selectClasses) }
  })
  console.log('   debug:', debug)
  await pickInSelect(page, 0, 'tOS19.0')

  log('4. Verify 项目责任人 was auto-filled with SPM (李四 for tOS19.0)')
  // In Antd v6 multi-select, selected tags appear as .ant-select-content-item inside the select.
  const responsibleTags = await page.evaluate(() => {
    const formItems = Array.from(document.querySelectorAll('.ant-modal .ant-form-item'))
    const item = formItems.find(it => (it.querySelector('.ant-form-item-label label')?.textContent || '').includes('项目责任人'))
    if (!item) return []
    return Array.from(item.querySelectorAll('.ant-select-content-item, .ant-select-selection-item')).map(t => (t.textContent || '').trim()).filter(Boolean)
  })
  console.log('   responsible tags:', responsibleTags)
  if (!responsibleTags.some(t => t.includes('李四'))) throw new Error('Expected 李四 auto-filled in 项目责任人 after picking tOS19.0')

  log('5. Pick 项目类型 = 产品项目')
  await pickInSelect(page, 1, '产品项目')

  log('6. Click 创建')
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.ant-modal-footer button'))
    const ok = btns.find(b => (b.textContent || '').trim() === '创建')
    if (ok) ok.click()
  })
  await sleep(2000)

  log('7. After create, expect to be inside project space with tOS19.0 as title')
  const pageState = await page.evaluate(() => {
    const backBtn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('返回工作台'))
    const titleEl = Array.from(document.querySelectorAll('span')).find(s => (s.textContent || '').trim() === 'tOS19.0')
    return {
      backBtnVisible: !!backBtn,
      titleHasNewProject: !!titleEl,
    }
  })
  console.log('   page state:', pageState)
  if (!pageState.backBtnVisible) throw new Error('Expected to be in project space (返回工作台 button missing)')
  if (!pageState.titleHasNewProject) throw new Error('Expected tOS19.0 as the project space title')

  log('8. Navigate to 权限配置 in project space, verify 系统管理员 row has 李四')
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.ant-menu-item, [role="menuitem"], .ant-menu-title-content'))
    // Find clickable parent containing the text
    const target = items.find(el => (el.textContent || '').trim().includes('权限配置'))
    if (target) {
      const click = target.closest('.ant-menu-item') || target
      click.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    }
  })
  await sleep(800)
  const sysAdminMembers = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tr'))
    const row = rows.find(r => (r.querySelector('td')?.textContent || '').includes('系统管理员'))
    if (!row) return null
    return Array.from(row.querySelectorAll('.ant-select-content-item, .ant-select-selection-item')).map(t => (t.textContent || '').trim()).filter(Boolean)
  })
  console.log('   系统管理员 row members:', sysAdminMembers)
  if (!sysAdminMembers || !sysAdminMembers.some(m => m.includes('李四'))) {
    throw new Error(`Expected 李四 in 系统管理员 row for new project, got: ${JSON.stringify(sysAdminMembers)}`)
  }

  log('✅ End-to-end smoke test passed.')
  if (errors.length > 0) {
    console.log('\n⚠️  Page errors:')
    errors.forEach(e => console.log('  ', e))
  }
} catch (e) {
  console.log('\n❌ Smoke test failed:', e.message)
  if (errors.length > 0) {
    console.log('Page errors:')
    errors.forEach(e => console.log('  ', e))
  }
  try {
    await page.screenshot({ path: '/tmp/pms-smoke-failure.png', fullPage: false })
    console.log('Failure screenshot saved to /tmp/pms-smoke-failure.png')
  } catch {}
  process.exitCode = 1
} finally {
  await browser.close()
}
