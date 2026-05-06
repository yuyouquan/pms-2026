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

  // Navigate to project space -> plan
  await page.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(500)

  // Click first project card (X6877)
  const allCards = await page.$$('.ant-card')
  for (const card of allCards) {
    const text = await page.evaluate(el => el.textContent, card)
    if (text && text.includes('X6877')) { await card.click(); break }
  }
  await wait(1000)

  // Click "计划" in sidebar
  const menuItems = await page.$$('.ant-menu-item')
  for (const item of menuItems) {
    const text = await page.evaluate(el => el.textContent, item)
    if (text && text.includes('计划')) { await item.click(); break }
  }
  await wait(800)

  // Switch to draft version if possible: click version selector and pick 修订 if exists
  // First, click "创建修订" button if exists
  const buttons = await page.$$('.ant-btn')
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn)
    if (text && text.includes('创建修订')) {
      await btn.click()
      await wait(800)
      break
    }
  }

  // Now should be in edit mode - capture
  console.log('Capturing: edit mode - table')
  await page.screenshot({ path: path.join(__dirname, 'v1-edit-table.png') })
  console.log('  -> saved')

  // Capture gantt view in edit mode
  const radioBtns = await page.$$('.ant-radio-button-wrapper')
  for (const btn of radioBtns) {
    const text = await page.evaluate(el => el.textContent, btn)
    if (text && text.includes('甘特图')) { await btn.click(); break }
  }
  await wait(1000)
  console.log('Capturing: edit mode - gantt')
  await page.screenshot({ path: path.join(__dirname, 'v1-edit-gantt.png') })
  console.log('  -> saved')

  await browser.close()
  console.log('\nDone!')
}

capture().catch(e => { console.error(e); process.exit(1) })
