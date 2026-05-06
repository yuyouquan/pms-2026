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
    await wait(800)
    await page.screenshot({ path: path.join(__dirname, `${name}.png`) })
    console.log(`  -> saved`)
  }

  // 1. 工作台 - 项目卡片
  await shot('01-workspace-cards', BASE)

  // 2. 工作台 - 工作跟踪
  await shot('02-workspace-tracker', null, async (p) => {
    const divs = await p.$$('div')
    for (const d of divs) {
      const t = await p.evaluate(el => el.textContent, d)
      if (t && t.trim() === '工作跟踪') { const b = await d.boundingBox(); if (b && b.width < 150) { await d.click(); break } }
    }
  })

  // 3. 项目空间 - 基本信息
  await shot('03-project-basic-info', null, async (p) => {
    await p.goto(BASE, { waitUntil: 'networkidle2' })
    await wait(500)
    const cards = await p.$$('.ant-card')
    if (cards.length > 2) await cards[2].click()
    await wait(1000)
  })

  // 4. 一级计划 - 竖版表格
  await shot('04-plan-L1-table', null, async (p) => {
    const items = await p.$$('.ant-menu-item')
    for (const i of items) {
      const t = await p.evaluate(el => el.textContent, i)
      if (t && t.includes('计划')) { await i.click(); break }
    }
    await wait(800)
  })

  // 5. 一级计划 - 横版表格
  await shot('05-plan-L1-horizontal', null, async (p) => {
    const btns = await p.$$('.ant-radio-button-wrapper')
    for (const b of btns) {
      const t = await p.evaluate(el => el.textContent, b)
      if (t && t.includes('横版表格')) { await b.click(); break }
    }
    await wait(800)
  })

  // 6. 一级计划 - 甘特图
  await shot('06-plan-L1-gantt', null, async (p) => {
    const btns = await p.$$('.ant-radio-button-wrapper')
    for (const b of btns) {
      const t = await p.evaluate(el => el.textContent, b)
      if (t && t.includes('甘特图')) { await b.click(); break }
    }
    await wait(1000)
  })

  // 7. 路标视图
  await shot('07-roadmap', null, async (p) => {
    await p.goto(BASE, { waitUntil: 'networkidle2' })
    await wait(500)
    const items = await p.$$('.ant-menu-item')
    for (const i of items) {
      const t = await p.evaluate(el => el.textContent, i)
      if (t && t.includes('路标')) { await i.click(); break }
    }
    await wait(1000)
  })

  // 8. 配置中心
  await shot('08-config', null, async (p) => {
    const items = await p.$$('.ant-menu-item')
    for (const i of items) {
      const t = await p.evaluate(el => el.textContent, i)
      if (t && t.includes('配置中心')) { await i.click(); break }
    }
    await wait(800)
  })

  // 9. 权限中心
  await shot('09-permission', null, async (p) => {
    const items = await p.$$('.ant-menu-item')
    for (const i of items) {
      const t = await p.evaluate(el => el.textContent, i)
      if (t && t.includes('权限中心')) { await i.click(); break }
    }
    await wait(800)
  })

  // 10. 分享页 - 整机项目
  await shot('10-share-whole-machine', `${BASE}/share/plan?projectId=1&level=level1`)

  // 11. 分享页 - 产品项目
  await shot('11-share-product', `${BASE}/share/plan?projectId=2&level=level1`)

  await browser.close()
  console.log('\nDone! All screenshots captured.')
}

capture().catch(e => { console.error(e); process.exit(1) })
