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
  const items = await page.$$('.ant-menu-item')
  for (const i of items) {
    const t = await page.evaluate(el => el.textContent, i)
    if (t && t.includes('权限中心')) { await i.click(); break }
  }
  await wait(800)
  console.log('Capturing: global permission - roles (fixed)')
  await page.screenshot({ path: path.join(__dirname, 'v1-global-perm-roles.png') })
  console.log('  -> saved')

  await browser.close()
  console.log('Done!')
}

capture().catch(e => { console.error(e); process.exit(1) })
