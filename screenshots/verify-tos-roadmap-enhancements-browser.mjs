import assert from 'node:assert/strict'
import fs from 'node:fs'
import puppeteer from 'puppeteer'

const baseUrl = process.env.PMS_BASE_URL || 'http://127.0.0.1:3034'
const output = process.env.PMS_BROWSER_OUTPUT || 'output/playwright/tos-roadmap-enhancements'
fs.mkdirSync(output, { recursive: true })
const browser = await puppeteer.launch({ headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
const errors = []
page.on('pageerror', error => errors.push(error.message))
const consoleErrors = []
page.on('console', message => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
const results = []
const tick = () => new Promise(resolve => setTimeout(resolve, 180))
async function clickText(selector, text) {
  const result = await page.$$eval(selector, (elements, expected) => {
    const element = elements.find(candidate => candidate.getBoundingClientRect().width > 0 && candidate.textContent.trim() === expected)
    element?.click()
    return Boolean(element)
  }, text)
  assert.ok(result, `visible control ${text}`)
  await tick()
}
async function openRoadmap() {
  await page.waitForSelector('[role="menuitem"]', { timeout: 60000 })
  await clickText('[role="menuitem"]', 'tOS路标')
  await page.waitForSelector('.roadmap-table th', { visible: true })
}
const header = key => `.roadmap-table th[data-project-list-header-id="roadmap::${key}"]`
const order = () => page.$$eval('.roadmap-table thead th[data-project-list-column-unit]', els => els.map(el => el.dataset.projectListColumnUnit))
const savedRoadmap = () => page.evaluate(() => JSON.parse(localStorage.getItem('pms-project-roadmap')).state)
async function drag(from, to) {
  const source = await page.$(from), target = await page.$(to)
  const a = await source.boundingBox(), b = await target.boundingBox()
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await tick()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 14 })
  await tick()
  await page.mouse.up()
  await tick()
}
try {
  await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 })
  await openRoadmap()
  await page.click(header('marketName'))
  assert.equal(await page.$eval(header('marketName'), el => el.getAttribute('aria-sort')), 'ascending')
  await page.focus(header('marketName'))
  await page.keyboard.press('Enter')
  assert.equal(await page.$eval(header('marketName'), el => el.getAttribute('aria-sort')), 'descending', 'keyboard sorting must survive draggable headers')
  const beforeSort = (await savedRoadmap()).sort
  const handle = await page.$(`${header('marketName')} [role="separator"]`)
  const handleBox = await handle.boundingBox()
  const beforeWidth = await page.$eval(header('marketName'), el => el.getBoundingClientRect().width)
  await page.mouse.move(handleBox.x + 3, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(handleBox.x + 83, handleBox.y + handleBox.height / 2, { steps: 10 })
  await page.mouse.up()
  assert.ok(await page.$eval(header('marketName'), el => el.getBoundingClientRect().width) >= beforeWidth + 75)
  assert.deepEqual((await savedRoadmap()).sort, beforeSort, 'resizing must not toggle sort')
  await drag(header('marketName'), header('brand'))
  const reordered = await order()
  assert.ok(reordered.indexOf('marketName') < reordered.indexOf('brand'), 'header drag updates visible order')
  assert.deepEqual((await savedRoadmap()).sort, beforeSort, 'drag must not toggle sort')
  await page.focus(header('brand'))
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowRight')
  await tick()
  await page.keyboard.press('Enter')
  await tick()
  assert.deepEqual((await savedRoadmap()).sort, beforeSort, 'keyboard drop must not toggle sort')
  await page.click('[aria-label="字段配置"]')
  await page.waitForSelector('[role="dialog"][aria-label="字段配置"]', { visible: true })
  const panel = '[role="dialog"][aria-label="字段配置"]'
  await page.waitForFunction(selector => document.querySelector(selector)?.closest('.ant-popover')?.getAnimations({ subtree: true }).every(animation => animation.playState !== 'running'), {}, panel)
  const panelOrder = await page.$$eval(`${panel} [role="group"]`, els => els.map(el => el.getAttribute('aria-label')))
  assert.ok(panelOrder.indexOf('市场名') < panelOrder.indexOf('品牌'))
  await drag(`${panel} [aria-label="拖动品牌调整顺序"]`, `${panel} [aria-label="拖动市场名调整顺序"]`)
  assert.ok((await order()).indexOf('brand') < (await order()).indexOf('marketName'), 'field settings drag updates table order')
  await page.click('[aria-label="字段配置"]')
  const persisted = await savedRoadmap()
  await page.reload({ waitUntil: 'networkidle0' })
  await openRoadmap()
  assert.deepEqual((await savedRoadmap()).columnOrder, persisted.columnOrder)
  assert.equal(await page.$eval(header('marketName'), el => el.getBoundingClientRect().width), beforeWidth + 80)
  results.push('roadmap click/keyboard sort, header and settings drag, resize, refresh persistence')

  // Controlled fixtures live only in this fresh browser profile; production mocks stay intact.
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('pms-projects'))
    const sample = saved.state.projects.find(project => project.id === 'mock-roadmap-incomplete')
    const minimal = { ...sample, id: 'qa-roadmap-minimal', name: 'QA路标最少必填', projectCode: 'QAMIN', brand: '', productLine: '', productSeries: '', marketName: '', chipCode: '', startRam: '', versionType: '', developMode: '', remark: '', str5Date: '', launchDate: '', boundFormalProjectId: null, fieldValues: {} }
    const cancelled = { ...minimal, id: 'qa-cancelled', name: 'QA已取消不展示', status: '已取消', firstSaleTosVersionId: '18.0' }
    const paused = { ...minimal, id: 'qa-paused', name: 'QA已暂停不展示', status: '已暂停', firstSaleTosVersionId: '18.0' }
    const incomplete = { ...minimal, id: 'qa-missing', name: 'QA缺必填不展示', androidVersion: '', firstSaleTosVersionId: '18.0' }
    const branded = { ...minimal, id: 'qa-branded', name: 'QA有品牌市场名', brand: '示例品牌A', marketName: 'TECNO CAMON 40', firstSaleTosVersionId: '16.3', str5Date: '2026-10-01', launchDate: '2026-11-01', fieldValues: { chipCode: 'DEMOCHIP001' } }
    const formal = saved.state.projects.find(project => project.id === '1')
    const secondFormal = { ...formal, id: 'qa-formal-sort', name: 'ZZZ排序测试项目', projectCode: 'QASORT', marketName: 'TECNO AARDVARK', fieldValues: { ...formal.fieldValues, marketName: 'TECNO AARDVARK' } }
    saved.state.projects = [{ ...formal, marketName: 'TECNO CAMON 40', fieldValues: { ...formal.fieldValues, marketName: 'TECNO CAMON 40' } }, secondFormal, minimal, cancelled, paused, incomplete, branded]
    localStorage.setItem('pms-projects', JSON.stringify(saved))
    const roadmap = JSON.parse(localStorage.getItem('pms-project-roadmap'))
    roadmap.state.sort = { field: null, direction: null }
    localStorage.setItem('pms-project-roadmap', JSON.stringify(roadmap))
  })
  await page.reload({ waitUntil: 'networkidle0' })
  await openRoadmap()
  const tableText = await page.$eval('.roadmap-table', el => el.innerText)
  assert.ok(tableText.includes('QA路标最少必填'), 'four fields sufficient even without dates or brand')
  for (const name of ['QA已取消不展示', 'QA已暂停不展示', 'QA缺必填不展示']) assert.ok(!tableText.includes(name), name)
  assert.ok(tableText.includes('CAMON 40') && !tableText.includes('TECNO CAMON 40'))
  await clickText('.ant-segmented-item-label', '版本演进视图')
  await page.waitForSelector('.pms-roadmap-evolution-grid')
  const evolutionText = await page.$eval('.pms-roadmap-evolution-grid', el => el.innerText)
  assert.ok(evolutionText.includes('QA路标最少必填') && evolutionText.includes('未填写品牌'))
  assert.ok(!evolutionText.includes('tOS18.0'), 'empty version whole column hidden')
  assert.ok(evolutionText.includes('CAMON 40') && !evolutionText.includes('TECNO CAMON 40'))
  await clickText('[aria-label="品牌快捷筛选"] .ant-segmented-item-label', '示例品牌A')
  assert.ok(!(await page.$eval('.pms-roadmap-evolution-grid', el => el.innerText)).includes('tOS17.2'), 'filter hides version when last project removed')
  await page.screenshot({ path: `${output}/evolution.png`, fullPage: true })
  results.push('status and required-field eligibility, undated/unbranded card, market label, filtered empty-version columns')

  await clickText('[aria-label="品牌快捷筛选"] .ant-segmented-item-label', '全部')
  await clickText('.ant-segmented-item-label', '表单视图')
  await clickText('.roadmap-table-project-name', 'QA路标最少必填')
  await page.waitForSelector('.pms-roadmap-project-info')
  await clickText('.pms-roadmap-project-info button', '编辑')
  await page.waitForSelector('.pms-roadmap-space-editor', { visible: true })
  const requiredLabels = await page.$$eval('.pms-roadmap-space-editor .ant-form-item-required', els => els.map(el => el.textContent.trim()))
  assert.deepEqual(requiredLabels.sort(), ['项目二级分类', '安卓版本', '产品类型', 'tOS 版本'].sort(), 'editor marks only the four required fields')
  await page.screenshot({ path: `${output}/roadmap-editor.png`, fullPage: true })
  await page.type('.pms-roadmap-space-editor textarea', '仅填写四项，其他字段保持空白')
  await clickText('.pms-roadmap-space-editor button', '保存修改')
  await page.waitForFunction(() => !document.querySelector('.pms-roadmap-space-editor') || document.querySelector('.pms-roadmap-space-editor').getBoundingClientRect().height === 0)
  const savedMinimal = await page.evaluate(() => JSON.parse(localStorage.getItem('pms-projects')).state.projects.find(project => project.id === 'qa-roadmap-minimal'))
  assert.equal(savedMinimal.remark, '仅填写四项，其他字段保持空白')
  assert.equal(savedMinimal.str5Date || '', '')
  assert.equal(savedMinimal.launchDate || '', '')
  assert.equal(savedMinimal.marketName || '', '')
  results.push('real roadmap editor saves with only four required fields and no optional dates, brand or chip')
  await clickText('button', '返回tOS路标')

  await clickText('.roadmap-table-project-name', 'QA有品牌市场名')
  await page.waitForSelector('.pms-roadmap-project-info')
  await clickText('.pms-roadmap-project-info button', '编辑')
  await page.waitForSelector('.pms-roadmap-space-editor', { visible: true })
  for (const field of ['brand', 'chipCode', 'str5Date', 'launchDate']) {
    const control = await page.$(`#${field}`)
    const clear = await control.evaluateHandle(el => el.closest('.ant-select, .ant-picker').querySelector('.ant-select-clear, .ant-picker-clear'))
    const element = clear.asElement()
    assert.ok(element, `${field} can be cleared`)
    await control.hover()
    await element.click()
    await tick()
  }
  await page.click('#marketName', { clickCount: 3 })
  await page.keyboard.press('Backspace')
  await clickText('.pms-roadmap-space-editor button', '保存修改')
  await page.waitForFunction(() => !document.querySelector('.pms-roadmap-space-editor') || document.querySelector('.pms-roadmap-space-editor').getBoundingClientRect().height === 0)
  const cleared = await page.evaluate(() => JSON.parse(localStorage.getItem('pms-projects')).state.projects.find(project => project.id === 'qa-branded'))
  for (const field of ['brand', 'marketName', 'str5Date', 'launchDate']) assert.equal(cleared[field] || '', '', `${field} saved empty`)
  assert.equal(cleared.fieldValues.chipCode || '', '', 'chip clearing is preserved')
  results.push('clearing existing optional brand, market name, chip and both dates persists')
  await clickText('button', '返回tOS路标')

  await clickText('[role="menuitem"]', '项目管理')
  await page.waitForSelector('.pms-project-summary-table th')
  assert.ok((await page.$eval('.pms-project-summary-table', el => el.innerText)).includes('CAMON 40'))
  assert.ok(!(await page.$eval('.pms-project-summary-table', el => el.innerText)).includes('TECNO CAMON 40'))
  const projectHeader = '.pms-project-summary-table th[data-project-list-header-id="leaf::projectName"]'
  for (const expected of ['ascending', 'descending', 'none']) {
    await page.click(projectHeader)
    assert.equal(await page.$eval(projectHeader, el => el.getAttribute('aria-sort')), expected)
    if (expected !== 'none') {
      const names = await page.$$eval('.pms-project-summary-table .pms-project-name-text', els => els.map(el => el.textContent.trim()))
      assert.equal(names.at(expected === 'ascending' ? -1 : 0), 'ZZZ排序测试项目', 'project rows follow header direction')
    }
  }
  await page.screenshot({ path: `${output}/project-view.png`, fullPage: true })
  results.push('project view three-state sort and market label')
  await page.click('.pms-project-summary-table th[data-project-list-header-id="leaf::marketName"]')
  await page.click('[aria-label="字段配置"]')
  await page.waitForSelector('[aria-label="市场名列已显示"]', { visible: true })
  await page.click('[aria-label="市场名列已显示"]')
  assert.equal(await page.$$eval('.pms-project-summary-table th[aria-sort="ascending"], .pms-project-summary-table th[aria-sort="descending"]', els => els.length), 0, 'hiding sorted column clears sort')
  await page.click('[aria-label="市场名列已隐藏"]')
  await page.click('[aria-label="字段配置"]')
  results.push('hiding a sorted project column clears invisible sorting')
  assert.deepEqual(errors, [], 'browser runtime errors')
  assert.deepEqual(consoleErrors, [], 'browser console errors')
  const report = { baseUrl, mode: process.env.PMS_BUILD_MODE || 'unspecified', verifiedAt: new Date().toISOString(), results, errors, consoleErrors }
  fs.writeFileSync(`${output}/results.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true })
  console.error((await page.$eval('body', el => el.innerText)).slice(-5000))
  throw error
} finally {
  await browser.close()
}
