// Smoke test for the new 新增项目 Modal feature.
import puppeteer from 'puppeteer'

const URL = 'http://localhost:3000'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({ headless: 'new', defaultViewport: { width: 1600, height: 1000 } })
const page = await browser.newPage()

const errors = []
page.on('pageerror', err => errors.push(`[pageerror] ${err.message}`))
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`)
})

const log = (...args) => console.log('-', ...args)

try {
  log('1. Loading app...')
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 })
  await sleep(800)

  log('2. Current user should be 张三 (admin). Check 新增项目 button is visible.')
  const btnVisible = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('button'))
    return els.some(b => (b.textContent || '').trim().includes('新增项目'))
  })
  console.log('   新增项目 button visible:', btnVisible)
  if (!btnVisible) throw new Error('Button not found for admin user 张三')

  log('3. Click the button — Modal should open with title 新增项目.')
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').trim().includes('新增项目'))
    btn.click()
  })
  await sleep(500)

  const modalOpen = await page.evaluate(() => {
    const titles = Array.from(document.querySelectorAll('.ant-modal-title'))
    return titles.some(t => (t.textContent || '').trim() === '新增项目')
  })
  console.log('   Modal opened:', modalOpen)
  if (!modalOpen) throw new Error('Modal did not open')

  log('4. Modal should have 3 form-item labels: 项目名 / 项目类型 / 项目责任人.')
  const labels = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.ant-modal .ant-form-item-label label'))
      .map(l => (l.textContent || '').trim())
  })
  console.log('   Field labels:', labels)
  const expected = ['项目名', '项目类型', '项目责任人']
  for (const e of expected) {
    if (!labels.includes(e)) throw new Error(`Missing field label: ${e}`)
  }

  log('5. Close Modal, switch user to 李四 (non-admin), confirm button hidden.')
  await page.evaluate(() => {
    const closeBtns = Array.from(document.querySelectorAll('.ant-modal-close'))
    if (closeBtns[0]) closeBtns[0].click()
  })
  await sleep(400)
  // Open user dropdown — header avatar
  await page.evaluate(() => {
    const avatars = Array.from(document.querySelectorAll('.ant-avatar')).filter(a => !a.closest('.ant-modal'))
    // pick the rightmost one (header)
    const headerAvatar = avatars.find(a => {
      const r = a.getBoundingClientRect()
      return r.top < 80
    })
    if (headerAvatar) {
      let target = headerAvatar.closest('div[class*="cursor"]') || headerAvatar.parentElement
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    }
  })
  await sleep(500)
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.ant-dropdown-menu-item, li'))
    const target = items.find(el => {
      const txt = (el.textContent || '').trim()
      return txt.startsWith('李四') || txt.includes('李四')
    })
    if (target) target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await sleep(800)

  const userNow = await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('header span, [class*="UserSwitcher"] span, span'))
    const u = spans.find(s => {
      const t = (s.textContent || '').trim()
      return ['张三','李四','王五','赵六','孙七','周八','李白','杜甫'].includes(t)
    })
    return u ? u.textContent.trim() : 'unknown'
  })
  console.log('   Current user after switch:', userNow)

  await sleep(500)
  const btnAfter = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('button'))
    return els.some(b => (b.textContent || '').trim().includes('新增项目'))
  })
  console.log('   新增项目 button visible for 李四:', btnAfter)
  if (btnAfter) throw new Error('Button should NOT be visible for non-admin 李四')

  log('✅ Smoke test passed.')
  if (errors.length > 0) {
    console.log('\n⚠️  Page errors during run:')
    errors.forEach(e => console.log('  ', e))
  }
} catch (e) {
  console.log('\n❌ Smoke test failed:', e.message)
  if (errors.length > 0) {
    console.log('Page errors:')
    errors.forEach(e => console.log('  ', e))
  }
  process.exitCode = 1
} finally {
  await browser.close()
}
