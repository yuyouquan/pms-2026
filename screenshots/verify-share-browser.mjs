import assert from 'node:assert/strict'
import fs from 'node:fs'
import puppeteer from 'puppeteer'

const base = process.env.PMS_BASE_URL || 'http://127.0.0.1:3017'
const browser = await puppeteer.launch({ headless: true, args: ['--disable-gpu', '--disable-backgrounding-occluded-windows'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1000 })
const errors = [], results = []
page.on('pageerror', error => errors.push(String(error)))
try {
  for (const [id, level, hasData] of [['1', 'level1', true], ['19', 'level1', true], ['2', 'level1', false], ['1', 'level2', false]]) {
    await page.goto(`${base}/share/plan?projectId=${id}&level=${level}`, { waitUntil: 'networkidle0' })
    const state = await page.evaluate(() => ({
      body: document.body.innerText,
      rows: document.querySelectorAll('tbody tr[data-row-key]').length,
      controls: [...document.querySelectorAll('button')].map(button => button.innerText),
    }))
    assert.equal(state.rows > 0, hasData, `${id}/${level} exposes only supported published data`)
    assert.ok(!state.body.includes('修订中'), 'drafts are not shared')
    if (hasData) {
      assert.ok(state.body.includes('已发布'))
      assert.ok(state.body.includes('其他浏览器不会同步本地修改'))
    } else {
      assert.ok(/暂无|不支持/.test(state.body))
    }
    results.push({ id, level, rows: state.rows, passed: true })
  }
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ results, errors }, null, 2))
} finally {
  fs.writeFileSync('output/audit-20260907/share-browser.json', JSON.stringify({ results, errors }, null, 2))
  await browser.close()
}
