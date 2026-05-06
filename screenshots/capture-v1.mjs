import puppeteer from 'puppeteer'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = 'http://localhost:3004'
const wait = ms => new Promise(r => setTimeout(r, ms))

async function capture() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1440,900'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })

  const shot = async (name, url, actions) => {
    console.log(`Capturing: ${name}`)
    if (url) await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
    if (actions) await actions(page)
    await wait(1000)
    await page.screenshot({ path: path.join(__dirname, `v1-${name}.png`) })
    console.log(`  -> saved`)
  }

  // 1. 工作台 - 项目卡片视图
  await shot('01-workspace-cards', BASE)

  // 2. 工作台 - 项目列表视图 (切换到列表)
  await shot('02-workspace-list', null, async (p) => {
    // Click list view icon in segmented
    const segs = await p.$$('.ant-segmented-item')
    if (segs.length >= 2) await segs[segs.length - 1].click()
    await wait(500)
  })

  // 3. 工作台 - 工作跟踪
  await shot('03-workspace-tracker', null, async (p) => {
    // Switch back to card view first
    const segs = await p.$$('.ant-segmented-item')
    if (segs.length >= 2) await segs[segs.length - 2].click()
    await wait(300)
    // Click 工作跟踪 tab
    const divs = await p.$$('div')
    for (const d of divs) {
      const t = await p.evaluate(el => el.textContent?.trim(), d)
      if (t === '工作跟踪') { const b = await d.boundingBox(); if (b && b.width < 150 && b.height < 40) { await d.click(); break } }
    }
  })

  // 4. 项目空间 - 基本信息 (进入第一个项目)
  await shot('04-project-basic-info', BASE, async (p) => {
    await wait(500)
    // Click first project card (skip filter bar cards)
    const allCards = await p.$$('.ant-card')
    for (const card of allCards) {
      const text = await p.evaluate(el => el.textContent, card)
      if (text && text.includes('X6877')) { await card.click(); break }
    }
    await wait(1000)
  })

  // 5. 一级计划 - 竖版表格
  await shot('05-plan-L1-table', null, async (p) => {
    const items = await p.$$('.ant-menu-item')
    for (const i of items) {
      const t = await p.evaluate(el => el.textContent, i)
      if (t && t.includes('计划')) { await i.click(); break }
    }
    await wait(800)
  })

  // 6. 一级计划 - 横版表格
  await shot('06-plan-L1-horizontal', null, async (p) => {
    const btns = await p.$$('.ant-radio-button-wrapper')
    for (const b of btns) {
      const t = await p.evaluate(el => el.textContent, b)
      if (t && t.includes('横版表格')) { await b.click(); break }
    }
    await wait(800)
  })

  // 7. 一级计划 - 甘特图
  await shot('07-plan-L1-gantt', null, async (p) => {
    const btns = await p.$$('.ant-radio-button-wrapper')
    for (const b of btns) {
      const t = await p.evaluate(el => el.textContent, b)
      if (t && t.includes('甘特图')) { await b.click(); break }
    }
    await wait(1000)
  })

  // 8. 路标视图
  await shot('08-roadmap', null, async (p) => {
    await p.goto(BASE, { waitUntil: 'networkidle2' })
    await wait(500)
    const items = await p.$$('.ant-menu-item')
    for (const i of items) {
      const t = await p.evaluate(el => el.textContent, i)
      if (t && t.includes('路标')) { await i.click(); break }
    }
    await wait(1000)
  })

  // 9. 配置中心 - 一级计划配置
  await shot('09-config-L1', null, async (p) => {
    const items = await p.$$('.ant-menu-item')
    for (const i of items) {
      const t = await p.evaluate(el => el.textContent, i)
      if (t && t.includes('配置中心')) { await i.click(); break }
    }
    await wait(800)
  })

  // 10. 权限中心
  await shot('10-permission', null, async (p) => {
    const items = await p.$$('.ant-menu-item')
    for (const i of items) {
      const t = await p.evaluate(el => el.textContent, i)
      if (t && t.includes('权限中心')) { await i.click(); break }
    }
    await wait(800)
  })

  // 11. 分享页 - 整机产品项目
  await shot('11-share-whole-machine', `${BASE}/share/plan?projectId=1&level=level1`)

  // 12. 分享页 - 产品项目 (无市场切换)
  await shot('12-share-product', `${BASE}/share/plan?projectId=2&level=level1`)

  await browser.close()
  console.log('\nDone! All V1.0 screenshots captured.')
}

capture().catch(e => { console.error(e); process.exit(1) })
