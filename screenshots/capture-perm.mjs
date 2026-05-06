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

  // 1. Global Permission Center (Header nav)
  await page.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(500)
  let items = await page.$$('.ant-menu-item')
  for (const i of items) {
    const t = await page.evaluate(el => el.textContent, i)
    if (t && t.includes('权限中心')) { await i.click(); break }
  }
  await wait(800)
  console.log('Capturing: global permission - roles tab')
  await page.screenshot({ path: path.join(__dirname, 'v1-global-perm-roles.png') })
  console.log('  -> saved')

  // Switch to permission tab
  const tabs = await page.$$('.ant-tabs-tab')
  for (const tab of tabs) {
    const t = await page.evaluate(el => el.textContent, tab)
    if (t && t.includes('权限配置')) { await tab.click(); break }
  }
  await wait(500)
  console.log('Capturing: global permission - perms tab')
  await page.screenshot({ path: path.join(__dirname, 'v1-global-perm-perms.png') })
  console.log('  -> saved')

  // 2. Project-level Permission (enter project -> permission)
  await page.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(500)
  const cards = await page.$$('.ant-card')
  for (const card of cards) {
    const t = await page.evaluate(el => el.textContent, card)
    if (t && t.includes('X6877')) { await card.click(); break }
  }
  await wait(1000)

  // Click "权限配置" in sidebar
  items = await page.$$('.ant-menu-item')
  for (const i of items) {
    const t = await page.evaluate(el => el.textContent, i)
    if (t && t.includes('权限配置')) { await i.click(); break }
  }
  await wait(800)
  console.log('Capturing: project permission - roles tab')
  await page.screenshot({ path: path.join(__dirname, 'v1-project-perm-roles.png') })
  console.log('  -> saved')

  // Switch to permission tab
  const tabs2 = await page.$$('.ant-tabs-tab')
  for (const tab of tabs2) {
    const t = await page.evaluate(el => el.textContent, tab)
    if (t && t.includes('权限配置')) { await tab.click(); break }
  }
  await wait(500)
  console.log('Capturing: project permission - perms tab')
  await page.screenshot({ path: path.join(__dirname, 'v1-project-perm-perms.png') })
  console.log('  -> saved')

  await browser.close()
  console.log('\nDone!')
}

capture().catch(e => { console.error(e); process.exit(1) })
