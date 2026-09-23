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
async function openPlan(page, projectName) {
  await clickText(page, '项目管理')
  await clickText(page, '项目配置')
  await fill(page, '筛选项目名称', projectName)
  await clickText(page, projectName)
  await page.waitForSelector('.pms-project-space')
  await clickText(page, '计划')
  await page.waitForSelector('input[aria-label="竖版表格"]')
  await page.$eval('input[aria-label="竖版表格"]', input => input.closest('label').click())
  await page.waitForSelector('.pms-level1-tree-table')
}
async function version(page, label) {
  await page.bringToFront()
  await page.$eval('input[aria-label="计划版本"]', input => input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
  await clickText(page, label)
  await wait(300)
}
async function scope(page, name) {
  await page.bringToFront()
  await page.evaluate(name => {
    const node = [...document.querySelectorAll('.ant-tag')].find(el => el.textContent.trim().startsWith(name))
    if (!node) throw new Error('missing scope ' + name)
    node.click()
  }, name)
  await wait(400)
}
const plan = page => page.evaluate(() => JSON.parse(localStorage.getItem('pms-plan-store')).state)
const business = (state, project, kind, scope) => Object.values(state.level1BusinessTasksByScope[JSON.stringify([project, kind, scope])] || {}).flat()
try {
  const page = await createPage()
  await openPlan(page, 'tOS16.3')
  assert.equal(await page.$('button[aria-label="添加业务节点 维护阶段"]'), null, 'draft cannot add')
  assert.equal(await page.$('input[aria-label="planStartDate 16.3.0.135"]'), null, 'draft dates readonly')
  console.log('select published version'); await version(page, 'V3 (已发布)')
  console.log('switch Slim'); await scope(page, 'Slim')
  assert.ok(await page.$('button[aria-label="修改业务节点 16.3.0.130"]'))
  assert.equal(await page.$('button[aria-label="修改业务节点 16.3.0.135"]'), null, 'follow type must not use Full children')
  const fullBefore = business(await plan(page), '19', 'tos', 'Full')
  await clickAria(page, '添加业务节点 维护阶段')
  await fill(page, '业务节点名称', '16.3.0.180', false)
  await clickText(page, '确认添加')
  await page.waitForSelector('button[aria-label="修改业务节点 16.3.0.180"]')
  await fill(page, 'planStartDate 16.3.0.180', '2026-11-02')
  await fill(page, 'planEndDate 16.3.0.180', '2026-11-15')
  assert.deepEqual(business(await plan(page), '19', 'tos', 'Full'), fullBefore, 'follower edit does not modify Full')
  await version(page, 'V4 (修订中)')
  assert.equal(await page.$('button[aria-label="修改业务节点 16.3.0.180"]'), null)
  assert.equal(await page.$('input[aria-label="planStartDate 16.3.0.180"]'), null)
  assert.ok((await page.$eval('.pms-level1-tree-table', node => node.innerText)).includes('16.3.0.180'))
  await scope(page, 'Full')
  await clickAria(page, '发布')
  await page.waitForSelector('button[aria-label="创建修订"]', { visible: true })
  console.log('switch Slim'); await scope(page, 'Slim')
  await fill(page, 'planEndDate 16.3.0.180', '2026-11-16')
  const state = await plan(page)
  const history = state.publishedSnapshots['project::19::tos-type::Slim::level1::v3::snapshot']
  assert.equal(history.find(task => task.taskName === '16.3.0.180').planEndDate, '2026-11-15', 'follow history freezes when source publishes')
  assert.equal(business(state, '19', 'tos', 'Slim').find(task => task.taskName === '16.3.0.180').planEndDate, '2026-11-16')
  console.log('select published version'); await version(page, 'V3 (已发布)')
  assert.ok((await page.$eval('.pms-level1-tree-table', node => node.innerText)).includes('2026-11-15'))
  await page.reload({ waitUntil: 'networkidle2' })
  assert.equal(business(await plan(page), '19', 'tos', 'Slim').find(task => task.taskName === '16.3.0.180').planEndDate, '2026-11-16')
  console.log('PASS followed type independent latest-only maintenance, draft read-only, publish history and refresh')
  await openPlan(page, 'DEMO017-DEMOCHIP001_DEMOBOARD016')
  assert.equal(await page.$('button[aria-label="添加业务节点 上市阶段"]'), null)
  assert.equal(await page.$('input[aria-label="planStartDate MR1"]'), null)
  await clickAria(page, '发布')
  await page.waitForSelector('button[aria-label="创建修订"]', { visible: true })
  assert.equal(await page.$('input[aria-label="planStartDate MR1"]'), null, 'publishing keeps generated MR dates readonly')
  const machineState = await plan(page)
  const op = business(machineState, '1', 'market', 'OP')
  const tr = business(machineState, '1', 'market', 'TR')
  assert.ok(op.length >= 2, 'machine MR generated without opening MR')
  assert.notDeepEqual(op.map(row => row.planStartDate), tr.map(row => row.planStartDate), 'follow market owns dates')
  const stages = machineState.level1BusinessTasksByScope[JSON.stringify(['1', 'market', 'OP'])]
  assert.ok(stages['machine-stage-launch'].length && stages['machine-stage-lifecycle'].length)
  console.log('select published version'); await version(page, 'V3 (已发布)')
  assert.equal(await page.$('button[aria-label="添加业务节点 生命周期阶段"]'), null)
  await scope(page, 'TR')
  assert.equal(await page.$('input[aria-label="planStartDate MR1"]'), null)
  await clickText(page, '三级计划-MR版本计划')
  await page.waitForSelector('.pms-machine-mr-table')
  const headers = await page.$$eval('.pms-machine-mr-table thead th', cells => cells.map(cell => cell.textContent.trim()))
  assert.deepEqual(headers.slice(0, 3), ['tOS版本号', 'MR号', '活动序号'])
  assert.ok((await page.$eval('.pms-machine-mr-table', node => node.innerText)).includes('MR1'))
  await page.$eval('input[aria-label="横版视图"]', input => input.closest('label').click())
  const horizontal = await page.$$eval('.pms-machine-mr-table thead tr:first-child th', cells => cells.map(cell => cell.textContent.trim()))
  assert.deepEqual(horizontal.slice(0, 3), ['tOS版本号', 'MR号', '市场项目'])
  const peer = await createPage()
  const firstVersion = await page.$eval('tr[data-mr-tos-version]', row => row.dataset.mrTosVersion)
  await peer.evaluate(version => {
    const key = 'pms-mr-version-plan-store', saved = JSON.parse(localStorage.getItem(key))
    const plan = saved.state.machinePlansByKey['1::' + version]
    plan.transferType = 'N/A'; plan.dates = {}
    localStorage.setItem(key, JSON.stringify(saved))
  }, firstVersion)
  await peer.close()
  await page.waitForFunction(version => !document.querySelector(`tr[data-mr-tos-version="${version}"]`), {}, firstVersion)
  await clickText(page, '一级计划')
  const changed = business(await plan(page), '1', 'market', 'TR')
  assert.equal(changed.length, tr.length - 1)
  assert.deepEqual(changed.map(row => row.taskName), changed.map((_, index) => `MR${index + 1}`))
  fs.writeFileSync(path.join(output, 'machine-independent-mr.txt'), await page.evaluate(() => document.body.innerText))
  assert.deepEqual(errors, [])
  console.log('PASS machine automatic phases, market isolation, readonly latest/draft, both MR columns, N/A removal; ' + output)
} catch (error) {
  console.error(error)
  for (const [i, page] of (await browser.pages()).entries()) {

    fs.writeFileSync(path.join(output, `failure-${i}.txt`), await page.evaluate(() => document.body.innerText).catch(() => ''))
  }
  console.error('Failure evidence: ' + output)
  throw error
} finally { await browser.close() }
