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

  // Step 1: Go to workspace
  await page.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(800)

  // Step 2: Click project card X6877 to enter project space
  const cards = await page.$$('.ant-card')
  for (const card of cards) {
    const t = await page.evaluate(el => el.textContent, card)
    if (t && t.includes('NOTE 50 Pro')) { await card.click(); break }
  }
  await wait(1500)

  // Step 3: Now in project space, find "权限配置" in sidebar menu
  // The sidebar uses pms-sidebar class
  const sidebarItems = await page.$$('.pms-sidebar .ant-menu-item')
  console.log(`Found ${sidebarItems.length} sidebar items`)
  for (const item of sidebarItems) {
    const t = await page.evaluate(el => el.textContent, item)
    console.log(`  Sidebar item: "${t}"`)
    if (t && t.includes('权限配置')) {
      await item.click()
      console.log('  -> Clicked 权限配置')
      break
    }
  }
  await wait(1000)

  // Capture roles tab
  console.log('Capturing: project permission - roles tab')
  await page.screenshot({ path: path.join(__dirname, 'v1-project-perm-roles.png') })
  console.log('  -> saved')

  // Click "权限配置" tab (not the sidebar, but the tab inside the permission component)
  const allTabs = await page.$$('.ant-tabs-tab')
  for (const tab of allTabs) {
    const t = await page.evaluate(el => el.textContent, tab)
    console.log(`  Tab: "${t}"`)
    if (t && t.includes('权限配置') && !t.includes('角色')) {
      await tab.click()
      console.log('  -> Clicked 权限配置 tab')
      break
    }
  }
  await wait(800)

  console.log('Capturing: project permission - perms tab')
  await page.screenshot({ path: path.join(__dirname, 'v1-project-perm-perms.png') })
  console.log('  -> saved')

  await browser.close()
  console.log('\nDone!')
}

capture().catch(e => { console.error(e); process.exit(1) })
