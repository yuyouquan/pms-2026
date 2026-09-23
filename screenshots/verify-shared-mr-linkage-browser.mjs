#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import puppeteer from 'puppeteer'

const base = process.env.PMS_BASE_URL || 'http://127.0.0.1:3042'
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'pms-shared-mr-linkage-'))
const browser = await puppeteer.launch({ headless: true, protocolTimeout: 20000 })
const errors = []
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
async function createPage() {
  const page = await browser.newPage()
  await page.setViewport({ width: 1680, height: 1100 })
  page.setDefaultTimeout(15000)
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.evaluateOnNewDocument(() => {
    window.__qaPlanWrites = 0
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = function(key, value) {
      if (key === 'pms-plan-store') window.__qaPlanWrites += 1
      return setItem.call(this, key, value)
    }
  })
  await page.goto(base, { waitUntil: 'networkidle2' })
  return page
}
const textSelector = 'button,[role="menuitem"],[role="tab"],.ant-segmented-item-label,.ant-select-item-option-content'
async function clickText(page, text) {
  await page.bringToFront()
  await page.waitForFunction(({ selector, text }) => [...document.querySelectorAll(selector)].some(node => node.textContent.trim() === text && node.getBoundingClientRect().width), {}, { selector: textSelector, text })
  await page.evaluate(({ selector, text }) => [...document.querySelectorAll(selector)].find(node => node.textContent.trim() === text && node.getBoundingClientRect().width).click(), { selector: textSelector, text })
}
async function clickAria(page, name) {
  await page.bringToFront()
  const selector = `button[aria-label=${JSON.stringify(name)}]`
  await page.waitForSelector(selector, { visible: true })
  await page.$eval(selector, node => node.click())
}
async function fill(page, name, value, commit = true) {
  await page.bringToFront()
  const selector = `input[aria-label=${JSON.stringify(name)}]`
  await page.waitForSelector(selector, { visible: true })
  await page.$eval(selector, (input, value) => {
    input.focus()
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
  if (commit) await page.keyboard.press('Enter')
}
async function openTosPlan(page) {
  await clickText(page, '项目管理')
  await clickText(page, '项目配置')
  await fill(page, '筛选项目名称', 'tOS16.3')
  await clickText(page, 'tOS16.3')
  await page.waitForSelector('.pms-project-space')
  await clickText(page, '计划')
  await page.waitForSelector('input[aria-label="横版表格"]')
}
async function verticalL1(page) {
  await page.bringToFront()
  await page.$eval('input[aria-label="竖版表格"]', input => input.closest('label').click())
  await page.waitForSelector('.pms-level1-tree-table')
}
async function addNode(page, name) {
  await clickAria(page, '添加业务节点 维护阶段')
  await fill(page, '业务节点名称', name, false)
  await clickText(page, '确认添加')
  await page.waitForSelector(`button[aria-label="修改业务节点 ${name}"]`)
}
const readMr = page => page.evaluate(() => JSON.parse(localStorage.getItem('pms-mr-version-plan-store')).state)
try {
  const source = await createPage()
  await openTosPlan(source)
  await verticalL1(source)
  const peer = await createPage()
  await openTosPlan(peer)
  await clickText(peer, '三级计划-MR版本计划')
  assert.equal(await peer.$('button[aria-label="新增tOS版本号"]'), null)
  await clickAria(source, '取消修订')
  await clickText(source, '确认取消')
  await addNode(source, '16.3.0.170')
  await peer.waitForSelector('[aria-label^="16.3.0.170 日期不可填写"]')
  assert.equal(await peer.$('input[aria-label="16.3.0.170-修改点收集开始时间-日期"]'), null)
  await fill(source, 'planStartDate 16.3.0.170', '2026-10-16')
  await fill(source, 'planEndDate 16.3.0.170', '2026-11-01')
  await fill(peer, '16.3.0.170-修改点收集开始时间-日期', '2026-10-18')
  console.log('PASS latest published addition, automatic MR and cross-tab date gating')

  // Isolated browser fixture: a downstream machine has already entered its MR dates.
  const seeder = await createPage()
  await seeder.evaluate(() => {
    const key = 'pms-mr-version-plan-store'
    const saved = JSON.parse(localStorage.getItem(key))
    const row = saved.state.tosInstancesByProjectId['19'].find(row => row.tosVersion === '16.3.0.170')
    const leaf = row.activities.find(item => item.activityName === '修改点收集开始时间')
    saved.state.machinePlansByKey['1::16.3.0.170'] = { projectId: '1', tosProjectId: '19', tosVersion: '16.3.0.170', transferType: '3', dates: { [leaf.id]: '2026-10-19' }, updatedBy: 'QA', updatedAt: '2026-09-23' }
    saved.state.machineRowLocks['1::19::16.3.0.170'] = { key: '1::19::16.3.0.170', projectId: '1', tosProjectId: '19', tosVersion: '16.3.0.170', lockedBy: 'QA', lockedAt: '2026-09-23' }
    localStorage.setItem(key, JSON.stringify(saved))
  })
  await seeder.close()
  await clickAria(source, '修改业务节点 16.3.0.170')
  await fill(source, '业务节点新名称 16.3.0.170', '16.3.0.175', false)
  await clickText(source, '确认修改')
  await peer.waitForSelector('input[aria-label="16.3.0.175-修改点收集开始时间-日期"]')
  let state = await readMr(peer)
  assert.equal(state.tosInstancesByProjectId['19'].find(row => row.tosVersion === '16.3.0.175').dates['mr-node-change-collection'], '2026-10-18')
  assert.equal(state.machinePlansByKey['1::16.3.0.175'].dates['mr-node-change-collection'], '2026-10-19')
  assert.equal(state.machinePlansByKey['1::16.3.0.175'].transferType, '3')
  assert.ok(state.machineRowLocks['1::19::16.3.0.175'])
  assert.equal(state.machinePlansByKey['1::16.3.0.170'], undefined)
  console.log('PASS source rename preserves persisted MR and downstream dates, transfer type and lock')

  await clickAria(source, '删除节点 16.3.0.175')
  await clickText(source, '确认')
  await peer.waitForSelector('input[aria-label="16.3.0.175-修改点收集开始时间-日期"]', { hidden: true })
  await addNode(source, '16.3.0.175')
  await peer.waitForSelector('[aria-label^="16.3.0.175 日期不可填写"]')
  state = await readMr(peer)
  assert.deepEqual(state.tosInstancesByProjectId['19'].find(row => row.tosVersion === '16.3.0.175').dates, {})
  assert.deepEqual(state.machinePlansByKey['1::16.3.0.175']?.dates || {}, {}, 're-created machine projection has no old dates')
  assert.equal(state.machineRowLocks['1::19::16.3.0.175'], undefined)
  console.log('PASS deleting and recreating the same name does not resurrect downstream data')

  await clickAria(source, '创建修订')
  await clickText(source, '创建非正式版本')
  await source.waitForSelector('button[aria-label="发布"]', { visible: true })
  await wait(1000)
  const beforeWrites = await Promise.all([source, peer].map(page => page.evaluate(() => window.__qaPlanWrites)))
  await wait(1500)
  const afterWrites = await Promise.all([source, peer].map(page => page.evaluate(() => window.__qaPlanWrites)))
  assert.deepEqual(afterWrites, beforeWrites, 'different version selections must settle without cross-tab write echoes')
  assert.equal(await source.$('button[aria-label="修改业务节点 16.3.0.175"]'), null, 'draft business children are read-only')
  assert.equal(await source.$('button[aria-label="添加业务节点 维护阶段"]'), null, 'draft cannot add business children')
  assert.equal(await source.$('input[aria-label="planStartDate 16.3.0.175"]'), null)
  const centerDelta = await source.$$eval('.pms-level1-tree-table tr', rows => {
    const cells = rows.find(row => row.textContent.includes('16.3.0.175')).querySelectorAll('td')
    const number = cells[0].querySelector('.ant-space-item:last-child span').getBoundingClientRect()
    const name = cells[1].querySelector('.ant-space-item:first-child span').getBoundingClientRect()
    return Math.abs(number.y + number.height / 2 - name.y - name.height / 2)
  })
  assert.ok(centerDelta <= 1, `sequence and task name centers differ by ${centerDelta}px`)
  await clickAria(source, '发布')
  // Publishing a partial business node is allowed; source availability is a warning in MR.
  await source.waitForSelector('button[aria-label="创建修订"]', { visible: true })
  await peer.waitForSelector('[aria-label^="16.3.0.175 日期不可填写"]')
  console.log('PASS draft creation settles across tabs, sequence aligns and publish preserves shared nodes')
  await peer.bringToFront()
  fs.writeFileSync(path.join(output, 'mr-source-warning.txt'), await peer.evaluate(() => document.body.innerText))
  await peer.reload({ waitUntil: 'networkidle2' })
  state = await readMr(peer)
  assert.ok(state.tosInstancesByProjectId['19'].some(row => row.tosVersion === '16.3.0.175'))
  assert.deepEqual(state.machinePlansByKey['1::16.3.0.175']?.dates || {}, {}, 're-created machine projection has no old dates')
  assert.deepEqual(errors, [], 'no browser runtime errors')
  console.log(`PASS refresh persistence and runtime errors; evidence: ${output}`)
} catch (error) {
  console.error(error)
  for (const [index, page] of (await browser.pages()).entries()) {

    fs.writeFileSync(path.join(output, `failure-${index}.txt`), await page.evaluate(() => document.body.innerText).catch(() => 'Page unavailable'))
  }
  console.error(`Failure evidence: ${output}`)
  throw error
} finally {
  await browser.close()
}
