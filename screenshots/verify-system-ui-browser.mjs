import assert from 'node:assert/strict'
import fs from 'node:fs'
import puppeteer from 'puppeteer'

const base = process.env.PMS_BASE_URL || 'http://127.0.0.1:3017'
const output = 'output/audit-20260907/system-ui'
const captureScreenshots = process.env.PMS_CAPTURE_SCREENSHOTS !== '0'
fs.mkdirSync(output, { recursive: true })
const browser = await puppeteer.launch({ headless: true, protocolTimeout: 30000, args: ['--disable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] })
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
const errors = [], results = []
page.on('pageerror', error => errors.push(String(error)))
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`) })
const click = async (text, selector = 'button,[role="menuitem"],.ant-segmented-item-label') => {
  await page.waitForFunction(({ text, selector }) => [...document.querySelectorAll(selector)].some(element =>
    element.getBoundingClientRect().height > 0 && element.textContent.trim() === text), { polling: 100 }, { text, selector })
  await page.evaluate(({ text, selector }) => {
    const element = [...document.querySelectorAll(selector)].find(element => element.getBoundingClientRect().height > 0 && element.textContent.trim() === text)
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    element.click()
  }, { text, selector })
}
const capture = async name => {
  console.log(`CHECK ${name}`)
  await page.bringToFront()
  await page.mouse.move(2, 2)
  // Give CSS entry transitions time to finish without waiting on renderer
  // animation-frame promises, which are paused by some headless environments.
  await new Promise(resolve => setTimeout(resolve, 400))
  const metrics = await page.evaluate(() => {
    const visible = element => element.getBoundingClientRect().height > 0 && getComputedStyle(element).visibility !== 'hidden'
    const measure = selector => [...document.querySelectorAll(selector)].filter(visible).slice(0, 80).map(element => {
      const style = getComputedStyle(element), rect = element.getBoundingClientRect()
      return { text: element.innerText?.trim().slice(0, 40), font: style.fontSize, line: style.lineHeight,
        height: Math.round(rect.height), padding: style.padding, rowSpan: element.rowSpan || 1 }
    })
    return {
      viewport: innerWidth,
      overflow: document.documentElement.scrollWidth - innerWidth,
      body: getComputedStyle(document.body).fontSize,
      headers: measure('thead th'), cells: measure('tbody tr:not(.ant-table-measure-row) > td'),
      controls: measure('.ant-btn:not(.ant-btn-link):not(.ant-btn-text),.ant-select-single'),
      mainPadding: document.querySelector('.pms-main-content') ? getComputedStyle(document.querySelector('.pms-main-content')).padding : null,
      ganttRows: measure('.gantt_row'),
    }
  })
  results.push({ name, ...metrics })
  if (captureScreenshots) await page.screenshot({ path: `${output}/${name}.png` })
  console.log(`CAPTURE ${name}: ${metrics.headers.length} headers, ${metrics.cells.length} cells, overflow ${metrics.overflow}`)
}
const openProject = async (category, id) => {
  await click('项目列表')
  await page.waitForSelector('[aria-label="项目分类筛选"]')
  await page.evaluate(category => [...document.querySelectorAll('[aria-label="项目分类筛选"] button')]
    .find(element => element.textContent.trim().startsWith(category))?.click(), category)
  await page.click('[aria-label="卡片视图"]')
  await page.waitForSelector(`[aria-label="打开项目 ${id}"]`)
  await page.click(`[aria-label="打开项目 ${id}"]`)
  await page.waitForSelector('[aria-label="项目空间导航"]')
}
try {
  await page.goto(base, { waitUntil: 'networkidle0' })
  await capture('workbench-plan')
  await page.click('[aria-label^="转维，"]')
  await capture('workbench-transfer')
  for (const [label, name] of [['项目列表', 'project-list'], ['联合项目空间', 'joint-mr'], ['tOS路标', 'roadmap'], ['人力资源管道', 'hr-empty'], ['配置中心', 'config-plan']]) {
    await click(label)
    await capture(name)
    if (name === 'roadmap') {
      await click('版本演进视图')
      await capture('roadmap-evolution')
      await click('表单视图')
      await click('筛选')
      await page.waitForSelector('[aria-label="关闭筛选"]', { visible: true })
      await capture('roadmap-filter')
      await page.click('[aria-label="关闭筛选"]')
    }
  }
  await click('转维材料模板配置')
  await capture('config-transfer')
  await click('枚举值配置')
  await capture('config-enums')
  // Known seeded top-level projects; technical child projects use another filter.
  for (const [category, id, name] of [['整机产品项目', '1', 'machine'], ['tOS版本项目', '2', 'tos'], ['技术项目', 'mock-tech-aios-v3', 'technical']]) {
    await openProject(category, id)
    await capture(`${name}-basic`)
    await click('计划')
    await capture(`${name}-plan-horizontal`)
    if (await page.$('[aria-label="竖版表格"]')) {
      await page.$eval('[aria-label="竖版表格"]', element => element.click())
      await capture(`${name}-plan-vertical`)
    }
    if (await page.$('[aria-label="甘特图"]')) {
      await page.$eval('[aria-label="甘特图"]', element => element.click())
      await page.waitForSelector('.gantt_container')
      await capture(`${name}-gantt`)
    }
    await click('权限配置')
    await capture(`${name}-permissions`)
    if (name === 'machine') {
      for (const [label, suffix] of [['概况', 'overview'], ['需求', 'requirements'], ['资源', 'resources'], ['任务', 'tasks'], ['风险', 'risks'], ['缺陷', 'bugs'], ['团队', 'team'], ['项目文档', 'documents']]) {
        await click(label, '[role="menuitem"]')
        await capture(`machine-${suffix}`)
      }
    }
    await click('返回项目列表')
  }
  await click('项目列表')
  await page.evaluate(() => [...document.querySelectorAll('[aria-label="项目分类筛选"] button')]
    .find(element => element.textContent.trim().startsWith('能力建设项目'))?.click())
  await capture('capability-empty')
  await page.evaluate(() => [...document.querySelectorAll('[aria-label="项目分类筛选"] button')]
    .find(element => element.textContent.trim().startsWith('整机产品项目'))?.click())
  await page.click('[aria-label="卡片视图"]')
  await capture('project-cards')
  await page.click('[aria-label="日历视图"]')
  await capture('project-calendar')
  await page.click('[aria-label="列表视图"]')
  await page.click('[aria-label="新增项目"]')
  await page.waitForSelector('[role="dialog"]')
  await capture('project-create-dialog')
  await page.keyboard.press('Escape')
  for (const width of [1440, 1024]) {
    await page.setViewport({ width, height: 1000 })
    await capture(`project-list-${width}`)
    await click('配置中心')
    await capture(`config-${width}`)
    await click('tOS路标')
    await capture(`roadmap-${width}`)
    await click('项目列表')
  }
  await page.setViewport({ width: 1600, height: 1000 })
  await page.goto(`${base}/share/plan?projectId=mock-tech-aios-v3&technical=1&kind=tdt`, { waitUntil: 'networkidle0' })
  await capture('share-technical')
  await click('横版表格')
  await capture('share-horizontal')
  await click('甘特图')
  await page.waitForSelector('.gantt_container')
  await capture('share-gantt')
  const violations = results.flatMap(result => [
    ...(result.overflow > 1 ? [`${result.name}: page overflow ${result.overflow}`] : []),
    ...result.headers.filter(item => item.font !== '16px').map(item => `${result.name}: header ${item.text}: ${item.font}`),
    ...result.cells.filter(item => item.font !== '14px').map(item => `${result.name}: cell ${item.text}: ${item.font}`),
    ...result.controls.filter(item => item.height !== 32).map(item => `${result.name}: control ${item.text}: ${item.height}`),
    ...result.ganttRows.filter(item => item.height !== 40).map(item => `${result.name}: Gantt row ${item.height}`),
  ])
  fs.writeFileSync(`${output}/metrics.json`, JSON.stringify({ captureScreenshots, results, violations, errors }, null, 2))
  assert.deepEqual(errors, [], 'no runtime/HTTP errors')
  assert.deepEqual(violations, [], 'all inspected system surfaces use the UI specification')
  console.log(`PASS ${results.length} system UI surfaces`)
} catch (error) {
  fs.writeFileSync(`${output}/metrics.json`, JSON.stringify({ captureScreenshots, results, errors, failure: String(error) }, null, 2))
  if (captureScreenshots) await page.screenshot({ path: `${output}/failure.png` }).catch(() => {})
  throw error
} finally { await browser.close() }
