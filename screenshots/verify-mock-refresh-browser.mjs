#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import puppeteer from 'puppeteer'
import { loadTypeScriptModule, projectRoot } from '../scripts/lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const { MOCK_DATASET_VERSION, MOCK_DATASET_VERSION_STORAGE_KEY } = loadTypeScriptModule(root, 'src/lib/mockDatasetStorage.ts')
const base = process.env.PMS_BASE_URL || 'http://127.0.0.1:3017'
const output = process.env.PMS_MOCK_OUTPUT || 'output/mock-refresh-20260908/browser'
fs.mkdirSync(output, { recursive: true })
const browser = await puppeteer.launch({ headless: true, protocolTimeout: 30000, args: ['--disable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] })
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
const errors = [], checks = []
page.on('pageerror', error => errors.push(String(error)))
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`) })
const click = async (text, selector = 'button,[role="menuitem"],.ant-segmented-item') => {
  await page.waitForFunction(({ text, selector }) => [...document.querySelectorAll(selector)].some(e => e.getBoundingClientRect().height && e.textContent.trim() === text), { polling: 100 }, { text, selector })
  await page.evaluate(({ text, selector }) => [...document.querySelectorAll(selector)].find(e => e.getBoundingClientRect().height && e.textContent.trim() === text).click(), { text, selector })
}
const openSeries = async () => {
  await click('配置中心', '[role="menuitem"]')
  await click('枚举值配置', '.ant-segmented-item')
  await page.waitForSelector('[data-testid="enum-type-product-series"]')
  await page.$eval('[data-testid="enum-type-product-series"]', e => e.click())
  await page.waitForFunction(() => document.querySelector('[data-testid="enum-type-product-series"]')?.getAttribute('aria-current') === 'page', { polling: 100 })
}
try {
  await page.goto(base, { waitUntil: 'networkidle0' })
  await page.evaluate(markerKey => {
    const keys = ['pms-projects', 'pms-project-permissions', 'pms-plan-store', 'pms-enum-values', 'pms-project-roadmap', 'pms-technical-projects', 'pms-technical-plans', 'pms-mr-version-plan-store', 'pms-level3-plan-store', 'pms_roadmap_milestone_views', 'pms_project_custom_views', 'pms:project-creation-draft:old-user', 'pms:project-summary:v1:old-user', 'pms%3Aproject-field-visibility%3Av1:old-user:project-a:basic']
    keys.forEach(key => localStorage.setItem(key, 'LEGACY_PRIVATE_FIXTURE'))
    localStorage.setItem('another-app:keep', 'unrelated data')
    localStorage.removeItem(markerKey)
    sessionStorage.setItem('pms:technical-project-list-target-child', 'LEGACY_PRIVATE_FIXTURE')
    sessionStorage.setItem('another-app:keep', 'unrelated session')
    sessionStorage.removeItem(markerKey)
  }, MOCK_DATASET_VERSION_STORAGE_KEY)
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('[data-current-user="演示用户01"]')
  const refreshed = await page.evaluate(markerKey => ({
    legacyKeys: Object.keys(localStorage).filter(key => localStorage.getItem(key)?.includes('LEGACY_PRIVATE_FIXTURE')),
    marker: localStorage.getItem(markerKey), unrelated: localStorage.getItem('another-app:keep'),
    sessionTarget: sessionStorage.getItem('pms:technical-project-list-target-child'), unrelatedSession: sessionStorage.getItem('another-app:keep'),
    body: document.body.innerText,
  }), MOCK_DATASET_VERSION_STORAGE_KEY)
  assert.deepEqual(refreshed.legacyKeys, [])
  assert.equal(refreshed.marker, MOCK_DATASET_VERSION)
  assert.equal(refreshed.unrelated, 'unrelated data')
  assert.equal(refreshed.sessionTarget, null)
  assert.equal(refreshed.unrelatedSession, 'unrelated session')
  assert.ok(refreshed.body.includes('虚构演示数据'))
  assert.ok(!refreshed.body.includes('LEGACY_PRIVATE_FIXTURE'))
  checks.push('旧项目、权限、计划、路标、枚举、草稿及视图在读取前刷新；保留其他应用数据')
  console.log('PASS old storage refresh')

  await openSeries()
  await page.$eval('[data-testid="enum-add-button"]', e => e.click())
  await page.waitForSelector('input[aria-label="产品系列"]', { visible: true })
  await page.type('input[aria-label="产品系列"]', '示例刷新后新增系列')
  await click('新增', '.ant-modal-footer button')
  await page.waitForFunction(() => document.body.innerText.includes('配置值已新增'), { polling: 100 })
  await page.reload({ waitUntil: 'networkidle0' })
  await openSeries()
  await page.waitForFunction(() => [...document.querySelectorAll('tbody')].some(e => e.innerText.includes('示例刷新后新增系列')), { polling: 100 })
  checks.push('刷新后新增的演示枚举在再次加载后保留')
  console.log('PASS current edits survive reload')
  await page.bringToFront()
  await new Promise(resolve => setTimeout(resolve, 400))
  await page.screenshot({ path: `${output}/persisted-demo-edit.png` })

  await click('项目列表', '[role="menuitem"]')
  await page.waitForSelector('[aria-label="卡片视图"]')
  await page.click('[aria-label="卡片视图"]')
  await page.waitForSelector('[aria-label="打开项目 1"]')
  await page.click('[aria-label="打开项目 1"]')
  await page.waitForSelector('[aria-label="项目空间导航"]')
  const projectText = await page.evaluate(() => document.body.innerText)
  assert.ok(projectText.includes('DEMO017-DEMOCHIP001_DEMOBOARD016'))
  assert.ok(projectText.includes('演示用户'))
  checks.push('整机项目空间显示同一虚构项目与人员')
  await page.bringToFront()
  await new Promise(resolve => setTimeout(resolve, 400))
  await page.screenshot({ path: `${output}/fictional-project.png` })
  assert.deepEqual(errors, [], 'no browser runtime or HTTP errors')
  fs.writeFileSync(`${output}/result.json`, JSON.stringify({ base, datasetVersion: MOCK_DATASET_VERSION, checks, errors }, null, 2))
  console.log(JSON.stringify({ checks, errors }, null, 2))
} finally { await browser.close() }
