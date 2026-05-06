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

  await page.goto(BASE, { waitUntil: 'networkidle2' })
  await wait(500)

  // Click "项目路标视图" in header nav
  const items = await page.$$('.ant-menu-item')
  for (const i of items) {
    const t = await page.evaluate(el => el.textContent, i)
    if (t && t.includes('路标')) { await i.click(); break }
  }
  await wait(1000)

  // 1. Software product view (default)
  console.log('Capturing: roadmap - software product')
  await page.screenshot({ path: path.join(__dirname, 'v1-roadmap-software.png') })
  console.log('  -> saved')

  // 2. Switch to 整机产品项目 tab
  const tabs = await page.$$('.ant-tabs-tab')
  for (const tab of tabs) {
    const t = await page.evaluate(el => el.textContent, tab)
    if (t && t.includes('整机')) { await tab.click(); break }
  }
  await wait(800)

  console.log('Capturing: roadmap - whole machine')
  await page.screenshot({ path: path.join(__dirname, 'v1-roadmap-machine.png') })
  console.log('  -> saved')

  await browser.close()
  console.log('\nDone!')
}

capture().catch(e => { console.error(e); process.exit(1) })
