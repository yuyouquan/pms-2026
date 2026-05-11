// Capture a screenshot showing the workspace toolbar's 新增项目 button +
// the AddProjectModal open with all three fields visible.
import puppeteer from 'puppeteer'

const URL = 'http://localhost:3000'
const OUT = '/tmp/pms-add-project-modal.png'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({ headless: 'new', defaultViewport: { width: 1600, height: 1000 } })
const page = await browser.newPage()

page.on('pageerror', err => console.log('[pageerror]', err.message))

console.log('Loading workspace...')
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 })
await sleep(900)

console.log('Click 新增项目 button')
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').trim().includes('新增项目'))
  btn?.click()
})
await sleep(700)

// Pick 项目名 = tOS19.0 so the auto-populated state isn't empty in the screenshot.
console.log('Pick 项目名 = tOS19.0')
const selects = await page.$$('.ant-modal .ant-select')
if (selects[0]) {
  await selects[0].click()
  await sleep(400)
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option'))
    const t = items.find(el => (el.textContent || '').trim() === 'tOS19.0')
    t?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await sleep(400)
}

// Pick 项目类型 = 产品项目
console.log('Pick 项目类型 = 产品项目')
const selects2 = await page.$$('.ant-modal .ant-select')
if (selects2[1]) {
  await selects2[1].click()
  await sleep(400)
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option'))
    const t = items.find(el => (el.textContent || '').trim() === '产品项目')
    t?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await sleep(400)
}

// Pick 项目责任人 (since auto-fill was removed, user must select; pick 李四 + 张三)
console.log('Pick 项目责任人 = 李四 + 张三')
const selects3 = await page.$$('.ant-modal .ant-select')
if (selects3[2]) {
  await selects3[2].click()
  await sleep(400)
  for (const name of ['李四', '张三']) {
    await page.evaluate((n) => {
      const items = Array.from(document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option'))
      const t = items.find(el => (el.textContent || '').trim() === n)
      t?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    }, name)
    await sleep(200)
  }
  // Close the open dropdown via Escape so the OK/Cancel and helper text show.
  await page.keyboard.press('Escape')
  await sleep(500)
}

console.log(`Taking screenshot → ${OUT}`)
await page.screenshot({ path: OUT, fullPage: false })

await browser.close()
console.log('done')
