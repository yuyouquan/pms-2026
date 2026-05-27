// 转维 PRD 截图：4 张业务视图（detail / entry-with-rejected / review / sqa-review）
// 从 transfer-maintenance-flow 当前最新版本抓取（含驳回 Collapse / 统一评审意见 等新特性）
// 运行：node scripts/capture-prd-views.mjs

import puppeteer from 'puppeteer'

const URL = 'http://localhost:3001'
const OUT = '/Users/shswyuyouquan/Documents/work/transfer-maintenance-flow/docs/screenshots/prd-pms-integration'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({ headless: 'new', defaultViewport: { width: 1600, height: 1000 } })
const page = await browser.newPage()
page.on('pageerror', err => console.log('[pageerror]', err.message))

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })
  console.log(`  ✓ ${name}.png`)
}

// 切用户辅助：通过工作台右上角下拉切换
const switchUser = async (name) => {
  await page.evaluate((n) => {
    const dropdowns = Array.from(document.querySelectorAll('[role="button"], .ant-dropdown-trigger, button'))
    const trigger = dropdowns.find(el => /[一-龥]{2,3}/.test(el.textContent || ''))
    trigger?.click()
  }, name)
  await sleep(500)
}

// =========== 5. 转维详情页 ===========
console.log('5. 转维详情页')
// app-002 是 X6768，其他状态都比较丰富（有驳回）
await page.goto(`${URL}/workbench/app-002`, { waitUntil: 'networkidle0', timeout: 30000 })
await sleep(1500)
await shot('05-transfer-detail')

// =========== 6. 资料录入与AI检查页（含驳回 Collapse） ===========
console.log('6. 资料录入页（驳回 Collapse）')
// 切到 SPM 角色研发侧（冯十二, u010）才能看到 Collapse
// 通过 localStorage 直接切？检查 UserContext 用什么 key
// 简化：直接进入 entry 页，先用默认用户看页面结构
await page.goto(`${URL}/workbench/app-002/entry`, { waitUntil: 'networkidle0', timeout: 30000 })
await sleep(1500)
// 如果不是 SPM 用户进 entry 页可能只看到 TPM 等其他角色 — 切用户
// 用 dropdown 切到 冯十二
await page.evaluate(() => {
  const dropdownTrigger = Array.from(document.querySelectorAll('[role="button"], .ant-dropdown-trigger'))
    .find(el => /[一-龥]/.test(el.textContent || '') && el.closest('header, .ant-layout-header'))
  dropdownTrigger?.click()
})
await sleep(600)
// 找到下拉中"冯十二"
await page.evaluate(() => {
  const items = Array.from(document.querySelectorAll('.ant-dropdown-menu-item, li[role="menuitem"]'))
  const fengshier = items.find(i => (i.textContent || '').includes('冯十二'))
  fengshier?.click()
})
await sleep(1500)
// 展开驳回 Collapse 头部以确保红色样式可见 — 但用户要求默认收起，直接截图收起态
await shot('06-transfer-entry-rejected-collapsed')
// 再点一下展开
await page.evaluate(() => {
  const header = document.querySelector('.rejection-collapse .ant-collapse-header')
  header?.click()
})
await sleep(800)
await shot('06b-transfer-entry-rejected-expanded')

// =========== 7. 维护审核页 ===========
console.log('7. 维护审核页')
// 切到维护团队 SPM = 张三 (u001)，他可以审 SPM
// 但 X6768 SPM 已经被驳回，看不到审核按钮... 试 底软/系统 ?
// X6768 维护团队: SPM=张三, TPM=李四, 底软=赵六, 系统=钱七, 影像=沈十七
// 底软 reviewing 中、系统/影像 已通过 — 让我们用 钱七 (系统), 但他已经审核完了...
// 用赵六（底软审核中）
await page.evaluate(() => {
  const items = Array.from(document.querySelectorAll('.ant-dropdown-menu-item, li[role="menuitem"]'))
  // 重新打开下拉
  const trig = Array.from(document.querySelectorAll('[role="button"], .ant-dropdown-trigger'))
    .find(el => /[一-龥]/.test(el.textContent || '') && el.closest('header, .ant-layout-header'))
  trig?.click()
})
await sleep(500)
await page.evaluate(() => {
  const items = Array.from(document.querySelectorAll('.ant-dropdown-menu-item, li[role="menuitem"]'))
  const zhao6 = items.find(i => (i.textContent || '').includes('赵六'))
  zhao6?.click()
})
await sleep(800)
await page.goto(`${URL}/workbench/app-002/review`, { waitUntil: 'networkidle0', timeout: 30000 })
await sleep(1500)
await shot('07-transfer-review')

// =========== 8. SQA审核页 ===========
console.log('8. SQA审核页')
// app-008 的 sqaReview 是 in_progress，且 SQA 用户是 王五 (u003)
await page.evaluate(() => {
  const trig = Array.from(document.querySelectorAll('[role="button"], .ant-dropdown-trigger'))
    .find(el => /[一-龥]/.test(el.textContent || '') && el.closest('header, .ant-layout-header'))
  trig?.click()
})
await sleep(500)
await page.evaluate(() => {
  const items = Array.from(document.querySelectorAll('.ant-dropdown-menu-item, li[role="menuitem"]'))
  const wang5 = items.find(i => (i.textContent || '').includes('王五'))
  wang5?.click()
})
await sleep(800)
await page.goto(`${URL}/workbench/app-008/sqa-review`, { waitUntil: 'networkidle0', timeout: 30000 })
await sleep(1500)
await shot('08-transfer-sqa-review')

await browser.close()
console.log('\n4 张视图截图完成')
