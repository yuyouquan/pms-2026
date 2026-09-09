import assert from 'node:assert/strict'
import fs from 'node:fs'
import puppeteer from 'puppeteer'

const base = process.env.PMS_BASE_URL || 'http://127.0.0.1:3017'
const output = process.env.PMS_UI_OUTPUT || 'output/audit-20260907/system-ui'
const captureScreenshots = process.env.PMS_CAPTURE_SCREENSHOTS !== '0'
const screenshotNames = process.env.PMS_UI_SCREENSHOT_NAMES?.split(',')
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
    const tableSelector = '.ant-table table, .pms-page-shell table:not(.ant-picker-panel table)'
    const headers = `${tableSelector.split(', ').map(selector => `${selector} th`).join(', ')}, .gantt_grid_head_cell, .gantt_scale_cell, [role="table"] [role="columnheader"]`
    const cells = `${tableSelector.split(', ').map(selector => `${selector} tbody tr:not(.ant-table-measure-row) > td, ${selector} tfoot td`).join(', ')}, .gantt_cell, .gantt_task_content, [role="table"] [role="cell"]`
    const textViolations = []
    for (const [selector, expected] of [[headers, '14px'], [cells, '12px']]) {
      for (const cell of document.querySelectorAll(selector)) {
        if (!visible(cell) || cell.closest('.ant-table-measure-row')) continue
        for (const element of [cell, ...cell.querySelectorAll('*')]) {
          if (!visible(element) || element.closest('.anticon, .ant-avatar, sup, .gantt_tree_icon, .gantt_tree_indent, .gantt_folder_open, .gantt_folder_closed, .gantt_file')) continue
          const text = [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join('').trim()
          const value = element.matches('input, textarea') ? element.value : ''
          if (!(text || value)) continue
          const font = getComputedStyle(element).fontSize
          if (font !== expected) textViolations.push({ text: (text || value).slice(0, 40), font, expected, className: element.className })
        }
      }
    }
    return {
      textViolations,
      viewport: innerWidth,
      overflow: document.documentElement.scrollWidth - innerWidth,
      body: getComputedStyle(document.body).fontSize,
      headers: measure(headers), cells: measure(cells),
      controls: measure('.ant-btn:not(.ant-btn-link):not(.ant-btn-text),.ant-select-single'),
      mainPadding: document.querySelector('.pms-main-content') ? getComputedStyle(document.querySelector('.pms-main-content')).padding : null,
      ganttRows: measure('.gantt_row'),
    }
  })
  results.push({ name, ...metrics })
  if (metrics.textViolations.length) console.log('TEXT VIOLATIONS', JSON.stringify(metrics.textViolations.slice(0, 8)))
  if (captureScreenshots && (!screenshotNames || screenshotNames.includes(name))) await page.screenshot({ path: `${output}/${name}.png` })
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
    if (name === 'hr-empty') {
      for (const [label, key] of [['整机产品项目', 'machine'], ['tOS项目', 'tos'], ['技术项目', 'technical'], ['能力建设项目', 'capability']]) {
        await click(label, '.pms-hr-sidebar-leaf')
        await capture(`hr-${key}-projects`)
        await click('项目预估投入空间', '.ant-segmented-item-label')
        await capture(`hr-${key}-versions`)
        await click('项目月度预估投入', '.ant-segmented-item-label')
        await capture(`hr-${key}-monthly`)
      }
      for (const [index, label] of ['人力模型', 'tOS阶段投入比', '品牌&产品线分摊比', '模块与部门', 'TMG及技术领域', '技术阶段投入比'].entries()) {
        await click(label, '.pms-hr-sidebar-leaf')
        await capture(`hr-config-${index + 1}`)
      }
    }
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
      await page.waitForSelector('.gantt_grid_head_cell', { visible: true })
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
  await page.waitForSelector('.gantt_grid_head_cell', { visible: true })
  await capture('share-gantt')
  for (const route of ['level1-template', 'level2-template']) {
    await page.goto(`${base}/config/${route}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('.pms-config-center-switch')
    await capture(`legacy-${route}`)
  }
  await openProject('整机产品项目', '1')
  await click('计划')
  await page.$eval('[aria-label="竖版表格"]', element => element.click())
  if (await page.$('button[aria-label="创建修订"]')) {
    await page.click('button[aria-label="创建修订"]')
    await click('创建正式版本', '[role="menuitem"]')
  }
  await page.waitForSelector('.pms-table-edit')
  await capture('machine-plan-edit')
  assert.ok(await page.$('.pms-table-edit input'), 'edit-state table has rendered inputs')
  const violations = results.flatMap(result => [
    ...result.textViolations.map(item => `${result.name}: text ${item.text}: ${item.font}, expected ${item.expected}`),
    ...(result.overflow > 1 ? [`${result.name}: page overflow ${result.overflow}`] : []),
    ...result.headers.filter(item => item.font !== '14px').map(item => `${result.name}: header ${item.text}: ${item.font}`),
    ...result.cells.filter(item => item.font !== '12px').map(item => `${result.name}: cell ${item.text}: ${item.font}`),
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
