import puppeteer from 'puppeteer'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = 'http://localhost:3000'
const wait = ms => new Promise(r => setTimeout(r, ms))

async function dumpState(page, label) {
  const info = await page.evaluate(() => {
    const menuItems = Array.from(document.querySelectorAll('.ant-menu-item')).map(e => e.textContent?.trim())
    const buttons = Array.from(document.querySelectorAll('button')).slice(0, 30).map(b => ({
      text: b.textContent?.trim().slice(0, 20),
      hasDownload: !!b.querySelector('.anticon-download'),
      iconClasses: Array.from(b.querySelectorAll('[class*="anticon-"]')).map(i => i.className).join(','),
    }))
    const downloadBtnCount = document.querySelectorAll('.anticon-download').length
    return { menuItems, buttons, downloadBtnCount, url: location.href }
  })
  console.log(`[${label}]`)
  console.log('  url:', info.url)
  console.log('  menuItems:', JSON.stringify(info.menuItems))
  console.log('  download icons on page:', info.downloadBtnCount)
  console.log('  first buttons:', JSON.stringify(info.buttons.filter(b => b.hasDownload || b.text?.includes('导出')).slice(0, 5)))
}

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--window-size=1600,1000'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 })

  console.log('=== Test 1: Initial page ===')
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 })
  await wait(2000)
  await dumpState(page, 'after goto')
  await page.screenshot({ path: path.join(__dirname, 'debug-01-landing.png') })

  console.log('\n=== Test 2: Click 路标 menu item ===')
  const items = await page.$$('.ant-menu-item')
  for (const i of items) {
    const t = await page.evaluate(el => el.textContent, i)
    if (t && t.includes('路标')) {
      console.log('  clicking:', t.trim())
      await i.click()
      break
    }
  }
  await wait(2500)
  await dumpState(page, 'after click 路标')
  await page.screenshot({ path: path.join(__dirname, 'debug-02-after-roadmap-click.png') })

  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
