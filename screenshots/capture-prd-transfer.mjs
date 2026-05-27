// 转维 PRD 截图脚本：覆盖 PMS ↔ 转维流程整合后的 9 个关键画面
// 运行：cd /Users/shswyuyouquan/Documents/work/pms-2026 && node screenshots/capture-prd-transfer.mjs
// 输出目录：/Users/shswyuyouquan/Documents/work/transfer-maintenance-flow/docs/screenshots/prd-pms-integration/

import puppeteer from 'puppeteer'

const URL = 'http://localhost:3000'
const OUT = '/Users/shswyuyouquan/Documents/work/transfer-maintenance-flow/docs/screenshots/prd-pms-integration'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({ headless: 'new', defaultViewport: { width: 1600, height: 1000 } })
const page = await browser.newPage()
page.on('pageerror', err => console.log('[pageerror]', err.message))

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })
  console.log(`  ✓ ${name}.png`)
}

// 文本匹配点击辅助
const clickByText = async (selector, text) => {
  const ok = await page.evaluate((sel, t) => {
    const el = Array.from(document.querySelectorAll(sel)).find(x => (x.textContent || '').trim() === t)
    if (!el) return false
    el.click()
    return true
  }, selector, text)
  return ok
}

const clickByContains = async (selector, text) => {
  const ok = await page.evaluate((sel, t) => {
    const el = Array.from(document.querySelectorAll(sel)).find(x => (x.textContent || '').includes(t))
    if (!el) return false
    el.click()
    return true
  }, selector, text)
  return ok
}

// =========== 1. 工作台-待办中心（首页） ===========
console.log('1. 工作台-待办中心')
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 })
await sleep(1200)
await shot('01-workspace-todo-center')

// =========== 2. 项目空间-基础信息（含申请转维按钮） ===========
console.log('2. 项目空间-基础信息（申请转维按钮）')
// 通过项目卡片进入
await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('[class*="ant-card"]'))
  const target = cards.find(c => (c.textContent || '').includes('X6855') || (c.textContent || '').includes('X6877'))
  target?.click()
})
await sleep(800)
// 进入"基础信息"模块
await clickByText('.ant-menu-item, [role="menuitem"]', '基础信息')
await sleep(1500)
// 滚到顶部，让申请转维按钮在画面右上角可见
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
await sleep(500)
await shot('02-project-basic-info-apply-button')

// =========== 3. 项目空间·转维信息模块 ===========
console.log('3. 项目空间·转维信息模块')
// 滚到 section-transfer 锚点
const scrolled = await page.evaluate(() => {
  const el = document.getElementById('section-transfer')
  if (!el) return false
  el.scrollIntoView({ behavior: 'instant', block: 'start' })
  return true
})
await sleep(800)
if (scrolled) {
  await shot('03-project-transfer-info-module')
} else {
  console.log('  ! section-transfer 未找到，请检查项目是否为整机产品（有转维申请）')
  await shot('03-project-transfer-info-module-FALLBACK')
}

// =========== 4. 申请转维页（项目锁定不可编辑） ===========
console.log('4. 申请转维页')
// 回到顶部点申请转维按钮
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
await sleep(400)
const applied = await clickByText('button', '申请转维')
await sleep(1500)
if (applied) await shot('04-transfer-apply-locked')
else console.log('  ! 申请转维按钮未找到')

// =========== 5. 转维详情页 ===========
console.log('5. 转维详情页')
// 返回基础信息（关闭 apply）→ 滚到 section-transfer → 点行内"详情"
const back1 = await clickByContains('button', '返回')
await sleep(600)
if (!back1) {
  // fallback：左上 ArrowLeft
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.querySelector('.anticon-arrow-left'))
    btn?.click()
  })
  await sleep(600)
}
await page.evaluate(() => document.getElementById('section-transfer')?.scrollIntoView({ behavior: 'instant', block: 'start' }))
await sleep(500)
const detailClicked = await clickByContains('a, button', '详情')
await sleep(1500)
if (detailClicked) await shot('05-transfer-detail')

// =========== 6. 资料录入与AI检查页（含驳回 Collapse） ===========
// 切换用户为系统角色研发侧（X6855 项目里"系统"被驳回，只有该角色看得到 Collapse）
console.log('6. 资料录入与AI检查页')
// 先回到详情页 / 列表
const back2 = await clickByContains('button', '返回')
await sleep(600)
// 在 section-transfer 找到一行带"录入"按钮的，点击
await page.evaluate(() => document.getElementById('section-transfer')?.scrollIntoView({ behavior: 'instant', block: 'start' }))
await sleep(400)
const entryClicked = await clickByContains('a, button', '录入')
await sleep(1500)
if (entryClicked) await shot('06-transfer-entry-rejected-collapse')
else console.log('  ! 录入按钮未找到（当前用户可能没有相应角色权限）')

// =========== 7. 维护审核页 ===========
console.log('7. 维护审核页')
const back3 = await clickByContains('button', '返回')
await sleep(600)
await page.evaluate(() => document.getElementById('section-transfer')?.scrollIntoView({ behavior: 'instant', block: 'start' }))
await sleep(400)
const reviewClicked = await clickByContains('a, button', '评审')
await sleep(1500)
if (reviewClicked) await shot('07-transfer-review')
else console.log('  ! 评审按钮未找到')

// =========== 8. SQA审核页 ===========
console.log('8. SQA审核页')
const back4 = await clickByContains('button', '返回')
await sleep(600)
await page.evaluate(() => document.getElementById('section-transfer')?.scrollIntoView({ behavior: 'instant', block: 'start' }))
await sleep(400)
const sqaClicked = await clickByContains('a, button', 'SQA审核')
await sleep(1500)
if (sqaClicked) await shot('08-transfer-sqa-review')
else console.log('  ! SQA审核按钮未找到')

// =========== 9. 配置中心-转维材料模板配置 tab ===========
console.log('9. 配置中心-转维材料模板配置')
// 顶部导航回到工作台
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('返回工作台'))
  btn?.click()
})
await sleep(800)
// 切到配置中心
await clickByText('.ant-menu-item, [role="menuitem"]', '配置中心')
await sleep(1200)
// 切到"转维材料模板配置" tab
await clickByContains('.ant-tabs-tab', '转维材料模板配置')
await sleep(1500)
await shot('09-config-transfer-template')

await browser.close()
console.log('\n全部完成。输出目录：' + OUT)
