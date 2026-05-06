import puppeteer from 'puppeteer'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const wait = ms => new Promise(r => setTimeout(r, ms))

async function capture() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1440,1200'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1200 })

  const filePath = `file://${path.join(__dirname, 'architecture-diagram.html')}`
  await page.goto(filePath, { waitUntil: 'networkidle2' })
  await wait(500)

  await page.screenshot({ path: path.join(__dirname, 'v1-architecture.png'), fullPage: true })
  console.log('Architecture diagram captured!')

  await browser.close()
}

capture().catch(e => { console.error(e); process.exit(1) })
