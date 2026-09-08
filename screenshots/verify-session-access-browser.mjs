import assert from 'node:assert/strict'
import fs from 'node:fs'
import puppeteer from 'puppeteer'

const base = process.env.PMS_BASE_URL || 'http://127.0.0.1:3017'
const output = 'output/audit-20260907/session-access'
fs.mkdirSync(output, { recursive: true })
const browser = await puppeteer.launch({ headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
const errors = []
page.on('pageerror', error => errors.push(String(error)))
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`) })
const clickText = async (text, selector = 'button,[role="menuitem"]') => {
  const clicked = await page.evaluate(({ text, selector }) => {
    const target = [...document.querySelectorAll(selector)].find(element => (
      element.getBoundingClientRect().height > 0 && element.textContent?.trim() === text
    ))
    target?.click()
    return Boolean(target)
  }, { text, selector })
  assert.ok(clicked, `visible control ${text}`)
}
const switchUser = async user => {
  await page.$eval('[aria-label="切换当前用户"]', button => button.click())
  await page.waitForSelector('.pms-user-menu__name', { visible: true })
  await page.evaluate(user => [...document.querySelectorAll('.pms-user-menu__name')]
    .find(element => element.textContent.trim() === user)?.closest('[role="menuitem"]')?.click(), user)
  await page.waitForFunction(user => document.querySelector('[data-current-user]')?.getAttribute('data-current-user') === user, {}, user)
}
const openProject = async id => {
  await clickText('项目列表')
  await page.waitForSelector('[aria-label="卡片视图"]')
  await page.click('[aria-label="卡片视图"]')
  await page.waitForSelector(`[aria-label="打开项目 ${id}"]`)
  await page.click(`[aria-label="打开项目 ${id}"]`)
  await page.waitForSelector('[aria-label="项目空间导航"]')
}
const checks = []
try {
  await page.goto(base, { waitUntil: 'networkidle0' })
  await openProject('3')
  await switchUser('演示用户09')
  await page.waitForFunction(() => document.body.innerText.includes('当前用户未配置该项目空间角色'), { timeout: 4000 })
  assert.equal(await page.$('[aria-label="项目空间导航"]'), null, 'nonmember project content unmounted immediately')
  assert.equal(await page.evaluate(() => document.body.innerText.includes('DEMO013_DEMOBOARD010')), false, 'no prior project details leaked')
  checks.push('进入项目后切换非成员：项目内容不可见')
  await page.screenshot({ path: `${output}/nonmember.png` })

  await clickText('返回项目列表')
  await switchUser('演示用户02')
  await openProject('1')
  const action = await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(element => element.textContent.trim() === '申请转维')
    return { exists: !!button, disabled: button?.disabled }
  })
  assert.deepEqual(action, { exists: true, disabled: true }, 'read-only member cannot apply for transfer')
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('[role="menuitem"]')]
    .find(element => element.textContent.trim() === '计划')?.getAttribute('aria-disabled')), 'true')
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('[role="menuitem"]')]
    .find(element => element.textContent.trim() === '权限配置')?.getAttribute('aria-disabled')), 'true')
  assert.equal(await page.$('[aria-label="一级计划横版"]'), null, 'plan data is hidden without data permission')
  checks.push('普通成员：转维、计划与角色配置权限生效')
  await page.screenshot({ path: `${output}/read-only.png` })

  await switchUser('演示用户09')
  await page.waitForSelector('.pms-project-info-core-actions')
  await clickText('编辑', '.pms-project-info-core-actions button')
  await page.waitForSelector('[role="dialog"]')
  await switchUser('演示用户02')
  assert.equal(await page.$('[role="dialog"]'), null, 'identity switch unmounts prior member edit modal')
  checks.push('成员切换：旧编辑弹窗关闭，不能借用前一个用户权限')
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ checks, errors }, null, 2))
} finally {
  fs.writeFileSync(`${output}/result.json`, JSON.stringify({ checks, errors }, null, 2))
  await browser.close()
}
